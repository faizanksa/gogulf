-- =============================================================================
-- Jobs and the applications bridge (0012, 0013) — behaviour, as each role.
--
-- Queries run as anon, as a signed-in non-staff user and as staff of several
-- roles, with the claims the JWT hook would issue, and assert what each one can
-- actually see and change. Every denial has a positive control, so a role that
-- can do nothing cannot pass by accident.
--
-- DISPOSABLE DATABASE ONLY. One transaction, rolled back.
--
--   npm run db:test                 # local
--   npm run db:mumbai -- test       # Mumbai staging
-- =============================================================================

begin;

create schema jobs_test;
grant usage on schema jobs_test to anon, authenticated, service_role;

create function jobs_test.check(condition boolean, description text)
returns void language plpgsql as $$
begin
  if condition then raise notice 'PASS  %', description;
  else raise exception 'FAIL  %', description;
  end if;
end $$;

-- Rows a query returns for the CURRENT role; -1 when refused outright.
create function jobs_test.visible(q text) returns bigint language plpgsql as $$
declare n bigint;
begin
  execute format('select count(*) from (%s) s', q) into n;
  return n;
exception when insufficient_privilege then
  return -1;
end $$;

-- Rows a write affects for the CURRENT role; -1 when refused by privilege.
create function jobs_test.affected(stmt text) returns bigint language plpgsql as $$
declare n bigint;
begin
  execute stmt;
  get diagnostics n = row_count;
  return n;
exception when insufficient_privilege then
  return -1;
end $$;

-- NULL when the statement succeeds; otherwise "SQLSTATE message [detail]".
create function jobs_test.error_of(stmt text) returns text language plpgsql as $$
declare d text;
begin
  execute stmt;
  return null;
exception when others then
  get stacked diagnostics d = pg_exception_detail;
  return sqlstate || ' ' || sqlerrm || coalesce(' [' || nullif(d, '') || ']', '');
end $$;

create table jobs_test.ids (k text primary key, v uuid);
grant select, insert, update on jobs_test.ids to anon, authenticated, service_role;

create function jobs_test.id(p_key text) returns uuid
language sql stable security definer set search_path = '' as $$
  select v from jobs_test.ids where k = p_key
$$;

create function jobs_test.act_as_staff(p_key text) returns void
language plpgsql security definer set search_path = '' as $$
declare s record;
begin
  select su.id, su.role_key, su.branch_id into s from public.staff_users su where su.id = jobs_test.id(p_key);
  perform set_config('request.jwt.claims', json_build_object(
    'sub', gen_random_uuid(), 'role', 'authenticated',
    'app_staff_id', s.id, 'app_role', s.role_key, 'app_branch', s.branch_id)::text, true);
end $$;

create function jobs_test.act_as_non_staff() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
end $$;

-- Transaction-local claims survive RESET ROLE, so a system write must clear them
-- explicitly or it is attributed to whichever staff member acted last.
create function jobs_test.act_as_system() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
end $$;

create function jobs_test.act_as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
end $$;

grant execute on all functions in schema jobs_test to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Fixtures (as postgres)
-- ---------------------------------------------------------------------------
insert into jobs_test.ids select 'b_lko', id from public.branches where code = 'LKO';

insert into public.staff_users (email, full_name, role_key, branch_id)
select e.email, e.name, e.role, jobs_test.id('b_lko')
from (values
  ('jt-super@gogulf.co', 'JT Super',     'SUPER_ADMIN'),
  ('jt-admin@gogulf.co', 'JT Admin',     'ADMIN'),
  ('jt-hr@gogulf.co',    'JT HR',        'HR_MANAGER'),
  ('jt-rec1@gogulf.co',  'JT Recruiter', 'RECRUITER'),
  ('jt-rec2@gogulf.co',  'JT Recruiter', 'RECRUITER'),
  ('jt-view@gogulf.co',  'JT View',      'VIEW_ONLY'),
  ('jt-mkt@gogulf.co',   'JT Marketing', 'MARKETING_MANAGER')
) as e(email, name, role);

insert into jobs_test.ids
select 's_' || split_part(split_part(email, '@', 1), '-', 2), id
  from public.staff_users where email like 'jt-%@gogulf.co';

insert into jobs_test.ids select 'cat_warehouse', id from public.job_categories where slug = 'warehouse-helper';
insert into jobs_test.ids select 'cat_accountant', id from public.job_categories where slug = 'accountant';

select jobs_test.check((select count(*) from public.job_categories where classification = 'general') >= 7
                   and (select count(*) from public.job_categories where classification = 'professional') >= 7,
  'categories are seeded as data for both classifications');

-- ===========================================================================
-- 1. Creating a job — as ADMIN
-- ===========================================================================
set local role authenticated;
select jobs_test.act_as_staff('s_admin');

with i as (
  insert into public.jobs (title, category_id, created_by)
  values ('JT Warehouse Helper', jobs_test.id('cat_warehouse'), jobs_test.id('s_hr'))
  returning id
)
insert into jobs_test.ids select 'j_general', id from i;

select jobs_test.check(
  (select status = 'draft' and classification = 'general' and created_by = jobs_test.id('s_admin')
          and updated_by = jobs_test.id('s_admin') and branch_id = jobs_test.id('b_lko')
     from public.jobs where id = jobs_test.id('j_general')),
  'ADMIN creates a draft, attributed to themselves (a forged created_by is replaced), in their branch');
select jobs_test.check(
  (select reference ~ '^GG-JOB-[0-9]{4}-[0-9]{5}$' from public.jobs where id = jobs_test.id('j_general')),
  'a job gets a GG-JOB reference');
