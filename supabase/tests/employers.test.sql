-- =============================================================================
-- Employers (0022): the record, branch isolation, the job and case links, audit.
--
-- DISPOSABLE DATABASE ONLY. One transaction, rolled back.
-- =============================================================================

begin;

create schema em_test;
grant usage on schema em_test to anon, authenticated, service_role;

create function em_test.check(condition boolean, description text)
returns void language plpgsql as $$
begin
  if condition then raise notice 'PASS  %', description;
  else raise exception 'FAIL  %', description;
  end if;
end $$;

-- 'SQLSTATE: message' of a failing statement, or null when it succeeds.
create function em_test.error_of(stmt text) returns text language plpgsql as $$
begin
  execute stmt;
  return null;
exception when others then
  return sqlstate || ': ' || sqlerrm;
end $$;

-- Rows touched, or -1 when the privilege layer refuses outright.
create function em_test.affected(stmt text) returns bigint language plpgsql as $$
declare n bigint;
begin
  execute stmt;
  get diagnostics n = row_count;
  return n;
exception when insufficient_privilege then
  return -1;
end $$;

create table em_test.ids (k text primary key, v uuid);
grant select, insert on em_test.ids to anon, authenticated, service_role;

create function em_test.id(p_key text) returns uuid
language sql stable security definer set search_path = '' as $$
  select v from em_test.ids where k = p_key
$$;

create function em_test.act_as_staff(p_key text) returns void
language plpgsql security definer set search_path = '' as $$
declare s record;
begin
  select su.id, su.role_key, su.branch_id into s from public.staff_users su where su.id = em_test.id(p_key);
  perform set_config('request.jwt.claims', json_build_object(
    'sub', gen_random_uuid(), 'role', 'authenticated',
    'app_staff_id', s.id, 'app_role', s.role_key, 'app_branch', s.branch_id)::text, true);
end $$;

-- How many employers the current caller can see, by name prefix.
create function em_test.visible(p_prefix text) returns bigint language sql as $$
  select count(*) from public.employers where name like p_prefix || '%'
$$;

grant execute on all functions in schema em_test to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Fixtures (as postgres)
-- ---------------------------------------------------------------------------
insert into public.branches (name, code, city, country_code) values ('EM Other Branch', 'EMO', 'Test City', 'IN');
insert into em_test.ids select 'b_lko', id from public.branches where code = 'LKO';
insert into em_test.ids select 'b_oth', id from public.branches where code = 'EMO';

-- A role that may manage jobs everywhere but see employers of its own branch only: no
-- seeded role is shaped like this today, so it proves the job link guard on its own.
insert into public.roles (key, label) values ('EM_TEST_JOBS', 'EM test: jobs everywhere, employers in branch');
insert into public.role_permissions (role_key, permission_id, scope)
select 'EM_TEST_JOBS', p.id, s.scope
  from (values ('jobs.view', 'all'), ('jobs.manage', 'all'), ('employers.view', 'branch')) as s(perm, scope)
  join public.permissions p on p.key = s.perm;

insert into public.staff_users (email, full_name, role_key, branch_id) values
  ('em-super@gogulf.co',  'EM Super Admin',   'SUPER_ADMIN',  em_test.id('b_lko')),
  ('em-admin@gogulf.co',  'EM Admin',         'ADMIN',        em_test.id('b_lko')),
  ('em-hr@gogulf.co',     'EM HR Lucknow',    'HR_MANAGER',   em_test.id('b_lko')),
  ('em-hroth@gogulf.co',  'EM HR Other',      'HR_MANAGER',   em_test.id('b_oth')),
  ('em-rec@gogulf.co',    'EM Recruiter',     'RECRUITER',    em_test.id('b_lko')),
  ('em-recoth@gogulf.co', 'EM Recruiter Oth', 'RECRUITER',    em_test.id('b_oth')),
  ('em-view@gogulf.co',   'EM View Only',     'VIEW_ONLY',    em_test.id('b_lko')),
  ('em-jobs@gogulf.co',   'EM Jobs Only',     'EM_TEST_JOBS', em_test.id('b_lko'));
insert into em_test.ids select 's_' || split_part(split_part(email, '@', 1), '-', 2), id from public.staff_users where email like 'em-%@gogulf.co';

