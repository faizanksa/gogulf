-- =============================================================================
-- Every application belongs to a branch (0020).
--
--   job-linked  → the job's branch (unchanged from 0013)
--   job-less    → the default intake branch (Lucknow)
--   branchless job → the default intake branch
--   existing applications were backfilled; none is left without a branch
--
-- and branch-scoped staff see exactly their own branch's applications: an HR Manager in
-- Lucknow sees Lucknow's, never another branch's, and vice versa.
--
-- DISPOSABLE DATABASE ONLY. One transaction, rolled back.
-- =============================================================================

begin;

create schema ib_test;
grant usage on schema ib_test to anon, authenticated, service_role;

create function ib_test.check(condition boolean, description text)
returns void language plpgsql as $$
begin
  if condition then raise notice 'PASS  %', description;
  else raise exception 'FAIL  %', description;
  end if;
end $$;

create function ib_test.sqlstate(stmt text) returns text language plpgsql as $$
begin
  execute stmt;
  return null;
exception when others then
  return sqlstate;
end $$;

create table ib_test.ids (k text primary key, v uuid);
grant select, insert on ib_test.ids to anon, authenticated, service_role;

create function ib_test.id(p_key text) returns uuid
language sql stable security definer set search_path = '' as $$
  select v from ib_test.ids where k = p_key
$$;

create function ib_test.act_as_staff(p_key text) returns void
language plpgsql security definer set search_path = '' as $$
declare s record;
begin
  select su.id, su.role_key, su.branch_id into s from public.staff_users su where su.id = ib_test.id(p_key);
  perform set_config('request.jwt.claims', json_build_object(
    'sub', gen_random_uuid(), 'role', 'authenticated',
    'app_staff_id', s.id, 'app_role', s.role_key, 'app_branch', s.branch_id)::text, true);
end $$;

create function ib_test.act_as_anon() returns void language sql as $$
  select set_config('request.jwt.claims', '{"role":"anon"}', true)
$$;

-- An anonymous application, with only the columns the public form may send.
create function ib_test.apply(p_name text, p_job uuid) returns void language sql as $$
  insert into public.job_applications (full_name, email, phone, job_title, cv_path, passport_path, page_source, job_id)
  values (p_name, 'ib-test@example.com', '+919000000000', 'Sent by the browser', 'ib/cv.pdf', 'ib/pp.pdf', 'ib-test', p_job)
$$;

-- What the current caller can see of this suite's applications.
create function ib_test.visible(p_name text) returns bigint language sql as $$
  select count(*) from public.job_applications where full_name = p_name
$$;

grant execute on all functions in schema ib_test to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Fixtures (as postgres): a second branch, an open job in each state, and staff.
-- ---------------------------------------------------------------------------
insert into public.branches (name, code, city, country_code) values ('IB Test Branch', 'IBT', 'Test City', 'IN');
insert into ib_test.ids select 'b_lko', id from public.branches where code = 'LKO';
insert into ib_test.ids select 'b_other', id from public.branches where code = 'IBT';

-- Two open, free, published jobs, re-homed for the test: one in the other branch, one with no branch.
insert into ib_test.ids
select 'job_other', id from public.jobs
 where status = 'published' and application_access = 'free'
   and (availability <> 'time_limited' or closes_on >= (now() at time zone 'Asia/Kolkata')::date)
 order by reference limit 1;
insert into ib_test.ids
select 'job_none', id from public.jobs
 where status = 'published' and application_access = 'free'
   and (availability <> 'time_limited' or closes_on >= (now() at time zone 'Asia/Kolkata')::date)
   and id <> ib_test.id('job_other')
 order by reference limit 1;
update public.jobs set branch_id = ib_test.id('b_other') where id = ib_test.id('job_other');
update public.jobs set branch_id = null where id = ib_test.id('job_none');

insert into public.staff_users (email, full_name, role_key, branch_id) values
  ('ib-hr-lko@gogulf.co',   'IB HR Lucknow', 'HR_MANAGER', ib_test.id('b_lko')),
  ('ib-hr-other@gogulf.co', 'IB HR Other',   'HR_MANAGER', ib_test.id('b_other')),
  ('ib-admin@gogulf.co',    'IB Admin',      'ADMIN',      ib_test.id('b_lko'));
insert into ib_test.ids select 's_' || split_part(split_part(email, '@', 1), '-', 2) || coalesce('_' || nullif(split_part(split_part(email, '@', 1), '-', 3), ''), ''), id
  from public.staff_users where email like 'ib-%@gogulf.co';