select jobs_test.check(
  (select slug = 'jt-warehouse-helper-' || lower(reference) from public.jobs where id = jobs_test.id('j_general')),
  'the slug is derived from the title and the reference');
select jobs_test.check(
  jobs_test.error_of(format($$insert into public.jobs (title, category_id, status) values ('JT Straight to live', %L, 'published')$$,
    jobs_test.id('cat_warehouse'))) like '%job_must_start_as_draft%',
  'staff cannot create a job directly as published');

-- ===========================================================================
-- 2. Lifecycle — the transition table and publish validation
-- ===========================================================================
select jobs_test.check(
  jobs_test.error_of(format($$update public.jobs set status = 'published' where id = %L$$, jobs_test.id('j_general')))
    like '%job_transition_not_allowed%draft -> published%',
  'draft cannot jump straight to published');
select jobs_test.check(
  (select e like '%job_not_publishable%country_missing%employment_type_missing%summary_missing%employer_disclosure_missing%'
     from jobs_test.error_of(format($$update public.jobs set status = 'review' where id = %L$$, jobs_test.id('j_general'))) e),
  'an incomplete job cannot go to review, and the problems are named');

select jobs_test.check(
  jobs_test.affected(format($$update public.jobs set country_code = 'AE', city = 'Dubai', employment_type = 'full_time',
    summary = 'Loading, unloading and stock handling in a distribution warehouse.',
    employer_disclosure = 'confidential', internal_notes = 'Employer: JT Logistics LLC'
    where id = %L$$, jobs_test.id('j_general'))) = 1,
  'ADMIN completes the draft');
select jobs_test.check(
  jobs_test.error_of(format($$update public.jobs set status = 'review' where id = %L$$, jobs_test.id('j_general'))) is null,
  'a complete draft moves to review');
select jobs_test.check(
  jobs_test.error_of(format($$update public.jobs set status = 'published' where id = %L$$, jobs_test.id('j_general'))) is null,
  'review moves to published');
select jobs_test.check(
  (select published_at is not null and last_published_at is not null from public.jobs where id = jobs_test.id('j_general')),
  'publication is timestamped by the database');

select jobs_test.check(
  jobs_test.error_of(format($$update public.jobs set reference = 'GG-JOB-CHANGED' where id = %L$$, jobs_test.id('j_general')))
    like '%job_reference_locked%',
  'a published job''s reference cannot change');
update public.jobs set title = 'JT Warehouse Helper (Night Shift)' where id = jobs_test.id('j_general');
select jobs_test.check(
  (select title like '%Night Shift%' and slug like 'jt-warehouse-helper-gg-job-%' from public.jobs where id = jobs_test.id('j_general')),
  'a published job can be edited, and its URL slug stays put');
select jobs_test.check(
  jobs_test.error_of(format($$update public.jobs set summary = null where id = %L$$, jobs_test.id('j_general')))
    like '%job_not_publishable%summary_missing%',
  'an edit cannot leave a published job incomplete');

select jobs_test.check(
  jobs_test.error_of(format($$update public.jobs set status = 'closed' where id = %L$$, jobs_test.id('j_general'))) is null,
  'published moves to closed');
select jobs_test.check((select closed_at is not null from public.jobs where id = jobs_test.id('j_general')),
  'closing is timestamped by the database');
select jobs_test.check(
  jobs_test.error_of(format($$update public.jobs set status = 'published' where id = %L$$, jobs_test.id('j_general'))) is null,
  'a closed job can be reopened');
select jobs_test.check((select closed_at is null from public.jobs where id = jobs_test.id('j_general')),
  'reopening clears the closed timestamp');
select jobs_test.check(
  jobs_test.error_of(format($$update public.jobs set status = 'draft' where id = %L$$, jobs_test.id('j_general'))) is null,
  'published can be unpublished back to draft');
update public.jobs set status = 'review' where id = jobs_test.id('j_general');
update public.jobs set status = 'published' where id = jobs_test.id('j_general');
update public.jobs set status = 'closed' where id = jobs_test.id('j_general');
select jobs_test.check(
  jobs_test.error_of(format($$update public.jobs set status = 'archived' where id = %L$$, jobs_test.id('j_general'))) is null,
  'closed moves to archived');
select jobs_test.check(
  jobs_test.error_of(format($$update public.jobs set status = 'published' where id = %L$$, jobs_test.id('j_general')))
    like '%job_transition_not_allowed%archived -> published%',
  'an archived job cannot be republished directly');
select jobs_test.check(
  jobs_test.error_of(format($$update public.jobs set status = 'draft' where id = %L$$, jobs_test.id('j_general'))) is null,
  'an archived job is restored to draft');
select jobs_test.check(
  (select archived_at is null and published_at is not null from public.jobs where id = jobs_test.id('j_general')),
  'restoring clears the archive timestamp and keeps the first-publication date');
select jobs_test.check(
  jobs_test.error_of(format($$update public.jobs set status = 'closed' where id = %L$$, jobs_test.id('j_general')))
    like '%job_transition_not_allowed%',
  'a draft cannot be closed');

-- ===========================================================================
-- 3. Availability, promotion and contradictory states
-- ===========================================================================
with i as (
  insert into public.jobs (title, category_id, country_code, employment_type, summary, employer_disclosure, employer_name)
  values ('JT Mall Cleaner', jobs_test.id('cat_warehouse'), 'QA', 'full_time',
          'Cleaning of shopping mall common areas on a rotating shift.', 'named', 'JT Facilities WLL')
  returning id
)
insert into jobs_test.ids select 'j_timed', id from i;

select jobs_test.check(
  jobs_test.error_of(format($$update public.jobs set closes_on = current_date + 10 where id = %L$$, jobs_test.id('j_timed')))
    like '%jobs_ongoing_has_no_closing_date%',
  'an ongoing job cannot carry a closing date');