insert into public.employers (name, country_code, branch_id, status) values
  ('EMT Lucknow Employer', 'AE', em_test.id('b_lko'), 'active'),
  ('EMT Other Employer',   'SA', em_test.id('b_oth'), 'active');
insert into em_test.ids select case name when 'EMT Lucknow Employer' then 'e_lko' else 'e_oth' end, id
  from public.employers where name like 'EMT %';

-- One contact and one recruitment case in each branch; the Lucknow case is owned by the recruiter.
insert into public.contacts (full_name, branch_id) values ('EM Contact Lucknow', em_test.id('b_lko')), ('EM Contact Other', em_test.id('b_oth'));
insert into em_test.ids select case full_name when 'EM Contact Lucknow' then 'c_lko' else 'c_oth' end, id
  from public.contacts where full_name like 'EM Contact %';
insert into public.cases (case_number, contact_id, case_type, pipeline_id, stage_id, title, branch_id, owner_id)
select public.next_case_number('recruitment'), em_test.id(t.contact), 'recruitment', p.id, s.id, t.title, em_test.id(t.branch), em_test.id(t.owner)
  from public.pipelines p join public.pipeline_stages s on s.pipeline_id = p.id and s.key = 'new',
       (values ('EM case Lucknow', 'c_lko', 'b_lko', 's_rec'), ('EM case Other', 'c_oth', 'b_oth', null)) as t(title, contact, branch, owner)
 where p.case_type = 'recruitment' and p.is_default;
insert into em_test.ids select case title when 'EM case Lucknow' then 'case_lko' else 'case_oth' end, id
  from public.cases where title like 'EM case %';
insert into public.case_recruitment (case_id) values (em_test.id('case_lko')), (em_test.id('case_oth'));

-- A job with a free-text named employer and NO employer record: the public wording.
insert into public.jobs (title, category_id, employer_disclosure, employer_name, branch_id)
select 'EM Free Text Job', c.id, 'named', 'Free Text Trading LLC', em_test.id('b_lko') from public.job_categories c where c.slug = 'labour';
insert into em_test.ids select 'job_free', id from public.jobs where title = 'EM Free Text Job';

-- ---------------------------------------------------------------------------
-- 1. Schema, privileges and the public boundary
-- ---------------------------------------------------------------------------
select em_test.check((select relrowsecurity from pg_class where oid = 'public.employers'::regclass),
  'employers has row level security enabled');
select em_test.check(not has_table_privilege('anon', 'public.employers', 'SELECT')
                 and not has_table_privilege('anon', 'public.employers', 'INSERT'),
  'anon has no privilege on employers');
select em_test.check(not has_table_privilege('authenticated', 'public.employers', 'DELETE')
                 and not has_table_privilege('authenticated', 'public.employers', 'TRUNCATE'),
  'staff can neither delete nor truncate employers — an employer is made inactive');
select em_test.check(not has_column_privilege('authenticated', 'public.employers', 'created_by', 'UPDATE')
                 and not has_column_privilege('authenticated', 'public.employers', 'created_at', 'UPDATE'),
  'provenance columns are not writable by staff');
select em_test.check(not has_column_privilege('anon', 'public.jobs', 'employer_id', 'SELECT')
                 and has_column_privilege('anon', 'public.jobs', 'employer_name', 'SELECT'),
  'the public reads a job''s free-text employer name but never its employer link');
select em_test.check(em_test.error_of($$insert into public.employers (name, country_code) values ('EMT No Branch', 'AE')$$) like '23502:%',
  'every employer has a branch (NOT NULL)');
select em_test.check(em_test.error_of($$insert into public.employers (name, country_code, branch_id) values ('emt lucknow employer ', 'ae', (select v from em_test.ids where k = 'b_lko'))$$) like '23505:%',
  'the same employer name in the same country is one record (case- and space-insensitive)');
select em_test.check(em_test.error_of($$insert into public.employers (name, country_code, branch_id, email) values ('EMT Bad Email', 'AE', (select v from em_test.ids where k = 'b_lko'), 'not-an-email')$$) like '23514:%',
  'a malformed email is refused');
select em_test.check(em_test.error_of(format($$update public.jobs set employer_id = %L where id = %L$$, gen_random_uuid(), em_test.id('job_free'))) like '23503:%',
  'jobs.employer_id must point at an employer');
