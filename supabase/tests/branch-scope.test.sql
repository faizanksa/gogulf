-- =============================================================================
-- Branch-scope hardening (0023). Every "succeeded" row of docs/BRANCH-SCOPE-AUDIT.md must
-- now be refused for branch- and own-scoped roles, and still work for ADMIN/SUPER_ADMIN;
-- plus the wider matrix in docs/BRANCH-SCOPE-HARDENING.md: parents, creator fields,
-- deletion, audit, the timeline and the trusted functions.
--
-- DISPOSABLE DATABASE ONLY. One transaction, rolled back.
-- =============================================================================

begin;

create schema bs_test;
grant usage on schema bs_test to anon, authenticated, service_role;

create function bs_test.check(condition boolean, description text)
returns void language plpgsql as $$
begin
  if condition then raise notice 'PASS  %', description;
  else raise exception 'FAIL  %', description;
  end if;
end $$;

-- 'SQLSTATE: message' of a failing statement, or null when it succeeds.
create function bs_test.error_of(stmt text) returns text language plpgsql as $$
begin
  execute stmt;
  return null;
exception when others then
  return sqlstate || ': ' || sqlerrm;
end $$;

-- Rows touched, or -1 when refused outright.
create function bs_test.affected(stmt text) returns bigint language plpgsql as $$
declare n bigint;
begin
  execute stmt;
  get diagnostics n = row_count;
  return n;
exception when others then
  return -1;
end $$;

create table bs_test.ids (k text primary key, v uuid);
grant select, insert on bs_test.ids to anon, authenticated, service_role;

create function bs_test.id(p_key text) returns uuid
language sql stable security definer set search_path = '' as $$
  select v from bs_test.ids where k = p_key
$$;

create function bs_test.act_as(p_key text) returns void
language plpgsql security definer set search_path = '' as $$
declare s record;
begin
  select su.id, su.role_key, su.branch_id into s from public.staff_users su where su.id = bs_test.id(p_key);
  perform set_config('request.jwt.claims', json_build_object(
    'sub', gen_random_uuid(), 'role', 'authenticated',
    'app_staff_id', s.id, 'app_role', s.role_key, 'app_branch', s.branch_id)::text, true);
end $$;

-- Read a value as the database owner, whatever the caller may see.
create function bs_test.val(p_sql text) returns text
language plpgsql security definer set search_path = '' as $$
declare r text;
begin
  execute p_sql into r;
  return r;
end $$;

-- Create a recruitment case as the current caller.
create function bs_test.new_case(p_title text, p_contact text, p_branch text, p_owner text) returns text language plpgsql as $$
begin
  return bs_test.error_of(format($f$
    insert into public.cases (case_number, contact_id, case_type, pipeline_id, stage_id, title, branch_id, owner_id)
    select public.next_case_number('recruitment'), %L, 'recruitment', p.id, s.id, %L, %L, %L
      from public.pipelines p join public.pipeline_stages s on s.pipeline_id = p.id and s.key = 'new'
     where p.case_type = 'recruitment' and p.is_default$f$,
    bs_test.id(p_contact), p_title, bs_test.id(p_branch), bs_test.id(p_owner)));
end $$;

grant execute on all functions in schema bs_test to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Fixtures (as postgres, i.e. a trusted system writer)
-- ---------------------------------------------------------------------------
insert into public.branches (name, code, city, country_code) values ('BS Other Branch', 'BSO', 'Test City', 'IN');
insert into bs_test.ids select 'b_lko', id from public.branches where code = 'LKO';
insert into bs_test.ids select 'b_oth', id from public.branches where code = 'BSO';

-- A branch-scoped job manager: no seeded role is one today, so the jobs guard is proven with it.
insert into public.roles (key, label) values ('BS_BRANCH_JOBS', 'BS test: jobs in own branch');
insert into public.role_permissions (role_key, permission_id, scope)
select 'BS_BRANCH_JOBS', p.id, s.scope
  from (values ('jobs.view', 'all'), ('jobs.manage', 'branch')) as s(perm, scope)
  join public.permissions p on p.key = s.perm;

