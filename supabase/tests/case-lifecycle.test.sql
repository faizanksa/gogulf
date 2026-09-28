-- =============================================================================
-- Case lifecycle (0025 Step 1): the ten stages, creation, one-step movement, the
-- exceptional move, Joined/won, close and reopen with reasons, tasks on closing,
-- the four separate permissions, ownership, the staff guard and the role grants.
-- Sections A–M follow the Step 1 test list in docs/CASE-LIFECYCLE.md.
--
-- DISPOSABLE DATABASE ONLY. One transaction, rolled back.
-- =============================================================================

begin;

create schema cl_test;
grant usage on schema cl_test to anon, authenticated, service_role;

create function cl_test.check(condition boolean, description text)
returns void language plpgsql as $$
begin
  if condition then raise notice 'PASS  %', description;
  else raise exception 'FAIL  %', description;
  end if;
end $$;

-- 'SQLSTATE: message' of a failing statement, or null when it succeeds.
create function cl_test.error_of(stmt text) returns text language plpgsql as $$
begin
  execute stmt;
  return null;
exception when others then
  return sqlstate || ': ' || sqlerrm;
end $$;

create table cl_test.ids (k text primary key, v uuid);
grant select, insert on cl_test.ids to anon, authenticated, service_role;

create function cl_test.id(p_key text) returns uuid
language sql stable security definer set search_path = '' as $$
  select v from cl_test.ids where k = p_key
$$;

create function cl_test.act_as(p_key text) returns void
language plpgsql security definer set search_path = '' as $$
declare s record;
begin
  select su.id, su.role_key, su.branch_id into s from public.staff_users su where su.id = cl_test.id(p_key);
  perform set_config('request.jwt.claims', json_build_object(
    'sub', gen_random_uuid(), 'role', 'authenticated',
    'app_staff_id', s.id, 'app_role', s.role_key, 'app_branch', s.branch_id)::text, true);
end $$;

-- Read a value as the database owner, whatever the caller may see.
create function cl_test.val(p_sql text) returns text
language plpgsql volatile security definer set search_path = '' as $$
declare r text;
begin
  execute p_sql into r;
  return r;
end $$;

-- VOLATILE, so a read in the same statement as a move sees the move.
create function cl_test.stage(p_case text) returns text
language sql volatile security definer set search_path = '' as $$
  select s.key from public.cases c join public.pipeline_stages s on s.id = c.stage_id where c.id = cl_test.id(p_case)
$$;

create function cl_test.status(p_case text) returns text
language sql volatile security definer set search_path = '' as $$
  select c.status::text from public.cases c where c.id = cl_test.id(p_case)
$$;

-- Open a recruitment case at the given stage key as the current caller; error text or null.
create function cl_test.new_case(p_title text, p_contact text, p_branch text, p_owner text, p_stage text default 'new', p_status text default 'open')
returns text language plpgsql as $$
begin
  return cl_test.error_of(format($f$
    insert into public.cases (case_number, contact_id, case_type, pipeline_id, stage_id, title, branch_id, owner_id, status)
    select public.next_case_number('recruitment'), %L, 'recruitment', p.id, s.id, %L, %L, %L, %L::public.case_status
      from public.pipelines p join public.pipeline_stages s on s.pipeline_id = p.id and s.key = %L
     where p.case_type = 'recruitment' and p.is_default$f$,
    cl_test.id(p_contact), p_title, cl_test.id(p_branch), cl_test.id(p_owner), p_status, p_stage));
end $$;

create function cl_test.move(p_case text, p_stage text, p_reason text default null, p_exceptional boolean default false) returns text
language plpgsql as $$
begin
  return cl_test.error_of(format('select public.move_case_stage(%L, %L, %L, %L)', cl_test.id(p_case), p_stage, p_reason, p_exceptional));
end $$;

create function cl_test.close(p_case text, p_outcome text, p_reason text, p_note text default null) returns text
language plpgsql as $$
begin
  return cl_test.error_of(format('select public.close_case(%L, %L, %L, %L)', cl_test.id(p_case), p_outcome, p_reason, p_note));
end $$;

create function cl_test.reopen(p_case text, p_reason text) returns text
language plpgsql as $$
begin
  return cl_test.error_of(format('select public.reopen_case(%L, %L)', cl_test.id(p_case), p_reason));
end $$;

create function cl_test.assign(p_case text, p_owner text) returns text
language plpgsql as $$
begin
  return cl_test.error_of(format('select public.assign_case(%L, %L)', cl_test.id(p_case), cl_test.id(p_owner)));
end $$;