select em_test.check(em_test.error_of(format($$update public.case_recruitment set employer_id = %L where case_id = %L$$, gen_random_uuid(), em_test.id('case_lko'))) like '23503:%',
  'case_recruitment.employer_id must point at an employer (0004 column, now with its foreign key)');

-- ---------------------------------------------------------------------------
-- 2. Reading: branch isolation both ways, with all-scope controls
-- ---------------------------------------------------------------------------
set local role authenticated;

select em_test.act_as_staff('s_super');
select em_test.check(em_test.visible('EMT ') = 2, 'SUPER_ADMIN sees employers of every branch');
select em_test.act_as_staff('s_admin');
select em_test.check(em_test.visible('EMT ') = 2, 'ADMIN (all scope) sees employers of every branch');
select em_test.act_as_staff('s_hr');
select em_test.check(em_test.visible('EMT ') = 2, 'HR_MANAGER holds employers.view at ALL scope in the seeded RBAC, so sees every branch');
select em_test.act_as_staff('s_rec');
select em_test.check(em_test.visible('EMT ') = 1 and em_test.visible('EMT Lucknow') = 1,
  'RECRUITER (branch scope) in Lucknow sees the Lucknow employer only');
select em_test.act_as_staff('s_recoth');
select em_test.check(em_test.visible('EMT ') = 1 and em_test.visible('EMT Other') = 1,
  'RECRUITER (branch scope) in the other branch sees that branch''s employer only — isolation holds both ways');
select em_test.act_as_staff('s_view');
select em_test.check(em_test.visible('EMT ') = 1 and em_test.visible('EMT Lucknow') = 1,
  'VIEW_ONLY (branch scope) sees its own branch only');

-- ---------------------------------------------------------------------------
-- 3. Writing
-- ---------------------------------------------------------------------------
select em_test.act_as_staff('s_admin');
select em_test.check(em_test.affected(format(
  $$insert into public.employers (name, country_code, branch_id, created_by, contact_person, email, phone, website, registration_number)
    values ('EMT Admin Created', 'QA', %L, %L, 'Priya Test', 'hr@example.com', '+974 4000 0000', 'https://example.com', 'CR-12345')$$,
  em_test.id('b_oth'), em_test.id('s_rec'))) = 1,
  'ADMIN creates an employer in another branch');
reset role;
insert into em_test.ids select 'e_admin', id from public.employers where name = 'EMT Admin Created';
select em_test.check((select created_by from public.employers where id = em_test.id('e_admin')) = em_test.id('s_admin'),
  'created_by is the creator, whatever the insert claimed');
set local role authenticated;

select em_test.act_as_staff('s_hr');
select em_test.check(em_test.affected($$insert into public.employers (name, country_code) values ('EMT HR Created', 'OM')$$) = 1,
  'HR_MANAGER creates an employer (employers.manage, all scope)');
reset role;
select em_test.check((select b.code from public.employers e join public.branches b on b.id = e.branch_id where e.name = 'EMT HR Created') = 'LKO',
  'an employer created without a branch gets the creator''s branch');
set local role authenticated;

select em_test.act_as_staff('s_rec');
select em_test.check(em_test.error_of($$insert into public.employers (name, country_code) values ('EMT Recruiter Created', 'AE')$$) like '42501:%',
  'RECRUITER (view only) cannot create an employer, even in its own branch');
select em_test.check(em_test.affected(format($$update public.employers set notes = 'x' where id = %L$$, em_test.id('e_lko'))) = 0,
  'RECRUITER cannot edit an employer it can see');
select em_test.act_as_staff('s_view');
select em_test.check(em_test.affected(format($$update public.employers set status = 'inactive' where id = %L$$, em_test.id('e_lko'))) = 0,
  'VIEW_ONLY cannot edit an employer');
select em_test.act_as_staff('s_hr');
select em_test.check(em_test.affected(format($$update public.employers set created_by = %L where id = %L$$, em_test.id('s_rec'), em_test.id('e_lko'))) = -1,
  'nobody rewrites who created an employer (no column privilege)');
select em_test.check(em_test.affected(format($$delete from public.employers where id = %L$$, em_test.id('e_lko'))) = -1,
  'staff cannot delete an employer');