select jobs_test.check(
  jobs_test.error_of(format($$update public.jobs set availability = 'time_limited', status = 'review' where id = %L$$, jobs_test.id('j_timed')))
    like '%closing_date_missing%',
  'a time-limited job needs a closing date');
select jobs_test.check(
  jobs_test.error_of(format($$update public.jobs set availability = 'time_limited', closes_on = current_date - 3, status = 'review' where id = %L$$,
    jobs_test.id('j_timed'))) is null,
  'a time-limited job with a past date may sit in review');
select jobs_test.check(
  jobs_test.error_of(format($$update public.jobs set status = 'published' where id = %L$$, jobs_test.id('j_timed')))
    like '%closing_date_passed%',
  'but it cannot be published with a deadline already gone');
select jobs_test.check(
  jobs_test.error_of(format($$update public.jobs set closes_on = current_date + 30, status = 'published' where id = %L$$,
    jobs_test.id('j_timed'))) is null,
  'with a future closing date it publishes');

select jobs_test.check(
  jobs_test.error_of(format($$update public.jobs set featured_until = current_date + 7 where id = %L$$, jobs_test.id('j_timed')))
    like '%jobs_standard_has_no_featured_until%',
  'a standard job cannot carry a featured-until date');
select jobs_test.check(
  jobs_test.error_of(format($$update public.jobs set promotion = 'featured', featured_until = current_date - 1 where id = %L$$,
    jobs_test.id('j_timed'))) is null,
  'a featured job may carry a featured-until date that has already lapsed');
select jobs_test.check(
  (select application_access = 'free' and status = 'published' and promotion = 'featured' from public.jobs where id = jobs_test.id('j_timed')),
  'a lapsed featured date changes neither application access nor status');
select jobs_test.check(
  jobs_test.error_of(format($$update public.jobs set employer_disclosure = 'named', employer_name = null where id = %L$$,
    jobs_test.id('j_timed'))) like '%jobs_named_employer_has_name%',
  'a named employer must have a name');
select jobs_test.check(
  jobs_test.error_of(format($$update public.jobs set employer_disclosure = 'confidential' where id = %L$$, jobs_test.id('j_timed')))
    like '%jobs_confidential_employer_not_named%',
  'a confidential employer cannot also be named publicly');
select jobs_test.check(
  jobs_test.error_of(format($$update public.jobs set salary_currency = 'QAR', salary_min = 1500 where id = %L$$, jobs_test.id('j_timed')))
    like '%jobs_salary_complete%',
  'a salary is stated completely or not at all');
select jobs_test.check(
  jobs_test.error_of(format($$update public.jobs set salary_currency = 'QAR', salary_min = 1800, salary_max = 1500, salary_period = 'month' where id = %L$$,
    jobs_test.id('j_timed'))) like '%jobs_salary_complete%',
  'a salary maximum cannot be below its minimum');

-- ===========================================================================
-- 4. Professional jobs and paid application access
-- ===========================================================================
with i as (
  insert into public.jobs (title, category_id, country_code, employment_type, summary, employer_disclosure,
                           employer_name, availability, closes_on, application_access)
  values ('JT Accountant', jobs_test.id('cat_accountant'), 'SA', 'full_time',
          'Maintain ledgers and prepare monthly management accounts.', 'named', 'JT Trading Co',
          'time_limited', current_date + 20, 'paid')
  returning id
)
insert into jobs_test.ids select 'j_prof', id from i;

select jobs_test.check(
  (select classification = 'professional' from public.jobs where id = jobs_test.id('j_prof')),
  'classification follows the category');
select jobs_test.check(
  (select e like '%requirements_missing%' and e not like '%paid_application_unavailable%'
     from jobs_test.error_of(format($$update public.jobs set status = 'review' where id = %L$$, jobs_test.id('j_prof'))) e),
  'a professional job must state its requirements (paid access alone does not block review)');
update public.jobs set requirements = array['Degree in accounting', '3 years of GCC experience'] where id = jobs_test.id('j_prof');
select jobs_test.check(
  jobs_test.error_of(format($$update public.jobs set status = 'review' where id = %L$$, jobs_test.id('j_prof'))) is null,
  'a paid-access job can be drafted and reviewed — the model is ready for it');
select jobs_test.check(
  jobs_test.error_of(format($$update public.jobs set status = 'published' where id = %L$$, jobs_test.id('j_prof')))
    like '%paid_application_unavailable%',
  'PAID APPLICATION ACCESS CANNOT BE PUBLISHED');
select jobs_test.check(
  jobs_test.error_of(format($$update public.jobs set application_access = 'free', status = 'published',
    promotion = 'featured', featured_until = current_date + 14 where id = %L$$, jobs_test.id('j_prof'))) is null,
  'Professional + Featured + Free application publishes');
select jobs_test.check(
  jobs_test.error_of(format($$update public.jobs set application_access = 'paid' where id = %L$$, jobs_test.id('j_prof')))
    like '%paid_application_unavailable%',
  'a published job cannot be switched to paid access');
reset role;
select jobs_test.act_as_system();

-- Even the table owner, with no trigger message to rely on, meets the constraint.
select jobs_test.check(
  jobs_test.error_of(format($$insert into public.jobs (title, category_id, status, application_access) values ('JT Owner paid', %L, 'closed', 'paid')$$,
    jobs_test.id('cat_warehouse'))) like '%jobs_paid_application_not_public%',
  'the paid-access CHECK constraint binds a system insert too');

