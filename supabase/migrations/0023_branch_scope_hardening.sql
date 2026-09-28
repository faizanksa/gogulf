-- =============================================================================
-- 0023 — Branch-scope hardening (Recruitment Operations, increment 4a).
--
-- Closes the gaps in docs/BRANCH-SCOPE-AUDIT.md and the wider matrix built for this
-- migration (docs/BRANCH-SCOPE-HARDENING.md). Write-side only: scope_allows() and the
-- read policies on contacts, cases, jobs, applications and invoices are unchanged.
--
--   1. HR_MANAGER employers.manage: all → branch (decided 28 Sep 2026). employers.view
--      stays all. No other permission changes.
--   2. branch_write_guard — a staff member creates a record in, or moves a record to, a
--      branch other than their own only with the table's permission at ALL scope; moving
--      a record between branches at all needs ALL scope. Ownership never carries a record
--      across branches. On: contacts, cases, job_applications, invoices, jobs.
--      (contacts: 0021 let a branch-scoped assigner pull an owned contact INTO their
--      branch; that is now all-scope too — the one deliberate tightening of 0021.)
--   3. Children follow their parent. A task's and a note's branch is derived from its
--      case, else its contact, for every writer, and follows the parent when an
--      all-scope person moves it. A staff member attaches a task/note only to a case or
--      contact they can see, and the case must belong to that contact.
--   4. Parents are fixed for staff: a case's contact, a note's contact/case, a
--      case_recruitment row's case and an application's contact/case are changed only
--      by the trusted functions (merge_contacts, convert_job_application). An invoice's
--      contact/case must be ones the staff member can see, and must agree.
--   5. Creator fields: tasks.created_by is the creator, frozen; completed_by/at are set
--      by the database; cases gain created_by (set on insert, frozen) and their number,
--      opening and creation times are frozen for staff.
--   6. Tasks are cancelled, never deleted, by staff (no DELETE privilege or policy).
--   7. Audit: case creation (was only update/delete) and every task change.
--   8. Timeline: staff read a case's entries by CASE visibility; candidates read only
--      verbs on an explicit allow-list (empty today); staff can no longer insert
--      entries directly — every entry comes from a database function or trigger.
--      Conversion's entry is now written by a trigger on the application.
--
-- TRUSTED PATHS
--   merge_contacts (SECURITY DEFINER): current_user is its owner, so every staff-only
--   rule here stands aside; merge checks scope itself (0021).
--   convert_job_application (SECURITY INVOKER, runs under the caller's RLS): sets the
--   transaction-local app.trusted_write = 'convert_job_application' around its writes
--   and clears it before returning. That exempts only the branch guard and the
--   application link lock — RLS still applies to every row it touches. A client cannot
--   set the setting (PostgREST exposes no way to), the same assumption as 0015's
--   app.invoice_trusted_transition.
--
-- GUARD: refuses to run if existing tasks or notes disagree with their parents, or a
-- converted application has no case — the 28 Sep preflight found none on staging or
-- production.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Guard.
-- -----------------------------------------------------------------------------
do $$
declare n bigint;
begin
  select count(*) into n from (
    select 1 from public.tasks t join public.cases k on k.id = t.case_id where t.contact_id is not null and t.contact_id <> k.contact_id
    union all select 1 from public.notes n join public.cases k on k.id = n.case_id where n.contact_id is not null and n.contact_id <> k.contact_id
    union all select 1 from public.job_applications where status = 'converted' and case_id is null
    union all select 1 from public.job_applications where (contact_id is not null or case_id is not null) and status <> 'converted'
  ) x;
  if n > 0 then
    raise exception '0023 refuses to run: % task/note/application row(s) disagree with their parent. Run the 0023 preflight and decide first.', n;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 1. HR Manager manages employers of their own branch only.
-- -----------------------------------------------------------------------------
update public.role_permissions rp
   set scope = 'branch'
  from public.permissions p
 where p.id = rp.permission_id and p.key = 'employers.manage'
   and rp.role_key = 'HR_MANAGER' and rp.scope = 'all';

-- -----------------------------------------------------------------------------
-- 2. The shared branch guard.
-- -----------------------------------------------------------------------------
-- True when the current write comes from a staff API session that no trusted function
-- has vouched for. SECURITY INVOKER throughout: current_user is 'authenticated' for a
-- staff request and the owner inside a SECURITY DEFINER function (see 0021).
create or replace function public.untrusted_staff_write()
returns boolean
language sql
stable
set search_path = ''
as $$
  select current_user = 'authenticated'
     and coalesce(current_setting('app.trusted_write', true), '') <> 'convert_job_application'
$$;

-- TG_ARGV[0]: the permission that creates the record; TG_ARGV[1]: the one that moves it.
create or replace function public.branch_write_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.untrusted_staff_write() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.branch_id := coalesce(new.branch_id, public.current_branch_id());
    if new.branch_id is distinct from public.current_branch_id() and not public.has_perm(tg_argv[0], 'all') then
      raise exception 'cross_branch_write_requires_all_scope: only staff working across all branches create a record in another branch'
        using errcode = 'insufficient_privilege';
    end if;
  elsif new.branch_id is distinct from old.branch_id and not public.has_perm(tg_argv[1], 'all') then
    raise exception 'branch_change_requires_all_scope: only staff working across all branches move a record between branches'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

drop trigger if exists contacts_branch_guard on public.contacts;
create trigger contacts_branch_guard
  before insert or update of branch_id on public.contacts
  for each row execute function public.branch_write_guard('contacts.create', 'contacts.assign');

drop trigger if exists cases_branch_guard on public.cases;
create trigger cases_branch_guard
  before insert or update of branch_id on public.cases
  for each row execute function public.branch_write_guard('cases.create', 'cases.update');

drop trigger if exists job_applications_branch_guard on public.job_applications;
create trigger job_applications_branch_guard
  before update of branch_id on public.job_applications
  for each row execute function public.branch_write_guard('applications.screen', 'applications.screen');

drop trigger if exists invoices_branch_guard on public.invoices;
create trigger invoices_branch_guard
  before insert or update of branch_id on public.invoices
  for each row execute function public.branch_write_guard('invoices.issue', 'invoices.issue');

drop trigger if exists jobs_branch_guard on public.jobs;
create trigger jobs_branch_guard
  before insert or update of branch_id on public.jobs
  for each row execute function public.branch_write_guard('jobs.manage', 'jobs.manage');

-- -----------------------------------------------------------------------------
-- 3. Tasks: parent-derived branch, provenance, completion, no deletion.
-- -----------------------------------------------------------------------------
create or replace function public.tasks_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  staff          uuid := public.current_staff_id();
  untrusted      boolean := public.untrusted_staff_write();
  parent_branch  uuid;
  parent_contact uuid;
  derive         boolean;
begin
  if tg_op = 'INSERT' then
    if untrusted or new.created_by is null then
      new.created_by := staff;
    end if;
    derive := true;
  else
    new.id := old.id;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    derive := new.case_id is distinct from old.case_id
           or new.contact_id is distinct from old.contact_id
           or new.branch_id is distinct from old.branch_id;
  end if;

  if derive then
    if new.case_id is not null then
      -- Under the caller's RLS for staff: a case they cannot see is not found.
      select k.branch_id, k.contact_id into parent_branch, parent_contact from public.cases k where k.id = new.case_id;
      if not found then
        raise exception 'task_parent_not_available: attach a task only to a case you can see' using errcode = 'insufficient_privilege';
      end if;
      if new.contact_id is null then
        new.contact_id := parent_contact;
      elsif new.contact_id <> parent_contact then
        raise exception 'task_parent_mismatch: the case belongs to a different contact' using errcode = 'check_violation';
      end if;
    elsif new.contact_id is not null then
      select c.branch_id into parent_branch from public.contacts c where c.id = new.contact_id;
      if not found then
        raise exception 'task_parent_not_available: attach a task only to a contact you can see' using errcode = 'insufficient_privilege';
      end if;
    end if;

    if new.case_id is not null or new.contact_id is not null then
      -- A child's branch is its parent's. Asking for another one is refused, not ignored.
      if untrusted and new.branch_id is distinct from parent_branch
         and (tg_op = 'INSERT' and new.branch_id is not null or tg_op = 'UPDATE' and new.branch_id is distinct from old.branch_id) then
        raise exception 'task_branch_follows_parent: a task''s branch is its case''s or contact''s' using errcode = 'check_violation';
      end if;
      new.branch_id := parent_branch;
    elsif untrusted then
      -- A free-standing task: the ordinary branch rule.
      if tg_op = 'INSERT' then
        new.branch_id := coalesce(new.branch_id, public.current_branch_id());
      end if;
      if (tg_op = 'INSERT' or new.branch_id is distinct from old.branch_id)
         and new.branch_id is distinct from public.current_branch_id()
         and not public.has_perm('tasks.manage', 'all') then
        raise exception 'cross_branch_write_requires_all_scope: only staff working across all branches put a task in another branch'
          using errcode = 'insufficient_privilege';
      end if;
    end if;
  end if;

  -- Completion is recorded by the database, never typed in.
  if new.status = 'done' then
    if tg_op = 'INSERT' or old.status is distinct from 'done' then
      new.completed_at := now();
      new.completed_by := staff;
    else
      new.completed_at := old.completed_at;
      new.completed_by := old.completed_by;
    end if;
  else
    new.completed_at := null;
    new.completed_by := null;
  end if;

  return new;
end;
$$;

drop trigger if exists tasks_before_write_trg on public.tasks;
create trigger tasks_before_write_trg
  before insert or update on public.tasks
  for each row execute function public.tasks_before_write();

drop policy if exists "staff write tasks" on public.tasks;
drop policy if exists "staff create tasks" on public.tasks;
create policy "staff create tasks" on public.tasks
  for insert to authenticated
  with check (public.scope_allows('tasks.manage', branch_id, assignee_id));
drop policy if exists "staff update tasks" on public.tasks;
create policy "staff update tasks" on public.tasks
  for update to authenticated
  using (public.scope_allows('tasks.manage', branch_id, assignee_id))
  with check (public.scope_allows('tasks.manage', branch_id, assignee_id));
-- No DELETE policy, and no DELETE privilege: a task is cancelled (status = 'cancelled').
revoke delete on table public.tasks from authenticated;

drop trigger if exists audit_tasks on public.tasks;
create trigger audit_tasks
  after insert or update or delete on public.tasks
  for each row execute function public.audit_table_change();

-- -----------------------------------------------------------------------------
-- 4. Notes: parent-derived branch; parents and provenance fixed for staff.
-- -----------------------------------------------------------------------------
create or replace function public.notes_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  untrusted      boolean := public.untrusted_staff_write();
  parent_branch  uuid;
  parent_contact uuid;
begin
  if tg_op = 'UPDATE' then
    new.id := old.id;
    new.created_at := old.created_at;
    if untrusted and (new.contact_id is distinct from old.contact_id or new.case_id is distinct from old.case_id) then
      raise exception 'note_parent_locked: a note stays on the contact and case it was written on' using errcode = 'check_violation';
    end if;
  end if;

  if new.case_id is not null then
    select k.branch_id, k.contact_id into parent_branch, parent_contact from public.cases k where k.id = new.case_id;
    if not found then
      raise exception 'note_parent_not_available: write a note only on a case you can see' using errcode = 'insufficient_privilege';
    end if;
    if new.contact_id is null then
      new.contact_id := parent_contact;
    elsif new.contact_id <> parent_contact then
      raise exception 'note_parent_mismatch: the case belongs to a different contact' using errcode = 'check_violation';
    end if;
    new.branch_id := parent_branch;
  elsif new.contact_id is not null then
    select c.branch_id into parent_branch from public.contacts c where c.id = new.contact_id;
    if found then
      new.branch_id := parent_branch;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists notes_before_write_trg on public.notes;
create trigger notes_before_write_trg
  before insert or update on public.notes
  for each row execute function public.notes_before_write();

-- -----------------------------------------------------------------------------
-- 5. Children follow a parent that an all-scope person moves.
-- -----------------------------------------------------------------------------
-- SECURITY DEFINER: the mover may not be able to see every child row, and the children
-- must follow regardless. It only ever copies the parent's own new branch.
create or replace function public.children_follow_branch()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.branch_id is not distinct from old.branch_id then
    return null;
  end if;
  if tg_table_name = 'cases' then
    update public.tasks set branch_id = new.branch_id where case_id = new.id and branch_id is distinct from new.branch_id;
    update public.notes set branch_id = new.branch_id where case_id = new.id and branch_id is distinct from new.branch_id;
  else
    update public.tasks set branch_id = new.branch_id where contact_id = new.id and case_id is null and branch_id is distinct from new.branch_id;
    update public.notes set branch_id = new.branch_id where contact_id = new.id and case_id is null and branch_id is distinct from new.branch_id;
  end if;
  return null;
end;
$$;

drop trigger if exists cases_children_follow_branch on public.cases;
create trigger cases_children_follow_branch
  after update of branch_id on public.cases
  for each row execute function public.children_follow_branch();

drop trigger if exists contacts_children_follow_branch on public.contacts;
create trigger contacts_children_follow_branch
  after update of branch_id on public.contacts
  for each row execute function public.children_follow_branch();

-- -----------------------------------------------------------------------------
-- 6. Cases: creator, frozen provenance, fixed contact.
-- -----------------------------------------------------------------------------
alter table public.cases add column if not exists created_by uuid references public.staff_users(id) on delete set null;

create or replace function public.cases_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(public.current_staff_id(), new.created_by);
    return new;
  end if;

  new.created_by := old.created_by;
  if public.untrusted_staff_write() then
    new.id               := old.id;
    new.case_number      := old.case_number;
    new.created_at       := old.created_at;
    new.opened_at        := old.opened_at;
    new.legacy_id        := old.legacy_id;
    new.stage_entered_at := case when new.stage_id is distinct from old.stage_id then now() else old.stage_entered_at end;
    if new.contact_id is distinct from old.contact_id then
      raise exception 'case_parent_locked: a case moves to another contact only by merging contacts' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists cases_before_write_trg on public.cases;
create trigger cases_before_write_trg
  before insert or update on public.cases
  for each row execute function public.cases_before_write();

-- Case creation is now audited too (0005 covered update and delete only).
drop trigger if exists audit_cases_insert on public.cases;
create trigger audit_cases_insert
  after insert on public.cases
  for each row execute function public.audit_table_change();

-- case_recruitment is the case's own extension: it never changes case.
create or replace function public.case_recruitment_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.created_at := old.created_at;
  if public.untrusted_staff_write() and new.case_id is distinct from old.case_id then
    raise exception 'case_recruitment_parent_locked: recruitment details stay on their case' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists case_recruitment_guard_trg on public.case_recruitment;
create trigger case_recruitment_guard_trg
  before update on public.case_recruitment
  for each row execute function public.case_recruitment_guard();

-- -----------------------------------------------------------------------------
-- 7. Applications are linked to a contact and case by conversion only.
-- -----------------------------------------------------------------------------
create or replace function public.job_applications_link_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.untrusted_staff_write()
     and (new.contact_id is distinct from old.contact_id or new.case_id is distinct from old.case_id) then
    raise exception 'application_link_locked: an application is linked to a contact and case by converting it'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists job_applications_link_guard_trg on public.job_applications;
create trigger job_applications_link_guard_trg
  before update of contact_id, case_id on public.job_applications
  for each row execute function public.job_applications_link_guard();

-- -----------------------------------------------------------------------------
-- 8. Invoices point only at a contact and case the staff member can see.
-- -----------------------------------------------------------------------------
create or replace function public.invoices_parent_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare case_contact uuid;
begin
  if not public.untrusted_staff_write() then
    return new;
  end if;
  if new.contact_id is not null and (tg_op = 'INSERT' or new.contact_id is distinct from old.contact_id)
     and not exists (select 1 from public.contacts c where c.id = new.contact_id) then
    raise exception 'invoice_parent_not_available: bill only a contact you can see' using errcode = 'insufficient_privilege';
  end if;
  if new.case_id is not null and (tg_op = 'INSERT' or new.case_id is distinct from old.case_id or new.contact_id is distinct from old.contact_id) then
    select k.contact_id into case_contact from public.cases k where k.id = new.case_id;
    if not found then
      raise exception 'invoice_parent_not_available: bill only a case you can see' using errcode = 'insufficient_privilege';
    end if;
    if new.contact_id is not null and new.contact_id <> case_contact then
      raise exception 'invoice_parent_mismatch: the case belongs to a different contact' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists invoices_parent_guard_trg on public.invoices;
create trigger invoices_parent_guard_trg
  before insert or update of contact_id, case_id on public.invoices
  for each row execute function public.invoices_parent_guard();

-- -----------------------------------------------------------------------------
-- 9. The timeline.
-- -----------------------------------------------------------------------------
-- Candidate-facing verbs. EMPTY on purpose: employer, merge, conversion, interview, offer
-- and every internal entry stay staff-only. Adding a verb is a migration, approved first.
create or replace function public.activity_is_customer_visible(p_verb text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_verb = any (array[]::text[])
$$;
revoke execute on function public.activity_is_customer_visible(text) from public, anon;
grant execute on function public.activity_is_customer_visible(text) to authenticated, service_role;

drop policy if exists "staff read activities" on public.activities;
create policy "staff read activities" on public.activities
  for select to authenticated
  using (
    case
      when activities.case_id is not null then exists (
        select 1 from public.cases k
         where k.id = activities.case_id and k.deleted_at is null
           and public.scope_allows('cases.view', k.branch_id, k.owner_id))
      else exists (
        select 1 from public.contacts c
         where c.id = activities.contact_id
           and public.scope_allows('contacts.view', c.branch_id, c.owner_id))
    end
  );

drop policy if exists "customer reads own activities" on public.activities;
create policy "customer reads own activities" on public.activities
  for select to authenticated
  using (contact_id = public.current_contact_id() and public.activity_is_customer_visible(verb));

-- Staff write nothing to the timeline directly: log_activity() and the audit triggers do.
drop policy if exists "staff append activities" on public.activities;
revoke insert on table public.activities from authenticated;

-- The conversion entry, written by the database when an application becomes converted.
create or replace function public.job_applications_conversion_timeline()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor      uuid := nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'app_staff_id', '')::uuid;
  case_no    text;
  job_ref    text;
  job_name   text;
  created    boolean;
begin
  if new.status <> 'converted' or old.status = 'converted' or new.case_id is null then
    return null;
  end if;
  select k.case_number into case_no from public.cases k where k.id = new.case_id;
  if new.job_id is not null then
    select jb.reference, jb.title into job_ref, job_name from public.jobs jb where jb.id = new.job_id;
  end if;
  select coalesce(c.first_touch ->> 'application_id' = new.id::text, false) into created
    from public.contacts c where c.id = new.contact_id;

  perform public.log_activity(
    new.contact_id, new.case_id,
    case when actor is not null then 'staff' else 'system' end, actor,
    'application.converted',
    'Application for ' || coalesce(job_name, new.job_title) || ' opened as case ' || case_no,
    'job_application', new.id,
    jsonb_build_object('application_id', new.id, 'job_id', new.job_id, 'job_reference', job_ref,
                       'contact_created', coalesce(created, false)));
  return null;
end;
$$;

drop trigger if exists job_applications_conversion_timeline_trg on public.job_applications;
create trigger job_applications_conversion_timeline_trg
  after update of status on public.job_applications
  for each row execute function public.job_applications_conversion_timeline();

-- -----------------------------------------------------------------------------
-- 10. Conversion: vouch for its own writes, and leave the timeline to the trigger.
--     Unchanged otherwise from 0013 — still SECURITY INVOKER, still under the caller's RLS.
-- -----------------------------------------------------------------------------
create or replace function public.convert_job_application(p_application_id uuid)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  staff           uuid := public.current_staff_id();
  app             public.job_applications%rowtype;
  phone_norm      text;
  email_norm      text;
  contact         uuid;
  contact_created boolean := false;
  branch          uuid;
  pipeline        uuid;
  stage           uuid;
  new_case        uuid;
  case_no         text;
  job_ref         text;
  job_name        text;
begin
  if staff is null then
    raise exception 'staff_session_required' using errcode = 'insufficient_privilege';
  end if;
  if not (public.has_perm('applications.screen', 'own')
          and public.has_perm('contacts.create', 'own')
          and public.has_perm('cases.create', 'own')) then
    raise exception 'permission_denied' using errcode = 'insufficient_privilege';
  end if;

  select * into app from public.job_applications where id = p_application_id for update;
  if not found then
    raise exception 'application_not_found' using errcode = 'no_data_found';
  end if;

  if app.case_id is not null then
    select k.case_number into case_no from public.cases k where k.id = app.case_id;
    return jsonb_build_object('contact_id', app.contact_id, 'case_id', app.case_id,
                              'case_number', case_no, 'contact_created', false, 'already_converted', true);
  end if;

  if app.status in ('rejected', 'withdrawn') then
    raise exception 'application_closed' using errcode = 'check_violation',
      hint = 'Move the application back to screening before converting it.';
  end if;

  phone_norm := public.normalize_phone_e164(app.phone);
  email_norm := public.normalize_email(app.email);

  if phone_norm is not null then
    select ci.contact_id into contact
      from public.contact_identities ci
     where ci.type in ('phone', 'whatsapp_wa_id', 'ivr_caller')
       and ci.value_normalized = phone_norm and not ci.is_shared
     limit 1;
  end if;
  if contact is null and email_norm is not null then
    select ci.contact_id into contact
      from public.contact_identities ci
     where ci.type = 'email' and ci.value_normalized = email_norm and not ci.is_shared
     limit 1;
  end if;

  -- The records land in the application's branch, which the caller did not choose.
  branch := coalesce(app.branch_id, public.current_branch_id());
  perform set_config('app.trusted_write', 'convert_job_application', true);

  if contact is null then
    begin
      insert into public.contacts (full_name, owner_id, branch_id, lifecycle_stage, first_touch)
      values (app.full_name, staff, branch, 'lead',
              jsonb_build_object('channel', 'website_job_application', 'application_id', app.id,
                                 'page_source', app.page_source, 'submitted_at', app.created_at))
      returning id into contact;

      if phone_norm is not null then
        insert into public.contact_identities (contact_id, type, value_raw, is_primary, source)
        values (contact, 'phone', app.phone, true, 'job_application');
      end if;
      if email_norm is not null then
        insert into public.contact_identities (contact_id, type, value_raw, is_primary, source)
        values (contact, 'email', app.email, true, 'job_application');
      end if;
    exception when unique_violation then
      perform set_config('app.trusted_write', '', true);
      raise exception 'contact_outside_scope' using errcode = 'insufficient_privilege',
        hint = 'This applicant already exists as a contact you cannot see. Ask an administrator to convert it.';
    end;
    contact_created := true;
  end if;

  select p.id into pipeline
    from public.pipelines p
   where p.case_type = 'recruitment' and p.is_default and p.is_active
   limit 1;
  select s.id into stage from public.pipeline_stages s where s.pipeline_id = pipeline and s.key = 'new';
  if pipeline is null or stage is null then
    perform set_config('app.trusted_write', '', true);
    raise exception 'recruitment_pipeline_missing' using errcode = 'no_data_found';
  end if;

  if app.job_id is not null then
    select jb.reference, jb.title into job_ref, job_name from public.jobs jb where jb.id = app.job_id;
  end if;

  insert into public.cases (case_number, contact_id, case_type, pipeline_id, stage_id, title, owner_id, branch_id)
  values (public.next_case_number('recruitment'), contact, 'recruitment', pipeline, stage,
          left(coalesce(job_name, app.job_title) || coalesce(' (' || job_ref || ')', ''), 200),
          coalesce(app.assignee_id, staff), branch)
  returning id, case_number into new_case, case_no;

  insert into public.case_recruitment (case_id, job_id, legacy_job_title, legacy_job_country)
  values (new_case, app.job_id,
          case when app.job_id is null then app.job_title end,
          case when app.job_id is null then app.job_country end);

  -- job_applications_conversion_timeline writes the timeline entry for this update.
  update public.job_applications
     set contact_id = contact, case_id = new_case, status = 'converted',
         branch_id = coalesce(branch_id, branch)
   where id = app.id;

  perform set_config('app.trusted_write', '', true);

  return jsonb_build_object('contact_id', contact, 'case_id', new_case, 'case_number', case_no,
                            'contact_created', contact_created, 'already_converted', false);
end;
$$;

-- -----------------------------------------------------------------------------
-- 11. Function privileges. Trigger functions are never called directly.
-- -----------------------------------------------------------------------------
revoke execute on function
  public.branch_write_guard(),
  public.tasks_before_write(),
  public.notes_before_write(),
  public.children_follow_branch(),
  public.cases_before_write(),
  public.case_recruitment_guard(),
  public.job_applications_link_guard(),
  public.invoices_parent_guard(),
  public.job_applications_conversion_timeline()
from public, anon, authenticated;

revoke execute on function public.untrusted_staff_write() from public, anon;
grant execute on function public.untrusted_staff_write() to authenticated, service_role;