insert into public.staff_users (email, full_name, role_key, branch_id) values
  ('bs-super@gogulf.co',  'BS Super',       'SUPER_ADMIN',    bs_test.id('b_lko')),
  ('bs-admin@gogulf.co',  'BS Admin',       'ADMIN',          bs_test.id('b_lko')),
  ('bs-hr@gogulf.co',     'BS HR',          'HR_MANAGER',     bs_test.id('b_lko')),
  ('bs-hroth@gogulf.co',  'BS HR Other',    'HR_MANAGER',     bs_test.id('b_oth')),
  ('bs-rec@gogulf.co',    'BS Recruiter',   'RECRUITER',      bs_test.id('b_lko')),
  ('bs-acc@gogulf.co',    'BS Accounts',    'ACCOUNTS',       bs_test.id('b_lko')),
  ('bs-jobs@gogulf.co',   'BS Branch Jobs', 'BS_BRANCH_JOBS', bs_test.id('b_lko'));
insert into bs_test.ids select 's_' || split_part(split_part(email, '@', 1), '-', 2), id from public.staff_users where email like 'bs-%@gogulf.co';

insert into public.contacts (full_name, branch_id, owner_id) values
  ('BS Lucknow Contact', bs_test.id('b_lko'), bs_test.id('s_rec')),
  ('BS Second Contact',  bs_test.id('b_lko'), bs_test.id('s_rec')),
  ('BS Other Contact',   bs_test.id('b_oth'), null),
  ('BS HR Contact',      bs_test.id('b_lko'), bs_test.id('s_hr'));
insert into bs_test.ids select case full_name when 'BS Lucknow Contact' then 'c_lko' when 'BS Second Contact' then 'c_two'
                                              when 'BS Other Contact' then 'c_oth' else 'c_hr' end, id
  from public.contacts where full_name like 'BS %';

select bs_test.new_case('BS case HR',    'c_lko', 'b_lko', 'nobody');
select bs_test.new_case('BS case Rec',   'c_lko', 'b_lko', 's_rec');
select bs_test.new_case('BS case Other', 'c_oth', 'b_oth', 'nobody');
select bs_test.new_case('BS case Cross', 'c_lko', 'b_oth', 'nobody'); -- a Lucknow person's case run by the other branch
select bs_test.new_case('BS case Move',  'c_two', 'b_lko', 'nobody');
insert into bs_test.ids select case title when 'BS case HR' then 'k_hr' when 'BS case Rec' then 'k_rec' when 'BS case Other' then 'k_oth'
                                          when 'BS case Cross' then 'k_cross' else 'k_move' end, id
  from public.cases where title like 'BS case %';
insert into public.case_recruitment (case_id) values (bs_test.id('k_rec')), (bs_test.id('k_hr'));

insert into public.tasks (title, contact_id, branch_id) values ('BS task', bs_test.id('c_lko'), bs_test.id('b_lko'));
insert into public.tasks (title, case_id, branch_id) values ('BS move task', bs_test.id('k_move'), bs_test.id('b_lko'));
insert into public.tasks (title, contact_id, branch_id) values ('BS contact task', bs_test.id('c_two'), bs_test.id('b_lko'));
insert into bs_test.ids select case title when 'BS task' then 't_lko' when 'BS move task' then 't_move' else 't_contact' end, id
  from public.tasks where title like 'BS %task';

insert into public.notes (contact_id, body, visibility, author_id) values (bs_test.id('c_lko'), 'BS note', 'team', bs_test.id('s_rec'));
insert into public.notes (contact_id, case_id, body, visibility, author_id) values (bs_test.id('c_two'), bs_test.id('k_move'), 'BS case note', 'team', bs_test.id('s_admin'));
insert into bs_test.ids select case body when 'BS note' then 'n_rec' else 'n_move' end, id from public.notes where body like 'BS %note';

insert into public.job_applications (full_name, email, phone, job_title, cv_path, passport_path, page_source)
values ('BS Applicant', 'bs-app@example.com', '+919000077001', 'General', 'bs/cv', 'bs/pp', 'bs-app'),
       ('BS Far Applicant', 'bs-far@example.com', '+919000077002', 'General', 'bs/cv2', 'bs/pp2', 'bs-far');
insert into bs_test.ids select case page_source when 'bs-app' then 'app' else 'app_far' end, id from public.job_applications where page_source like 'bs-%';
-- The second application belongs to the other branch but is assigned to the Lucknow recruiter.
update public.job_applications set branch_id = bs_test.id('b_oth'), assignee_id = bs_test.id('s_rec') where id = bs_test.id('app_far');

