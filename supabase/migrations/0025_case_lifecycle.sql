-- =============================================================================
-- 0025 — Case lifecycle (Recruitment Operations, 0025 Step 1).
--
-- Decisions: docs/0025-DISCOVERY.md §2–§4, answered 28–29 Sep 2026 ("0025 Step 1 —
-- FINAL DECISIONS"). Design and test map: docs/CASE-LIFECYCLE.md.
--
--   1. Stages. The recruitment pipeline is exactly ten stages, New Lead → … → Joined.
--      'legacy_imported' and 'lost' are removed (no case has ever used either; refused
--      otherwise). Lost is an outcome (status), not a stage. Stage definitions change
--      only by migration: the settings.manage write policies on pipelines and
--      pipeline_stages are dropped and the API write privileges revoked.
--   2. Movement. One stage forward, or one back with a reason. Anything else is an
--      explicit exceptional move by ADMIN or SUPER_ADMIN, with a reason. Joined needs
--      cases.stage.change AND cases.close, and is the only route to status 'won'.
--      A closed case does not move; it is reopened first. Stage gates have a hook
--      (case_stage_gate) and no gate yet.
--   3. Outcomes. lost and cancelled each need a reason from their own fixed list;
--      'other' needs a note. Closing cancels the case's open tasks (never deletes).
--      Reopening needs cases.close and a reason, and returns the case to the last
--      active stage stored at closure (for a won case: the stage before Joined).
--   4. Permissions, separately: cases.update (title, priority, value…),
--      cases.stage.change, cases.assign, cases.close (close and reopen). The last three
--      act only through move_case_stage / close_case / reopen_case / assign_case.
--      OPERATIONS_MANAGER loses cases.close and cases.assign (TRAVEL_MANAGER was
--      retired in 0019 and holds nothing).
--   5. Ownership. An open case's owner is active, in the case's branch, of an eligible
--      role (SUPER_ADMIN, ADMIN, HR_MANAGER, RECRUITER) and able to view the case.
--      A staff member who owns open cases cannot be deactivated, moved to another
--      branch, given an ineligible role or removed until the cases are reassigned.
--      Closed cases keep their historical owner.
--   6. Creation. Every new case starts open at its pipeline's first stage (New Lead),
--      whoever writes it. Conversion is unchanged and already does exactly that.
--
-- WHY THE NEW OBJECTS
--   cases.closed_by        who closed it (closed_at alone does not say).
--   cases.close_reason     the fixed-list reason key a lost or cancelled case needs.
--   cases.close_note       the note "Other" needs (and optional context otherwise).
--   cases.reopen_stage_id  D9: the last non-terminal stage before closure, stored at
--                          closure, because a won case's stage_id is then Joined.
--   Four functions         the only way to carry a reason and check the right
--                          permission; a plain column update can do neither.
--
-- TRUSTED PATH
--   The four functions are SECURITY DEFINER: each re-checks the caller's session, the
--   case's visibility and its own permission at the row's scope, then sets the
--   transaction-local app.case_lifecycle = 'on' around its write. cases_lifecycle_guard
--   refuses a change to stage, pipeline, type or closure columns without it — for every
--   writer, service role included. A client cannot set the setting (PostgREST exposes
--   no way to), the same assumption as 0015 and 0023.
--
-- DATA: no case row is rewritten. The 28–29 Sep preflight (production: one case, open,
-- New Lead, owner SUPER_ADMIN in its branch; staging: none) satisfies every rule below;
-- section 0 refuses to run otherwise.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Guard: refuse, changing nothing, if existing data would violate the new rules.
-- -----------------------------------------------------------------------------
do $$
declare n bigint;
begin
  select count(*) into n
    from public.cases c join public.pipeline_stages s on s.id = c.stage_id
   where s.key in ('legacy_imported', 'lost');
  if n > 0 then
    raise exception '0025 refuses to run: % case(s) sit on the legacy_imported or Lost stage. Decide where they go first.', n;
  end if;

  select count(*) into n from public.cases where status <> 'open';
  if n > 0 then
    raise exception '0025 refuses to run: % case(s) are already closed without the closure details 0025 requires. Review them first.', n;
  end if;

  select count(*) into n
    from public.cases c join public.pipeline_stages s on s.id = c.stage_id
   where s.pipeline_id <> c.pipeline_id or s.is_won;
  if n > 0 then
    raise exception '0025 refuses to run: % open case(s) sit on a stage of another pipeline or on Joined.', n;
  end if;

  select count(*) into n
    from public.cases c join public.staff_users su on su.id = c.owner_id
   where c.deleted_at is null
     and (not su.is_active or su.branch_id is distinct from c.branch_id
          or su.role_key <> all (array['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'RECRUITER']));
  if n > 0 then
    raise exception '0025 refuses to run: % open case(s) have an owner who would not be eligible. Reassign them first.', n;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 1. The ten stages. Keys are kept ('new' … 'completed'), so conversion and every
--    reference keep working; only the two unused stages go.
-- -----------------------------------------------------------------------------
select public.write_audit_log(
  'system', null, null, 'pipeline_stages.retire', 'settings', s.id,
  jsonb_build_object('pipeline', p.name, 'key', s.key, 'name', s.name, 'position', s.position,
                     'is_won', s.is_won, 'is_lost', s.is_lost),
  null)
  from public.pipeline_stages s join public.pipelines p on p.id = s.pipeline_id
 where p.case_type = 'recruitment' and s.key in ('legacy_imported', 'lost');

delete from public.pipeline_stages s
 using public.pipelines p
 where p.id = s.pipeline_id and p.case_type = 'recruitment' and s.key in ('legacy_imported', 'lost');

do $$
begin
  if (select array_agg(s.key order by s.position)
        from public.pipeline_stages s join public.pipelines p on p.id = s.pipeline_id
       where p.case_type = 'recruitment' and p.is_default)
     is distinct from array['new', 'contacted', 'documents', 'screening', 'interview',
                            'selected', 'processing', 'visa', 'travel', 'completed'] then
    raise exception '0025: the recruitment pipeline is not the expected ten stages after removal. Nothing was changed.';
  end if;
  if (select count(*) from public.pipeline_stages s join public.pipelines p on p.id = s.pipeline_id
       where p.case_type = 'recruitment' and p.is_default and s.is_won) <> 1 then
    raise exception '0025: the recruitment pipeline must have exactly one won stage (Joined).';
  end if;
end $$;

-- Stage definitions change only by migration.
drop policy if exists "settings manage stages" on public.pipeline_stages;
drop policy if exists "settings manage pipelines" on public.pipelines;
revoke insert, update, delete on table public.pipeline_stages, public.pipelines from authenticated;

-- -----------------------------------------------------------------------------
-- 2. Closure state on cases.
-- -----------------------------------------------------------------------------
-- The fixed reason lists (D3.2 / final decisions 14–15). Keys are stored; labels are
-- shown. Returns null for a key that is not on the outcome's list.
create or replace function public.case_close_reason_label(p_outcome text, p_reason text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_outcome
    when 'lost' then case p_reason
      when 'candidate_withdrew'             then 'Candidate withdrew'
      when 'candidate_unresponsive'         then 'Candidate unavailable/unresponsive'
      when 'not_selected_by_employer'       then 'Not selected by employer'
      when 'failed_screening'               then 'Failed screening'
      when 'failed_medical'                 then 'Failed medical'
      when 'visa_refused'                   then 'Visa refused'
      when 'employer_cancelled_requirement' then 'Employer cancelled requirement'
      when 'position_filled'                then 'Position filled'
      when 'duplicate'                      then 'Duplicate application/case'
      when 'fees_payment_issue'             then 'Fees/payment issue'
      when 'other'                          then 'Other'
    end
    when 'cancelled' then case p_reason
      when 'client_cancelled_requirement'   then 'Employer/client cancelled requirement'
      when 'position_no_longer_available'   then 'Position no longer available'
      when 'position_filled'                then 'Position filled'
      when 'duplicate_case'                 then 'Duplicate case'
      when 'created_in_error'               then 'Created in error'
      when 'superseded'                     then 'Case superseded/replaced'
      when 'wrong_branch_intake'            then 'Wrong branch/intake'
      when 'recruitment_not_required'       then 'Recruitment no longer required'
      when 'administrative_correction'      then 'Administrative correction'
      when 'other'                          then 'Other'
    end
  end
$$;

alter table public.cases
  add column if not exists closed_by       uuid references public.staff_users(id) on delete set null,
  add column if not exists close_reason    text,
  add column if not exists close_note      text,
  add column if not exists reopen_stage_id uuid references public.pipeline_stages(id);

alter table public.cases
  add constraint cases_closure_consistent check (
       (status = 'open' and closed_at is null and closed_by is null and close_reason is null
        and close_note is null and reopen_stage_id is null)
    or (status <> 'open' and closed_at is not null and reopen_stage_id is not null)
  ),
  add constraint cases_close_reason_valid check (
    case when status in ('lost', 'cancelled')
         then public.case_close_reason_label(status::text, close_reason) is not null
         else close_reason is null end
  ),
  add constraint cases_close_note_valid check (
        (close_reason is distinct from 'other' or nullif(btrim(close_note), '') is not null)
    and (close_note is null or length(close_note) <= 1000)
  );

comment on column public.cases.close_reason is
  'Why a lost or cancelled case closed: a key from case_close_reason_label(). Internal only — never candidate-visible (0025).';
comment on column public.cases.reopen_stage_id is
  'The last non-terminal stage before closure; reopen_case() returns the case there (0025).';

-- -----------------------------------------------------------------------------
-- 3. Ownership eligibility.
-- -----------------------------------------------------------------------------
-- has_perm for a given role rather than the caller. Used to ask whether a would-be
-- owner can see a case, including for a role the staff member is about to be given.
create or replace function public.role_has_perm(p_role text, perm text, required_scope text default 'all')
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.roles r
     where r.key = p_role
       and (r.is_super or exists (
             select 1
               from public.role_permissions rp
               join public.permissions p on p.id = rp.permission_id
              where rp.role_key = r.key
                and p.key = perm
                and case required_scope
                      when 'own'    then rp.scope in ('own', 'branch', 'all')
                      when 'branch' then rp.scope in ('branch', 'all')
                      else               rp.scope = 'all'
                    end))
  );
$$;

-- Why a staff member with these attributes may not own an open case in p_case_branch,
-- or null when they may. "Able to view the case" is asked at own scope: as its owner,
-- an own-scope role sees it; branch and all scope include own.
create or replace function public.case_owner_problem_for(p_role text, p_active boolean, p_staff_branch uuid, p_case_branch uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when not coalesce(p_active, false) then 'owner_inactive'
    when p_role is null or p_role <> all (array['SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'RECRUITER']) then 'owner_role_not_eligible'
    when p_staff_branch is distinct from p_case_branch then 'owner_other_branch'
    when not public.role_has_perm(p_role, 'cases.view', 'own') then 'owner_cannot_view'
  end
$$;

create or replace function public.case_owner_problem(p_owner uuid, p_case_branch uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select public.case_owner_problem_for(su.role_key, su.is_active, su.branch_id, p_case_branch)
       from public.staff_users su where su.id = p_owner),
    case when exists (select 1 from public.staff_users su where su.id = p_owner) then null else 'owner_not_found' end)
$$;

-- -----------------------------------------------------------------------------
-- 4. The lifecycle guard — every writer.
-- -----------------------------------------------------------------------------
-- Stage gates (D2.4): the reason a move may not happen yet, or null. No gate exists in
-- Step 1; interviews, offers and documents add theirs when they exist.
create or replace function public.case_stage_gate(p_case uuid, p_from_stage uuid, p_to_stage uuid)
returns text
language sql
stable
set search_path = ''
as $$
  select null::text
$$;

create or replace function public.cases_lifecycle_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  via_function boolean := coalesce(current_setting('app.case_lifecycle', true), '') = 'on';
  first_stage  uuid;
  stage_won    boolean;
  problem      text;
begin
  if tg_op = 'INSERT' then
    if new.status is distinct from 'open' or new.closed_at is not null or new.closed_by is not null
       or new.close_reason is not null or new.close_note is not null or new.reopen_stage_id is not null then
      raise exception 'case_must_start_open: a new case starts open' using errcode = 'check_violation';
    end if;
    if not exists (select 1 from public.pipelines p
                    where p.id = new.pipeline_id and p.case_type = new.case_type and p.is_active) then
      raise exception 'case_pipeline_mismatch: a case uses an active pipeline of its own type' using errcode = 'check_violation';
    end if;
    select s.id into first_stage from public.pipeline_stages s
     where s.pipeline_id = new.pipeline_id order by s.position limit 1;
    if new.stage_id is distinct from first_stage then
      raise exception 'case_must_start_at_first_stage: a new case starts at the first stage (New Lead)' using errcode = 'check_violation';
    end if;
    if new.owner_id is not null then
      problem := public.case_owner_problem(new.owner_id, new.branch_id);
      if problem is not null then
        raise exception 'case_owner_invalid: %', problem using errcode = 'check_violation';
      end if;
      -- A staff member hands a new case to someone else only with cases.assign.
      if public.untrusted_staff_write() and new.owner_id is distinct from public.current_staff_id()
         and not public.scope_allows('cases.assign', new.branch_id, new.owner_id) then
        raise exception 'case_assign_requires_permission: only staff who assign cases open one for someone else'
          using errcode = 'insufficient_privilege';
      end if;
    end if;
    return new;
  end if;

  -- UPDATE. Stage, pipeline, type and closure change only inside the lifecycle functions.
  if not via_function
     and (new.pipeline_id, new.stage_id, new.case_type, new.status, new.closed_at, new.closed_by,
          new.close_reason, new.close_note, new.reopen_stage_id)
         is distinct from
         (old.pipeline_id, old.stage_id, old.case_type, old.status, old.closed_at, old.closed_by,
          old.close_reason, old.close_note, old.reopen_stage_id) then
    raise exception 'case_lifecycle_via_functions: stage and status change only through move_case_stage, close_case and reopen_case'
      using errcode = 'insufficient_privilege';
  end if;

  -- Invariants, for the functions too.
  if (new.pipeline_id, new.stage_id, new.case_type) is distinct from (old.pipeline_id, old.stage_id, old.case_type) then
    if not exists (select 1 from public.pipeline_stages s join public.pipelines p on p.id = s.pipeline_id
                    where s.id = new.stage_id and p.id = new.pipeline_id and p.case_type = new.case_type) then
      raise exception 'stage_not_in_pipeline: the stage belongs to another pipeline' using errcode = 'check_violation';
    end if;
  end if;
  if old.status <> 'open' and new.status <> 'open' and new.stage_id is distinct from old.stage_id then
    raise exception 'case_closed_reopen_first: a closed case is reopened before it moves' using errcode = 'check_violation';
  end if;
  select s.is_won into stage_won from public.pipeline_stages s where s.id = new.stage_id;
  if coalesce(stage_won, false) <> (new.status = 'won') then
    raise exception 'joined_is_won: Joined is the only won stage, and a won case is at Joined' using errcode = 'check_violation';
  end if;

  -- An open case's owner is valid when it is set or when the case reopens.
  if new.status = 'open' and new.owner_id is not null
     and (new.owner_id is distinct from old.owner_id or old.status <> 'open' or new.branch_id is distinct from old.branch_id) then
    problem := public.case_owner_problem(new.owner_id, new.branch_id);
    if problem is not null then
      raise exception 'case_owner_invalid: %', problem using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists cases_lifecycle_guard_trg on public.cases;
create trigger cases_lifecycle_guard_trg
  before insert or update on public.cases
  for each row execute function public.cases_lifecycle_guard();

-- Staff see and change owners and lifecycle only through the functions below.
revoke update on table public.cases from authenticated;
grant update (id, case_number, contact_id, title, branch_id, value_amount_paise, priority, source_id,
              legacy_id, opened_at, stage_entered_at, created_at, updated_at, deleted_at, created_by)
  on table public.cases to authenticated;

-- -----------------------------------------------------------------------------
-- 5. A staff member who owns open cases keeps a valid ownership until reassigned.
-- -----------------------------------------------------------------------------
create or replace function public.staff_users_case_owner_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare n bigint;
begin
  if tg_op = 'DELETE' then
    select count(*) into n from public.cases where owner_id = old.id and status = 'open' and deleted_at is null;
    if n > 0 then
      raise exception 'staff_owns_open_cases: reassign % open case(s) before removing this staff member', n
        using errcode = 'check_violation';
    end if;
    return old;
  end if;

  if (new.is_active, new.branch_id, new.role_key) is not distinct from (old.is_active, old.branch_id, old.role_key) then
    return new;
  end if;
  select count(*) into n from public.cases c
   where c.owner_id = new.id and c.status = 'open' and c.deleted_at is null
     and public.case_owner_problem_for(new.role_key, new.is_active, new.branch_id, c.branch_id) is not null;
  if n > 0 then
    raise exception 'staff_owns_open_cases: reassign % open case(s) before this change', n
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists staff_users_case_owner_guard_trg on public.staff_users;
create trigger staff_users_case_owner_guard_trg
  before update of is_active, branch_id, role_key or delete on public.staff_users
  for each row execute function public.staff_users_case_owner_guard();

-- -----------------------------------------------------------------------------
-- 6. The lifecycle functions.
-- -----------------------------------------------------------------------------
-- Move a case one stage forward, one back (with a reason), or — ADMIN and SUPER_ADMIN
-- only, with a reason — anywhere as an explicit exceptional move. Joined closes it as won.
create or replace function public.move_case_stage(p_case uuid, p_stage_key text, p_reason text default null, p_exceptional boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  staff     uuid := public.current_staff_id();
  k         public.cases%rowtype;
  cur       public.pipeline_stages%rowtype;
  target    public.pipeline_stages%rowtype;
  cur_ord   int;
  to_ord    int;
  reason    text := nullif(btrim(coalesce(p_reason, '')), '');
  direction text;
  gate      text;
begin
  if staff is null then
    raise exception 'staff_session_required' using errcode = 'insufficient_privilege';
  end if;
  select * into k from public.cases where id = p_case and deleted_at is null for update;
  if not found or not public.scope_allows('cases.view', k.branch_id, k.owner_id) then
    raise exception 'case_not_found' using errcode = 'no_data_found';
  end if;
  if not public.scope_allows('cases.stage.change', k.branch_id, k.owner_id) then
    raise exception 'case_stage_change_requires_permission: you cannot move this case' using errcode = 'insufficient_privilege';
  end if;
  if k.status <> 'open' then
    raise exception 'case_closed_reopen_first: a closed case is reopened before it moves' using errcode = 'check_violation';
  end if;
  if length(reason) > 1000 then
    raise exception 'reason_too_long: keep the reason under 1000 characters' using errcode = 'check_violation';
  end if;

  select * into cur from public.pipeline_stages where id = k.stage_id;
  select * into target from public.pipeline_stages where pipeline_id = k.pipeline_id and key = p_stage_key;
  if not found then
    raise exception 'stage_not_in_pipeline: that stage is not part of this case''s pipeline' using errcode = 'check_violation';
  end if;
  if target.id = cur.id then
    raise exception 'stage_unchanged: the case is already at that stage' using errcode = 'check_violation';
  end if;
  select count(*) into cur_ord from public.pipeline_stages where pipeline_id = k.pipeline_id and position <= cur.position;
  select count(*) into to_ord  from public.pipeline_stages where pipeline_id = k.pipeline_id and position <= target.position;

  if coalesce(p_exceptional, false) then
    if not exists (select 1 from public.staff_users su
                    where su.id = staff and su.is_active and su.role_key in ('ADMIN', 'SUPER_ADMIN')) then
      raise exception 'exceptional_move_admin_only: only ADMIN and SUPER_ADMIN make an exceptional stage move'
        using errcode = 'insufficient_privilege';
    end if;
    if reason is null then
      raise exception 'reason_required: an exceptional move needs a reason' using errcode = 'check_violation';
    end if;
    direction := 'exceptional';
  elsif to_ord = cur_ord + 1 then
    direction := 'forward';
  elsif to_ord = cur_ord - 1 then
    if reason is null then
      raise exception 'reason_required: moving a case back needs a reason' using errcode = 'check_violation';
    end if;
    direction := 'backward';
  else
    raise exception 'stage_skip_not_allowed: a case moves one stage at a time' using errcode = 'check_violation';
  end if;

  if target.is_won and not public.scope_allows('cases.close', k.branch_id, k.owner_id) then
    raise exception 'joined_requires_close_permission: moving a case to Joined closes it, which needs cases.close'
      using errcode = 'insufficient_privilege';
  end if;
  gate := public.case_stage_gate(k.id, cur.id, target.id);
  if gate is not null then
    raise exception 'stage_gate: %', gate using errcode = 'check_violation';
  end if;

  perform set_config('app.case_lifecycle', 'on', true);
  if target.is_won then
    update public.cases
       set stage_id = target.id, status = 'won', closed_at = now(), closed_by = staff, reopen_stage_id = cur.id
     where id = k.id;
  else
    update public.cases set stage_id = target.id where id = k.id;
  end if;
  perform set_config('app.case_lifecycle', '', true);

  perform public.log_activity(
    k.contact_id, k.id, 'staff', staff, 'case.stage_changed',
    'Stage: ' || cur.name || ' → ' || target.name
      || case direction when 'backward' then ' (moved back)' when 'exceptional' then ' (exceptional move)' else '' end,
    'case', k.id,
    jsonb_build_object('from', cur.key, 'to', target.key, 'direction', direction, 'reason', reason));
  perform public.write_audit_log(
    'staff', staff, null, 'case.stage_changed', 'cases', k.id,
    jsonb_build_object('stage', cur.key, 'status', k.status),
    jsonb_build_object('stage', target.key, 'status', case when target.is_won then 'won' else 'open' end,
                       'direction', direction, 'reason', reason));
  if target.is_won then
    perform public.log_activity(k.contact_id, k.id, 'staff', staff, 'case.closed',
      'Closed as won: joined', 'case', k.id, jsonb_build_object('outcome', 'won'));
  end if;

  return jsonb_build_object('case_id', k.id, 'from', cur.key, 'to', target.key, 'direction', direction,
                            'status', case when target.is_won then 'won' else 'open' end);
end;
$$;

-- Close an open case as lost or cancelled, with a reason from that outcome's list.
-- Its open tasks are cancelled; done and cancelled tasks are left as they are.
create or replace function public.close_case(p_case uuid, p_outcome text, p_reason text, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  staff    uuid := public.current_staff_id();
  k        public.cases%rowtype;
  note     text := nullif(btrim(coalesce(p_note, '')), '');
  label    text;
  n_tasks  int;
begin
  if staff is null then
    raise exception 'staff_session_required' using errcode = 'insufficient_privilege';
  end if;
  select * into k from public.cases where id = p_case and deleted_at is null for update;
  if not found or not public.scope_allows('cases.view', k.branch_id, k.owner_id) then
    raise exception 'case_not_found' using errcode = 'no_data_found';
  end if;
  if not public.scope_allows('cases.close', k.branch_id, k.owner_id) then
    raise exception 'case_close_requires_permission: you cannot close this case' using errcode = 'insufficient_privilege';
  end if;
  if k.status <> 'open' then
    raise exception 'case_already_closed: this case is already closed' using errcode = 'check_violation';
  end if;
  if p_outcome = 'won' then
    raise exception 'won_only_via_joined: a case is won by moving it to Joined' using errcode = 'check_violation';
  end if;
  if p_outcome is null or p_outcome not in ('lost', 'cancelled') then
    raise exception 'close_outcome_invalid: close a case as lost or cancelled' using errcode = 'check_violation';
  end if;
  label := public.case_close_reason_label(p_outcome, p_reason);
  if label is null then
    raise exception 'close_reason_invalid: choose a reason from the list' using errcode = 'check_violation';
  end if;
  if p_reason = 'other' and note is null then
    raise exception 'close_note_required: "Other" needs a note' using errcode = 'check_violation';
  end if;
  if length(note) > 1000 then
    raise exception 'reason_too_long: keep the note under 1000 characters' using errcode = 'check_violation';
  end if;

  perform set_config('app.case_lifecycle', 'on', true);
  update public.cases
     set status = p_outcome::public.case_status, closed_at = now(), closed_by = staff,
         close_reason = p_reason, close_note = note, reopen_stage_id = k.stage_id
   where id = k.id;
  perform set_config('app.case_lifecycle', '', true);

  update public.tasks set status = 'cancelled'
   where case_id = k.id and status in ('open', 'in_progress');
  get diagnostics n_tasks = row_count;

  perform public.log_activity(
    k.contact_id, k.id, 'staff', staff, 'case.closed',
    'Closed as ' || p_outcome || ': ' || label
      || case when n_tasks > 0 then ' (' || n_tasks || ' open task' || case when n_tasks = 1 then '' else 's' end || ' cancelled)' else '' end,
    'case', k.id,
    jsonb_build_object('outcome', p_outcome, 'reason', p_reason, 'tasks_cancelled', n_tasks));
  perform public.write_audit_log(
    'staff', staff, null, 'case.closed', 'cases', k.id,
    jsonb_build_object('status', k.status),
    jsonb_build_object('status', p_outcome, 'reason', p_reason, 'note', note, 'tasks_cancelled', n_tasks));

  return jsonb_build_object('case_id', k.id, 'status', p_outcome, 'tasks_cancelled', n_tasks);
end;
$$;

-- Reopen a closed case at the last active stage stored at closure. Cancelled tasks stay
-- cancelled. An owner who is no longer eligible must be replaced first (assign_case).
create or replace function public.reopen_case(p_case uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  staff    uuid := public.current_staff_id();
  k        public.cases%rowtype;
  reason   text := nullif(btrim(coalesce(p_reason, '')), '');
  target   public.pipeline_stages%rowtype;
begin
  if staff is null then
    raise exception 'staff_session_required' using errcode = 'insufficient_privilege';
  end if;
  select * into k from public.cases where id = p_case and deleted_at is null for update;
  if not found or not public.scope_allows('cases.view', k.branch_id, k.owner_id) then
    raise exception 'case_not_found' using errcode = 'no_data_found';
  end if;
  if not public.scope_allows('cases.close', k.branch_id, k.owner_id) then
    raise exception 'case_reopen_requires_permission: you cannot reopen this case' using errcode = 'insufficient_privilege';
  end if;
  if k.status = 'open' then
    raise exception 'case_not_closed: this case is already open' using errcode = 'check_violation';
  end if;
  if reason is null then
    raise exception 'reason_required: reopening a case needs a reason' using errcode = 'check_violation';
  end if;
  if length(reason) > 1000 then
    raise exception 'reason_too_long: keep the reason under 1000 characters' using errcode = 'check_violation';
  end if;
  if k.owner_id is not null and public.case_owner_problem(k.owner_id, k.branch_id) is not null then
    raise exception 'case_owner_invalid_reassign_first: the owner can no longer own an open case; assign another owner first'
      using errcode = 'check_violation';
  end if;

  select * into target from public.pipeline_stages where id = k.reopen_stage_id and pipeline_id = k.pipeline_id and not is_won;
  if not found then
    raise exception 'reopen_stage_missing: the stage to return to is not recorded' using errcode = 'check_violation';
  end if;

  perform set_config('app.case_lifecycle', 'on', true);
  update public.cases
     set status = 'open', stage_id = target.id, closed_at = null, closed_by = null,
         close_reason = null, close_note = null, reopen_stage_id = null
   where id = k.id;
  perform set_config('app.case_lifecycle', '', true);

  perform public.log_activity(
    k.contact_id, k.id, 'staff', staff, 'case.reopened',
    'Reopened (was ' || k.status || ') at ' || target.name,
    'case', k.id,
    jsonb_build_object('previous_status', k.status, 'stage', target.key, 'reason', reason));
  perform public.write_audit_log(
    'staff', staff, null, 'case.reopened', 'cases', k.id,
    jsonb_build_object('status', k.status, 'close_reason', k.close_reason),
    jsonb_build_object('status', 'open', 'stage', target.key, 'reason', reason));

  return jsonb_build_object('case_id', k.id, 'status', 'open', 'stage', target.key);
end;
$$;

-- Give a case to an owner, or leave it unassigned (null). Needs cases.assign at the
-- case's scope; the new owner must be eligible for the case.
create or replace function public.assign_case(p_case uuid, p_owner uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  staff     uuid := public.current_staff_id();
  k         public.cases%rowtype;
  problem   text;
  old_name  text;
  new_name  text;
begin
  if staff is null then
    raise exception 'staff_session_required' using errcode = 'insufficient_privilege';
  end if;
  select * into k from public.cases where id = p_case and deleted_at is null for update;
  if not found or not public.scope_allows('cases.view', k.branch_id, k.owner_id) then
    raise exception 'case_not_found' using errcode = 'no_data_found';
  end if;
  if not public.scope_allows('cases.assign', k.branch_id, k.owner_id) then
    raise exception 'case_assign_requires_permission: you cannot assign this case' using errcode = 'insufficient_privilege';
  end if;
  if p_owner is not distinct from k.owner_id then
    return jsonb_build_object('case_id', k.id, 'owner_id', k.owner_id, 'unchanged', true);
  end if;
  if p_owner is not null then
    problem := public.case_owner_problem(p_owner, k.branch_id);
    if problem is not null then
      raise exception 'case_owner_invalid: %', problem using errcode = 'check_violation';
    end if;
  end if;

  update public.cases set owner_id = p_owner where id = k.id;

  select full_name into old_name from public.staff_users where id = k.owner_id;
  select full_name into new_name from public.staff_users where id = p_owner;
  perform public.log_activity(
    k.contact_id, k.id, 'staff', staff, 'case.assigned',
    'Owner: ' || coalesce(old_name, 'unassigned') || ' → ' || coalesce(new_name, 'unassigned'),
    'case', k.id,
    jsonb_build_object('from', k.owner_id, 'to', p_owner));
  perform public.write_audit_log(
    'staff', staff, null, 'case.assigned', 'cases', k.id,
    jsonb_build_object('owner_id', k.owner_id), jsonb_build_object('owner_id', p_owner));

  return jsonb_build_object('case_id', k.id, 'owner_id', p_owner, 'unchanged', false);
end;
$$;

-- -----------------------------------------------------------------------------
-- 7. Role grants: close and assign stay with SUPER_ADMIN, ADMIN (all) and HR_MANAGER
--    (branch). OPERATIONS_MANAGER loses both. Audited by the role_permissions trigger.
-- -----------------------------------------------------------------------------
delete from public.role_permissions rp
 using public.permissions p
 where rp.permission_id = p.id
   and rp.role_key in ('OPERATIONS_MANAGER', 'TRAVEL_MANAGER')
   and p.key in ('cases.close', 'cases.assign');

-- -----------------------------------------------------------------------------
-- 8. Function privileges.
-- -----------------------------------------------------------------------------
revoke execute on function
  public.move_case_stage(uuid, text, text, boolean),
  public.close_case(uuid, text, text, text),
  public.reopen_case(uuid, text),
  public.assign_case(uuid, uuid)
from public, anon;
grant execute on function
  public.move_case_stage(uuid, text, text, boolean),
  public.close_case(uuid, text, text, text),
  public.reopen_case(uuid, text),
  public.assign_case(uuid, uuid)
to authenticated, service_role;

-- Called from the SECURITY INVOKER guard and the check constraint under the caller's
-- privileges; they reveal only whether a colleague may own a case, and a reason label.
revoke execute on function
  public.case_owner_problem(uuid, uuid),
  public.case_close_reason_label(text, text)
from public, anon;
grant execute on function
  public.case_owner_problem(uuid, uuid),
  public.case_close_reason_label(text, text)
to authenticated, service_role;

revoke execute on function
  public.role_has_perm(text, text, text),
  public.case_owner_problem_for(text, boolean, uuid, uuid),
  public.case_stage_gate(uuid, uuid, uuid),
  public.cases_lifecycle_guard(),
  public.staff_users_case_owner_guard()
from public, anon, authenticated;
