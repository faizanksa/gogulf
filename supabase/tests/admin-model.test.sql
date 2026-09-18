-- =============================================================================
-- ADMIN is operational staff; SUPER_ADMIN is the system administrator (0016).
--
-- Every rule here is asserted as the role that would break it, with a positive
-- control beside each denial, so a role that can do nothing cannot pass by accident.
-- Hiding a screen is not security: these are RLS and privilege checks.
--
-- DISPOSABLE DATABASE ONLY. One transaction, rolled back.
-- =============================================================================

begin;

create schema am_test;
grant usage on schema am_test to anon, authenticated, service_role;

create function am_test.check(condition boolean, description text)
returns void language plpgsql as $$
begin
  if condition then raise notice 'PASS  %', description;
  else raise exception 'FAIL  %', description;
  end if;
end $$;

create function am_test.visible(q text) returns bigint language plpgsql as $$
declare n bigint;
begin
  execute format('select count(*) from (%s) s', q) into n;
  return n;
exception when insufficient_privilege then
  return -1;
end $$;

create function am_test.affected(stmt text) returns bigint language plpgsql as $$
declare n bigint;
begin
  execute stmt;
  get diagnostics n = row_count;
  return n;
exception when insufficient_privilege then
  return -1;
end $$;

create table am_test.ids (k text primary key, v uuid);
grant select, insert, update on am_test.ids to anon, authenticated, service_role;

create function am_test.id(p_key text) returns uuid
language sql stable security definer set search_path = '' as $$
  select v from am_test.ids where k = p_key
$$;

create function am_test.act_as_staff(p_key text) returns void
language plpgsql security definer set search_path = '' as $$
declare s record;
begin
  select su.id, su.role_key, su.branch_id into s from public.staff_users su where su.id = am_test.id(p_key);
  perform set_config('request.jwt.claims', json_build_object(
    'sub', gen_random_uuid(), 'role', 'authenticated',
    'app_staff_id', s.id, 'app_role', s.role_key, 'app_branch', s.branch_id)::text, true);
end $$;

grant execute on all functions in schema am_test to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Fixtures (as postgres)
-- ---------------------------------------------------------------------------
insert into public.staff_users (email, full_name, role_key, branch_id)
select e.email, e.name, e.role, b.id
from (values
  ('am-super@gogulf.co',  'AM Super',    'SUPER_ADMIN'),
  ('am-admin@gogulf.co',  'AM Admin',    'ADMIN'),
  ('am-admin2@gogulf.co', 'AM Admin Two','ADMIN'),
  ('am-fin@gogulf.co',    'AM Finance',  'FINANCE_MANAGER'),
  ('am-rec@gogulf.co',    'AM Recruiter','RECRUITER')
) as e(email, name, role), public.branches b where b.code = 'LKO';

insert into am_test.ids
select 's_' || split_part(split_part(email, '@', 1), '-', 2), id
  from public.staff_users where email like 'am-%@gogulf.co';

-- ===========================================================================
-- 1. The catalogue: what ADMIN holds and does not
-- ===========================================================================
select am_test.check(
  not exists (
    select 1 from public.role_permissions rp join public.permissions p on p.id = rp.permission_id
     where rp.role_key = 'ADMIN'
       and p.key in ('users.manage', 'settings.manage', 'roles.manage', 'permissions.manage', 'integrations.manage')),
  'ADMIN holds none of users.manage, settings.manage, roles.manage, permissions.manage, integrations.manage');

select am_test.check(
  (select count(*) from public.role_permissions rp join public.permissions p on p.id = rp.permission_id
    where rp.role_key = 'ADMIN'
      and p.key in ('jobs.manage', 'applications.screen', 'contacts.view', 'cases.view', 'invoices.view', 'invoices.issue',
                    'invoices.void', 'payments.view', 'audit.view', 'documents.view.identity', 'documents.view.employment')) = 11,
  'ADMIN keeps every operational permission: jobs, applications, CRM, invoices, payments, documents and operational audit');

select am_test.check((select count(*) from public.permissions) = 72, 'the permission catalogue is unchanged: no permission was invented');
select am_test.check(
  not exists (select 1 from public.role_permissions where role_key = 'SUPER_ADMIN'),
  'SUPER_ADMIN still has no explicit grants — it is unrestricted by is_super, and 0016 cannot change that');
select am_test.check(
  (select count(*) from public.audit_logs where entity_type = 'role_permissions' and action = 'role_permissions.delete') >= 2,
  'the two removed grants are on the audit trail, recorded by the system');

-- ===========================================================================
-- 2. ADMIN cannot administer the platform
-- ===========================================================================
set local role authenticated;
select am_test.act_as_staff('s_admin');

select am_test.check(
  am_test.affected(format($$insert into public.staff_users (email, full_name, role_key) values ('am-new@gogulf.co', 'New', 'RECRUITER')$$)) = -1,
  'ADMIN cannot create a staff member');