grant execute on all functions in schema cl_test to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Fixtures (as postgres, a trusted system writer)
-- ---------------------------------------------------------------------------
insert into public.branches (name, code, city, country_code) values ('CL Other Branch', 'CLO', 'Test City', 'IN');
insert into cl_test.ids select 'b_lko', id from public.branches where code = 'LKO';
insert into cl_test.ids select 'b_oth', id from public.branches where code = 'CLO';

insert into public.staff_users (email, full_name, role_key, branch_id, is_active) values
  ('cl-super@gogulf.co',  'CL Super',       'SUPER_ADMIN',        cl_test.id('b_lko'), true),
  ('cl-admin@gogulf.co',  'CL Admin',       'ADMIN',              cl_test.id('b_lko'), true),
  ('cl-hr@gogulf.co',     'CL HR',          'HR_MANAGER',         cl_test.id('b_lko'), true),
  ('cl-hroth@gogulf.co',  'CL HR Other',    'HR_MANAGER',         cl_test.id('b_oth'), true),
  ('cl-hroff@gogulf.co',  'CL HR Inactive', 'HR_MANAGER',         cl_test.id('b_lko'), false),
  ('cl-rec@gogulf.co',    'CL Recruiter',   'RECRUITER',          cl_test.id('b_lko'), true),
  ('cl-rectwo@gogulf.co', 'CL Recruiter 2', 'RECRUITER',          cl_test.id('b_lko'), true),
  ('cl-ops@gogulf.co',    'CL Operations',  'OPERATIONS_MANAGER', cl_test.id('b_lko'), true),
  ('cl-acc@gogulf.co',    'CL Accounts',    'ACCOUNTS',           cl_test.id('b_lko'), true);
insert into cl_test.ids select 's_' || split_part(split_part(email, '@', 1), '-', 2), id from public.staff_users where email like 'cl-%@gogulf.co';

insert into public.contacts (full_name, branch_id) values
  ('CL Candidate', cl_test.id('b_lko')), ('CL Other Candidate', cl_test.id('b_oth'));
insert into cl_test.ids select case full_name when 'CL Candidate' then 'c_lko' else 'c_oth' end, id
  from public.contacts where full_name like 'CL %';

-- ===========================================================================
-- A. Stage definitions
-- ===========================================================================
select cl_test.check(
  (select array_agg(s.key order by s.position) from public.pipeline_stages s join public.pipelines p on p.id = s.pipeline_id
    where p.case_type = 'recruitment' and p.is_default)
  = array['new', 'contacted', 'documents', 'screening', 'interview', 'selected', 'processing', 'visa', 'travel', 'completed'],
  'A1 the recruitment pipeline is exactly ten stages, in order');
select cl_test.check(
  (select string_agg(s.name, ' → ' order by s.position) from public.pipeline_stages s join public.pipelines p on p.id = s.pipeline_id
    where p.case_type = 'recruitment' and p.is_default)
  = 'New Lead → Contacted → Documents Pending → Screening → Interview → Selected → Offer & Processing → Visa Processing → Travel Preparation → Joined',
  'A2 their names are New Lead … Joined');
select cl_test.check(
  (select array_agg(s.position order by s.position) from public.pipeline_stages s join public.pipelines p on p.id = s.pipeline_id
    where p.case_type = 'recruitment' and p.is_default) = array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  'A3 positions run 1 to 10 without a gap');
select cl_test.check(
  not exists (select 1 from public.pipeline_stages where key in ('legacy_imported', 'lost') or is_lost),
  'A4 there is no legacy_imported stage and no Lost stage (lost is an outcome)');
select cl_test.check(
  (select string_agg(key, ',') from public.pipeline_stages where is_won) = 'completed',
  'A5 Joined is the one won stage');
select cl_test.check(
  (select count(*) from public.audit_logs where action = 'pipeline_stages.retire' and actor_type = 'system') = 2,
  'A6 both removed stages are on the audit trail');