-- ===========================================================================
-- 1. The default intake branch
-- ===========================================================================
select ib_test.check(
  (select count(*) from public.branches where is_default_intake) = 1
    and (select code from public.branches where is_default_intake) = 'LKO'
    and (select is_active from public.branches where is_default_intake),
  'exactly one default intake branch, Lucknow, and it is active');
select ib_test.check(
  ib_test.sqlstate($$update public.branches set is_default_intake = true where code = 'IBT'$$) = '23505',
  'a second default intake branch is refused by the database');

-- ===========================================================================
-- 2. Intake routing, as the anonymous public form
-- ===========================================================================
set local role anon;
select ib_test.act_as_anon();
select ib_test.apply('IB job-linked', ib_test.id('job_other'));
select ib_test.apply('IB job-less', null);
select ib_test.apply('IB branchless job', ib_test.id('job_none'));
select ib_test.check(
  ib_test.sqlstate($$insert into public.job_applications (full_name, email, phone, job_title, cv_path, passport_path, branch_id)
                     values ('IB forged', 'x@example.com', '+919000000000', 'x', 'x', 'x', gen_random_uuid())$$) = '42501',
  'the public still cannot choose a branch (anon has no INSERT on branch_id)');
reset role;

select ib_test.check(
  (select branch_id from public.job_applications where full_name = 'IB job-linked') = ib_test.id('b_other'),
  'a job-linked application takes the job''s branch, exactly as before 0020');
select ib_test.check(
  (select branch_id from public.job_applications where full_name = 'IB job-less') = ib_test.id('b_lko'),
  'a job-less application is assigned to Lucknow, the default intake branch');
select ib_test.check(
  (select branch_id from public.job_applications where full_name = 'IB branchless job') = ib_test.id('b_lko'),
  'an application to a job with no branch is assigned to Lucknow');

-- ===========================================================================
-- 3. The backfill left no application without a branch
-- ===========================================================================
select ib_test.check(
  not exists (select 1 from public.job_applications where branch_id is null),
  'no application is without a branch (existing ones were backfilled by 0020)');

-- ===========================================================================
-- 4. Visibility: branch-scoped HR Managers see their own branch only
-- ===========================================================================
set local role authenticated;
select ib_test.act_as_staff('s_hr_lko');
select ib_test.check(
  ib_test.visible('IB job-less') = 1 and ib_test.visible('IB branchless job') = 1,
  'the Lucknow HR Manager sees the job-less and branchless-job applications');
select ib_test.check(
  (select count(*) from public.job_applications where branch_id is distinct from ib_test.id('b_lko')) = 0,
  'the Lucknow HR Manager sees nothing outside Lucknow');
select ib_test.check(ib_test.visible('IB job-linked') = 0,
  'branch isolation: the Lucknow HR Manager cannot see the other branch''s application');

select ib_test.act_as_staff('s_hr_other');
select ib_test.check(ib_test.visible('IB job-linked') = 1,
  'the other branch''s HR Manager sees its own branch''s application');
select ib_test.check(
  ib_test.visible('IB job-less') = 0 and ib_test.visible('IB branchless job') = 0,
  'branch isolation: the other branch''s HR Manager cannot see Lucknow''s applications');

select ib_test.act_as_staff('s_admin');
select ib_test.check(
  ib_test.visible('IB job-linked') = 1 and ib_test.visible('IB job-less') = 1 and ib_test.visible('IB branchless job') = 1,
  'ADMIN (all scope) still sees every branch');
select ib_test.check(
  not public.has_perm('applications.screen', 'all') is distinct from true,
  'ADMIN''s applications.screen is still all-scope');
select ib_test.act_as_staff('s_hr_lko');
select ib_test.check(
  public.has_perm('applications.screen', 'branch') and not public.has_perm('applications.screen', 'all'),
  'HR Manager stays branch-scoped: 0020 widened no permission');
reset role;

-- ===========================================================================
-- 5. Intake is never refused because of branch routing
-- ===========================================================================
update public.branches set is_default_intake = false where code = 'LKO';
set local role anon;
select ib_test.act_as_anon();
select ib_test.check(
  ib_test.sqlstate($$select ib_test.apply('IB no default', null)$$) is null,
  'with no default intake branch marked, a public application is still accepted');
reset role;
select ib_test.check(
  (select branch_id from public.job_applications where full_name = 'IB no default') is null,
  '— and simply has no branch, for an all-scope administrator to route');
update public.branches set is_default_intake = true where code = 'LKO';

rollback;
