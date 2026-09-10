-- =============================================================================
-- Behavioural RBAC / RLS validation.
--
-- rls.test.sql checks catalogue facts (policies exist, grants are right).
-- THIS file executes real queries AS each role, with forged JWT claims, and
-- asserts what each one can actually see and change. It is the difference
-- between "a policy named X exists" and "a recruiter cannot read another
-- recruiter's candidate".
--
-- Every denial is paired with a positive control somewhere, so a role that can
-- do nothing at all cannot pass by accident.
--
-- DISPOSABLE DATABASE ONLY. One transaction, rolled back.
--
--   npm run db:test      (local Supabase, via docker exec)
--
-- How roles are simulated: Supabase's auth.jwt() and auth.uid() read the
-- `request.jwt.claims` setting, and PostgREST switches to `anon` or
-- `authenticated` per request. set_config + SET ROLE reproduces exactly what a
-- real API request does, minus the network.
-- =============================================================================

begin;

create schema rls_test;
grant usage on schema rls_test to anon, authenticated, service_role;

create function rls_test.check(condition boolean, description text)
returns void language plpgsql as $$
begin
  if condition then raise notice 'PASS  %', description;
  else raise exception 'FAIL  %', description;
  end if;
end $$;

-- Rows a query returns for the CURRENT role; -1 when refused outright.
create function rls_test.visible(q text) returns bigint language plpgsql as $$
declare n bigint;
begin
  execute format('select count(*) from (%s) s', q) into n;
  return n;
exception when insufficient_privilege then
  return -1;
end $$;

-- Rows a write affects for the CURRENT role; -1 when refused. RLS filters an
-- UPDATE/DELETE to zero rows silently, while a WITH CHECK violation, a missing
-- privilege and the audit immutability trigger all raise 42501. So 0 and -1
-- both mean "denied"; only a positive count means the write landed.
create function rls_test.affected(stmt text) returns bigint language plpgsql as $$
declare n bigint;
begin
  execute stmt;
  get diagnostics n = row_count;
  return n;
exception when insufficient_privilege then
  return -1;
end $$;

create table rls_test.ids (k text primary key, v uuid);

-- Act as a staff member: exactly the claims the JWT hook would inject.
-- SECURITY DEFINER so it can look the staff row up before any claims exist.
create function rls_test.act_as_staff(p_key text) returns void
language plpgsql security definer set search_path = '' as $$
declare s record;
begin
  select su.id, su.role_key, su.branch_id into s
    from public.staff_users su
   where su.id = (select v from rls_test.ids where k = p_key);
  perform set_config('request.jwt.claims', json_build_object(
    'sub', gen_random_uuid(), 'role', 'authenticated',
    'app_staff_id', s.id, 'app_role', s.role_key, 'app_branch', s.branch_id)::text, true);
end $$;

create function rls_test.act_as_customer(auth_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object(
    'sub', auth_user, 'role', 'authenticated')::text, true);
end $$;

create function rls_test.id(p_key text) returns uuid
language sql stable security definer set search_path = '' as $$
  select v from rls_test.ids where k = p_key
$$;

grant execute on all functions in schema rls_test to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Fixtures (as postgres)
-- ---------------------------------------------------------------------------
insert into public.branches (name, code, city) values ('Delhi (test)', 'TST-DEL', 'Delhi');
insert into rls_test.ids select 'b_lko', id from public.branches where code = 'LKO';
insert into rls_test.ids select 'b_del', id from public.branches where code = 'TST-DEL';