select public.log_activity(bs_test.id('c_lko'), bs_test.id('k_cross'), 'system', null, 'bs.case_entry', 'BS entry on the other branch''s case');
select public.log_activity(bs_test.id('c_lko'), null, 'system', null, 'bs.contact_entry', 'BS entry on the contact');

set local role authenticated;

-- ===========================================================================
-- 1. Every succeeded row of BRANCH-SCOPE-AUDIT.md is now refused
-- ===========================================================================
select bs_test.act_as('s_hr');
select bs_test.check(bs_test.affected(format($$update public.cases set owner_id = %L where id = %L$$, bs_test.id('s_hr'), bs_test.id('k_hr'))) = 1,
  'HR_MANAGER may still take ownership of a case in its own branch');
select bs_test.check(bs_test.error_of(format($$update public.cases set branch_id = %L where id = %L$$, bs_test.id('b_oth'), bs_test.id('k_hr'))) like '42501:%branch_change_requires_all_scope%',
  'audit row 1 — HR_MANAGER cannot then move that case to another branch');

select bs_test.act_as('s_rec');
select bs_test.check(bs_test.error_of(format($$update public.cases set branch_id = %L where id = %L$$, bs_test.id('b_oth'), bs_test.id('k_rec'))) like '42501:%branch_change_requires_all_scope%',
  'audit row 2 — RECRUITER cannot move a case it owns to another branch');
select bs_test.check(bs_test.new_case('BS forged case', 'c_lko', 'b_oth', 's_rec') like '42501:%cross_branch_write_requires_all_scope%',
  'audit row 3 — RECRUITER cannot create a case in another branch (owner = self)');

select bs_test.act_as('s_hr');
select bs_test.check(bs_test.affected(format($$update public.tasks set assignee_id = %L where id = %L$$, bs_test.id('s_hr'), bs_test.id('t_lko'))) = 1,
  'HR_MANAGER may still assign a task in its own branch to itself');
select bs_test.check(bs_test.error_of(format($$update public.tasks set branch_id = %L where id = %L$$, bs_test.id('b_oth'), bs_test.id('t_lko'))) like '23514:%task_branch_follows_parent%',
  'audit row 4 — HR_MANAGER cannot then move that task to another branch');

select bs_test.act_as('s_rec');
select bs_test.check(bs_test.error_of(format($$insert into public.tasks (title, branch_id, assignee_id) values ('BS forged task', %L, %L)$$, bs_test.id('b_oth'), bs_test.id('s_rec'))) like '42501:%cross_branch_write_requires_all_scope%',
  'audit row 5 — RECRUITER cannot create a task in another branch assigned to itself');

select bs_test.act_as('s_hr');
select bs_test.affected(format($$update public.tasks set created_by = %L where id = %L$$, bs_test.id('s_rec'), bs_test.id('t_lko')));
select bs_test.check(bs_test.val(format('select created_by::text from public.tasks where id = %L', bs_test.id('t_lko'))) is null,
  'audit row 6 — HR_MANAGER cannot rewrite who created a task (the write leaves it as it was)');

select bs_test.act_as('s_hr');
select bs_test.check(bs_test.affected(format($$update public.job_applications set assignee_id = %L where id = %L$$, bs_test.id('s_hr'), bs_test.id('app'))) = 1,
  'HR_MANAGER may still assign an application in its own branch to itself');
select bs_test.check(bs_test.error_of(format($$update public.job_applications set branch_id = %L where id = %L$$, bs_test.id('b_oth'), bs_test.id('app'))) like '42501:%branch_change_requires_all_scope%',
  'audit row 7 — HR_MANAGER cannot then move that application to another branch');

select bs_test.act_as('s_rec');
select bs_test.check(bs_test.error_of(format($$insert into public.contacts (full_name, branch_id, owner_id) values ('BS forged contact', %L, %L)$$, bs_test.id('b_oth'), bs_test.id('s_rec'))) like '42501:%cross_branch_write_requires_all_scope%',
  'audit row 8 — RECRUITER cannot create a contact in another branch owned by itself');

