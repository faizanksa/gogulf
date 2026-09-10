-- =============================================================================
-- 0009 — Security hardening found by semantic validation (Phase 1.6).
--
-- Migrations 0002–0008 parse cleanly, and they all APPLY cleanly to a fresh
-- Postgres 17 / Supabase database. Running real queries against them as each
-- role, however, found defects no parser can see. Each is fixed here rather than
-- by editing 0002–0008, which are already published on the `staging` branch.
--
--   1. A hardened trigger could not resolve the `citext` type, so EVERY insert
--      into contact_identities failed — identity resolution was broken outright.
--   2. The API roles held no SELECT/INSERT/UPDATE/DELETE on any platform table
--      (Supabase no longer auto-grants), so every RLS policy was unreachable —
--      yet anon and authenticated DID hold TRUNCATE, which bypasses RLS.
--   3. Every SECURITY DEFINER function was executable by anon, including ones
--      that forge audit and timeline entries and one that reveals whether a
--      phone number belongs to a customer.
--   4. Audit partitions had RLS disabled: closed today only by accident of (2),
--      wide open the moment table grants were added.
--   5. The notes read policy checked the permission but not the row's scope.
--   6. ADMIN could promote itself to SUPER_ADMIN through users.manage.
--   7. INSERT policies did not constrain branch/owner, and staff could append
--      timeline entries — as anyone — to contacts outside their scope.
--   8. The UPDATE policies on contacts and cases had a WITH CHECK that allowed
--      only `all` and `branch` scope, so own-scope staff — every recruiter and
--      travel agent — could never edit their own records. Found by a positive
--      control; an all-deny test suite would have passed right over it.
--
-- Verified by supabase/tests/rbac-behaviour.test.sql against local Supabase.
-- Additive, idempotent. Touches nothing in public.job_applications.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Identity sync trigger: no unqualified extension type under search_path ''.
--    The explicit ::citext cast is dropped; assigning text to the citext column
--    uses citext's assignment cast, which is found by type OID, so this works
--    whichever schema the extension lives in.
-- -----------------------------------------------------------------------------
create or replace function public.contacts_sync_primary_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_contact uuid;
begin
  target_contact := coalesce(new.contact_id, old.contact_id);

  update public.contacts c set
    primary_phone_e164 = (
      select ci.value_normalized from public.contact_identities ci
      where ci.contact_id = target_contact and ci.type = 'phone'
      order by ci.is_primary desc, ci.verified_at nulls last, ci.created_at
      limit 1
    ),
    primary_email = (
      select ci.value_normalized from public.contact_identities ci
      where ci.contact_id = target_contact and ci.type = 'email'
      order by ci.is_primary desc, ci.verified_at nulls last, ci.created_at
      limit 1
    )
  where c.id = target_contact;

  return null;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. Table privileges — explicit and least-privilege.
--
--    Privileges decide whether a role may touch a table at all; RLS decides
--    which rows. Both layers are needed. anon gets nothing on platform tables.
--    TRUNCATE, TRIGGER and REFERENCES are granted to no API role.
-- -----------------------------------------------------------------------------
revoke all on table
  public.branches, public.roles, public.permissions, public.role_permissions,
  public.staff_users, public.settings, public.contacts, public.contact_identities,
  public.contact_merges, public.pipelines, public.pipeline_stages, public.cases,
  public.case_recruitment, public.case_travel, public.case_visa,
  public.activities, public.tasks, public.notes, public.audit_logs,
  public.audit_logs_2026, public.audit_logs_2027, public.audit_logs_default
from anon, authenticated, service_role;

grant select, insert, update, delete on table
  public.branches, public.roles, public.role_permissions, public.staff_users,
  public.settings, public.contacts, public.contact_identities, public.pipelines,
  public.pipeline_stages, public.cases, public.case_recruitment, public.case_travel,
  public.case_visa, public.tasks, public.notes
to authenticated, service_role;

-- The permission catalogue is seeded by migration and read-only to users.
grant select on table public.permissions to authenticated;
grant select, insert, update, delete on table public.permissions to service_role;

-- Append-only tables: the privilege layer enforces it too, not just the absence
-- of an UPDATE/DELETE policy. This binds service_role as well, which bypasses RLS.
grant select, insert on table public.contact_merges, public.activities to authenticated, service_role;

-- Audit: readable through its policy; written only by SECURITY DEFINER triggers.
-- service_role may add entries for system events but never alter one.
grant select on table public.audit_logs to authenticated;
grant select, insert on table public.audit_logs to service_role;