insert into public.staff_users (email, full_name, role_key, branch_id)
select e.email, e.name, e.role, rls_test.id(e.branch)
from (values
  ('t-super@gogulf.co',  'Test Super',      'SUPER_ADMIN',       'b_lko'),
  ('t-admin@gogulf.co',  'Test Admin',      'ADMIN',             'b_lko'),
  ('t-hr@gogulf.co',     'Test HR LKO',     'HR_MANAGER',        'b_lko'),
  ('t-hrdel@gogulf.co',  'Test HR DEL',     'HR_MANAGER',        'b_del'),
  ('t-rec1@gogulf.co',   'Test Recruiter1', 'RECRUITER',         'b_lko'),
  ('t-rec2@gogulf.co',   'Test Recruiter2', 'RECRUITER',         'b_lko'),
  ('t-fin@gogulf.co',    'Test Finance',    'FINANCE_MANAGER',   'b_lko'),
  ('t-acc@gogulf.co',    'Test Accounts',   'ACCOUNTS',          'b_lko'),
  ('t-mkt@gogulf.co',    'Test Marketing',  'MARKETING_MANAGER', 'b_lko'),
  ('t-view@gogulf.co',   'Test ViewOnly',   'VIEW_ONLY',         'b_lko')
) as e(email, name, role, branch);

insert into rls_test.ids
select 's_' || split_part(split_part(email, '@', 1), '-', 2), id
from public.staff_users where email like 't-%@gogulf.co';

insert into public.contacts (full_name, owner_id, branch_id) values
  ('Candidate of Recruiter 1', rls_test.id('s_rec1'), rls_test.id('b_lko')),
  ('Candidate of Recruiter 2', rls_test.id('s_rec2'), rls_test.id('b_lko')),
  ('Delhi candidate',          null,                  rls_test.id('b_del'));
insert into rls_test.ids select 'c_rec1', id from public.contacts where full_name = 'Candidate of Recruiter 1';
insert into rls_test.ids select 'c_rec2', id from public.contacts where full_name = 'Candidate of Recruiter 2';
insert into rls_test.ids select 'c_del',  id from public.contacts where full_name = 'Delhi candidate';

insert into public.notes (contact_id, body, visibility, branch_id) values
  (rls_test.id('c_rec1'), 'team note',     'team',            rls_test.id('b_lko')),
  (rls_test.id('c_rec1'), 'hr assessment', 'hr_private',      rls_test.id('b_lko')),
  (rls_test.id('c_rec1'), 'fee dispute',   'finance_private', rls_test.id('b_lko'));

-- A customer: an auth user whose identity row links them to c_rec1. (Inserting
-- an identity fires the primary-identity sync trigger — the one 0009 fixed.)
insert into rls_test.ids values ('u_customer', gen_random_uuid());
insert into public.contact_identities (contact_id, type, value_raw, verified_at)
values (rls_test.id('c_rec1'), 'auth_user', rls_test.id('u_customer')::text, now());

-- The test population. security_invoker: the view must apply the CALLER's RLS
-- to contacts, not bypass it as the view's owner would by default.
create view rls_test.fixture_contacts with (security_invoker = true) as
  select c.* from public.contacts c
   where c.id in (rls_test.id('c_rec1'), rls_test.id('c_rec2'), rls_test.id('c_del'));

grant select on all tables in schema rls_test to anon, authenticated, service_role;