select bs_test.act_as('s_acc');
select bs_test.check(bs_test.error_of(format($$insert into public.invoices (customer_name, purpose, line_items, branch_id) values ('BS', 'x', '[{"description":"a","quantity":1,"unit_amount_minor":100}]', %L)$$, bs_test.id('b_oth'))) like '42501:%cross_branch_write_requires_all_scope%',
  'audit row 9 — ACCOUNTS cannot create a draft invoice in another branch');

select bs_test.act_as('s_rec');
select bs_test.check(bs_test.error_of(format($$update public.notes set contact_id = %L where id = %L$$, bs_test.id('c_two'), bs_test.id('n_rec'))) like '23514:%note_parent_locked%',
  'audit row 10 — a note stays on its contact, even one the author can see (was refused only by visibility)');
select bs_test.check(bs_test.error_of(format($$update public.contacts set branch_id = %L where id = %L$$, bs_test.id('b_oth'), bs_test.id('c_lko'))) is not null,
  'audit row 11 — RECRUITER still cannot move a contact it owns to another branch');

-- The same moves for branch-scoped staff with no ownership at all.
select bs_test.act_as('s_hr');
select bs_test.check(bs_test.error_of(format($$update public.contacts set branch_id = %L where id = %L$$, bs_test.id('b_oth'), bs_test.id('c_hr'))) like '42501:%',
  'HR_MANAGER cannot move a contact of its branch to another branch');
select bs_test.check(bs_test.error_of(format($$insert into public.contacts (full_name, branch_id) values ('BS null-owner elsewhere', %L)$$, bs_test.id('b_oth'))) is not null,
  'HR_MANAGER cannot create a contact in another branch');
select bs_test.act_as('s_jobs');
select bs_test.check(bs_test.error_of(format($$insert into public.jobs (title, category_id, branch_id) select 'BS Job Elsewhere', c.id, %L from public.job_categories c where c.slug = 'labour'$$, bs_test.id('b_oth'))) like '42501:%cross_branch_write_requires_all_scope%',
  'a branch-scoped job manager cannot create a job in another branch (created_by = self no longer carries it)');
select bs_test.check(bs_test.error_of($$insert into public.jobs (title, category_id) select 'BS Job Here', c.id from public.job_categories c where c.slug = 'labour'$$) is null,
  'positive control: the branch-scoped job manager creates a job in its own branch');
select bs_test.check(bs_test.error_of($$update public.jobs set branch_id = (select v from bs_test.ids where k = 'b_oth') where title = 'BS Job Here'$$) like '42501:%branch_change_requires_all_scope%',
  'and cannot move it to another branch');

-- ===========================================================================
-- 2. All-scope positive controls
-- ===========================================================================
select bs_test.act_as('s_admin');
select bs_test.check(bs_test.new_case('BS admin case elsewhere', 'c_oth', 'b_oth', 's_admin') is null,
  'ADMIN creates a case in another branch');
select bs_test.check(bs_test.affected(format($$update public.cases set branch_id = %L where id = %L$$, bs_test.id('b_oth'), bs_test.id('k_move'))) = 1,
  'ADMIN moves a case to another branch');
select bs_test.check(bs_test.error_of(format($$insert into public.tasks (title, branch_id) values ('BS admin free task', %L)$$, bs_test.id('b_oth'))) is null,
  'ADMIN creates a free-standing task in another branch');
select bs_test.check(bs_test.affected(format($$update public.job_applications set branch_id = %L where id = %L$$, bs_test.id('b_oth'), bs_test.id('app'))) = 1,
  'ADMIN moves an application to another branch');
select bs_test.check(bs_test.error_of(format($$insert into public.contacts (full_name, branch_id) values ('BS admin contact elsewhere', %L)$$, bs_test.id('b_oth'))) is null,
  'ADMIN creates a contact in another branch');
select bs_test.check(bs_test.error_of(format($$insert into public.invoices (customer_name, purpose, line_items, branch_id) values ('BS admin', 'x', '[{"description":"a","quantity":1,"unit_amount_minor":100}]', %L)$$, bs_test.id('b_oth'))) is null,
  'ADMIN creates a draft invoice in another branch');
select bs_test.check(bs_test.error_of(format($$insert into public.jobs (title, category_id, branch_id) select 'BS Admin Job', c.id, %L from public.job_categories c where c.slug = 'labour'$$, bs_test.id('b_oth'))) is null,
  'ADMIN creates a job in another branch');