select cl_test.check(
  not has_table_privilege('authenticated', 'public.pipeline_stages', 'INSERT')
  and not has_table_privilege('authenticated', 'public.pipeline_stages', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.pipeline_stages', 'DELETE')
  and not has_table_privilege('authenticated', 'public.pipelines', 'UPDATE')
  and not exists (select 1 from pg_policies where tablename in ('pipelines', 'pipeline_stages') and cmd <> 'SELECT'),
  'A7 stage definitions have no API write path, not even for settings.manage');
set local role authenticated;
select cl_test.act_as('s_super');
select cl_test.check(
  cl_test.error_of($$update public.pipeline_stages set name = 'Renamed' where key = 'new'$$) like '42501:%',
  'A8 a SUPER_ADMIN session cannot rename a stage through the API');
reset role;

-- ===========================================================================
-- B. Creation
-- ===========================================================================
set local role authenticated;
select cl_test.act_as('s_hr');
select cl_test.check(cl_test.new_case('CL main', 'c_lko', 'b_lko', 's_hr') is null,
  'B1 HR_MANAGER opens a case in its branch');
select cl_test.check(cl_test.new_case('CL skip in', 'c_lko', 'b_lko', 's_hr', 'screening') like '23514:%case_must_start_at_first_stage%',
  'B2 a case cannot be created at a later stage');
select cl_test.check(cl_test.new_case('CL born won', 'c_lko', 'b_lko', 's_hr', 'completed', 'won') like '23514:%case_must_start_open%',
  'B3 a case cannot be created won');
select cl_test.check(cl_test.new_case('CL born lost', 'c_lko', 'b_lko', 's_hr', 'new', 'lost') like '23514:%case_must_start_open%',
  'B4 a case cannot be created lost');
select cl_test.act_as('s_admin');
select cl_test.check(cl_test.new_case('CL for rec', 'c_lko', 'b_lko', 's_rec') is null,
  'B5 ADMIN (cases.assign) may open a case for a recruiter');
select cl_test.act_as('s_rec');
select cl_test.check(cl_test.new_case('CL rec hands', 'c_lko', 'b_lko', 's_hr') like '42501:%case_assign_requires_permission%',
  'B6 a RECRUITER (no cases.assign) cannot open a case in someone else''s name');
reset role;
select cl_test.check(cl_test.new_case('CL system skip', 'c_lko', 'b_lko', 's_hr', 'selected') like '23514:%case_must_start_at_first_stage%',
  'B7 not even a system (owner) write creates a case at an arbitrary stage');
select cl_test.check(
  (select c.status = 'open' and s.key = 'new' from public.cases c join public.pipeline_stages s on s.id = c.stage_id where c.title = 'CL main'),
  'B8 the new case is open at New Lead');
insert into cl_test.ids select case title when 'CL main' then 'k_main' else 'k_rec' end, id from public.cases where title in ('CL main', 'CL for rec');

-- Conversion keeps creating open + New Lead.
insert into public.job_applications (full_name, email, phone, job_title, cv_path, passport_path, page_source)
values ('CL Applicant', 'cl-app@example.com', '+919000088001', 'General', 'cl/cv', 'cl/pp', 'cl-app');
update public.job_applications set branch_id = cl_test.id('b_lko') where page_source = 'cl-app';
set local role authenticated;
select cl_test.act_as('s_hr');
select cl_test.check(
  cl_test.error_of($$select public.convert_job_application((select id from public.job_applications where page_source = 'cl-app'))$$) is null,
  'B9 HR_MANAGER converts an application');
reset role;
select cl_test.check(
  (select c.status = 'open' and s.key = 'new' and c.owner_id = cl_test.id('s_hr')
     from public.job_applications a join public.cases c on c.id = a.case_id join public.pipeline_stages s on s.id = c.stage_id
    where a.page_source = 'cl-app'),
  'B10 conversion still opens the case open at New Lead, owned by the converter');

-- ===========================================================================
-- C. Forward movement
-- ===========================================================================
set local role authenticated;
select cl_test.act_as('s_hr');
select cl_test.check(cl_test.move('k_main', 'contacted') is null and cl_test.stage('k_main') = 'contacted',
  'C1 one stage forward, no reason needed');
select cl_test.check(cl_test.move('k_main', 'screening') like '23514:%stage_skip_not_allowed%' and cl_test.stage('k_main') = 'contacted',
  'C2 skipping a stage forward is refused');
select cl_test.check(cl_test.move('k_main', 'contacted') like '23514:%stage_unchanged%',
  'C3 moving to the current stage is refused');
select cl_test.check(cl_test.move('k_main', 'no_such_stage') like '23514:%stage_not_in_pipeline%',
  'C4 an unknown stage is refused');
reset role;
select cl_test.check(
  exists (select 1 from public.activities where case_id = cl_test.id('k_main') and verb = 'case.stage_changed'
           and summary = 'Stage: New Lead → Contacted' and metadata ->> 'direction' = 'forward')
  and exists (select 1 from public.audit_logs where action = 'case.stage_changed' and entity_id = cl_test.id('k_main')
               and actor_id = cl_test.id('s_hr')),
  'C5 the move is on the case timeline and the audit trail, as the mover');
select cl_test.check(
  (select stage_entered_at > now() - interval '1 minute' from public.cases where id = cl_test.id('k_main')),
  'C6 the stage entry time is reset');

-- ===========================================================================
-- D. Backward movement
-- ===========================================================================
set local role authenticated;
select cl_test.act_as('s_hr');
select cl_test.check(cl_test.move('k_main', 'new') like '23514:%reason_required%',
  'D1 moving back without a reason is refused');
select cl_test.check(cl_test.move('k_main', 'new', '   ') like '23514:%reason_required%',
  'D2 a blank reason is no reason');
select cl_test.check(cl_test.move('k_main', 'new', 'Wrong number; recontact') is null and cl_test.stage('k_main') = 'new',
  'D3 one stage back with a reason');
select cl_test.move('k_main', 'contacted');
select cl_test.move('k_main', 'documents');
select cl_test.move('k_main', 'screening');
select cl_test.check(cl_test.move('k_main', 'contacted', 'Two back') like '23514:%stage_skip_not_allowed%' and cl_test.stage('k_main') = 'screening',
  'D4 moving back two stages is refused, even with a reason');
reset role;
select cl_test.check(
  exists (select 1 from public.activities where case_id = cl_test.id('k_main') and verb = 'case.stage_changed'
           and metadata ->> 'direction' = 'backward' and metadata ->> 'reason' = 'Wrong number; recontact'),
  'D5 the backward move records its reason');

-- ===========================================================================
-- E. Exceptional movement
-- ===========================================================================
set local role authenticated;
select cl_test.act_as('s_hr');
select cl_test.check(cl_test.move('k_main', 'visa', 'Urgent', true) like '42501:%exceptional_move_admin_only%',
  'E1 HR_MANAGER cannot make an exceptional move');
select cl_test.act_as('s_rec');
select cl_test.check(cl_test.move('k_rec', 'screening', 'Urgent', true) like '42501:%exceptional_move_admin_only%',
  'E2 a RECRUITER cannot make an exceptional move, even on its own case');
select cl_test.act_as('s_admin');
select cl_test.check(cl_test.move('k_main', 'visa', null, true) like '23514:%reason_required%',
  'E3 an exceptional move needs a reason');
select cl_test.check(cl_test.move('k_main', 'visa', 'Visa already in hand from the employer', true) is null and cl_test.stage('k_main') = 'visa',
  'E4 ADMIN makes an explicit exceptional move forward with a reason');
select cl_test.act_as('s_super');
select cl_test.check(cl_test.move('k_main', 'documents', 'Documents found invalid', true) is null and cl_test.stage('k_main') = 'documents',
  'E5 SUPER_ADMIN makes an explicit exceptional move back with a reason');
select cl_test.act_as('s_admin');
select cl_test.check(cl_test.move('k_main', 'interview') like '23514:%stage_skip_not_allowed%',
  'E6 without the exceptional flag, ADMIN is bound by the one-step rule too');
reset role;
select cl_test.check(
  (select count(*) from public.activities where case_id = cl_test.id('k_main') and metadata ->> 'direction' = 'exceptional'
      and summary like '%(exceptional move)') = 2,
  'E7 exceptional moves are marked on the timeline');

-- ===========================================================================
-- F. Joined
-- ===========================================================================
set local role authenticated;
select cl_test.act_as('s_admin');
select cl_test.move('k_rec', 'travel', 'Fixture: to Travel Preparation', true);
select cl_test.act_as('s_rec');
select cl_test.check(cl_test.move('k_rec', 'completed') like '42501:%joined_requires_close_permission%' and cl_test.status('k_rec') = 'open',
  'F1 a RECRUITER (stage change, no close) cannot move its case to Joined');
select cl_test.act_as('s_hr');
select cl_test.check(cl_test.close('k_main', 'won', null) like '23514:%won_only_via_joined%',
  'F2 there is no "close as won" from an earlier stage');
select cl_test.check(cl_test.move('k_rec', 'completed') is null,
  'F3 HR_MANAGER (stage change + close) moves Travel Preparation → Joined');
reset role;
select cl_test.check(
  (select c.status = 'won' and s.key = 'completed' and c.closed_at is not null and c.closed_by = cl_test.id('s_hr')
          and c.reopen_stage_id = (select id from public.pipeline_stages where key = 'travel') and c.close_reason is null
     from public.cases c join public.pipeline_stages s on s.id = c.stage_id where c.id = cl_test.id('k_rec')),
  'F4 Joined makes the case won, records who closed it, and remembers Travel Preparation');
set local role authenticated;
select cl_test.act_as('s_admin');
select cl_test.check(
  cl_test.error_of(format($$update public.cases set status = 'won' where id = %L$$, cl_test.id('k_main'))) like '42501:%permission denied%'
  and cl_test.error_of(format($$update public.cases set stage_id = (select id from public.pipeline_stages where key = 'completed') where id = %L$$, cl_test.id('k_main'))) like '42501:%permission denied%'
  and cl_test.error_of(format($$update public.cases set owner_id = %L where id = %L$$, cl_test.id('s_admin'), cl_test.id('k_main'))) like '42501:%permission denied%',
  'F5 staff cannot write status, stage or owner directly, even ADMIN');
reset role;
select cl_test.check(
  cl_test.error_of(format($$update public.cases set status = 'won', stage_id = (select id from public.pipeline_stages where key = 'completed'), closed_at = now(), reopen_stage_id = stage_id where id = %L$$, cl_test.id('k_main')))
    like '42501:%case_lifecycle_via_functions%'
  and cl_test.error_of(format($$update public.cases set stage_id = (select id from public.pipeline_stages where key = 'selected') where id = %L$$, cl_test.id('k_main')))
    like '42501:%case_lifecycle_via_functions%',
  'F6 a direct database write (service role / owner) cannot change stage or status either');

-- ===========================================================================
-- G. Closed cases do not move
-- ===========================================================================
set local role authenticated;
select cl_test.act_as('s_admin');
select cl_test.check(cl_test.move('k_rec', 'travel', 'Back', false) like '23514:%case_closed_reopen_first%'
                 and cl_test.move('k_rec', 'selected', 'Back', true) like '23514:%case_closed_reopen_first%',
  'G1 a won case cannot change stage, not even by an exceptional move');
select cl_test.new_case('CL lost', 'c_lko', 'b_lko', 's_hr');
select cl_test.new_case('CL cancelled', 'c_lko', 'b_lko', 's_hr');
reset role;
insert into cl_test.ids select case title when 'CL lost' then 'k_lost' else 'k_canc' end, id from public.cases where title in ('CL lost', 'CL cancelled');
set local role authenticated;
select cl_test.act_as('s_admin');
select cl_test.move('k_lost', 'interview', 'Fixture: to Interview', true);
select cl_test.move('k_canc', 'screening', 'Fixture: to Screening', true);

-- ===========================================================================
-- I. Closing and its tasks
-- ===========================================================================
reset role;
insert into public.tasks (title, case_id, status) values
  ('CL open task', cl_test.id('k_lost'), 'open'),
  ('CL progress task', cl_test.id('k_lost'), 'in_progress'),
  ('CL done task', cl_test.id('k_lost'), 'done'),
  ('CL cancelled task', cl_test.id('k_lost'), 'cancelled');
set local role authenticated;
select cl_test.act_as('s_rec');
select cl_test.check(cl_test.close('k_lost', 'lost', 'failed_medical') like '%case_not_found%',
  'I1 a RECRUITER cannot close a case it does not own (it cannot see it)');
select cl_test.act_as('s_hroth');
select cl_test.check(cl_test.close('k_lost', 'lost', 'failed_medical') like '%case_not_found%',
  'I2 HR_MANAGER of another branch cannot close a Lucknow case');
select cl_test.act_as('s_hr');
select cl_test.check(cl_test.close('k_lost', 'lost', null) like '23514:%close_reason_invalid%',
  'I3 lost needs a reason');
select cl_test.check(cl_test.close('k_lost', 'lost', 'created_in_error') like '23514:%close_reason_invalid%',
  'I4 a cancellation reason is not a lost reason');
select cl_test.check(cl_test.close('k_lost', 'lost', 'other') like '23514:%close_note_required%'
                 and cl_test.close('k_lost', 'lost', 'other', '  ') like '23514:%close_note_required%',
  'I5 "Other" needs a note');
select cl_test.check(cl_test.close('k_lost', 'open', 'failed_medical') like '23514:%close_outcome_invalid%',
  'I6 only lost or cancelled are closing outcomes');
select cl_test.check(cl_test.close('k_lost', 'lost', 'failed_medical') is null,
  'I7 HR_MANAGER closes its branch''s case as lost with a listed reason');
reset role;
select cl_test.check(
  (select c.status = 'lost' and c.close_reason = 'failed_medical' and c.closed_by = cl_test.id('s_hr')
          and c.reopen_stage_id = c.stage_id and s.key = 'interview'
     from public.cases c join public.pipeline_stages s on s.id = c.stage_id where c.id = cl_test.id('k_lost')),
  'I8 a lost case keeps its stage (Interview) and records reason, closer and the stage to return to');
select cl_test.check(
  (select string_agg(title || '=' || status, ', ' order by title) from public.tasks where case_id = cl_test.id('k_lost'))
  = 'CL cancelled task=cancelled, CL done task=done, CL open task=cancelled, CL progress task=cancelled',
  'I9 closing cancels open and in-progress tasks; done and cancelled tasks are unchanged; none is deleted');
select cl_test.check(
  exists (select 1 from public.activities where case_id = cl_test.id('k_lost') and verb = 'case.closed'
           and summary = 'Closed as lost: Failed medical (2 open tasks cancelled)')
  and exists (select 1 from public.audit_logs where action = 'case.closed' and entity_id = cl_test.id('k_lost')),
  'I10 the closure is on the timeline and the audit trail');
set local role authenticated;
select cl_test.act_as('s_hr');
select cl_test.check(cl_test.close('k_canc', 'cancelled', 'failed_medical') like '23514:%close_reason_invalid%',
  'I11 a lost reason is not a cancellation reason');
select cl_test.check(cl_test.close('k_canc', 'cancelled', 'other', 'Client merged two requisitions') is null,
  'I12 cancelled with "Other" and a note');
select cl_test.check(cl_test.close('k_canc', 'lost', 'failed_medical') like '23514:%case_already_closed%',
  'I13 a closed case is not closed again');
reset role;
select cl_test.check(
  cl_test.error_of(format($$update public.cases set close_reason = 'visa_refused' where id = %L$$, cl_test.id('k_lost'))) like '42501:%case_lifecycle_via_functions%',
  'I14 the reason cannot be rewritten afterwards');
select cl_test.check(
  not public.activity_is_customer_visible('case.closed') and not public.activity_is_customer_visible('case.stage_changed')
  and not public.activity_is_customer_visible('case.reopened') and not public.activity_is_customer_visible('case.assigned'),
  'I15 lifecycle entries (and so lost reasons) are not candidate-visible');

-- ===========================================================================
-- H. Reopening
-- ===========================================================================
set local role authenticated;
select cl_test.act_as('s_rec');
select cl_test.check(cl_test.reopen('k_rec', 'Candidate back') like '42501:%case_reopen_requires_permission%',
  'H1 a RECRUITER cannot reopen, even its own case');
select cl_test.act_as('s_hr');
select cl_test.check(cl_test.reopen('k_rec', null) like '23514:%reason_required%',
  'H2 reopening needs a reason');
select cl_test.check(cl_test.reopen('k_main', 'x') like '23514:%case_not_closed%',
  'H3 an open case is not reopened');
select cl_test.check(cl_test.reopen('k_rec', 'Candidate returned before flying') is null,
  'H4 HR_MANAGER reopens a won case in its branch');
select cl_test.check(cl_test.stage('k_rec') = 'travel' and cl_test.status('k_rec') = 'open',
  'H5 a won case reopens at the stage before Joined (Travel Preparation)');
select cl_test.check(cl_test.reopen('k_lost', 'Medical re-test passed') is null
                 and cl_test.stage('k_lost') = 'interview' and cl_test.status('k_lost') = 'open',
  'H6 a lost case reopens at its last active stage (Interview → Lost → Reopen → Interview)');
select cl_test.act_as('s_admin');
select cl_test.check(cl_test.reopen('k_canc', 'Requisition restored') is null
                 and cl_test.stage('k_canc') = 'screening' and cl_test.status('k_canc') = 'open',
  'H7 ADMIN reopens a cancelled case at its last active stage');
reset role;
select cl_test.check(
  (select closed_at is null and closed_by is null and close_reason is null and close_note is null and reopen_stage_id is null
     from public.cases where id = cl_test.id('k_lost')),
  'H8 reopening clears the closure details');
select cl_test.check(
  exists (select 1 from public.activities where case_id = cl_test.id('k_lost') and verb = 'case.reopened'
           and summary = 'Reopened (was lost) at Interview' and metadata ->> 'reason' = 'Medical re-test passed')
  and exists (select 1 from public.audit_logs where action = 'case.reopened' and entity_id = cl_test.id('k_lost')
               and actor_id = cl_test.id('s_hr') and new_values ->> 'reason' = 'Medical re-test passed'),
  'H9 case.reopened is on the timeline and the audit trail, with the reason');
select cl_test.check(
  (select count(*) from public.tasks where case_id = cl_test.id('k_lost')) = 4
  and (select count(*) from public.tasks where case_id = cl_test.id('k_lost') and status in ('open', 'in_progress')) = 0,
  'H10 reopening does not recreate or reopen cancelled tasks');
set local role authenticated;
select cl_test.act_as('s_hr');
select cl_test.check(cl_test.move('k_lost', 'selected') is null,
  'H11 a reopened case moves again');
reset role;

-- ===========================================================================
-- J. Ownership and assignment
-- ===========================================================================
set local role authenticated;
select cl_test.act_as('s_hr');
select cl_test.check(cl_test.assign('k_main', 's_hroff') like '23514:%owner_inactive%',
  'J1 an inactive staff member cannot own a case');
select cl_test.check(cl_test.assign('k_main', 's_hroth') like '23514:%owner_other_branch%',
  'J2 a staff member of another branch cannot own the case');
select cl_test.check(cl_test.assign('k_main', 's_acc') like '23514:%owner_role_not_eligible%'
                 and cl_test.assign('k_main', 's_ops') like '23514:%owner_role_not_eligible%',
  'J3 an ineligible role (ACCOUNTS, OPERATIONS_MANAGER) cannot own a case');
select cl_test.check(cl_test.assign('k_main', 's_super') is null,
  'J4 SUPER_ADMIN is an eligible owner');
select cl_test.check(cl_test.assign('k_main', 's_rec') is null,
  'J5 HR_MANAGER hands a case to a recruiter of its branch');
reset role;
select cl_test.check(
  exists (select 1 from public.activities where case_id = cl_test.id('k_main') and verb = 'case.assigned'
           and summary = 'Owner: CL Super → CL Recruiter')
  and exists (select 1 from public.audit_logs where action = 'case.assigned' and entity_id = cl_test.id('k_main')),
  'J6 assignment is on the timeline and the audit trail');
-- A recruiter whose role could not view cases: take RECRUITER's cases.view away (rolled back).
delete from public.role_permissions rp using public.permissions p
 where rp.permission_id = p.id and rp.role_key = 'RECRUITER' and p.key = 'cases.view';
set local role authenticated;
select cl_test.act_as('s_hr');
select cl_test.check(cl_test.assign('k_lost', 's_rectwo') like '23514:%owner_cannot_view%',
  'J7 an owner who could not view the case is refused');
reset role;
insert into public.role_permissions (role_key, permission_id, scope)
select 'RECRUITER', id, 'own' from public.permissions where key = 'cases.view';
set local role authenticated;
select cl_test.act_as('s_rec');
select cl_test.check(cl_test.assign('k_main', 's_rectwo') like '42501:%case_assign_requires_permission%',
  'J8 a RECRUITER (no cases.assign) cannot hand its case to someone else');
select cl_test.check(cl_test.assign('k_canc', 's_rec') is not null,
  'J9 a RECRUITER cannot take a case that is not its own');
select cl_test.act_as('s_hr');
select cl_test.check(cl_test.assign('k_main', 'nobody') is null
                 and cl_test.val(format('select owner_id::text from public.cases where id = %L', cl_test.id('k_main'))) is null,
  'J10 HR_MANAGER can leave a case unassigned');
select cl_test.act_as('s_rec');
select cl_test.check(cl_test.assign('k_main', 's_rec') is not null
                 and cl_test.val(format('select owner_id::text from public.cases where id = %L', cl_test.id('k_main'))) is null,
  'J11 a RECRUITER cannot take an unassigned case');
select cl_test.act_as('s_hroth');
select cl_test.check(cl_test.assign('k_lost', 's_hroth') like '%case_not_found%',
  'J12 HR_MANAGER of another branch cannot assign a Lucknow case');
select cl_test.act_as('s_hr');
select cl_test.check(cl_test.assign('k_main', 's_rec') is null, 'J13 (fixture) the recruiter owns the main case again');
reset role;
select cl_test.check(
  cl_test.error_of(format($$update public.cases set owner_id = %L where id = %L$$, cl_test.id('s_acc'), cl_test.id('k_main'))) like '23514:%owner_role_not_eligible%',
  'J14 a direct database write cannot give an open case an ineligible owner either');

-- ===========================================================================
-- K. Staff lifecycle
-- ===========================================================================
set local role authenticated;
select cl_test.act_as('s_super');
select cl_test.check(
  cl_test.error_of(format($$update public.staff_users set is_active = false where id = %L$$, cl_test.id('s_rec'))) like '23514:%staff_owns_open_cases%',
  'K1 a recruiter who owns an open case cannot be deactivated');
select cl_test.check(
  cl_test.error_of(format($$update public.staff_users set branch_id = %L where id = %L$$, cl_test.id('b_oth'), cl_test.id('s_rec'))) like '23514:%staff_owns_open_cases%',
  'K2 … nor moved to another branch');
select cl_test.check(
  cl_test.error_of(format($$update public.staff_users set role_key = 'ACCOUNTS' where id = %L$$, cl_test.id('s_rec'))) like '23514:%staff_owns_open_cases%',
  'K3 … nor given a role that cannot own cases');
select cl_test.check(
  cl_test.error_of(format($$delete from public.staff_users where id = %L$$, cl_test.id('s_rec'))) like '23514:%staff_owns_open_cases%',
  'K4 … nor removed');
select cl_test.check(
  cl_test.error_of(format($$update public.staff_users set role_key = 'HR_MANAGER', full_name = 'CL Recruiter promoted' where id = %L$$, cl_test.id('s_rec'))) is null,
  'K5 a change that keeps the owner eligible (RECRUITER → HR_MANAGER, same branch) is allowed');
select cl_test.check(
  cl_test.error_of(format($$update public.staff_users set role_key = 'RECRUITER' where id = %L$$, cl_test.id('s_rec'))) is null,
  'K5b (fixture) back to RECRUITER');
-- Reassign one of the recruiter's open cases and close the other: the historical owner may then leave.
select cl_test.act_as('s_hr');
select cl_test.check(cl_test.assign('k_rec', 's_hr') is null and cl_test.close('k_main', 'lost', 'candidate_withdrew') is null,
  'K5c (fixture) the recruiter''s open cases are reassigned or closed');
select cl_test.act_as('s_super');
select cl_test.check(
  cl_test.error_of(format($$update public.staff_users set is_active = false where id = %L$$, cl_test.id('s_rec'))) is null,
  'K6 once its cases are closed, the recruiter can be deactivated');
reset role;
select cl_test.check(
  (select owner_id = cl_test.id('s_rec') from public.cases where id = cl_test.id('k_main')),
  'K7 the closed case keeps its historical owner');
set local role authenticated;
select cl_test.act_as('s_hr');
select cl_test.check(cl_test.reopen('k_main', 'Candidate back') like '23514:%case_owner_invalid_reassign_first%',
  'K8 a closed case whose owner left is reassigned before it reopens');
select cl_test.check(cl_test.assign('k_main', 's_hr') is null and cl_test.reopen('k_main', 'Candidate back') is null,
  'K9 after assigning an eligible owner, it reopens');
reset role;

-- ===========================================================================
-- L. Role grants
-- ===========================================================================
select cl_test.check(
  public.role_has_perm('ADMIN', 'cases.close', 'all') and public.role_has_perm('ADMIN', 'cases.assign', 'all')
  and public.role_has_perm('SUPER_ADMIN', 'cases.close', 'all'),
  'L1 ADMIN and SUPER_ADMIN close, reopen and assign in every branch');
select cl_test.check(
  public.role_has_perm('HR_MANAGER', 'cases.close', 'branch') and not public.role_has_perm('HR_MANAGER', 'cases.close', 'all')
  and public.role_has_perm('HR_MANAGER', 'cases.assign', 'branch') and not public.role_has_perm('HR_MANAGER', 'cases.assign', 'all'),
  'L2 HR_MANAGER closes, reopens and assigns in its own branch only');
select cl_test.check(
  not public.role_has_perm('RECRUITER', 'cases.close', 'own') and not public.role_has_perm('RECRUITER', 'cases.assign', 'own')
  and public.role_has_perm('RECRUITER', 'cases.stage.change', 'own') and not public.role_has_perm('RECRUITER', 'cases.stage.change', 'branch'),
  'L3 RECRUITER keeps stage change on its own cases and cannot close, reopen or assign');
select cl_test.check(
  not public.role_has_perm('OPERATIONS_MANAGER', 'cases.close', 'own') and not public.role_has_perm('OPERATIONS_MANAGER', 'cases.assign', 'own')
  and exists (select 1 from public.roles where key = 'OPERATIONS_MANAGER')
  and not exists (select 1 from public.role_permissions where role_key = 'TRAVEL_MANAGER'),
  'L4 OPERATIONS_MANAGER (kept) no longer closes or assigns cases; TRAVEL_MANAGER holds nothing');
select cl_test.check(
  (select count(*) from public.audit_logs where action = 'role_permissions.delete' and old_values ->> 'role_key' = 'OPERATIONS_MANAGER'
      and old_values ->> 'permission_id' in (select id::text from public.permissions where key in ('cases.close', 'cases.assign'))) = 2,
  'L5 the two removed grants are on the audit trail');
set local role authenticated;
select cl_test.act_as('s_ops');
select cl_test.check(cl_test.close('k_canc', 'cancelled', 'created_in_error') like '42501:%case_close_requires_permission%',
  'L6 OPERATIONS_MANAGER can no longer close a case (live check)');
reset role;

-- ===========================================================================
-- M. Production-compatible data
-- ===========================================================================
-- The one production case: recruitment, open, New Lead, owned by a SUPER_ADMIN of its branch.
select cl_test.check(cl_test.new_case('CL prod-like', 'c_lko', 'b_lko', 's_super') is null,
  'M1 a case shaped like the production case is valid under every new rule');
insert into cl_test.ids select 'k_prod', id from public.cases where title = 'CL prod-like';
set local role authenticated;
select cl_test.act_as('s_hr');
select cl_test.check(
  cl_test.error_of(format($$update public.cases set title = 'CL prod-like (renamed)', priority = 2 where id = %L$$, cl_test.id('k_prod'))) is null,
  'M2 ordinary edits (title, priority) still work under cases.update');
reset role;
select cl_test.check(
  not exists (select 1 from pg_constraint where conrelid = 'public.cases'::regclass and contype = 'c' and not convalidated),
  'M3 the new constraints are validated against existing rows, not left NOT VALID');

rollback;
