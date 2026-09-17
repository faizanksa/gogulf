-- =============================================================================
-- 0013 — Applications bridge: job → application → contact → case.
--
-- job_applications has been a write-only inbox since 0001: the public form
-- inserts, and staff read rows in the Supabase dashboard. This migration makes it
-- part of the CRM without creating a second identity model beside contacts:
--
--   JOB ──< APPLICATION ──> CONTACT ──< CASE (recruitment) ──< ACTIVITIES
--
--   * An application may name the job it is for (job_id). Applications to a job
--     that is not open — a draft, a closed or expired job, a paid-access job —
--     are refused at the door (job_applications_intake).
--   * An application has its own triage status, separate from the job's
--     lifecycle and from the case's pipeline stage. Closing or archiving a job
--     never touches its applications: job_id is ON DELETE RESTRICT and nothing
--     here updates applications when a job changes.
--   * Converting an application creates — or finds — the one contact for that
--     person and opens a recruitment case, in a single transaction
--     (convert_job_application). It runs with the caller's own rights, so RLS
--     decides what a staff member may create, exactly as it would for any other
--     write. There is no privileged side door.
--   * Staff read applications and their documents under applications.screen,
--     scoped by branch and assignee. A passport is readable only with
--     documents.view.identity, a CV with documents.view.employment.
--
-- WHAT THE PUBLIC FORM MAY WRITE is narrowed from the whole row (0011) to the
-- columns it actually sends. anon cannot set a status, an assignee, a branch, a
-- contact or a case on its own application.
--
-- This table holds live applicant data in production. Every change here is
-- additive: new nullable columns (status has a constant default, which is a
-- catalogue-only change in PostgreSQL 11+ and does not rewrite the table), new
-- policies, narrower privileges. No existing row is modified.
-- =============================================================================

do $$ begin
  create type public.application_status as enum ('new', 'screening', 'converted', 'rejected', 'withdrawn');
exception when duplicate_object then null; end $$;

alter table public.job_applications
  add column if not exists job_id            uuid references public.jobs(id) on delete restrict,
  add column if not exists status            public.application_status not null default 'new',
  add column if not exists assignee_id       uuid references public.staff_users(id) on delete set null,
  add column if not exists branch_id         uuid references public.branches(id),
  add column if not exists contact_id        uuid references public.contacts(id) on delete set null,
  add column if not exists case_id           uuid references public.cases(id) on delete set null,
  add column if not exists status_changed_at timestamptz,
  add column if not exists updated_at        timestamptz not null default now();

create index if not exists job_applications_job_idx      on public.job_applications (job_id, created_at desc);
create index if not exists job_applications_status_idx   on public.job_applications (status, created_at desc);
create index if not exists job_applications_contact_idx  on public.job_applications (contact_id);
create index if not exists job_applications_case_idx     on public.job_applications (case_id);
create index if not exists job_applications_assignee_idx on public.job_applications (assignee_id);

-- The job a recruitment case is about. Declared in 0004 without a target.
alter table public.case_recruitment drop constraint if exists case_recruitment_job_fk;
alter table public.case_recruitment
  add constraint case_recruitment_job_fk foreign key (job_id) references public.jobs(id) on delete restrict;
create index if not exists case_recruitment_job_idx on public.case_recruitment (job_id);

-- -----------------------------------------------------------------------------
-- Intake. SECURITY DEFINER: it runs for the anonymous applicant, and must read
-- the job's status whatever columns anon can see.
-- -----------------------------------------------------------------------------
create or replace function public.job_applications_intake()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  j record;
begin
  if new.job_id is not null then
    select id, title, status, application_access, availability, closes_on, branch_id
      into j
      from public.jobs
     where id = new.job_id;

    if j.id is null then
      raise exception 'job_not_found' using errcode = 'foreign_key_violation';
    end if;

    if j.status <> 'published'
       or j.application_access <> 'free'
       or (j.availability = 'time_limited'
           and (j.closes_on is null or j.closes_on < (now() at time zone 'Asia/Kolkata')::date)) then
      raise exception 'job_not_accepting_applications' using errcode = 'check_violation';
    end if;

    -- The title staff see is the job's own, not whatever the browser sent.
    new.job_title := j.title;
    new.branch_id := coalesce(new.branch_id, j.branch_id);
  end if;
  return new;