select bs_test.act_as('s_super');
select bs_test.check(bs_test.affected(format($$update public.contacts set branch_id = %L where id = %L$$, bs_test.id('b_oth'), bs_test.id('c_hr'))) = 1,
  'SUPER_ADMIN moves a contact to another branch');
select bs_test.check(bs_test.affected(format($$update public.contacts set branch_id = %L where id = %L$$, bs_test.id('b_lko'), bs_test.id('c_hr'))) = 1,
  'SUPER_ADMIN moves it back');

-- ===========================================================================
-- 3. Children follow their parent
-- ===========================================================================
reset role;
select bs_test.check(bs_test.val(format('select branch_id::text from public.tasks where id = %L', bs_test.id('t_move'))) = bs_test.id('b_oth')::text
                 and bs_test.val(format('select branch_id::text from public.notes where id = %L', bs_test.id('n_move'))) = bs_test.id('b_oth')::text,
  'when ADMIN moved the case, its task and note moved with it');
update public.contacts set branch_id = bs_test.id('b_oth') where id = bs_test.id('c_two');
select bs_test.check(bs_test.val(format('select branch_id::text from public.tasks where id = %L', bs_test.id('t_contact'))) = bs_test.id('b_oth')::text,
  'a contact''s own tasks follow the contact to another branch');
select bs_test.check(bs_test.val(format('select branch_id::text from public.tasks where id = %L', bs_test.id('t_move'))) = bs_test.id('b_oth')::text,
  'a task on a case follows the case, not the contact');
update public.contacts set branch_id = bs_test.id('b_lko') where id = bs_test.id('c_two');
set local role authenticated;

select bs_test.act_as('s_rec');
select bs_test.check(bs_test.error_of(format($$insert into public.tasks (title, case_id, assignee_id) values ('BS on own case', %L, %L)$$, bs_test.id('k_rec'), bs_test.id('s_rec'))) is null,
  'positive control: RECRUITER adds a task to its own case');
reset role;
select bs_test.check(bs_test.val($$select branch_id::text || '/' || contact_id::text from public.tasks where title = 'BS on own case'$$)
                     = bs_test.id('b_lko')::text || '/' || bs_test.id('c_lko')::text,
  'the task takes the case''s branch and contact');
set local role authenticated;
select bs_test.act_as('s_rec');
select bs_test.check(bs_test.error_of(format($$insert into public.tasks (title, case_id, assignee_id) values ('BS on hidden case', %L, %L)$$, bs_test.id('k_oth'), bs_test.id('s_rec'))) like '42501:%task_parent_not_available%',
  'RECRUITER cannot attach a task to a case it cannot see');
select bs_test.check(bs_test.error_of(format($$insert into public.tasks (title, contact_id, assignee_id) values ('BS on hidden contact', %L, %L)$$, bs_test.id('c_oth'), bs_test.id('s_rec'))) like '42501:%task_parent_not_available%',
  'RECRUITER cannot attach a task to a contact it cannot see');
select bs_test.check(bs_test.error_of(format($$insert into public.tasks (title, case_id, contact_id, assignee_id) values ('BS mismatched', %L, %L, %L)$$, bs_test.id('k_rec'), bs_test.id('c_two'), bs_test.id('s_rec'))) like '23514:%task_parent_mismatch%',
  'a task''s case must belong to its contact');
select bs_test.check(bs_test.error_of(format($$insert into public.tasks (title, case_id, branch_id, assignee_id) values ('BS forged branch', %L, %L, %L)$$, bs_test.id('k_rec'), bs_test.id('b_oth'), bs_test.id('s_rec'))) like '23514:%task_branch_follows_parent%',
  'a forged branch on a task with a parent is refused, not quietly kept');
select bs_test.check(bs_test.error_of(format($$update public.tasks set case_id = %L where title = 'BS on own case'$$, bs_test.id('k_oth'))) like '42501:%task_parent_not_available%',
  'RECRUITER cannot re-point its task at a case it cannot see');
select bs_test.check(bs_test.error_of(format($$insert into public.notes (contact_id, case_id, body, author_id) values (%L, %L, 'BS note on hidden case', %L)$$, bs_test.id('c_lko'), bs_test.id('k_cross'), bs_test.id('s_rec'))) like '42501:%note_parent_not_available%',
  'RECRUITER cannot write a note on a case it cannot see, even for a contact it owns');
