-- =============================================================================
-- 0007 — Row Level Security policies.
--
-- Two audiences, deliberately kept separate:
--
--   STAFF    — permission + scope, via has_perm() / scope_allows().
--   CUSTOMER — own records only, via current_contact_id(). Kept trivially
--              simple, because the one rule that must never fail is
--              "customer A cannot see customer B", and simple rules are
--              provable.
--
-- `anon` gets nothing here. The public website reads no platform table.
--
-- NOTE: this migration does not touch the existing job_applications policies.
-- The live apply form keeps working exactly as it does today; its replacement
-- lands in Phase 5 (see docs/MIGRATION-PLAN.md).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Reference data — readable by any signed-in staff member; writable by few.
-- -----------------------------------------------------------------------------
drop policy if exists "staff read branches" on public.branches;
create policy "staff read branches" on public.branches
  for select to authenticated using (public.is_staff());

drop policy if exists "settings manage branches" on public.branches;
create policy "settings manage branches" on public.branches
  for all to authenticated
  using (public.has_perm('settings.manage')) with check (public.has_perm('settings.manage'));

drop policy if exists "staff read roles" on public.roles;
create policy "staff read roles" on public.roles
  for select to authenticated using (public.is_staff());

drop policy if exists "staff read permissions" on public.permissions;
create policy "staff read permissions" on public.permissions
  for select to authenticated using (public.is_staff());

drop policy if exists "staff read role_permissions" on public.role_permissions;
create policy "staff read role_permissions" on public.role_permissions
  for select to authenticated using (public.is_staff());

-- Only roles.manage (SUPER_ADMIN alone) may change who can do what.
-- This is the privilege-escalation guard: ADMIN can manage users but cannot
-- redefine what a role means, so cannot grant itself more than it has.
drop policy if exists "super admin manages grants" on public.role_permissions;
create policy "super admin manages grants" on public.role_permissions
  for all to authenticated
  using (public.has_perm('roles.manage')) with check (public.has_perm('roles.manage'));

drop policy if exists "super admin manages roles" on public.roles;
create policy "super admin manages roles" on public.roles
  for all to authenticated
  using (public.has_perm('roles.manage')) with check (public.has_perm('roles.manage'));

-- -----------------------------------------------------------------------------
-- Staff users
-- -----------------------------------------------------------------------------
drop policy if exists "staff read colleagues" on public.staff_users;
create policy "staff read colleagues" on public.staff_users
  for select to authenticated
  using (public.is_staff());

drop policy if exists "staff read self" on public.staff_users;
create policy "staff read self" on public.staff_users
  for select to authenticated
  using (auth_user_id = auth.uid());

drop policy if exists "users.manage writes staff" on public.staff_users;
create policy "users.manage writes staff" on public.staff_users
  for all to authenticated
  using (public.has_perm('users.manage')) with check (public.has_perm('users.manage'));

-- -----------------------------------------------------------------------------
-- Settings
-- -----------------------------------------------------------------------------
drop policy if exists "staff read settings" on public.settings;
create policy "staff read settings" on public.settings
  for select to authenticated using (public.is_staff());

drop policy if exists "settings.manage writes settings" on public.settings;
create policy "settings.manage writes settings" on public.settings
  for all to authenticated
  using (public.has_perm('settings.manage')) with check (public.has_perm('settings.manage'));

-- -----------------------------------------------------------------------------
-- Contacts
-- -----------------------------------------------------------------------------
drop policy if exists "staff read contacts" on public.contacts;
create policy "staff read contacts" on public.contacts
  for select to authenticated
  using (deleted_at is null and public.scope_allows('contacts.view', branch_id, owner_id));

drop policy if exists "staff create contacts" on public.contacts;
create policy "staff create contacts" on public.contacts
  for insert to authenticated
  with check (public.has_perm('contacts.create', 'own'));

-- The WITH CHECK clause is the part that is easy to omit and expensive to miss:
-- without it a branch-scoped user could reassign a record to another branch and
-- thereby move data outside the scope that protects it.
drop policy if exists "staff update contacts" on public.contacts;
create policy "staff update contacts" on public.contacts
  for update to authenticated
  using (public.scope_allows('contacts.update', branch_id, owner_id))
  with check (
       public.has_perm('contacts.update', 'all')
    or (public.has_perm('contacts.update', 'branch')
        and branch_id is not distinct from public.current_branch_id())
  );

