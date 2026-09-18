-- =============================================================================
-- 0016 — ADMIN is operational staff; SUPER_ADMIN is the system administrator.
--
-- WHAT WAS WRONG
--
-- The 0008 catalogue gave ADMIN `users.manage` and `settings.manage`, and the audit
-- read policy let any `audit.view` holder read EVERY entry — including changes to
-- who the staff are, what roles may do, and system settings. That is broader than
-- the operating model: ADMIN runs recruitment, applications, billing and payments;
-- it does not administer the platform.
--
-- WHAT THIS CHANGES — the minimum, using only permissions that already exist
--
--   1. ADMIN loses `users.manage` and `settings.manage`. It never held `roles.manage`,
--      `permissions.manage` or `integrations.manage`, and still does not. SUPER_ADMIN
--      is untouched: it holds no explicit grants (roles.is_super short-circuits
--      has_perm) and so gains and loses nothing from this file.
--   2. The audit read policy keeps `audit.view` as the gate, and adds one more gate
--      for the three entity types that record platform administration:
--
--          staff_users       (who the staff are, their roles, active or not)  → users.manage
--          role_permissions  (what each role may do)                          → roles.manage
--          settings          (system settings)                                → settings.manage
--
--      So ADMIN (and FINANCE_MANAGER, the only other audit.view holder) still see the
--      operational trail — jobs, applications, contacts, cases, invoices, payments,
--      document access — and SUPER_ADMIN sees all of it. No new permission was invented.
--
-- WHAT DOES NOT CHANGE, AND WHY IT MATTERS
--
-- The escalation guards from 0007/0009 stand and are re-asserted in
-- supabase/tests/admin-model.test.sql: only `roles.manage` may write role_permissions
-- or promote anyone; `users.manage` (now SUPER_ADMIN's alone in practice) still cannot
-- mint or touch a SUPER_ADMIN or edit its own record; nobody can insert, update or
-- delete an audit row. Hiding a screen is not security — every rule here is RLS.
--
-- The two deletions below are audited by the existing role_permissions trigger, as
-- `system` entries, like the rest of the seed.
-- =============================================================================

delete from public.role_permissions rp
 using public.permissions p
 where rp.permission_id = p.id
   and rp.role_key = 'ADMIN'
   and p.key in ('users.manage', 'settings.manage');

drop policy if exists "audit.view reads audit" on public.audit_logs;
create policy "audit.view reads audit" on public.audit_logs
  for select to authenticated
  using (
    public.has_perm('audit.view')
    and case entity_type
          when 'staff_users'      then public.has_perm('users.manage')
          when 'role_permissions' then public.has_perm('roles.manage')
          when 'settings'         then public.has_perm('settings.manage')
          else true
        end
  );

comment on policy "audit.view reads audit" on public.audit_logs is
  'audit.view reads the operational trail; entries about staff, role grants and settings additionally need users.manage / roles.manage / settings.manage (0016).';