-- A few more jobs for visibility, as the system (the way the staging seed writes).
with i as (
  insert into public.jobs (title, category_id, country_code, employment_type, summary, employer_disclosure, status)
  values ('JT In Review', jobs_test.id('cat_warehouse'), 'OM', 'contract', 'A job waiting for review before it goes live.', 'confidential', 'review')
  returning id)
insert into jobs_test.ids select 'j_review', id from i;
with i as (
  insert into public.jobs (title, category_id) values ('JT Draft', jobs_test.id('cat_warehouse')) returning id)
insert into jobs_test.ids select 'j_draft', id from i;
with i as (
  insert into public.jobs (title, category_id, country_code, employment_type, summary, employer_disclosure, status)
  values ('JT Closed', jobs_test.id('cat_warehouse'), 'KW', 'full_time', 'A job that has stopped taking applications.', 'confidential', 'closed')
  returning id)
insert into jobs_test.ids select 'j_closed', id from i;
with i as (
  insert into public.jobs (title, category_id, status) values ('JT Archived', jobs_test.id('cat_warehouse'), 'archived') returning id)
insert into jobs_test.ids select 'j_archived', id from i;
with i as (
  insert into public.jobs (title, category_id, country_code, employment_type, summary, employer_disclosure, status, availability, closes_on)
  values ('JT Expired', jobs_test.id('cat_warehouse'), 'BH', 'full_time', 'Published, but its closing date has passed.', 'confidential',
          'published', 'time_limited', current_date + 1)
  returning id)
insert into jobs_test.ids select 'j_expired', id from i;
-- Let the deadline pass without a transition, as the calendar would.
alter table public.jobs disable trigger jobs_before_write_trg;
update public.jobs set closes_on = current_date - 2 where id = jobs_test.id('j_expired');
alter table public.jobs enable trigger jobs_before_write_trg;

create view jobs_test.fixture_jobs as
  select j.* from public.jobs j join jobs_test.ids i on i.v = j.id where i.k like 'j\_%';
alter view jobs_test.fixture_jobs set (security_invoker = true);
grant select on jobs_test.fixture_jobs to anon, authenticated;

-- ===========================================================================
-- 5. Who sees which jobs
-- ===========================================================================
set local role anon;
select jobs_test.act_as_anon();
select jobs_test.check(
  jobs_test.visible($$select 1 from public.jobs j join jobs_test.ids i on i.v = j.id where i.k like 'j\_%'$$) = 4,
  'anon sees exactly the published and closed test jobs (timed, prof, closed, expired)');
select jobs_test.check(
  jobs_test.visible(format('select id from public.jobs where id in (%L, %L, %L)',
    jobs_test.id('j_draft'), jobs_test.id('j_review'), jobs_test.id('j_archived'))) = 0,
  'anon cannot see a draft, a job in review or an archived job, even by id');
select jobs_test.check(
  jobs_test.visible('select internal_notes from public.jobs') = -1,
  'anon cannot read internal notes');
select jobs_test.check(
  jobs_test.visible('select created_by, branch_id from public.jobs') = -1,
  'anon cannot read who created a job or its branch');
select jobs_test.check(
  jobs_test.visible('select id, reference, slug, title, summary, status, availability, closes_on, promotion, featured_until, application_access from public.jobs') >= 4,
  'positive control: anon reads the public columns');
select jobs_test.check(
  jobs_test.affected(format($$update public.jobs set title = 'anon' where id = %L$$, jobs_test.id('j_timed'))) <= 0,
  'anon cannot edit a job');
select jobs_test.check(
  jobs_test.affected(format($$insert into public.jobs (title, category_id) values ('anon', %L)$$, jobs_test.id('cat_warehouse'))) <= 0,
  'anon cannot create a job');
select jobs_test.check(
  jobs_test.visible('select 1 from public.job_categories') >= 14,
  'anon reads job categories');
select jobs_test.check(
  jobs_test.affected($$insert into public.job_categories (slug, name, classification) values ('anon', 'Anon', 'general')$$) <= 0,
  'anon cannot create a job category');
reset role;

set local role authenticated;
select jobs_test.act_as_non_staff();
select jobs_test.check(jobs_test.visible('select 1 from jobs_test.fixture_jobs') = 0,
  'a signed-in non-staff user reads no jobs through the staff policy');
-- Refused before RLS is even reached: a non-staff user cannot see the category.
select jobs_test.check(
  jobs_test.error_of(format($$insert into public.jobs (title, category_id) values ('non-staff', %L)$$, jobs_test.id('cat_warehouse'))) is not null,
  'a signed-in non-staff user cannot create a job');
select jobs_test.check(jobs_test.visible('select 1 from public.job_applications') = 0,
  'a signed-in non-staff user reads no applications');
select jobs_test.check(jobs_test.visible('select 1 from public.job_categories') = 0,
  'a signed-in non-staff user reads no categories through the staff policy');

select jobs_test.act_as_staff('s_view');
select jobs_test.check(jobs_test.visible('select 1 from jobs_test.fixture_jobs') = 8,
  'VIEW_ONLY reads every job, in every status');
select jobs_test.check(
  jobs_test.affected(format($$update public.jobs set title = 'x' where id = %L$$, jobs_test.id('j_draft'))) <= 0,
  'VIEW_ONLY cannot edit a job');
select jobs_test.check(
  jobs_test.affected(format($$insert into public.jobs (title, category_id) values ('view', %L)$$, jobs_test.id('cat_warehouse'))) <= 0,
  'VIEW_ONLY cannot create a job');

select jobs_test.act_as_staff('s_rec1');
select jobs_test.check(jobs_test.visible('select 1 from jobs_test.fixture_jobs') = 8, 'RECRUITER reads jobs');
select jobs_test.check(
  jobs_test.affected(format($$update public.jobs set title = 'x' where id = %L$$, jobs_test.id('j_draft'))) <= 0,
  'RECRUITER cannot manage jobs');