-- ===========================================================================
-- 0. The sync trigger fixed in 0009 works under its hardened search_path
-- ===========================================================================
insert into public.contact_identities (contact_id, type, value_raw)
values (rls_test.id('c_rec2'), 'email', '  Rec2.Candidate@Example.COM ');
select rls_test.check(
  (select primary_email::text from public.contacts where id = rls_test.id('c_rec2')) = 'rec2.candidate@example.com',
  'identity insert succeeds and syncs contacts.primary_email (citext, search_path '''')');

-- ===========================================================================
-- 1. ANONYMOUS
-- ===========================================================================
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select rls_test.check(rls_test.visible('select 1 from public.contacts') <= 0, 'anon reads no contacts');
select rls_test.check(rls_test.visible('select 1 from public.staff_users') <= 0, 'anon reads no staff');
select rls_test.check(rls_test.visible('select 1 from public.audit_logs') <= 0, 'anon reads no audit log');
select rls_test.check(rls_test.visible('select 1 from public.role_permissions') <= 0,
  'anon cannot enumerate the permission model');
select rls_test.check(
  rls_test.affected($$insert into public.contacts (full_name) values ('anon insert')$$) <= 0,
  'anon cannot create a contact');
reset role;

-- ===========================================================================
-- 2. SCOPE — own / branch / all (with positive controls)
-- ===========================================================================
set local role authenticated;

select rls_test.act_as_staff('s_rec1');
select rls_test.check(rls_test.visible('select 1 from rls_test.fixture_contacts') = 1,
  'RECRUITER sees only the candidate they own');
select rls_test.check(
  rls_test.visible(format('select 1 from public.contacts where id = %L', rls_test.id('c_rec2'))) = 0,
  'RECRUITER cannot read another recruiter''s candidate by id (IDOR)');
select rls_test.check(
  rls_test.affected(format($$update public.contacts set full_name = 'x' where id = %L$$, rls_test.id('c_rec2'))) <= 0,
  'RECRUITER cannot edit another recruiter''s candidate');
select rls_test.check(
  rls_test.affected(format($$update public.contacts set nationality = 'Indian' where id = %L$$, rls_test.id('c_rec1'))) = 1,
  'positive control: RECRUITER can edit their own candidate');

select rls_test.act_as_staff('s_hr');
select rls_test.check(rls_test.visible('select 1 from rls_test.fixture_contacts') = 2,
  'HR_MANAGER (Lucknow) sees both Lucknow candidates');
select rls_test.check(
  rls_test.visible(format('select 1 from public.contacts where id = %L', rls_test.id('c_del'))) = 0,
  'HR_MANAGER (Lucknow) cannot see the Delhi branch');
select rls_test.check(
  rls_test.affected(format($$update public.contacts set branch_id = %L where id = %L$$,
    rls_test.id('b_del'), rls_test.id('c_rec1'))) <= 0,
  'HR_MANAGER cannot move a candidate to another branch (scope-hop blocked)');
select rls_test.check(
  rls_test.affected(format($$update public.contacts set preferred_language = 'hi' where id = %L$$, rls_test.id('c_rec2'))) = 1,
  'positive control: HR_MANAGER can edit a candidate in their branch');

select rls_test.act_as_staff('s_hrdel');
select rls_test.check(rls_test.visible('select 1 from rls_test.fixture_contacts') = 1,
  'HR_MANAGER (Delhi) sees only the Delhi candidate');

select rls_test.act_as_staff('s_admin');
select rls_test.check(rls_test.visible('select 1 from rls_test.fixture_contacts') = 3, 'ADMIN sees all branches');

select rls_test.act_as_staff('s_super');
select rls_test.check(rls_test.visible('select 1 from rls_test.fixture_contacts') = 3,
  'SUPER_ADMIN sees all branches via is_super');

-- ===========================================================================
-- 3. VIEW_ONLY is read-only
-- ===========================================================================
select rls_test.act_as_staff('s_view');
select rls_test.check(rls_test.visible('select 1 from rls_test.fixture_contacts') = 2,
  'VIEW_ONLY reads at branch scope');
select rls_test.check(
  rls_test.affected(format($$update public.contacts set full_name = 'x' where id = %L$$, rls_test.id('c_rec1'))) <= 0,
  'VIEW_ONLY cannot update a contact');
select rls_test.check(
  rls_test.affected($$insert into public.contacts (full_name) values ('view-only insert')$$) <= 0,
  'VIEW_ONLY cannot create a contact');
select rls_test.check(
  rls_test.affected($$insert into public.tasks (title) values ('view-only task')$$) <= 0,
  'VIEW_ONLY cannot create a task');

-- ===========================================================================
-- 4. Notes — the permission AND the row's scope
-- ===========================================================================
select rls_test.act_as_staff('s_rec1');
select rls_test.check(
  rls_test.visible($$select 1 from public.notes where visibility = 'team'$$) = 1,
  'RECRUITER reads the team note on their own candidate');
select rls_test.act_as_staff('s_rec2');
select rls_test.check(rls_test.visible('select 1 from public.notes') = 0,
  'RECRUITER reads no notes on another recruiter''s candidate');

select rls_test.act_as_staff('s_acc');
select rls_test.check(
  rls_test.visible($$select 1 from public.notes where visibility = 'hr_private'$$) = 0,
  'ACCOUNTS cannot read private HR notes');
select rls_test.check(
  rls_test.visible($$select 1 from public.notes where visibility = 'finance_private'$$) = 1,
  'positive control: ACCOUNTS reads private finance notes in its branch');

select rls_test.act_as_staff('s_fin');
select rls_test.check(
  rls_test.visible($$select 1 from public.notes where visibility = 'hr_private'$$) = 0,
  'FINANCE_MANAGER cannot read private HR notes');

select rls_test.act_as_staff('s_hr');
select rls_test.check(
  rls_test.visible($$select 1 from public.notes where visibility = 'hr_private'$$) = 1,
  'positive control: HR_MANAGER reads private HR notes in its branch');
select rls_test.check(
  rls_test.visible($$select 1 from public.notes where visibility = 'finance_private'$$) = 0,
  'HR_MANAGER cannot read private finance notes');

select rls_test.act_as_staff('s_hrdel');
select rls_test.check(
  rls_test.visible($$select 1 from public.notes where visibility = 'hr_private'$$) = 0,
  'HR_MANAGER (Delhi) cannot read Lucknow''s private HR notes');

select rls_test.act_as_staff('s_mkt');
select rls_test.check(rls_test.visible('select 1 from public.notes') = 0,
  'MARKETING_MANAGER reads no notes of any kind');

-- Writing notes
select rls_test.act_as_staff('s_rec1');
select rls_test.check(
  rls_test.affected(format($$insert into public.notes (contact_id, body, visibility, author_id)
    values (%L, 'called candidate', 'team', %L)$$, rls_test.id('c_rec1'), rls_test.id('s_rec1'))) = 1,
  'positive control: RECRUITER writes a team note on their own candidate');
select rls_test.check(
  rls_test.affected(format($$insert into public.notes (contact_id, body, visibility, author_id)
    values (%L, 'x', 'hr_private', %L)$$, rls_test.id('c_rec1'), rls_test.id('s_rec1'))) <= 0,
  'RECRUITER cannot write into the private HR channel');
select rls_test.check(
  rls_test.affected(format($$insert into public.notes (contact_id, body, visibility, author_id)
    values (%L, 'x', 'team', %L)$$, rls_test.id('c_rec2'), rls_test.id('s_rec1'))) <= 0,
  'RECRUITER cannot write a note on another recruiter''s candidate');
select rls_test.check(
  rls_test.affected(format($$insert into public.notes (contact_id, body, visibility, author_id)
    values (%L, 'x', 'team', %L)$$, rls_test.id('c_rec1'), rls_test.id('s_rec2'))) <= 0,
  'RECRUITER cannot write a note under someone else''s name');

-- ===========================================================================
-- 5. Creation stays inside the creator's scope
-- ===========================================================================
select rls_test.check(
  rls_test.affected(format($$insert into public.contacts (full_name, owner_id, branch_id)
    values ('new lead', %L, %L)$$, rls_test.id('s_rec1'), rls_test.id('b_lko'))) = 1,
  'positive control: RECRUITER creates a contact they own');
select rls_test.check(
  rls_test.affected(format($$insert into public.contacts (full_name, owner_id, branch_id)
    values ('planted lead', %L, %L)$$, rls_test.id('s_rec2'), rls_test.id('b_lko'))) <= 0,
  'RECRUITER cannot create a contact owned by someone else');
select rls_test.check(
  rls_test.affected(format($$insert into public.tasks (title, assignee_id, branch_id)
    values ('follow up', %L, %L)$$, rls_test.id('s_rec1'), rls_test.id('b_lko'))) = 1,
  'positive control: RECRUITER creates a task for themselves');
select rls_test.check(
  rls_test.affected(format($$insert into public.tasks (title, assignee_id, branch_id)
    values ('dumped task', %L, %L)$$, rls_test.id('s_rec2'), rls_test.id('b_lko'))) <= 0,
  'RECRUITER cannot assign a task to someone else');
select rls_test.check(
  rls_test.affected(format($$insert into public.cases (case_number, contact_id, case_type, pipeline_id, stage_id, owner_id, branch_id)
    select public.next_case_number('recruitment'), %L, 'recruitment', p.id, s.id, %L, %L
      from public.pipelines p join public.pipeline_stages s on s.pipeline_id = p.id
     where p.case_type = 'recruitment' and p.is_default and s.key = 'new'$$,
    rls_test.id('c_rec1'), rls_test.id('s_rec1'), rls_test.id('b_lko'))) = 1,
  'positive control: RECRUITER opens a case for their own candidate');
select rls_test.check(
  rls_test.affected(format($$insert into public.cases (case_number, contact_id, case_type, pipeline_id, stage_id, owner_id, branch_id)
    select public.next_case_number('recruitment'), %L, 'recruitment', p.id, s.id, %L, %L
      from public.pipelines p join public.pipeline_stages s on s.pipeline_id = p.id
     where p.case_type = 'recruitment' and p.is_default and s.key = 'new'$$,
    rls_test.id('c_rec2'), rls_test.id('s_rec1'), rls_test.id('b_lko'))) <= 0,
  'RECRUITER cannot open a case on a candidate they cannot see');
select rls_test.check(
  rls_test.affected(format($$insert into public.activities (contact_id, actor_type, actor_id, verb, summary)
    values (%L, 'staff', %L, 'call.logged', 'Called the candidate')$$, rls_test.id('c_rec1'), rls_test.id('s_rec1'))) = 1,
  'positive control: RECRUITER logs an activity on their own candidate');
select rls_test.check(
  rls_test.affected(format($$insert into public.activities (contact_id, actor_type, actor_id, verb, summary)
    values (%L, 'staff', %L, 'call.logged', 'x')$$, rls_test.id('c_rec2'), rls_test.id('s_rec1'))) <= 0,
  'RECRUITER cannot write to another recruiter''s candidate timeline');
select rls_test.check(
  rls_test.affected(format($$insert into public.activities (contact_id, actor_type, actor_id, verb, summary)
    values (%L, 'staff', %L, 'call.logged', 'x')$$, rls_test.id('c_rec1'), rls_test.id('s_rec2'))) <= 0,
  'RECRUITER cannot forge a timeline entry as another staff member');
select rls_test.check(
  rls_test.affected(format($$update public.activities set summary = 'rewritten' where contact_id = %L$$, rls_test.id('c_rec1'))) <= 0,
  'the timeline is append-only: an activity cannot be rewritten');

-- ===========================================================================
-- 6. Privilege escalation
-- ===========================================================================
select rls_test.act_as_staff('s_admin');
select rls_test.check(
  rls_test.affected($$insert into public.role_permissions (role_key, permission_id, scope)
    select 'ADMIN', id, 'all' from public.permissions where key = 'roles.manage'$$) <= 0,
  'ADMIN cannot grant itself roles.manage');
select rls_test.check(
  rls_test.affected(format($$update public.staff_users set role_key = 'SUPER_ADMIN' where id = %L$$, rls_test.id('s_admin'))) <= 0,
  'ADMIN cannot promote itself to SUPER_ADMIN');
select rls_test.check(
  rls_test.affected($$insert into public.staff_users (email, full_name, role_key)
    values ('t-evil@gogulf.co', 'Planted Super', 'SUPER_ADMIN')$$) <= 0,
  'ADMIN cannot create a SUPER_ADMIN account');
select rls_test.check(
  rls_test.affected(format($$update public.staff_users set is_active = false where id = %L$$, rls_test.id('s_super'))) <= 0,
  'ADMIN cannot deactivate or alter a SUPER_ADMIN');
select rls_test.check(
  rls_test.affected(format($$update public.staff_users set is_active = false where id = %L$$, rls_test.id('s_rec2'))) = 1,
  'positive control: ADMIN can deactivate a recruiter');
reset role;
update public.staff_users set is_active = true where id = rls_test.id('s_rec2');
set local role authenticated;

select rls_test.act_as_staff('s_rec1');
select rls_test.check(
  rls_test.affected(format($$update public.staff_users set role_key = 'ADMIN' where id = %L$$, rls_test.id('s_rec1'))) <= 0,
  'RECRUITER cannot change its own role');

select rls_test.act_as_staff('s_super');
select rls_test.check(
  rls_test.affected($$update public.settings set description = description where key = 'feature.payments'$$) = 1,
  'positive control: SUPER_ADMIN can change a setting');

-- ===========================================================================
-- 7. Customer isolation
-- ===========================================================================
select rls_test.act_as_customer(rls_test.id('u_customer'));
select rls_test.check(rls_test.visible('select 1 from rls_test.fixture_contacts') = 1,
  'a customer sees exactly their own contact record');
select rls_test.check(
  rls_test.visible(format('select 1 from public.contacts where id = %L', rls_test.id('c_rec2'))) = 0,
  'a customer cannot read another customer by id (IDOR)');
select rls_test.check(rls_test.visible('select 1 from public.notes') = 0, 'a customer reads no internal notes');
select rls_test.check(rls_test.visible('select 1 from public.staff_users') = 0, 'a customer cannot enumerate staff');
select rls_test.check(rls_test.visible('select 1 from public.audit_logs') = 0, 'a customer reads no audit log');
select rls_test.check(rls_test.visible('select 1 from public.tasks') = 0, 'a customer reads no internal tasks');
select rls_test.check(
  rls_test.visible($$select 1 from public.activities where verb = 'call.logged'$$) = 1,
  'positive control: a customer sees their own timeline');

-- ===========================================================================
-- 8. Deactivation takes effect on the next query, not at token expiry
-- ===========================================================================
reset role;
update public.staff_users set is_active = false where id = rls_test.id('s_rec1');
set local role authenticated;
select rls_test.act_as_staff('s_rec1');   -- same, still-valid token
select rls_test.check(rls_test.visible('select 1 from rls_test.fixture_contacts') = 0,
  'a deactivated recruiter holding a valid token sees nothing');
reset role;
update public.staff_users set is_active = true where id = rls_test.id('s_rec1');

-- ===========================================================================
-- 9. Audit trail
-- ===========================================================================
do $$
declare before_n bigint; after_n bigint;
begin
  select count(*) into before_n from public.audit_logs where entity_type = 'contacts';
  update public.contacts set full_name = full_name || ' (edited)' where id = rls_test.id('c_rec2');
  select count(*) into after_n from public.audit_logs where entity_type = 'contacts';
  perform rls_test.check(after_n = before_n + 1, 'updating a contact writes exactly one audit row');
end $$;

-- Immutable even to the table owner: the trigger holds where policies cannot.
select rls_test.check(
  rls_test.affected($$update public.audit_logs set action = 'tampered'$$) = -1,
  'the table owner itself cannot UPDATE the audit log (trigger)');
select rls_test.check(
  rls_test.affected($$delete from public.audit_logs_2026$$) = -1,
  'the table owner itself cannot DELETE from an audit partition (trigger)');

set local role service_role;
select rls_test.check(
  rls_test.affected($$update public.audit_logs set action = 'tampered'$$) <= 0,
  'service_role cannot UPDATE the audit log, although it bypasses RLS');
reset role;

set local role authenticated;
select rls_test.act_as_staff('s_super');
select rls_test.check(rls_test.visible('select 1 from public.audit_logs') >= 1,
  'positive control: SUPER_ADMIN can read the audit trail');
select rls_test.check(rls_test.affected($$update public.audit_logs set action = 'tampered'$$) <= 0,
  'even SUPER_ADMIN cannot UPDATE the audit log');
select rls_test.check(rls_test.affected($$delete from public.audit_logs$$) <= 0,
  'even SUPER_ADMIN cannot DELETE from the audit log');
select rls_test.check(rls_test.affected($$truncate public.audit_logs$$) <= 0,
  'even SUPER_ADMIN cannot TRUNCATE the audit log');
select rls_test.check(
  rls_test.affected($$insert into public.audit_logs (actor_type, action, entity_type) values ('staff','forged','contacts')$$) <= 0,
  'no signed-in role can INSERT a forged audit row directly');
select rls_test.check(rls_test.visible('select 1 from public.audit_logs_2026') <= 0,
  'an audit partition cannot be read directly, bypassing the parent''s RLS');

select rls_test.act_as_staff('s_rec1');
select rls_test.check(rls_test.visible('select 1 from public.audit_logs') = 0,
  'a RECRUITER cannot read the audit trail');

-- ===========================================================================
-- 10. SECURITY DEFINER functions are not a side door
--
-- Function probes use callable(), which EXECUTES the call. Wrapping a STABLE
-- function as `select count(*) from (select f()) s` lets the planner drop the
-- unused call entirely — no execution, no privilege check, a vacuous pass.
-- That flaw was caught here: an earlier version of this section "passed" a
-- service-role positive control that proved nothing.
-- ===========================================================================
reset role;
create function rls_test.callable(q text) returns boolean language plpgsql as $$
begin
  execute q;
  return true;
exception when insufficient_privilege then
  return false;
end $$;
grant execute on function rls_test.callable(text) to anon, authenticated, service_role;

set local role authenticated;
select rls_test.act_as_staff('s_rec1');
select rls_test.check(
  not rls_test.callable($$select public.write_audit_log('staff', null, null, 'forged', 'contacts', null)$$),
  'authenticated cannot call write_audit_log to forge audit entries');
select rls_test.check(
  not rls_test.callable($$select public.log_activity(null, null, 'staff', null, 'forged', 'forged')$$),
  'authenticated cannot call log_activity to forge timeline entries');
select rls_test.check(
  not rls_test.callable($$select public.resolve_contact(null, '9936309015', null)$$),
  'authenticated cannot call resolve_contact');
select rls_test.check(
  rls_test.callable($$select public.has_perm('contacts.view', 'own')$$),
  'positive control: authenticated can call the policy helper has_perm');
reset role;

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select rls_test.check(
  not rls_test.callable($$select public.resolve_contact(null, '9936309015', null)$$),
  'anon cannot call resolve_contact (it would reveal whether a phone number is a customer)');
select rls_test.check(
  not rls_test.callable($$select public.write_audit_log('system', null, null, 'forged', 'contacts', null)$$),
  'anon cannot call write_audit_log');
select rls_test.check(
  not rls_test.callable($$select public.custom_access_token_hook('{"user_id":"00000000-0000-0000-0000-000000000000","claims":{}}'::jsonb)$$),
  'anon cannot call the JWT hook to mint claims');
select rls_test.check(
  not rls_test.callable($$select public.has_perm('contacts.view', 'own')$$),
  'anon cannot call the policy helpers either');
reset role;

set local role service_role;
select rls_test.check(
  rls_test.callable($$select public.resolve_contact(null, '9000000000', null)$$),
  'positive control: the service role can call resolve_contact (webhooks, jobs)');
reset role;

-- ===========================================================================
-- 11. JWT hook — claims for active staff only
-- ===========================================================================
do $$
declare
  auth_id uuid := gen_random_uuid();
  result jsonb;
begin
  insert into auth.users (id, instance_id, aud, role, email)
  values (auth_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'hook-test@gogulf.co');
  update public.staff_users set auth_user_id = auth_id where id = rls_test.id('s_hr');

  result := public.custom_access_token_hook(jsonb_build_object(
    'user_id', auth_id, 'claims', jsonb_build_object('sub', auth_id, 'role', 'authenticated')));

  perform rls_test.check(result -> 'claims' ->> 'app_role' = 'HR_MANAGER', 'JWT hook injects the staff role');
  perform rls_test.check(result -> 'claims' ->> 'app_staff_id' = rls_test.id('s_hr')::text, 'JWT hook injects the staff id');
  perform rls_test.check(result -> 'claims' ->> 'app_branch' = rls_test.id('b_lko')::text, 'JWT hook injects the branch');
  perform rls_test.check(result -> 'claims' ->> 'sub' = auth_id::text, 'JWT hook preserves the original claims');

  update public.staff_users set is_active = false where id = rls_test.id('s_hr');
  result := public.custom_access_token_hook(jsonb_build_object(
    'user_id', auth_id, 'claims', jsonb_build_object('sub', auth_id)));
  perform rls_test.check(not (result -> 'claims' ? 'app_role'),
    'JWT hook injects no staff claims for a deactivated staff member');
end $$;

rollback;