select bs_test.check(bs_test.error_of(format($$insert into public.notes (contact_id, case_id, body, author_id) values (%L, %L, 'BS mismatched note', %L)$$, bs_test.id('c_two'), bs_test.id('k_rec'), bs_test.id('s_rec'))) like '23514:%note_parent_mismatch%',
  'a note''s case must belong to its contact');
select bs_test.check(bs_test.error_of(format($$insert into public.notes (contact_id, case_id, body, author_id, branch_id) values (%L, %L, 'BS good note', %L, %L)$$, bs_test.id('c_lko'), bs_test.id('k_rec'), bs_test.id('s_rec'), bs_test.id('b_oth'))) is null,
  'positive control: RECRUITER writes a note on its own case');
reset role;
select bs_test.check(bs_test.val($$select branch_id::text from public.notes where body = 'BS good note'$$) = bs_test.id('b_lko')::text,
  'a note''s branch is its case''s, whatever the insert claimed');
set local role authenticated;

-- ===========================================================================
-- 4. Parents are fixed for staff
-- ===========================================================================
select bs_test.act_as('s_admin');
select bs_test.check(bs_test.error_of(format($$update public.cases set contact_id = %L where id = %L$$, bs_test.id('c_two'), bs_test.id('k_hr'))) like '23514:%case_parent_locked%',
  'even ADMIN moves a case to another contact only by merging contacts');
select bs_test.check(bs_test.error_of(format($$update public.case_recruitment set case_id = %L where case_id = %L$$, bs_test.id('k_oth'), bs_test.id('k_rec'))) like '23514:%case_recruitment_parent_locked%',
  'recruitment details stay on their case');
select bs_test.check(bs_test.error_of(format($$update public.job_applications set contact_id = %L where id = %L$$, bs_test.id('c_lko'), bs_test.id('app_far'))) like '23514:%application_link_locked%',
  'an application is linked to a contact only by converting it');
select bs_test.act_as('s_acc');
select bs_test.check(bs_test.error_of(format($$insert into public.invoices (customer_name, purpose, line_items, contact_id) values ('BS', 'x', '[{"description":"a","quantity":1,"unit_amount_minor":100}]', %L)$$, bs_test.id('c_oth'))) like '42501:%invoice_parent_not_available%',
  'ACCOUNTS cannot bill a contact it cannot see');
select bs_test.check(bs_test.error_of(format($$insert into public.invoices (customer_name, purpose, line_items, contact_id, case_id) values ('BS', 'x', '[{"description":"a","quantity":1,"unit_amount_minor":100}]', %L, %L)$$, bs_test.id('c_hr'), bs_test.id('k_hr'))) like '23514:%invoice_parent_mismatch%',
  'an invoice''s case must belong to its contact');

-- ===========================================================================
-- 5. Creator fields and frozen provenance
-- ===========================================================================
select bs_test.act_as('s_rec');
select bs_test.check(bs_test.error_of(format($$insert into public.tasks (title, contact_id, assignee_id, created_by, completed_by, completed_at) values ('BS forged creator', %L, %L, %L, %L, '2020-01-01')$$,
                                              bs_test.id('c_lko'), bs_test.id('s_rec'), bs_test.id('s_admin'), bs_test.id('s_admin'))) is null,
  'RECRUITER creates a task while claiming someone else made and completed it');
reset role;
select bs_test.check(bs_test.val($$select created_by::text || '/' || coalesce(completed_by::text, '-') || '/' || coalesce(completed_at::text, '-') from public.tasks where title = 'BS forged creator'$$)
                     = bs_test.id('s_rec')::text || '/-/-',
  'the task records its real creator and no invented completion');
set local role authenticated;
select bs_test.act_as('s_rec');
select bs_test.affected($$update public.tasks set status = 'done' where title = 'BS forged creator'$$);
reset role;
select bs_test.check(bs_test.val($$select completed_by::text from public.tasks where title = 'BS forged creator'$$) = bs_test.id('s_rec')::text
                 and bs_test.val($$select (completed_at is not null)::text from public.tasks where title = 'BS forged creator'$$) = 'true',
  'completing a task records who and when, by the database');