select jobs_test.act_as_staff('s_mkt');
select jobs_test.check(
  jobs_test.affected(format($$update public.jobs set title = 'x' where id = %L$$, jobs_test.id('j_draft'))) <= 0,
  'MARKETING_MANAGER cannot manage jobs');

select jobs_test.act_as_staff('s_hr');
select jobs_test.check(
  jobs_test.affected(format($$update public.jobs set title = 'JT Draft (HR)' where id = %L$$, jobs_test.id('j_draft'))) = 1,
  'positive control: HR_MANAGER manages jobs');

select jobs_test.act_as_staff('s_super');
select jobs_test.check(
  jobs_test.affected(format($$update public.jobs set title = 'JT Draft (Super)' where id = %L$$, jobs_test.id('j_draft'))) = 1,
  'positive control: SUPER_ADMIN manages jobs');
select jobs_test.check(
  jobs_test.affected(format($$delete from public.jobs where id = %L$$, jobs_test.id('j_draft'))) <= 0,
  'not even SUPER_ADMIN can delete a job through the API');

-- Categories
select jobs_test.act_as_staff('s_admin');
select jobs_test.check(
  jobs_test.affected($$insert into public.job_categories (slug, name, classification) values ('jt-welder', 'JT Welder', 'general')$$) = 1,
  'ADMIN adds a job category without a code change');
select jobs_test.check(
  jobs_test.error_of(format($$insert into public.job_categories (slug, name, classification, parent_id) values ('jt-cost-accountant', 'JT Cost Accountant', 'general', %L)$$,
    jobs_test.id('cat_accountant'))) like '%job_category_parent_classification_mismatch%',
  'a sub-category must share its parent''s classification');
select jobs_test.act_as_staff('s_view');
select jobs_test.check(
  jobs_test.affected($$insert into public.job_categories (slug, name, classification) values ('jt-view', 'JT View', 'general')$$) <= 0,
  'VIEW_ONLY cannot add a category');
reset role;

-- ===========================================================================
-- 6. Audit — meaningful actions, attributed, and not forgeable
-- ===========================================================================
select jobs_test.check(
  (select count(*) from public.audit_logs
    where entity_type = 'job' and entity_id = jobs_test.id('j_general') and action = 'job.created'
      and actor_type = 'staff' and actor_id = jobs_test.id('s_admin') and actor_label = 'jt-admin@gogulf.co') = 1,
  'job.created is recorded with the staff actor and their email');
select jobs_test.check(
  (select array_agg(distinct action order by action) from public.audit_logs
    where entity_type = 'job' and entity_id = jobs_test.id('j_general'))
  @> array['job.archived', 'job.closed', 'job.published', 'job.reopened', 'job.restored',
           'job.submitted_for_review', 'job.unpublished', 'job.updated'],
  'each lifecycle step is recorded as its own action');
select jobs_test.check(
  (select bool_and(new_values ? 'title' and not new_values ? 'summary' and old_values ? 'title')
     from public.audit_logs
    where entity_id = jobs_test.id('j_general') and action = 'job.updated'
      and new_values ->> 'title' like '%Night Shift%'),
  'job.updated records only the fields that changed, before and after');
select jobs_test.check(
  exists (select 1 from public.audit_logs where entity_id = jobs_test.id('j_timed') and action = 'job.featured'
            and new_values ->> 'promotion' = 'featured'),
  'featuring a job is recorded');
select jobs_test.check(
  exists (select 1 from public.audit_logs where entity_id = jobs_test.id('j_prof') and action = 'job.application_access_changed'
            and old_values ->> 'application_access' = 'paid' and new_values ->> 'application_access' = 'free'),
  'a change of application access is recorded');
select jobs_test.check(
  exists (select 1 from public.audit_logs where entity_id = jobs_test.id('j_review') and action = 'job.created' and actor_type = 'system'),
  'system writes (the staging seed) are attributed to the system');

set local role authenticated;
select jobs_test.act_as_staff('s_admin');
select jobs_test.check(
  jobs_test.affected($$insert into public.audit_logs (actor_type, action, entity_type) values ('staff', 'job.forged', 'job')$$) <= 0,
  'ADMIN cannot insert an audit entry directly');
select jobs_test.check(
  jobs_test.affected($$update public.audit_logs set action = 'tampered' where entity_type = 'job'$$) <= 0,
  'ADMIN cannot alter an audit entry');
select jobs_test.check(
  jobs_test.visible($$select 1 from public.audit_logs where entity_type = 'job'$$) > 0,
  'positive control: ADMIN reads the job audit trail (audit.view)');
select jobs_test.act_as_staff('s_rec1');
select jobs_test.check(
  jobs_test.visible($$select 1 from public.audit_logs where entity_type = 'job'$$) = 0,
  'RECRUITER cannot read the audit trail');
reset role;

-- ===========================================================================
-- 7. Role administration — ADMIN is not a SUPER_ADMIN
-- ===========================================================================
set local role authenticated;
select jobs_test.act_as_staff('s_admin');
select jobs_test.check(
  jobs_test.affected(format($$insert into public.role_permissions (role_key, permission_id, scope)
    select 'VIEW_ONLY', id, 'branch' from public.permissions where key = 'jobs.manage'$$)) <= 0,
  'ADMIN cannot grant permissions to a role');
select jobs_test.check(
  jobs_test.affected($$update public.roles set description = 'changed' where key = 'ADMIN'$$) <= 0,
  'ADMIN cannot alter a role definition');
select jobs_test.check(
  jobs_test.affected($$insert into public.permissions (key, domain) values ('jobs.forged', 'recruitment')$$) <= 0,
  'ADMIN cannot add to the permission catalogue');