select am_test.check(
  am_test.affected(format($$update public.staff_users set role_key = 'HR_MANAGER' where id = %L$$, am_test.id('s_rec'))) = 0,
  'ADMIN cannot change a colleague''s role');
select am_test.check(
  am_test.affected(format($$update public.staff_users set is_active = false where id = %L$$, am_test.id('s_rec'))) = 0,
  'ADMIN cannot deactivate a colleague');
select am_test.check(
  am_test.affected(format($$update public.staff_users set role_key = 'SUPER_ADMIN' where id = %L$$, am_test.id('s_admin'))) = 0,
  'ADMIN cannot promote itself to SUPER_ADMIN');
select am_test.check(
  am_test.affected(format($$update public.staff_users set role_key = 'SUPER_ADMIN' where id = %L$$, am_test.id('s_admin2'))) = 0,
  'ADMIN cannot promote another ADMIN either');
select am_test.check(
  am_test.affected(format($$update public.staff_users set is_active = false, full_name = 'x' where id = %L$$, am_test.id('s_super'))) = 0,
  'ADMIN cannot touch a SUPER_ADMIN');
select am_test.check(
  am_test.affected(format($$delete from public.staff_users where id = %L$$, am_test.id('s_rec'))) = 0,
  'ADMIN cannot remove a staff member');
select am_test.check(
  am_test.visible(format('select 1 from public.staff_users where id = %L', am_test.id('s_rec'))) = 1,
  'but ADMIN can still see its colleagues, to assign work to them (positive control)');

select am_test.check(
  am_test.affected($$insert into public.role_permissions (role_key, permission_id, scope)
                      select 'ADMIN', id, 'all' from public.permissions where key = 'roles.manage'$$) = -1,
  'ADMIN cannot grant itself roles.manage');
select am_test.check(
  am_test.affected($$insert into public.role_permissions (role_key, permission_id, scope)
                      select 'ADMIN', id, 'all' from public.permissions where key = 'users.manage'$$) = -1,
  'ADMIN cannot grant itself users.manage back');
select am_test.check(
  am_test.affected($$update public.role_permissions set scope = 'all' where role_key = 'RECRUITER'$$) = 0,
  'ADMIN cannot widen any role''s grants');
select am_test.check(
  am_test.affected($$delete from public.role_permissions where role_key = 'FINANCE_MANAGER'$$) = 0,
  'ADMIN cannot remove any role''s grants');
select am_test.check(
  am_test.affected($$update public.roles set label = 'x' where key = 'SUPER_ADMIN'$$) = 0,
  'ADMIN cannot edit the definition of a role');

select am_test.check(
  am_test.affected($$update public.settings set value = 'true'::jsonb where key = 'feature.payments'$$) = 0,
  'ADMIN cannot change a system setting');
select am_test.check(
  am_test.affected($$insert into public.settings (key, value, description) values ('feature.admin_made', 'true'::jsonb, 'x')$$) = -1,
  'ADMIN cannot add a system setting');
select am_test.check(
  am_test.visible('select 1 from public.settings') = 6,
  'ADMIN can still read the settings the application shows (positive control)');

-- The audit trail: operational entries yes, platform administration no, forging never.
select am_test.check(
  am_test.visible($$select 1 from public.audit_logs where entity_type = 'role_permissions'$$) = 0,
  'ADMIN cannot read the audit entries about role grants');
select am_test.check(
  am_test.visible($$select 1 from public.audit_logs where entity_type = 'settings'$$) = 0,
  'ADMIN cannot read the audit entries about system settings');
select am_test.check(
  am_test.visible($$select 1 from public.audit_logs where entity_type = 'staff_users'$$) = 0,
  'ADMIN cannot read the audit entries about staff records');

with c as (select id from public.job_categories where slug = 'warehouse-helper'),
     j as (insert into public.jobs (title, category_id) select 'AM Warehouse Helper', c.id from c returning id)
insert into am_test.ids select 'job_a', id from j;
select am_test.check(
  am_test.visible(format($$select 1 from public.audit_logs where entity_type = 'job' and entity_id = %L and action = 'job.created'$$, am_test.id('job_a'))) = 1,
  'ADMIN can read the operational audit trail of the work it does (a job it created)');

with i as (
  insert into public.invoices (customer_name, purpose, line_items)
  values ('AM Customer', 'Consultation', '[{"description":"Fee","quantity":1,"unit_amount_minor":100000}]'::jsonb)
  returning id
)
insert into am_test.ids select 'inv_a', id from i;
select am_test.check(
  am_test.visible(format($$select 1 from public.audit_logs where entity_type = 'invoice' and entity_id = %L$$, am_test.id('inv_a'))) >= 1,
  'and the trail of an invoice it created');

select am_test.check(
  am_test.affected($$insert into public.audit_logs (actor_type, action, entity_type) values ('staff', 'forged', 'job')$$) = -1,
  'ADMIN cannot insert an audit entry');
select am_test.check(
  am_test.affected($$update public.audit_logs set action = 'edited'$$) = -1,
  'ADMIN cannot edit an audit entry');