set local role authenticated;
select bs_test.act_as('s_rec');
select bs_test.affected($$update public.tasks set status = 'open' where title = 'BS forged creator'$$);
reset role;
select bs_test.check(bs_test.val($$select (completed_at is null and completed_by is null)::text from public.tasks where title = 'BS forged creator'$$) = 'true',
  'reopening a task clears its completion');

set local role authenticated;
select bs_test.act_as('s_hr');
select bs_test.check(bs_test.error_of(format($$insert into public.cases (case_number, contact_id, case_type, pipeline_id, stage_id, title, branch_id, owner_id, created_by)
    select public.next_case_number('recruitment'), %L, 'recruitment', p.id, s.id, 'BS HR case', %L, %L, %L
      from public.pipelines p join public.pipeline_stages s on s.pipeline_id = p.id and s.key = 'new' where p.case_type = 'recruitment' and p.is_default$$,
    bs_test.id('c_hr'), bs_test.id('b_lko'), bs_test.id('s_hr'), bs_test.id('s_admin'))) is null,
  'HR_MANAGER opens a case in its own branch while claiming ADMIN created it');
reset role;
select bs_test.check(bs_test.val($$select created_by::text from public.cases where title = 'BS HR case'$$) = bs_test.id('s_hr')::text,
  'the case records its real creator');
select bs_test.check(exists (select 1 from public.audit_logs where action = 'cases.insert' and entity_id = (select id from public.cases where title = 'BS HR case') and actor_id = bs_test.id('s_hr')),
  'opening a case is audited (0005 covered only edits and deletions)');
create temp table bs_before on commit drop as
  select case_number, created_at, opened_at, created_by, stage_entered_at from public.cases where id = bs_test.id('k_hr');
set local role authenticated;
select bs_test.act_as('s_hr');
select bs_test.affected(format($$update public.cases set case_number = 'GG-REC-FAKE', created_at = '2000-01-01', opened_at = '2000-01-01', created_by = %L, stage_entered_at = '2000-01-01', title = 'BS renamed' where id = %L$$, bs_test.id('s_rec'), bs_test.id('k_hr')));
reset role;
select bs_test.check((select k.case_number = b.case_number and k.created_at = b.created_at and k.opened_at = b.opened_at
                             and k.created_by is not distinct from b.created_by and k.stage_entered_at = b.stage_entered_at and k.title = 'BS renamed'
                        from public.cases k, bs_before b where k.id = bs_test.id('k_hr')),
  'a case''s number, creation, opening and stage-entry times and creator cannot be rewritten; its title still can');

-- ===========================================================================
-- 6. Tasks are cancelled, never deleted; every task change is audited
-- ===========================================================================
set local role authenticated;
select bs_test.act_as('s_hr');
select bs_test.check(bs_test.affected(format($$delete from public.tasks where id = %L$$, bs_test.id('t_lko'))) = -1,
  'HR_MANAGER cannot delete a task');
select bs_test.act_as('s_admin');
select bs_test.check(bs_test.affected(format($$delete from public.tasks where id = %L$$, bs_test.id('t_lko'))) = -1,
  'neither can ADMIN — a task is cancelled');
select bs_test.act_as('s_hr');
select bs_test.check(bs_test.affected(format($$update public.tasks set status = 'cancelled' where id = %L$$, bs_test.id('t_lko'))) = 1,
  'HR_MANAGER cancels the task instead');
reset role;
select bs_test.check((select count(*) from public.audit_logs where entity_id = bs_test.id('t_lko') and action = 'tasks.update') >= 2
                 and exists (select 1 from public.audit_logs where action = 'tasks.insert' and entity_id = (select id from public.tasks where title = 'BS forged creator')),
  'creating and changing tasks is audited');

-- ===========================================================================
-- 7. The timeline
-- ===========================================================================
set local role authenticated;
select bs_test.act_as('s_hr');
select bs_test.check((select count(*) from public.activities where verb = 'bs.contact_entry') = 1,
  'HR_MANAGER reads the contact-level entry of a contact in its branch');
select bs_test.check((select count(*) from public.activities where verb = 'bs.case_entry') = 0,
  'but not the entry on that person''s case run by another branch — timeline visibility follows the case');
select bs_test.act_as('s_hroth');
select bs_test.check((select count(*) from public.activities where verb = 'bs.case_entry') = 1,
  'the other branch, which runs the case, reads it');