select jobs_test.check(
  jobs_test.affected(format($$update public.staff_users set role_key = 'SUPER_ADMIN' where id = %L$$, jobs_test.id('s_admin'))) <= 0,
  'ADMIN cannot promote itself to SUPER_ADMIN');
select jobs_test.check(
  jobs_test.affected(format($$update public.staff_users set full_name = 'Renamed' where id = %L$$, jobs_test.id('s_super'))) <= 0,
  'ADMIN cannot alter a SUPER_ADMIN');
select jobs_test.check(
  jobs_test.affected(format($$update public.staff_users set role_key = 'SUPER_ADMIN' where id = %L$$, jobs_test.id('s_view'))) <= 0,
  'ADMIN cannot make anyone else a SUPER_ADMIN');
select jobs_test.check(
  jobs_test.affected(format($$update public.staff_users set full_name = 'JT View (renamed by admin)' where id = %L$$, jobs_test.id('s_view'))) = 1,
  'positive control: ADMIN manages a non-super staff member (users.manage)');

select jobs_test.act_as_staff('s_super');
select jobs_test.check(
  jobs_test.affected(format($$insert into public.role_permissions (role_key, permission_id, scope)
    select 'VIEW_ONLY', id, 'branch' from public.permissions where key = 'tags.manage'$$)) = 1,
  'SUPER_ADMIN grants a permission to a role');
select jobs_test.check(
  jobs_test.affected($$delete from public.role_permissions where role_key = 'VIEW_ONLY'
    and permission_id = (select id from public.permissions where key = 'tags.manage')$$) = 1,
  'SUPER_ADMIN revokes a permission from a role');
select jobs_test.check(
  jobs_test.affected($$update public.roles set description = description where key = 'VIEW_ONLY'$$) = 1,
  'SUPER_ADMIN edits a role definition');
select jobs_test.check(
  jobs_test.affected(format($$update public.staff_users set role_key = 'HR_MANAGER' where id = %L$$, jobs_test.id('s_view'))) = 1,
  'SUPER_ADMIN changes a staff member''s role (a SUPER_ADMIN-only operation)');
select jobs_test.check(
  jobs_test.affected($$insert into public.permissions (key, domain) values ('jobs.forged', 'recruitment')$$) <= 0,
  'the permission catalogue is migration-only, even for SUPER_ADMIN');
reset role;
update public.staff_users set role_key = 'VIEW_ONLY' where id = jobs_test.id('s_view');

-- ===========================================================================
-- 8. Applications — intake
-- ===========================================================================
set local role anon;
select jobs_test.act_as_anon();

select jobs_test.check(
  jobs_test.error_of(format($$insert into public.job_applications
    (id, job_id, job_title, job_country, full_name, email, phone, cv_path, passport_path, page_source)
    values ('11111111-0000-4000-8000-000000000001', %L, 'Whatever the browser says', 'Qatar', 'JT Applicant One',
            'jt.one@example.com', '+91 90000 11111', '11111111-0000-4000-8000-000000000001/cv-a.pdf',
            '11111111-0000-4000-8000-000000000001/passport-a.png', 'Jobs Page')$$, jobs_test.id('j_timed'))) is null,
  'anon applies to an open, free job');
select jobs_test.check(
  jobs_test.error_of(format($$insert into public.job_applications (job_id, job_title, full_name, email, phone, cv_path, passport_path)
    values (%L, 'x', 'JT Late', 'late@example.com', '+91 90000 22222', 'x/cv', 'x/passport')$$, jobs_test.id('j_closed')))
    like '%job_not_accepting_applications%',
  'an application to a closed job is refused');
select jobs_test.check(
  jobs_test.error_of(format($$insert into public.job_applications (job_id, job_title, full_name, email, phone, cv_path, passport_path)
    values (%L, 'x', 'JT Late', 'late@example.com', '+91 90000 22222', 'x/cv', 'x/passport')$$, jobs_test.id('j_expired')))
    like '%job_not_accepting_applications%',
  'an application to a job past its closing date is refused');
select jobs_test.check(
  jobs_test.error_of(format($$insert into public.job_applications (job_id, job_title, full_name, email, phone, cv_path, passport_path)
    values (%L, 'x', 'JT Early', 'early@example.com', '+91 90000 33333', 'x/cv', 'x/passport')$$, jobs_test.id('j_draft')))
    like '%job_not_accepting_applications%',
  'an application to a draft job is refused');
select jobs_test.check(
  jobs_test.affected($$insert into public.job_applications (job_title, full_name, email, phone, cv_path, passport_path, status)
    values ('General Application', 'JT Sneaky', 'sneaky@example.com', '+91 90000 44444', 'x/cv', 'x/passport', 'converted')$$) = -1,
  'anon cannot set the status of its own application');
select jobs_test.check(
  jobs_test.visible('select 1 from public.job_applications') = -1,
  'anon cannot read applications back');
reset role;

select jobs_test.check(
  (select job_title = 'JT Mall Cleaner' and status = 'new' and branch_id = jobs_test.id('b_lko') and contact_id is null
     from public.job_applications where id = '11111111-0000-4000-8000-000000000001'),
  'the stored title is the job''s own, the branch is the job''s, and the application starts new and unlinked');

insert into jobs_test.ids values ('a_one', '11111111-0000-4000-8000-000000000001');
-- More, as the system: one from the same person (same phone, new email), one
-- general, one with no branch at all.
select jobs_test.act_as_system();
insert into public.job_applications (id, job_id, job_title, full_name, email, phone, cv_path, passport_path, branch_id)
values ('11111111-0000-4000-8000-000000000002', jobs_test.id('j_prof'), 'x', 'JT Applicant One', 'jt.one.other@example.com',
        '9000011111', '11111111-0000-4000-8000-000000000002/cv-b.pdf', '11111111-0000-4000-8000-000000000002/passport-b.png',
        jobs_test.id('b_lko'));