select em_test.act_as_staff('s_admin');
select em_test.check(em_test.affected(format($$update public.employers set status = 'inactive', notes = 'EM paused' where id = %L$$, em_test.id('e_admin'))) = 1,
  'ADMIN edits an employer');

-- ---------------------------------------------------------------------------
-- 4. Audit of the employer record
-- ---------------------------------------------------------------------------
reset role;
select em_test.check(exists (select 1 from public.audit_logs
                              where action = 'employers.insert' and entity_id = em_test.id('e_admin')
                                and actor_type = 'staff' and actor_id = em_test.id('s_admin')),
  'creating an employer is audited, attributed to the staff member');
select em_test.check(exists (select 1 from public.audit_logs
                              where action = 'employers.update' and entity_id = em_test.id('e_admin')
                                and old_values ->> 'status' = 'active' and new_values ->> 'status' = 'inactive'),
  'editing an employer is audited with the old and new values');

-- ---------------------------------------------------------------------------
-- 5. Jobs: the optional link, and the free-text name
-- ---------------------------------------------------------------------------
select em_test.check((select employer_name from public.jobs where id = em_test.id('job_free')) = 'Free Text Trading LLC'
                 and (select employer_id from public.jobs where id = em_test.id('job_free')) is null,
  'a job with no employer record keeps its free-text employer name');

set local role authenticated;
select em_test.act_as_staff('s_hr');
select em_test.check(em_test.affected(format($$update public.jobs set summary = 'An ordinary edit that does not touch the employer at all.' where id = %L$$, em_test.id('job_free'))) = 1,
  'HR_MANAGER edits the unlinked job');
reset role;
select em_test.check((select employer_name from public.jobs where id = em_test.id('job_free')) = 'Free Text Trading LLC'
                 and (select employer_id from public.jobs where id = em_test.id('job_free')) is null,
  'an unrelated edit leaves the free-text name intact and the job unlinked');
set local role authenticated;

select em_test.act_as_staff('s_hr');
select em_test.check(em_test.affected(format($$update public.jobs set employer_id = %L where id = %L$$, em_test.id('e_lko'), em_test.id('job_free'))) = 1,
  'HR_MANAGER links an employer record to a named job');
reset role;
select em_test.check((select employer_name from public.jobs where id = em_test.id('job_free')) = 'Free Text Trading LLC',
  'linking a record never overwrites the job''s public employer name');
select em_test.check(exists (select 1 from public.audit_logs
                              where action = 'job.employer_linked' and entity_id = em_test.id('job_free')
                                and actor_id = em_test.id('s_hr') and new_values ->> 'employer_name' = 'EMT Lucknow Employer'),
  'linking an employer to a job is audited with the employer''s name');
set local role authenticated;

select em_test.act_as_staff('s_admin');
select em_test.check(em_test.affected(format($$insert into public.jobs (title, category_id, employer_disclosure, employer_id)
    select 'EM Confidential Job', c.id, 'confidential', %L from public.job_categories c where c.slug = 'labour'$$, em_test.id('e_oth'))) = 1,
  'ADMIN creates a confidential job linked to an employer record');
reset role;
insert into em_test.ids select 'job_conf', id from public.jobs where title = 'EM Confidential Job';
select em_test.check((select employer_name is null and employer_id = em_test.id('e_oth') from public.jobs where id = em_test.id('job_conf')),
  'a confidential job stays unnamed publicly while linked internally');
select em_test.check(exists (select 1 from public.audit_logs where action = 'job.employer_linked' and entity_id = em_test.id('job_conf')),
  'a job created with an employer is audited as linked');

-- The public cannot reach the link: the column privilege decides, whatever the job's status.
set local role anon;
select em_test.check(em_test.error_of($$select employer_id from public.jobs limit 1$$) like '42501:%',
  'anon reading jobs.employer_id is refused');
reset role;

-- The link guard: a jobs.manage holder may link only an employer it can see.
set local role authenticated;
select em_test.act_as_staff('s_jobs');
select em_test.check(em_test.error_of(format($$update public.jobs set employer_id = %L where id = %L$$, em_test.id('e_oth'), em_test.id('job_free'))) like '42501:%employer_not_available%',
  'a job editor cannot link an employer outside its employer scope');
select em_test.check(em_test.affected(format($$update public.jobs set employer_id = null where id = %L$$, em_test.id('job_free'))) = 1,
  'unlinking is allowed for a job editor');
