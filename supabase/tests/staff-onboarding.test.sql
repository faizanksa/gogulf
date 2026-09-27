-- =============================================================================
-- Staff onboarding (0018, and the 0009 rules /admin/staff/new relies on).
--
-- The Staff screen adds a person in three steps (lib/admin/staff-onboarding.ts):
-- the staff row through the caller's session, a confirmed passwordless login (admin
-- API), and the link — again through the caller's session. The database facts that
-- makes safe are asserted here as the role that would break them, with a positive
-- control beside each denial.
--
-- DISPOSABLE DATABASE ONLY. One transaction, rolled back.
-- =============================================================================

begin;

create schema so_test;
grant usage on schema so_test to anon, authenticated, service_role;

create function so_test.check(condition boolean, description text)
returns void language plpgsql as $$
begin
  if condition then raise notice 'PASS  %', description;
  else raise exception 'FAIL  %', description;
  end if;
end $$;

-- -1 when the privilege layer refuses outright; otherwise rows affected.
create function so_test.affected(stmt text) returns bigint language plpgsql as $$
declare n bigint;
begin
  execute stmt;
  get diagnostics n = row_count;
  return n;
exception when insufficient_privilege then
  return -1;
end $$;

-- The SQLSTATE a statement fails with, or null when it succeeds.
create function so_test.sqlstate(stmt text) returns text language plpgsql as $$
begin
  execute stmt;
  return null;
exception when others then
  return sqlstate;
end $$;

create function so_test.callable(q text) returns boolean language plpgsql as $$
begin
  execute q;
  return true;
exception when insufficient_privilege then
  return false;
end $$;

create table so_test.ids (k text primary key, v uuid);
grant select, insert, update on so_test.ids to anon, authenticated, service_role;

create function so_test.id(p_key text) returns uuid
language sql stable security definer set search_path = '' as $$
  select v from so_test.ids where k = p_key
$$;

create function so_test.act_as_staff(p_key text) returns void
language plpgsql security definer set search_path = '' as $$
declare s record;
begin
  select su.id, su.role_key, su.branch_id into s from public.staff_users su where su.id = so_test.id(p_key);
  perform set_config('request.jwt.claims', json_build_object(
    'sub', gen_random_uuid(), 'role', 'authenticated',
    'app_staff_id', s.id, 'app_role', s.role_key, 'app_branch', s.branch_id)::text, true);
end $$;

-- Rows the status function returns to the current caller, as a count.
create function so_test.status_rows() returns bigint language sql as $$
  select count(*) from public.staff_sign_in_status()
$$;

grant execute on all functions in schema so_test to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Fixtures (as postgres): three callers, and one person at each onboarding stage.
-- ---------------------------------------------------------------------------
insert into public.staff_users (email, full_name, role_key, branch_id)
select e.email, e.name, e.role, b.id
from (values
  ('so-super@gogulf.co',   'SO Super',        'SUPER_ADMIN'),
  ('so-admin@gogulf.co',   'SO Admin',        'ADMIN'),
  ('so-rec@gogulf.co',     'SO Recruiter',    'RECRUITER'),
  ('so-nologin@gogulf.co', 'SO No Login',     'RECRUITER'),
  ('so-unconf@gogulf.co',  'SO Unconfirmed',  'RECRUITER'),
  ('so-waiting@gogulf.co', 'SO Waiting',      'RECRUITER'),
  ('so-google@gogulf.co',  'SO Signed In',    'RECRUITER')
) as e(email, name, role), public.branches b where b.code = 'LKO';

insert into so_test.ids
select split_part(split_part(email, '@', 1), '-', 2), id
  from public.staff_users where email like 'so-%@gogulf.co';

do $$
declare
  unconf  uuid := gen_random_uuid();
  waiting uuid := gen_random_uuid();
  google  uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at) values
    (unconf,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'so-unconf@gogulf.co',  null),
    (waiting, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'so-waiting@gogulf.co', now()),
    (google,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'so-google@gogulf.co',  now());
  insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at) values
    (waiting::text, waiting, jsonb_build_object('sub', waiting::text, 'email', 'so-waiting@gogulf.co'), 'email', null),
    (google::text,  google,  jsonb_build_object('sub', google::text,  'email', 'so-google@gogulf.co'),  'email', null),
    ('google-sub-so-test', google, jsonb_build_object('sub', 'google-sub-so-test', 'email', 'so-google@gogulf.co'), 'google', '2026-09-27 10:00+00');
  update public.staff_users set auth_user_id = unconf  where id = so_test.id('unconf');
  update public.staff_users set auth_user_id = waiting where id = so_test.id('waiting');
  update public.staff_users set auth_user_id = google  where id = so_test.id('google');
end $$;

-- ===========================================================================
-- 1. The function's shape: no identifiers leave it
-- ===========================================================================
select so_test.check(
  pg_get_function_result('public.staff_sign_in_status()'::regprocedure)
    = 'TABLE(staff_id uuid, has_login boolean, email_confirmed boolean, google_linked boolean, google_last_sign_in timestamp with time zone)',
  'staff_sign_in_status returns booleans and one time only — no email, phone, token or provider id');
select so_test.check(
  (select p.prosecdef and p.proconfig @> array['search_path=""'] from pg_proc p where p.oid = 'public.staff_sign_in_status()'::regprocedure),
  'staff_sign_in_status is SECURITY DEFINER with an empty search_path');