select bs_test.act_as('s_rec');
select bs_test.check(bs_test.affected(format($$insert into public.activities (contact_id, actor_type, actor_id, verb, summary) values (%L, 'staff', %L, 'case.employer_linked', 'Employer linked: forged')$$, bs_test.id('c_lko'), bs_test.id('s_rec'))) = -1,
  'staff cannot insert a timeline entry directly, not even as themselves on their own contact');
select bs_test.check(bs_test.error_of(format($$select public.log_activity(%L, null, 'staff', %L, 'x', 'forged')$$, bs_test.id('c_lko'), bs_test.id('s_rec'))) like '42501:%',
  'nor through log_activity(), which staff cannot call');
select bs_test.check(not public.activity_is_customer_visible('case.employer_linked') and not public.activity_is_customer_visible('contact.merged')
                 and not public.activity_is_customer_visible('application.converted') and not public.activity_is_customer_visible('internal.anything'),
  'employer, merge, conversion and internal entries are not candidate-visible');

-- ===========================================================================
-- 8. Trusted functions: conversion and merge keep working, and vouch only for themselves
-- ===========================================================================
select bs_test.act_as('s_rec');
select bs_test.check(bs_test.error_of(format($$select public.convert_job_application(%L)$$, bs_test.id('app_far'))) is null,
  'RECRUITER converts the other branch''s application assigned to it: the records land in the application''s branch');
reset role;
select bs_test.check((select k.branch_id = bs_test.id('b_oth') and c.branch_id = bs_test.id('b_oth') and k.created_by = bs_test.id('s_rec')
                        from public.job_applications a join public.cases k on k.id = a.case_id join public.contacts c on c.id = a.contact_id
                       where a.id = bs_test.id('app_far')),
  'the converted contact and case are in the application''s branch, the case records its creator');
select bs_test.check(exists (select 1 from public.activities v join public.job_applications a on a.id = v.entity_id
                              where a.id = bs_test.id('app_far') and v.verb = 'application.converted' and v.actor_id = bs_test.id('s_rec')
                                and v.case_id = a.case_id and (v.metadata ->> 'contact_created')::boolean),
  'the conversion''s timeline entry is written by the database, attributed to the recruiter');
select bs_test.check(coalesce(current_setting('app.trusted_write', true), '') = '',
  'conversion leaves nothing trusted behind in the transaction');
set local role authenticated;
select bs_test.act_as('s_rec');
select bs_test.check(bs_test.error_of(format($$insert into public.contacts (full_name, branch_id, owner_id) values ('BS after conversion', %L, %L)$$, bs_test.id('b_oth'), bs_test.id('s_rec'))) like '42501:%cross_branch_write_requires_all_scope%',
  'straight after converting, the same recruiter still cannot create a contact in another branch');

select bs_test.act_as('s_admin');
select bs_test.check(bs_test.error_of(format($$select public.merge_contacts(%L, %L, 'bs')$$, bs_test.id('c_oth'), bs_test.id('c_two'))) is null,
  'ADMIN merges a Lucknow contact into the other branch''s contact');
reset role;
select bs_test.check(bs_test.val(format('select branch_id::text from public.tasks where id = %L', bs_test.id('t_contact'))) = bs_test.id('b_oth')::text
                 and bs_test.val(format('select contact_id::text from public.tasks where id = %L', bs_test.id('t_contact'))) = bs_test.id('c_oth')::text,
  'the merged contact''s own task moved to the survivor and took its branch');
select bs_test.check(bs_test.val(format('select branch_id::text from public.tasks where id = %L', bs_test.id('t_move'))) = bs_test.id('b_oth')::text
                 and bs_test.val(format('select contact_id::text from public.tasks where id = %L', bs_test.id('t_move'))) = bs_test.id('c_oth')::text,
  'a task on a moved case follows its case to the survivor, and stays in the case''s branch');
set local role authenticated;
select bs_test.act_as('s_hr');
select bs_test.check(bs_test.error_of(format($$select public.merge_contacts(%L, %L, 'bs')$$, bs_test.id('c_lko'), bs_test.id('c_oth'))) like '42501:%not_permitted%',
  'HR_MANAGER still cannot merge across branches: the other branch''s contact is outside its merge scope (0021)');

rollback;