-- The staff directory was fully revoked in 0006 for the JWT hook's benefit;
-- the hook's own grant to supabase_auth_admin is unaffected by the above.

grant usage on sequence public.case_number_seq to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3. Function execution.
--
--    PostgreSQL grants EXECUTE to PUBLIC by default. For a SECURITY DEFINER
--    function that is a way round every policy, so each is closed explicitly.
--    Lists are explicit (not "all functions in schema") because citext installs
--    its own operator functions into public, and revoking those would break
--    ordinary case-insensitive email comparisons.
-- -----------------------------------------------------------------------------

-- System-only: never callable through the API by a signed-in user or visitor.
-- The server calls these with the service role, from webhooks and jobs.
revoke execute on function
  public.write_audit_log(text, uuid, text, text, text, uuid, jsonb, jsonb, inet, text),
  public.log_activity(uuid, uuid, text, uuid, text, text, text, uuid, jsonb),
  public.resolve_contact(text, text, text)
from public, anon, authenticated;
grant execute on function
  public.write_audit_log(text, uuid, text, text, text, uuid, jsonb, jsonb, inet, text),
  public.log_activity(uuid, uuid, text, uuid, text, text, text, uuid, jsonb),
  public.resolve_contact(text, text, text)
to service_role;

-- Trigger functions and seed helpers: no API role needs them. (A trigger fires
-- regardless of the caller's EXECUTE right; that right is checked only when the
-- trigger is created.)
revoke execute on function
  public.audit_table_change(),
  public.contacts_sync_primary_identity(),
  public.contact_identities_normalize(),
  public.cases_touch_stage_entered(),
  public.set_updated_at(),
  public.grant_perm(text, text, text),
  public.redact_audit_payload(jsonb)
from public, anon, authenticated;

-- Policy helpers: evaluated by policies that apply `to authenticated` only.
revoke execute on function
  public.has_perm(text, text),
  public.scope_allows(text, uuid, uuid),
  public.is_staff(),
  public.current_staff_id(),
  public.current_branch_id(),
  public.current_role_key(),
  public.current_contact_id(),
  public.next_case_number(public.case_type),
  public.normalize_phone_e164(text, text),
  public.normalize_email(text),
  public.normalize_wa_id(text)
from public, anon;
grant execute on function
  public.has_perm(text, text),
  public.scope_allows(text, uuid, uuid),
  public.is_staff(),
  public.current_staff_id(),
  public.current_branch_id(),
  public.current_role_key(),
  public.current_contact_id(),
  public.next_case_number(public.case_type),
  public.normalize_phone_e164(text, text),
  public.normalize_email(text),
  public.normalize_wa_id(text)
to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 4. Audit trail: partitions closed in their own right, and immutable even to
--    the table owner.
-- -----------------------------------------------------------------------------

-- RLS on a partitioned parent does not protect a partition queried directly.
alter table public.audit_logs_2026    enable row level security;
alter table public.audit_logs_2027    enable row level security;
alter table public.audit_logs_default enable row level security;

-- Policies and privileges bind API roles; the table owner bypasses RLS. This
-- trigger holds for EVERY role, owner included. Retention is unaffected: an old
-- year is removed by dropping its partition, which is not an UPDATE or DELETE.
create or replace function public.audit_logs_reject_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit_logs is append-only: % is not permitted', tg_op
    using errcode = 'insufficient_privilege';
end;
$$;

drop trigger if exists audit_logs_immutable on public.audit_logs;
create trigger audit_logs_immutable
  before update or delete on public.audit_logs
  for each row execute function public.audit_logs_reject_mutation();

revoke execute on function public.audit_logs_reject_mutation() from public, anon, authenticated;