reset role;
select em_test.check(exists (select 1 from public.audit_logs
                              where action = 'job.employer_unlinked' and entity_id = em_test.id('job_free')
                                and old_values ->> 'employer_name' = 'EMT Lucknow Employer'),
  'unlinking an employer from a job is audited');
select em_test.check((select employer_name from public.jobs where id = em_test.id('job_free')) = 'Free Text Trading LLC',
  'unlinking leaves the free-text name as it was');

-- ---------------------------------------------------------------------------
-- 6. Recruitment cases: the link, branch-scoped editing, the guard, the timeline
-- ---------------------------------------------------------------------------
set local role authenticated;

select em_test.act_as_staff('s_hr');
select em_test.check(em_test.affected(format($$update public.case_recruitment set employer_id = %L where case_id = %L$$, em_test.id('e_lko'), em_test.id('case_lko'))) = 1,
  'HR_MANAGER links an employer to a case in its own branch');
select em_test.check(em_test.affected(format($$update public.case_recruitment set employer_id = %L where case_id = %L$$, em_test.id('e_lko'), em_test.id('case_oth'))) = 0,
  'HR_MANAGER (cases.update, branch scope) cannot link an employer to a case in another branch');
select em_test.act_as_staff('s_hroth');
select em_test.check(em_test.affected(format($$update public.case_recruitment set employer_id = %L where case_id = %L$$, em_test.id('e_oth'), em_test.id('case_lko'))) = 0,
  'and the other branch''s HR_MANAGER cannot link one to a Lucknow case — both ways');

select em_test.act_as_staff('s_rec');
select em_test.check(em_test.error_of(format($$update public.case_recruitment set employer_id = %L where case_id = %L$$, em_test.id('e_oth'), em_test.id('case_lko'))) like '42501:%employer_not_available%',
  'a RECRUITER cannot link an employer of another branch to its own case');
select em_test.check(em_test.affected(format($$update public.case_recruitment set employer_id = %L where case_id = %L$$, em_test.id('e_lko'), em_test.id('case_lko'))) = 1,
  'a RECRUITER may set an employer it can see on a case it owns');

select em_test.act_as_staff('s_admin');
select em_test.check(em_test.affected(format($$update public.case_recruitment set employer_id = %L where case_id = %L$$, em_test.id('e_oth'), em_test.id('case_lko'))) = 1,
  'ADMIN changes a case''s employer, across branches');
select em_test.check(em_test.affected(format($$update public.case_recruitment set employer_id = %L where case_id = %L$$, em_test.id('e_lko'), em_test.id('case_oth'))) = 1,
  'ADMIN links an employer to the other branch''s case');
reset role;

select em_test.check(exists (select 1 from public.audit_logs
                              where action = 'case.employer_linked' and entity_type = 'case' and entity_id = em_test.id('case_lko')
                                and actor_id = em_test.id('s_hr') and new_values ->> 'employer_name' = 'EMT Lucknow Employer'),
  'linking an employer to a case is audited, attributed to the staff member');
select em_test.check(exists (select 1 from public.audit_logs
                              where action = 'case.employer_changed' and entity_id = em_test.id('case_lko')
                                and old_values ->> 'employer_name' = 'EMT Lucknow Employer' and new_values ->> 'employer_name' = 'EMT Other Employer'),
  'changing a case''s employer is audited with both names');
select em_test.check(not exists (select 1 from public.audit_logs
                                  where action like 'case.employer_%' and entity_id = em_test.id('case_lko') and actor_id = em_test.id('s_rec')),
  'setting the same employer again is not a change and is not recorded');
select em_test.check((select count(*) from public.activities
                       where case_id = em_test.id('case_lko') and verb in ('case.employer_linked', 'case.employer_changed')) = 2
                 and exists (select 1 from public.activities where case_id = em_test.id('case_lko') and summary = 'Employer changed: EMT Lucknow Employer → EMT Other Employer'),
  'the case timeline shows the employer being linked and changed');

-- An employer in use cannot be removed even by the server; it is made inactive instead.
select em_test.check(em_test.error_of(format($$delete from public.employers where id = %L$$, em_test.id('e_lko'))) like '23503:%',
  'an employer linked to a job or case cannot be deleted, even without RLS');

rollback;