select am_test.check(
  am_test.affected($$delete from public.audit_logs$$) = -1,
  'ADMIN cannot delete an audit entry');

-- Notes: an operational feature ADMIN keeps. A team note on a contact, as itself, and no one else.
reset role;
insert into public.contacts (full_name, branch_id) select 'AM Contact', b.id from public.branches b where b.code = 'LKO';
insert into am_test.ids select 'contact_a', id from public.contacts where full_name = 'AM Contact';
set local role authenticated;
select am_test.act_as_staff('s_admin');
select am_test.check(
  am_test.affected(format($$insert into public.notes (contact_id, body, visibility, author_id) values (%L, 'Called the applicant', 'team', %L)$$,
    am_test.id('contact_a'), am_test.id('s_admin'))) = 1,
  'ADMIN can add a team note to a contact, as itself');
select am_test.check(
  am_test.affected(format($$insert into public.notes (contact_id, body, visibility, author_id) values (%L, 'Forged', 'team', %L)$$,
    am_test.id('contact_a'), am_test.id('s_rec'))) = -1,
  'ADMIN cannot write a note in someone else''s name');

-- ===========================================================================
-- 3. Other roles: the gate is per entity type, not per role name
-- ===========================================================================
select am_test.act_as_staff('s_fin');
select am_test.check(
  am_test.visible(format($$select 1 from public.audit_logs where entity_type = 'invoice' and entity_id = %L$$, am_test.id('inv_a'))) >= 1,
  'FINANCE_MANAGER (audit.view) reads the invoice trail');
select am_test.check(
  am_test.visible($$select 1 from public.audit_logs where entity_type in ('role_permissions', 'settings', 'staff_users')$$) = 0,
  'but reads nothing about roles, settings or staff either');

select am_test.act_as_staff('s_rec');
select am_test.check(
  am_test.visible($$select 1 from public.audit_logs$$) = 0,
  'a RECRUITER (no audit.view) reads no audit entries at all');

-- ===========================================================================
-- 4. SUPER_ADMIN administers the platform — and everything ADMIN does
-- ===========================================================================
select am_test.act_as_staff('s_super');
select am_test.check(
  am_test.visible($$select 1 from public.audit_logs where entity_type = 'role_permissions'$$) >= 364,
  'SUPER_ADMIN reads the audit entries about role grants');
select am_test.check(
  am_test.visible($$select 1 from public.audit_logs where entity_type = 'settings'$$) = 6,
  'SUPER_ADMIN reads the audit entries about system settings');
select am_test.check(
  am_test.visible($$select 1 from public.audit_logs where entity_type = 'staff_users'$$) >= 5,
  'SUPER_ADMIN reads the audit entries about staff records');
select am_test.check(
  am_test.visible(format($$select 1 from public.audit_logs where entity_id = %L$$, am_test.id('job_a'))) >= 1
    and am_test.visible(format($$select 1 from public.audit_logs where entity_id = %L$$, am_test.id('inv_a'))) >= 1,
  'and the operational trail as well — the full audit');

select am_test.check(
  am_test.affected(format($$update public.staff_users set role_key = 'HR_MANAGER' where id = %L$$, am_test.id('s_rec'))) = 1,
  'SUPER_ADMIN can change a staff member''s role');
select am_test.check(
  am_test.affected(format($$update public.staff_users set is_active = false where id = %L$$, am_test.id('s_admin2'))) = 1,
  'SUPER_ADMIN can deactivate a staff member');
select am_test.check(
  am_test.visible(format($$select 1 from public.audit_logs where entity_type = 'staff_users' and entity_id = %L and action = 'staff_users.update'$$, am_test.id('s_rec'))) >= 1,
  'and those changes are on the audit trail, attributed to a person');

select am_test.check(
  am_test.affected($$insert into public.role_permissions (role_key, permission_id, scope)
                      select 'HR_MANAGER', id, 'branch' from public.permissions where key = 'reports.financial'$$) = 1,
  'SUPER_ADMIN can grant a permission to a role');
select am_test.check(
  am_test.affected($$delete from public.role_permissions rp using public.permissions p
                      where p.id = rp.permission_id and rp.role_key = 'HR_MANAGER' and p.key = 'reports.financial'$$) = 1,
  'and revoke it again');
select am_test.check(
  am_test.affected($$update public.settings set value = 'true'::jsonb where key = 'feature.payments'$$) = 1,
  'SUPER_ADMIN can change a system setting');

select am_test.check(
  am_test.affected($$insert into public.audit_logs (actor_type, action, entity_type) values ('staff', 'forged', 'job')$$) = -1
    and am_test.affected($$delete from public.audit_logs$$) = -1,
  'even SUPER_ADMIN cannot forge or delete an audit entry — immutability has no exception');

select am_test.check(
  am_test.affected(format($$update public.jobs set title = 'AM Warehouse Helper (edited)' where id = %L$$, am_test.id('job_a'))) = 1,
  'SUPER_ADMIN can do everything ADMIN can (a job edit)');

reset role;

rollback;