-- Future partitions are created through this, so a new year cannot be added
-- without RLS or with API grants — the defect found above cannot recur.
create or replace function public.ensure_audit_partition(p_year int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  part text := format('audit_logs_%s', p_year);
begin
  execute format(
    'create table if not exists public.%I partition of public.audit_logs for values from (%L) to (%L)',
    part, make_date(p_year, 1, 1), make_date(p_year + 1, 1, 1));
  execute format('alter table public.%I enable row level security', part);
  execute format('revoke all on table public.%I from anon, authenticated, service_role', part);
end;
$$;

revoke execute on function public.ensure_audit_partition(int) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 5. Notes: the permission AND the row's scope, via the parent contact.
-- -----------------------------------------------------------------------------
create or replace function public.note_view_permission(p_visibility text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_visibility
           when 'team'            then 'notes.team.view'
           when 'hr_private'      then 'notes.hr_private.view'
           when 'finance_private' then 'notes.finance_private.view'
         end;
$$;
revoke execute on function public.note_view_permission(text) from public, anon;
grant execute on function public.note_view_permission(text) to authenticated, service_role;

drop policy if exists "staff read notes" on public.notes;
create policy "staff read notes" on public.notes
  for select to authenticated
  using (
    exists (
      select 1 from public.contacts c
       where c.id = notes.contact_id
         and public.scope_allows(public.note_view_permission(notes.visibility), c.branch_id, c.owner_id)
    )
  );

-- Writing a note: onto a contact in your scope, as yourself, and into a private
-- channel only if you could read that channel.
drop policy if exists "staff write notes" on public.notes;
create policy "staff write notes" on public.notes
  for insert to authenticated
  with check (
    author_id = public.current_staff_id()
    and exists (
      select 1 from public.contacts c
       where c.id = notes.contact_id
         and public.scope_allows('notes.team.create', c.branch_id, c.owner_id)
         and public.scope_allows(public.note_view_permission(notes.visibility), c.branch_id, c.owner_id)
    )
  );

-- -----------------------------------------------------------------------------
-- 6. Staff administration: users.manage cannot mint or touch a SUPER_ADMIN, and
--    an administrator cannot edit their own staff record. Only roles.manage
--    (SUPER_ADMIN alone) is unrestricted.
-- -----------------------------------------------------------------------------
drop policy if exists "users.manage writes staff" on public.staff_users;

create policy "roles.manage writes staff" on public.staff_users
  for all to authenticated
  using (public.has_perm('roles.manage'))
  with check (public.has_perm('roles.manage'));

create policy "users.manage creates staff" on public.staff_users
  for insert to authenticated
  with check (public.has_perm('users.manage') and role_key <> 'SUPER_ADMIN');

create policy "users.manage updates staff" on public.staff_users
  for update to authenticated
  using (
    public.has_perm('users.manage')
    and role_key <> 'SUPER_ADMIN'
    and id <> public.current_staff_id()
  )
  with check (
    public.has_perm('users.manage')
    and role_key <> 'SUPER_ADMIN'
    and id <> public.current_staff_id()
  );

create policy "users.manage removes staff" on public.staff_users
  for delete to authenticated
  using (
    public.has_perm('users.manage')
    and role_key <> 'SUPER_ADMIN'
    and id <> public.current_staff_id()
  );

-- -----------------------------------------------------------------------------
-- 7. Creation stays inside the creator's scope.
--    `own` scope means you create records you own (or tasks assigned to you);
--    `branch` scope means records in your branch.
-- -----------------------------------------------------------------------------
drop policy if exists "staff create contacts" on public.contacts;
create policy "staff create contacts" on public.contacts
  for insert to authenticated
  with check (public.scope_allows('contacts.create', branch_id, owner_id));

-- UPDATE: the new row must still be inside the editor's scope. This is what
-- lets a recruiter edit their own candidate while still preventing them from
-- handing it to someone else, and a branch manager from moving it out of branch.
drop policy if exists "staff update contacts" on public.contacts;
create policy "staff update contacts" on public.contacts
  for update to authenticated
  using (public.scope_allows('contacts.update', branch_id, owner_id))
  with check (public.scope_allows('contacts.update', branch_id, owner_id));

drop policy if exists "staff update cases" on public.cases;
create policy "staff update cases" on public.cases
  for update to authenticated
  using (public.scope_allows('cases.update', branch_id, owner_id))
  with check (public.scope_allows('cases.update', branch_id, owner_id));

drop policy if exists "staff create cases" on public.cases;
create policy "staff create cases" on public.cases
  for insert to authenticated
  with check (
    public.scope_allows('cases.create', branch_id, owner_id)
    and exists (
      select 1 from public.contacts c
       where c.id = cases.contact_id
         and public.scope_allows('contacts.view', c.branch_id, c.owner_id)
    )
  );

drop policy if exists "staff write tasks" on public.tasks;
create policy "staff write tasks" on public.tasks
  for all to authenticated
  using (public.scope_allows('tasks.manage', branch_id, assignee_id))
  with check (public.scope_allows('tasks.manage', branch_id, assignee_id));

-- Timeline entries: as yourself, onto a contact you can see.
drop policy if exists "staff append activities" on public.activities;
create policy "staff append activities" on public.activities
  for insert to authenticated
  with check (
    actor_type = 'staff'
    and actor_id = public.current_staff_id()
    and exists (
      select 1 from public.contacts c
       where c.id = activities.contact_id
         and public.scope_allows('contacts.view', c.branch_id, c.owner_id)
    )
  );