insert into jobs_test.ids values ('a_same_person', '11111111-0000-4000-8000-000000000002');
insert into public.job_applications (id, job_title, full_name, email, phone, cv_path, passport_path, branch_id)
values ('11111111-0000-4000-8000-000000000003', 'General Application', 'JT Applicant Three', 'jt.three@example.com',
        '+91 90000 33333', '11111111-0000-4000-8000-000000000003/cv-c.pdf', '11111111-0000-4000-8000-000000000003/passport-c.png',
        jobs_test.id('b_lko'));
insert into jobs_test.ids values ('a_general', '11111111-0000-4000-8000-000000000003');
insert into public.job_applications (id, job_title, full_name, email, phone, cv_path, passport_path)
values ('11111111-0000-4000-8000-000000000004', 'General Application', 'JT Applicant Four', 'jt.four@example.com',
        '+91 90000 44444', '11111111-0000-4000-8000-000000000004/cv-d.pdf', '11111111-0000-4000-8000-000000000004/passport-d.png');
insert into jobs_test.ids values ('a_nobranch', '11111111-0000-4000-8000-000000000004');

create view jobs_test.fixture_apps as
  select a.* from public.job_applications a join jobs_test.ids i on i.v = a.id where i.k like 'a\_%';
alter view jobs_test.fixture_apps set (security_invoker = true);
grant select on jobs_test.fixture_apps to anon, authenticated;

-- ===========================================================================
-- 9. Applications — who reads and triages
-- ===========================================================================
set local role authenticated;
select jobs_test.act_as_staff('s_admin');
select jobs_test.check(jobs_test.visible('select 1 from jobs_test.fixture_apps') = 4, 'ADMIN reads every application');
select jobs_test.check(
  jobs_test.affected(format($$update public.job_applications set email = 'changed@example.com' where id = %L$$, jobs_test.id('a_one'))) = -1,
  'staff cannot edit what the applicant submitted');

select jobs_test.act_as_staff('s_rec1');
select jobs_test.check(jobs_test.visible('select 1 from jobs_test.fixture_apps') = 0,
  'RECRUITER sees no unassigned application');

select jobs_test.act_as_staff('s_hr');
select jobs_test.check(jobs_test.visible('select 1 from jobs_test.fixture_apps') = 3,
  'HR_MANAGER sees the applications in their branch, not the one without a branch');
select jobs_test.check(
  jobs_test.affected(format($$update public.job_applications set assignee_id = %L, status = 'screening' where id = %L$$,
    jobs_test.id('s_rec1'), jobs_test.id('a_general'))) = 1,
  'HR_MANAGER assigns an application and moves it to screening');

select jobs_test.act_as_staff('s_rec1');
select jobs_test.check(jobs_test.visible('select 1 from jobs_test.fixture_apps') = 1,
  'the assigned RECRUITER now sees exactly that application');
select jobs_test.act_as_staff('s_rec2');
select jobs_test.check(jobs_test.visible('select 1 from jobs_test.fixture_apps') = 0,
  'another RECRUITER still sees none');

select jobs_test.act_as_staff('s_mkt');
select jobs_test.check(jobs_test.visible('select 1 from jobs_test.fixture_apps') = 0,
  'MARKETING_MANAGER (no applications.screen) reads no applications');
reset role;

select jobs_test.check(
  exists (select 1 from public.audit_logs where entity_type = 'job_application' and entity_id = jobs_test.id('a_general')
            and action = 'job_application.status_changed' and actor_id = jobs_test.id('s_hr')
            and not (new_values ? 'email') and not (new_values ? 'phone')),
  'triage is audited, without copying the applicant''s personal data into the trail');

-- ===========================================================================
-- 10. Documents
-- ===========================================================================
set local role authenticated;
select jobs_test.act_as_staff('s_admin');
select jobs_test.check(public.can_view_application_document('11111111-0000-4000-8000-000000000001/passport-a.png'),
  'ADMIN may open a recorded passport');
select jobs_test.check(not public.can_view_application_document('11111111-0000-4000-8000-000000000001/passport-z.png'),
  'a path the application did not record is refused');
select jobs_test.act_as_staff('s_rec1');
select jobs_test.check(public.can_view_application_document('11111111-0000-4000-8000-000000000003/cv-c.pdf'),
  'the assigned RECRUITER may open the CV');
select jobs_test.check(not public.can_view_application_document('11111111-0000-4000-8000-000000000001/cv-a.pdf'),
  'but not the documents of an application they are not assigned');
select jobs_test.act_as_staff('s_mkt');
select jobs_test.check(not public.can_view_application_document('11111111-0000-4000-8000-000000000002/cv-b.pdf'),
  'MARKETING_MANAGER may open no applicant document');
select jobs_test.check(not public.record_document_access('11111111-0000-4000-8000-000000000002/passport-b.png'),
  'MARKETING_MANAGER is refused a passport through the access recorder too');

select jobs_test.act_as_staff('s_admin');
select jobs_test.check(public.record_document_access('11111111-0000-4000-8000-000000000002/passport-b.png'),
  'ADMIN''s passport access is granted by the recorder');
select jobs_test.check(not public.record_document_access('11111111-0000-4000-8000-000000000002/passport-forged.png'),
  'a path the application did not record is refused by the recorder');
reset role;