drop policy if exists "staff delete contacts" on public.contacts;
create policy "staff delete contacts" on public.contacts
  for delete to authenticated using (public.has_perm('contacts.delete'));

-- Customer: their own record, nothing else.
drop policy if exists "customer reads own contact" on public.contacts;
create policy "customer reads own contact" on public.contacts
  for select to authenticated
  using (id = public.current_contact_id() and deleted_at is null);

-- -----------------------------------------------------------------------------
-- Contact identities
-- -----------------------------------------------------------------------------
drop policy if exists "staff read identities" on public.contact_identities;
create policy "staff read identities" on public.contact_identities
  for select to authenticated
  using (exists (
    select 1 from public.contacts c
     where c.id = contact_identities.contact_id
       and public.scope_allows('contacts.view', c.branch_id, c.owner_id)
  ));

drop policy if exists "staff write identities" on public.contact_identities;
create policy "staff write identities" on public.contact_identities
  for all to authenticated
  using (exists (
    select 1 from public.contacts c
     where c.id = contact_identities.contact_id
       and public.scope_allows('contacts.update', c.branch_id, c.owner_id)
  ))
  with check (exists (
    select 1 from public.contacts c
     where c.id = contact_identities.contact_id
       and public.scope_allows('contacts.update', c.branch_id, c.owner_id)
  ));

drop policy if exists "customer reads own identities" on public.contact_identities;
create policy "customer reads own identities" on public.contact_identities
  for select to authenticated
  using (contact_id = public.current_contact_id());

-- Merges are append-only and require an explicit permission.
drop policy if exists "staff read merges" on public.contact_merges;
create policy "staff read merges" on public.contact_merges
  for select to authenticated using (public.has_perm('contacts.merge', 'branch'));

drop policy if exists "staff create merges" on public.contact_merges;
create policy "staff create merges" on public.contact_merges
  for insert to authenticated with check (public.has_perm('contacts.merge', 'own'));

-- -----------------------------------------------------------------------------
-- Pipelines
-- -----------------------------------------------------------------------------
drop policy if exists "staff read pipelines" on public.pipelines;
create policy "staff read pipelines" on public.pipelines
  for select to authenticated using (public.is_staff());

drop policy if exists "settings manage pipelines" on public.pipelines;
create policy "settings manage pipelines" on public.pipelines
  for all to authenticated
  using (public.has_perm('settings.manage')) with check (public.has_perm('settings.manage'));

drop policy if exists "staff read stages" on public.pipeline_stages;
create policy "staff read stages" on public.pipeline_stages
  for select to authenticated using (public.is_staff());

drop policy if exists "settings manage stages" on public.pipeline_stages;
create policy "settings manage stages" on public.pipeline_stages
  for all to authenticated
  using (public.has_perm('settings.manage')) with check (public.has_perm('settings.manage'));

-- Customers need stage names to see where they are in a process.
drop policy if exists "customer reads stages" on public.pipeline_stages;
create policy "customer reads stages" on public.pipeline_stages
  for select to authenticated using (public.current_contact_id() is not null);

-- -----------------------------------------------------------------------------
-- Cases
-- -----------------------------------------------------------------------------
drop policy if exists "staff read cases" on public.cases;
create policy "staff read cases" on public.cases
  for select to authenticated
  using (deleted_at is null and public.scope_allows('cases.view', branch_id, owner_id));

drop policy if exists "staff create cases" on public.cases;
create policy "staff create cases" on public.cases
  for insert to authenticated with check (public.has_perm('cases.create', 'own'));

drop policy if exists "staff update cases" on public.cases;
create policy "staff update cases" on public.cases
  for update to authenticated
  using (public.scope_allows('cases.update', branch_id, owner_id))
  with check (
       public.has_perm('cases.update', 'all')
    or (public.has_perm('cases.update', 'branch')
        and branch_id is not distinct from public.current_branch_id())
  );

drop policy if exists "staff delete cases" on public.cases;
create policy "staff delete cases" on public.cases
  for delete to authenticated using (public.has_perm('cases.delete'));

drop policy if exists "customer reads own cases" on public.cases;
create policy "customer reads own cases" on public.cases
  for select to authenticated
  using (contact_id = public.current_contact_id() and deleted_at is null);