end;
$$;

drop trigger if exists job_applications_intake_trg on public.job_applications;
create trigger job_applications_intake_trg
  before insert on public.job_applications
  for each row execute function public.job_applications_intake();

create or replace function public.job_applications_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  if new.status is distinct from old.status then
    new.status_changed_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists job_applications_touch_trg on public.job_applications;
create trigger job_applications_touch_trg
  before update on public.job_applications
  for each row execute function public.job_applications_touch();

-- -----------------------------------------------------------------------------
-- Audit — triage only. The row holds names, emails, phones and document paths,
-- so it is never copied into the trail wholesale.
-- -----------------------------------------------------------------------------
create or replace function public.job_applications_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor       uuid := nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'app_staff_id', '')::uuid;
  actor_email text;
begin
  if old.status is not distinct from new.status
     and old.assignee_id is not distinct from new.assignee_id
     and old.branch_id is not distinct from new.branch_id
     and old.contact_id is not distinct from new.contact_id
     and old.case_id is not distinct from new.case_id then
    return null;
  end if;

  if actor is not null then
    select su.email::text into actor_email from public.staff_users su where su.id = actor;
  end if;

  perform public.write_audit_log(
    case when actor is not null then 'staff' else 'system' end,
    actor, actor_email,
    case
      when new.status = 'converted' and old.status <> 'converted' then 'job_application.converted'
      when old.status is distinct from new.status then 'job_application.status_changed'
      when old.assignee_id is distinct from new.assignee_id then 'job_application.assigned'
      else 'job_application.updated'
    end,
    'job_application', new.id,
    jsonb_build_object('status', old.status, 'assignee_id', old.assignee_id, 'branch_id', old.branch_id,
                       'contact_id', old.contact_id, 'case_id', old.case_id),
    jsonb_build_object('status', new.status, 'assignee_id', new.assignee_id, 'branch_id', new.branch_id,
                       'contact_id', new.contact_id, 'case_id', new.case_id, 'job_id', new.job_id));
  return null;
end;
$$;

drop trigger if exists job_applications_audit_trg on public.job_applications;
create trigger job_applications_audit_trg
  after update on public.job_applications
  for each row execute function public.job_applications_audit();

-- -----------------------------------------------------------------------------
-- Privileges
-- -----------------------------------------------------------------------------

-- The public form: exactly the columns lib/supabase.js sends, nothing it could
-- use to mark its own application as reviewed or attach it to someone's case.
revoke insert on table public.job_applications from anon;
grant insert (
  id, job_id, job_title, job_country, full_name, email, phone, experience, message,
  cv_path, passport_path, other_paths, page_source
) on table public.job_applications to anon;

-- Staff: read, and triage. What the applicant submitted is a record and is not
-- editable by staff; corrections belong on the contact.
grant select on table public.job_applications to authenticated;
grant update (status, assignee_id, branch_id, contact_id, case_id) on table public.job_applications to authenticated;

-- -----------------------------------------------------------------------------
-- Policies
-- -----------------------------------------------------------------------------
drop policy if exists "staff read applications" on public.job_applications;
create policy "staff read applications" on public.job_applications
  for select to authenticated
  using (public.scope_allows('applications.screen', branch_id, assignee_id));

-- A contact or case may be linked only if the editor can see it.
drop policy if exists "staff triage applications" on public.job_applications;
create policy "staff triage applications" on public.job_applications
  for update to authenticated
  using (public.scope_allows('applications.screen', branch_id, assignee_id))
  with check (
    public.scope_allows('applications.screen', branch_id, assignee_id)
    and (contact_id is null or exists (select 1 from public.contacts c where c.id = job_applications.contact_id))
    and (case_id is null or exists (select 1 from public.cases k where k.id = job_applications.case_id))
  );