select jobs_test.check(
  (select count(*) from public.audit_logs
    where action = 'document.accessed' and entity_id = jobs_test.id('a_same_person')
      and actor_id = jobs_test.id('s_admin') and new_values ->> 'document' = 'passport'
      and new_values::text not like '%passport-b.png%') = 1,
  'opening a passport is audited once, by kind, without the file name');

set local role anon;
select jobs_test.act_as_anon();
select jobs_test.check(
  jobs_test.error_of($$select public.record_document_access('11111111-0000-4000-8000-000000000002/passport-b.png')$$) like '42501%',
  'anon cannot call the document access recorder');
reset role;

-- ===========================================================================
-- 11. Conversion: application → contact → case
-- ===========================================================================
set local role authenticated;
select jobs_test.act_as_non_staff();
select jobs_test.check(
  jobs_test.error_of(format('select public.convert_job_application(%L)', jobs_test.id('a_one'))) like '%staff_session_required%',
  'a non-staff user cannot convert an application');
select jobs_test.act_as_staff('s_view');
select jobs_test.check(
  jobs_test.error_of(format('select public.convert_job_application(%L)', jobs_test.id('a_one'))) like '%permission_denied%',
  'VIEW_ONLY cannot convert an application');

select jobs_test.act_as_staff('s_admin');
create temp table conv_one on commit drop as select public.convert_job_application(jobs_test.id('a_one')) as r;
reset role;

select jobs_test.check(
  (select (r ->> 'contact_created')::boolean and not (r ->> 'already_converted')::boolean and r ->> 'case_number' like 'GG-REC-%'
     from conv_one),
  'ADMIN converts an application: a new contact and a GG-REC case');
select jobs_test.check(
  (select a.status = 'converted' and a.contact_id = (c.r ->> 'contact_id')::uuid and a.case_id = (c.r ->> 'case_id')::uuid
     from public.job_applications a, conv_one c where a.id = jobs_test.id('a_one')),
  'the application links to its contact and case');
select jobs_test.check(
  (select count(*) from public.contact_identities ci, conv_one c
    where ci.contact_id = (c.r ->> 'contact_id')::uuid and ci.source = 'job_application'
      and ((ci.type = 'phone' and ci.value_normalized = '+919000011111')
        or (ci.type = 'email' and ci.value_normalized = 'jt.one@example.com'))) = 2,
  'the contact carries the applicant''s normalised phone and email as identities');
select jobs_test.check(
  (select k.case_type = 'recruitment' and s.key = 'new' and k.owner_id = jobs_test.id('s_admin')
          and cr.job_id = jobs_test.id('j_timed') and k.title like 'JT Mall Cleaner (GG-JOB-%'
     from conv_one c
     join public.cases k on k.id = (c.r ->> 'case_id')::uuid
     join public.pipeline_stages s on s.id = k.stage_id
     join public.case_recruitment cr on cr.case_id = k.id),
  'the case is a recruitment case at the New stage, linked to the job');
select jobs_test.check(
  exists (select 1 from public.activities a, conv_one c
           where a.case_id = (c.r ->> 'case_id')::uuid and a.verb = 'application.converted'
             and a.actor_type = 'staff' and a.actor_id = jobs_test.id('s_admin')),
  'the conversion is on the contact''s timeline');
select jobs_test.check(
  exists (select 1 from public.audit_logs where entity_id = jobs_test.id('a_one') and action = 'job_application.converted'),
  'the conversion is audited');

set local role authenticated;
select jobs_test.act_as_staff('s_admin');
select jobs_test.check(
  (select (public.convert_job_application(jobs_test.id('a_one')) ->> 'already_converted')::boolean),
  'converting twice returns the existing links');
create temp table conv_same on commit drop as select public.convert_job_application(jobs_test.id('a_same_person')) as r;
reset role;
select jobs_test.check(
  (select count(*) from public.cases k join public.job_applications a on a.case_id = k.id
    where a.id in (jobs_test.id('a_one'), jobs_test.id('a_same_person'))) = 2
  and (select not (s.r ->> 'contact_created')::boolean and (s.r ->> 'contact_id') = (o.r ->> 'contact_id')
         from conv_same s, conv_one o),
  'a second application from the same phone joins the same contact, with its own case');

-- Scope: a match the caller cannot see is reported, never duplicated.
select jobs_test.act_as_system();
insert into public.contacts (full_name, owner_id, branch_id) values ('JT Someone Else''s Candidate', jobs_test.id('s_rec2'), jobs_test.id('b_lko'));
insert into public.contact_identities (contact_id, type, value_raw)
select id, 'phone', '+91 90000 33333' from public.contacts where full_name = 'JT Someone Else''s Candidate';
set local role authenticated;
select jobs_test.act_as_staff('s_rec1');
select jobs_test.check(
  jobs_test.error_of(format('select public.convert_job_application(%L)', jobs_test.id('a_general'))) like '%contact_outside_scope%',
  'converting an applicant who exists as a contact outside your scope is refused, not duplicated');
reset role;

-- ===========================================================================
-- 12. Closing a job keeps its applications
-- ===========================================================================
set local role authenticated;
select jobs_test.act_as_staff('s_admin');
select jobs_test.check(
  jobs_test.error_of(format($$update public.jobs set status = 'closed' where id = %L$$, jobs_test.id('j_timed'))) is null,
  'the job with applications closes');
select jobs_test.check(
  jobs_test.visible(format('select 1 from public.job_applications where job_id = %L', jobs_test.id('j_timed'))) = 1,
  'its application is still there and still readable');
update public.jobs set status = 'archived' where id = jobs_test.id('j_timed');
select jobs_test.check(
  jobs_test.visible(format('select 1 from public.job_applications where job_id = %L and case_id is not null', jobs_test.id('j_timed'))) = 1,
  'archiving the job keeps the application and its case link');
reset role;

rollback;