-- Typed extensions inherit the parent case's visibility.
do $$
declare t text;
begin
  foreach t in array array['case_recruitment','case_travel','case_visa'] loop
    execute format('drop policy if exists "staff read %1$s" on public.%1$s', t);
    execute format($f$
      create policy "staff read %1$s" on public.%1$s
        for select to authenticated
        using (exists (select 1 from public.cases c
                        where c.id = %1$s.case_id
                          and public.scope_allows('cases.view', c.branch_id, c.owner_id)))
    $f$, t);

    execute format('drop policy if exists "staff write %1$s" on public.%1$s', t);
    execute format($f$
      create policy "staff write %1$s" on public.%1$s
        for all to authenticated
        using (exists (select 1 from public.cases c
                        where c.id = %1$s.case_id
                          and public.scope_allows('cases.update', c.branch_id, c.owner_id)))
        with check (exists (select 1 from public.cases c
                        where c.id = %1$s.case_id
                          and public.scope_allows('cases.update', c.branch_id, c.owner_id)))
    $f$, t);

    execute format('drop policy if exists "customer reads own %1$s" on public.%1$s', t);
    execute format($f$
      create policy "customer reads own %1$s" on public.%1$s
        for select to authenticated
        using (exists (select 1 from public.cases c
                        where c.id = %1$s.case_id
                          and c.contact_id = public.current_contact_id()))
    $f$, t);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- Activities — append-only. No UPDATE or DELETE policy, for anyone.
-- -----------------------------------------------------------------------------
drop policy if exists "staff read activities" on public.activities;
create policy "staff read activities" on public.activities
  for select to authenticated
  using (exists (
    select 1 from public.contacts c
     where c.id = activities.contact_id
       and public.scope_allows('contacts.view', c.branch_id, c.owner_id)
  ));

drop policy if exists "staff append activities" on public.activities;
create policy "staff append activities" on public.activities
  for insert to authenticated with check (public.is_staff());

-- The customer timeline. Internal-only verbs are filtered out: a customer
-- should see "Documents reviewed", not "Assigned to recruiter X because Y".
drop policy if exists "customer reads own activities" on public.activities;
create policy "customer reads own activities" on public.activities
  for select to authenticated
  using (
    contact_id = public.current_contact_id()
    and verb not like 'internal.%'
    and verb not like 'note.%'
    and verb not like 'assignment.%'
  );

-- -----------------------------------------------------------------------------
-- Tasks — internal only. Customers never see them at all.
-- -----------------------------------------------------------------------------
drop policy if exists "staff read tasks" on public.tasks;
create policy "staff read tasks" on public.tasks
  for select to authenticated
  using (public.scope_allows('tasks.view', branch_id, assignee_id));

drop policy if exists "staff write tasks" on public.tasks;
create policy "staff write tasks" on public.tasks
  for all to authenticated
  using (public.scope_allows('tasks.manage', branch_id, assignee_id))
  with check (public.has_perm('tasks.manage', 'own'));

-- -----------------------------------------------------------------------------
-- Notes — visibility is part of the predicate. This is how Accounts is kept
-- out of private HR assessments and vice versa.
-- -----------------------------------------------------------------------------
drop policy if exists "staff read notes" on public.notes;
create policy "staff read notes" on public.notes
  for select to authenticated
  using (
    case visibility
      when 'team'            then public.has_perm('notes.team.view', 'branch')
      when 'hr_private'      then public.has_perm('notes.hr_private.view', 'branch')
      when 'finance_private' then public.has_perm('notes.finance_private.view', 'branch')
      else false
    end
  );

drop policy if exists "staff write notes" on public.notes;
create policy "staff write notes" on public.notes
  for insert to authenticated with check (public.has_perm('notes.team.create', 'own'));

drop policy if exists "staff edit own notes" on public.notes;
create policy "staff edit own notes" on public.notes
  for update to authenticated
  using (author_id = public.current_staff_id())
  with check (author_id = public.current_staff_id());

-- Customers never read notes of any visibility. No policy is granted, so the
-- default deny applies — stated here because the absence is deliberate.

-- -----------------------------------------------------------------------------
-- Audit logs — READ ONLY, and only for audit.view.
--
-- There is no INSERT policy: writes come from SECURITY DEFINER triggers only.
-- There is no UPDATE policy. There is no DELETE policy. Not for ADMIN, not for
-- SUPER_ADMIN. The absence of those policies is the immutability guarantee.
-- -----------------------------------------------------------------------------
drop policy if exists "audit.view reads audit" on public.audit_logs;
create policy "audit.view reads audit" on public.audit_logs
  for select to authenticated using (public.has_perm('audit.view'));