select so_test.check(
  not has_function_privilege('anon', 'public.staff_sign_in_status()', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.staff_sign_in_status()', 'EXECUTE'),
  'anon cannot execute staff_sign_in_status; authenticated can (and is then gated by users.manage)');

-- ===========================================================================
-- 2. Who sees onboarding state
-- ===========================================================================
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select so_test.check(not so_test.callable('select public.staff_sign_in_status()'), 'anon is refused by the privilege layer');
reset role;

set local role authenticated;
select so_test.act_as_staff('rec');
select so_test.check(so_test.status_rows() = 0, 'a RECRUITER (no users.manage) sees no onboarding rows');
select so_test.act_as_staff('admin');
select so_test.check(so_test.status_rows() = 0, 'ADMIN sees no onboarding rows — users.manage is SUPER_ADMIN''s since 0016');
select so_test.act_as_staff('super');
select so_test.check(
  so_test.status_rows() = (select count(*) from public.staff_users),
  'positive control: a SUPER_ADMIN sees one row per staff member');
reset role;

-- ===========================================================================
-- 3. What each stage reads as
-- ===========================================================================
set local role authenticated;
select so_test.act_as_staff('super');
select so_test.check(
  (select not has_login and not email_confirmed and not google_linked from public.staff_sign_in_status() where staff_id = so_test.id('nologin')),
  'a staff row with no login reads as no login');
select so_test.check(
  (select has_login and not email_confirmed from public.staff_sign_in_status() where staff_id = so_test.id('unconf')),
  'an unconfirmed login reads as unconfirmed (Google would refuse to link to it)');
select so_test.check(
  (select has_login and email_confirmed and not google_linked and google_last_sign_in is null from public.staff_sign_in_status() where staff_id = so_test.id('waiting')),
  'a confirmed login with only its email identity reads as awaiting the first Google sign-in');
select so_test.check(
  (select has_login and email_confirmed and google_linked and google_last_sign_in = '2026-09-27 10:00+00' from public.staff_sign_in_status() where staff_id = so_test.id('google')),
  'a linked Google identity reads as signed in, with its own last sign-in time');
reset role;

-- A deactivated SUPER_ADMIN loses it on the next query, like every has_perm gate.
update public.staff_users set is_active = false where id = so_test.id('super');
set local role authenticated;
select so_test.act_as_staff('super');
select so_test.check(so_test.status_rows() = 0, 'a deactivated SUPER_ADMIN sees no onboarding rows');
reset role;
update public.staff_users set is_active = true where id = so_test.id('super');

-- ===========================================================================
-- 4. The writes /admin/staff/new makes, as the caller — RLS and audit
-- ===========================================================================
set local role authenticated;
select so_test.act_as_staff('admin');
select so_test.check(
  so_test.affected($$insert into public.staff_users (email, full_name, role_key, branch_id)
                      select 'so-new-by-admin@gogulf.co', 'New', 'RECRUITER', id from public.branches where code = 'LKO'$$) = -1,
  'ADMIN cannot add a staff member (no users.manage)');

select so_test.act_as_staff('super');
select so_test.check(
  so_test.sqlstate($$insert into public.staff_users (email, full_name, role_key, branch_id)
                     select 'so-outsider@gmail.com', 'Outsider', 'RECRUITER', id from public.branches where code = 'LKO'$$) = '23514',
  'even a SUPER_ADMIN cannot add an address outside @gogulf.co (staff_users_company_domain)');
select so_test.check(
  so_test.affected($$insert into public.staff_users (email, full_name, role_key, branch_id)
                      select 'so-new@gogulf.co', 'SO New', 'RECRUITER', id from public.branches where code = 'LKO'$$) = 1,
  'positive control: a SUPER_ADMIN adds a staff member through their own session');
reset role;

insert into so_test.ids select 'new', id from public.staff_users where email = 'so-new@gogulf.co';
select so_test.check(
  exists (select 1 from public.audit_logs
           where action = 'staff_users.insert' and entity_id = so_test.id('new') and actor_id = so_test.id('super')),
  'the new staff row is on the audit trail, attributed to the SUPER_ADMIN who added it');
select so_test.check(
  (select auth_user_id is null and is_active from public.staff_users where id = so_test.id('new')),
  'a freshly added row has no login yet: nobody can sign in as it until the link is made');

-- Step 2 happens in the Auth admin API; here its result is simulated as postgres.
do $$
begin
  insert into so_test.ids values ('new_login', gen_random_uuid());
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at)
  values (so_test.id('new_login'), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'so-new@gogulf.co', now());
end $$;

set local role authenticated;
select so_test.act_as_staff('super');
select so_test.check(
  so_test.affected(format($$update public.staff_users set auth_user_id = %L where id = %L and auth_user_id is null$$,
                          so_test.id('new_login'), so_test.id('new'))) = 1,
  'step 3: the SUPER_ADMIN links the login to the row through their own session');
select so_test.check(
  (select has_login and email_confirmed and not google_linked from public.staff_sign_in_status() where staff_id = so_test.id('new')),
  'the new person now reads as awaiting their first Google sign-in');
select so_test.check(
  so_test.sqlstate(format($$update public.staff_users set auth_user_id = %L where id = %L$$,
                          so_test.id('new_login'), so_test.id('nologin'))) = '23505',
  'one login can never be linked to two staff records');
reset role;

select so_test.check(
  exists (select 1 from public.audit_logs
           where action = 'staff_users.update' and entity_id = so_test.id('new') and actor_id = so_test.id('super')
             and new_values ->> 'auth_user_id' = so_test.id('new_login')::text),
  'the link is on the audit trail too, attributed to the same person');

-- The JWT hook turns the linked row into staff claims — the whole point of onboarding.
select so_test.check(
  (select (public.custom_access_token_hook(jsonb_build_object('user_id', so_test.id('new_login'), 'claims', '{}'::jsonb))
            -> 'claims' ->> 'app_staff_id') = so_test.id('new')::text),
  'once linked, the JWT hook issues staff claims for the new person''s login');

rollback;