-- -----------------------------------------------------------------------------
-- Documents. The storage path must be one this application actually recorded,
-- and the caller must hold the permission for that category of document. Other
-- documents are treated as identity documents: they are often visas or IDs.
-- SECURITY INVOKER, so the application itself must be visible to the caller.
-- -----------------------------------------------------------------------------
create or replace function public.can_view_application_document(p_name text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
      from public.job_applications a
     where a.id::text = split_part(p_name, '/', 1)
       and (p_name = a.cv_path or p_name = a.passport_path or p_name = any (a.other_paths))
       and public.scope_allows(
             case when p_name = a.cv_path then 'documents.view.employment'
                  else 'documents.view.identity' end,
             a.branch_id, a.assignee_id)
  );
$$;

drop policy if exists "staff read application documents" on storage.objects;
create policy "staff read application documents" on storage.objects
  for select to authenticated
  using (bucket_id = 'job-applications' and public.can_view_application_document(name));

-- Who opened which applicant's passport, and when. The staff workspace calls this
-- before it asks Storage for a short-lived signed link; nothing is issued unless it
-- returns true, and the storage policy above checks again when the link is signed.
--
-- SECURITY DEFINER because audit entries are written only by definer functions (0005).
-- That also bypasses RLS on job_applications, so the scope and document permission are
-- re-checked here explicitly, with the same predicates the policies use. The entry
-- names the document kind — never the file name, which applicants often make their own.
create or replace function public.record_document_access(p_path text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.current_staff_id();
  app   record;
  kind  text;
begin
  if actor is null or p_path is null then
    return false;
  end if;

  select a.id, a.cv_path, a.passport_path, a.other_paths, a.branch_id, a.assignee_id
    into app
    from public.job_applications a
   where a.id::text = split_part(p_path, '/', 1);
  if app.id is null then
    return false;
  end if;

  kind := case
            when p_path = app.cv_path then 'cv'
            when p_path = app.passport_path then 'passport'
            when p_path = any (app.other_paths) then 'other'
          end;
  if kind is null
     or not public.scope_allows('applications.screen', app.branch_id, app.assignee_id)
     or not public.scope_allows(case when kind = 'cv' then 'documents.view.employment' else 'documents.view.identity' end,
                                app.branch_id, app.assignee_id) then
    return false;
  end if;

  perform public.write_audit_log(
    'staff', actor, (select su.email::text from public.staff_users su where su.id = actor),
    'document.accessed', 'job_application', app.id, null, jsonb_build_object('document', kind));
  return true;
end;
$$;

-- -----------------------------------------------------------------------------
-- Conversion: application → contact (found or created) → recruitment case.
--
-- Identity resolution follows resolve_contact's deterministic order — phone,
-- then email, exact normalised matches only, shared numbers excluded — but among
-- the contacts the caller can see, because it runs as the caller. A match the
-- caller cannot see surfaces as the unique-identity violation it is, reported as
-- contact_outside_scope, rather than silently creating a duplicate person.
--
-- Idempotent: converting an already converted application returns its links.
-- No consent is recorded: applying for a job is not consent to marketing.
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

  branch := coalesce(app.branch_id, public.current_branch_id());

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

  update public.job_applications
     set contact_id = contact, case_id = new_case, status = 'converted',
         branch_id = coalesce(branch_id, branch)
   where id = app.id;

  insert into public.activities (contact_id, case_id, actor_type, actor_id, verb, entity_type, entity_id, summary, metadata)
  values (contact, new_case, 'staff', staff, 'application.converted', 'job_application', app.id,
          'Application for ' || coalesce(job_name, app.job_title) || ' opened as case ' || case_no,
          jsonb_build_object('application_id', app.id, 'job_id', app.job_id, 'job_reference', job_ref,
                             'contact_created', contact_created));

  return jsonb_build_object('contact_id', contact, 'case_id', new_case, 'case_number', case_no,
                            'contact_created', contact_created, 'already_converted', false);
end;
$$;

-- -----------------------------------------------------------------------------
-- Function privileges
-- -----------------------------------------------------------------------------
revoke execute on function
  public.job_applications_intake(),
  public.job_applications_touch(),
  public.job_applications_audit()
from public, anon, authenticated;

revoke execute on function
  public.can_view_application_document(text),
  public.convert_job_application(uuid),
  public.record_document_access(text)
from public, anon;
grant execute on function
  public.can_view_application_document(text),
  public.convert_job_application(uuid),
  public.record_document_access(text)
to authenticated, service_role;
