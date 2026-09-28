-- =============================================================================
-- Security and data-integrity hardening (0024): portal identity, merge records, deletions,
-- case soft delete, application conversion, note visibility. Each finding is proven closed
-- for staff sessions, and each trusted path (merge, conversion, the server) proven intact.
--
-- DISPOSABLE DATABASE ONLY. One transaction, rolled back.
-- =============================================================================

begin;

create schema ih_test;
grant usage on schema ih_test to anon, authenticated, service_role;

create function ih_test.check(condition boolean, description text)
returns void language plpgsql as $$
begin
  if condition then raise notice 'PASS  %', description;
  else raise exception 'FAIL  %', description;
  end if;
end $$;

create function ih_test.error_of(stmt text) returns text language plpgsql as $$
begin
  execute stmt;
  return null;
exception when others then
  return sqlstate || ': ' || sqlerrm;
end $$;

create function ih_test.affected(stmt text) returns bigint language plpgsql as $$
declare n bigint;
begin
  execute stmt;
  get diagnostics n = row_count;
  return n;
exception when others then
  return -1;
end $$;

create table ih_test.ids (k text primary key, v uuid);
grant select, insert on ih_test.ids to anon, authenticated, service_role;

create function ih_test.id(p_key text) returns uuid
language sql stable security definer set search_path = '' as $$
  select v from ih_test.ids where k = p_key
$$;

create function ih_test.act_as(p_key text) returns void
language plpgsql security definer set search_path = '' as $$
declare s record;
begin
  select su.id, su.role_key, su.branch_id into s from public.staff_users su where su.id = ih_test.id(p_key);
  perform set_config('request.jwt.claims', json_build_object(
    'sub', gen_random_uuid(), 'role', 'authenticated',
    'app_staff_id', s.id, 'app_role', s.role_key, 'app_branch', s.branch_id)::text, true);
end $$;

create function ih_test.val(p_sql text) returns text
language plpgsql security definer set search_path = '' as $$
declare r text;
begin
  execute p_sql into r;
  return r;
end $$;

grant execute on all functions in schema ih_test to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Fixtures (as postgres — a trusted system writer)
-- ---------------------------------------------------------------------------
insert into ih_test.ids select 'b_lko', id from public.branches where code = 'LKO';
insert into ih_test.ids select 'portal_user', gen_random_uuid();
insert into public.staff_users (email, full_name, role_key, branch_id) values
  ('ih-super@gogulf.co', 'IH Super',     'SUPER_ADMIN', ih_test.id('b_lko')),
  ('ih-admin@gogulf.co', 'IH Admin',     'ADMIN',       ih_test.id('b_lko')),
  ('ih-hr@gogulf.co',    'IH HR',        'HR_MANAGER',  ih_test.id('b_lko')),
  ('ih-rec@gogulf.co',   'IH Recruiter', 'RECRUITER',   ih_test.id('b_lko'));
insert into ih_test.ids select 's_' || split_part(split_part(email, '@', 1), '-', 2), id from public.staff_users where email like 'ih-%@gogulf.co';

insert into public.contacts (full_name, branch_id, owner_id) values
  ('IH Candidate', ih_test.id('b_lko'), ih_test.id('s_rec')),
  ('IH Other',     ih_test.id('b_lko'), ih_test.id('s_rec')),
  ('IH Duplicate', ih_test.id('b_lko'), null);
insert into ih_test.ids select case full_name when 'IH Candidate' then 'c_cand' when 'IH Other' then 'c_other' else 'c_dup' end, id
  from public.contacts where full_name like 'IH %';

-- The trusted path: a verified phone, and a portal link, written by the system.
insert into public.contact_identities (contact_id, type, value_raw, is_primary, verified_at, source) values
  (ih_test.id('c_cand'), 'phone', '+91 90000 88001', true, now(), 'otp'),
  (ih_test.id('c_dup'), 'auth_user', ih_test.id('portal_user')::text, false, now(), 'otp');
insert into ih_test.ids select case type when 'phone' then 'i_phone' else 'i_portal' end, id
  from public.contact_identities where contact_id in (ih_test.id('c_cand'), ih_test.id('c_dup'));

insert into public.cases (case_number, contact_id, case_type, pipeline_id, stage_id, title, branch_id, owner_id)
select public.next_case_number('recruitment'), ih_test.id('c_cand'), 'recruitment', p.id, s.id, 'IH case', ih_test.id('b_lko'), ih_test.id('s_rec')
  from public.pipelines p join public.pipeline_stages s on s.pipeline_id = p.id and s.key = 'new' where p.case_type = 'recruitment' and p.is_default;
insert into ih_test.ids select 'case', id from public.cases where title = 'IH case';
insert into public.case_recruitment (case_id, legacy_job_title) values (ih_test.id('case'), 'IH legacy role');

insert into public.job_applications (full_name, email, phone, job_title, cv_path, passport_path, page_source)
values ('IH Applicant', 'ih-app@example.com', '+919000088002', 'General', 'ih/cv', 'ih/pp', 'ih-app');
insert into ih_test.ids select 'app', id from public.job_applications where page_source = 'ih-app';

insert into public.notes (contact_id, body, visibility, author_id) values (ih_test.id('c_cand'), 'IH note', 'team', ih_test.id('s_hr'));
insert into ih_test.ids select 'note', id from public.notes where body = 'IH note';

select ih_test.check(
  (select contact_id from public.contact_identities where type = 'auth_user' and value_normalized = ih_test.id('portal_user')::text) = ih_test.id('c_dup'),
  'baseline: a system-written auth_user identity is what maps a portal session to a contact');

set local role authenticated;

-- ===========================================================================
-- 1. Portal identity and verification are not staff-assertable
-- ===========================================================================
select ih_test.act_as('s_hr');
select ih_test.check(ih_test.error_of(format($$insert into public.contact_identities (contact_id, type, value_raw) values (%L, 'auth_user', %L)$$, ih_test.id('c_other'), gen_random_uuid())) like '42501:%identity_portal_link_reserved%',
  'HR_MANAGER cannot link a portal account to a contact');
select ih_test.act_as('s_admin');
select ih_test.check(ih_test.error_of(format($$insert into public.contact_identities (contact_id, type, value_raw) values (%L, 'auth_user', %L)$$, ih_test.id('c_other'), gen_random_uuid())) like '42501:%identity_portal_link_reserved%',
  'nor can ADMIN');
select ih_test.act_as('s_super');
select ih_test.check(ih_test.error_of(format($$insert into public.contact_identities (contact_id, type, value_raw) values (%L, 'auth_user', %L)$$, ih_test.id('c_other'), gen_random_uuid())) like '42501:%identity_portal_link_reserved%',
  'nor can SUPER_ADMIN, from a staff session');
select ih_test.act_as('s_admin');
select ih_test.check(ih_test.error_of(format($$update public.contact_identities set contact_id = %L where id = %L$$, ih_test.id('c_other'), ih_test.id('i_portal'))) like '42501:%identity_portal_link_reserved%',
  'an existing portal link cannot be moved to another contact by staff');
select ih_test.check(ih_test.error_of(format($$update public.contact_identities set value_raw = %L where id = %L$$, gen_random_uuid(), ih_test.id('i_portal'))) like '42501:%identity_portal_link_reserved%',
  'nor re-pointed at another portal account');
select ih_test.check(ih_test.error_of(format($$insert into public.contact_identities (contact_id, type, value_raw, verified_at) values (%L, 'email', 'ih-new@example.com', now())$$, ih_test.id('c_other'))) like '42501:%identity_verification_reserved%',
  'staff cannot add an identity as already verified');
select ih_test.act_as('s_rec');
select ih_test.check(ih_test.error_of(format($$insert into public.contact_identities (contact_id, type, value_raw) values (%L, 'email', 'ih-unverified@example.com')$$, ih_test.id('c_other'))) is null,
  'positive control: RECRUITER still adds an unverified email to its own candidate');
select ih_test.check(ih_test.error_of($$update public.contact_identities set verified_at = now() where value_normalized = 'ih-unverified@example.com'$$) like '42501:%identity_verification_reserved%',
  'and cannot then mark it verified');
select ih_test.check(ih_test.error_of($$update public.contact_identities set type = 'auth_user' where value_normalized = 'ih-unverified@example.com'$$) like '42501:%identity_portal_link_reserved%',
  'nor turn it into a portal link');
select ih_test.check(ih_test.error_of(format($$update public.contact_identities set contact_id = %L where value_normalized = 'ih-unverified@example.com'$$, ih_test.id('c_cand'))) like '23514:%identity_parent_locked%',
  'nor move an identity to another contact');
select ih_test.check(ih_test.affected(format($$update public.contact_identities set value_raw = '+91 90000 88009' where id = %L$$, ih_test.id('i_phone'))) = 1,
  'correcting a verified phone number is allowed');
reset role;
select ih_test.check(ih_test.val(format('select verified_at::text from public.contact_identities where id = %L', ih_test.id('i_phone'))) is null,
  'but the corrected number is no longer verified — verification belonged to the old value');
select ih_test.check(exists (select 1 from public.audit_logs where action = 'contact_identities.update' and entity_id = ih_test.id('i_phone')),
  'identity changes are audited');
set local role authenticated;

-- ===========================================================================
-- 2. Merge records come only from merge_contacts()
-- ===========================================================================
select ih_test.act_as('s_admin');
select ih_test.check(ih_test.affected(format($$insert into public.contact_merges (winner_id, loser_id, merged_by, reason, snapshot) values (%L, %L, %L, 'forged', '{}')$$,
                                              ih_test.id('c_cand'), ih_test.id('c_other'), ih_test.id('s_admin'))) = -1,
  'ADMIN cannot insert a merge record directly');
select ih_test.act_as('s_hr');
select ih_test.check(ih_test.affected(format($$insert into public.contact_merges (winner_id, loser_id, merged_by, reason, snapshot) values (%L, %L, %L, 'forged', '{}')$$,
                                              ih_test.id('c_cand'), ih_test.id('c_other'), ih_test.id('s_hr'))) = -1,
  'nor can HR_MANAGER');
select ih_test.act_as('s_admin');
select ih_test.check(ih_test.error_of(format($$select public.merge_contacts(%L, %L, 'ih')$$, ih_test.id('c_cand'), ih_test.id('c_dup'))) is null,
  'positive control: ADMIN merges through merge_contacts()');
reset role;
select ih_test.check(exists (select 1 from public.contact_merges where winner_id = ih_test.id('c_cand') and loser_id = ih_test.id('c_dup') and merged_by = ih_test.id('s_admin')),
  'the merge record exists, written by the function');
select ih_test.check((select contact_id = ih_test.id('c_cand') and verified_at is not null from public.contact_identities where id = ih_test.id('i_portal')),
  'the merge moved the portal link with its verification intact (trusted path)');
set local role authenticated;

-- ===========================================================================
-- 3. No silent deletion of recruitment details or identities
-- ===========================================================================
select ih_test.act_as('s_admin');
select ih_test.check(ih_test.affected(format($$delete from public.case_recruitment where case_id = %L$$, ih_test.id('case'))) = -1,
  'ADMIN cannot delete a case''s recruitment details');
select ih_test.act_as('s_rec');
select ih_test.check(ih_test.affected(format($$delete from public.case_recruitment where case_id = %L$$, ih_test.id('case'))) = -1,
  'nor can the owning RECRUITER');
select ih_test.check(ih_test.affected(format($$delete from public.contact_identities where id = %L$$, ih_test.id('i_phone'))) = -1,
  'RECRUITER cannot delete its candidate''s phone identity');
select ih_test.act_as('s_super');
select ih_test.check(ih_test.affected(format($$delete from public.contact_identities where id = %L$$, ih_test.id('i_portal'))) = -1,
  'SUPER_ADMIN cannot delete a portal link from a staff session');
reset role;
select ih_test.check(ih_test.val(format('select count(*)::text from public.case_recruitment where case_id = %L', ih_test.id('case'))) = '1',
  'the recruitment details are still there');
set local role authenticated;

-- ===========================================================================
-- 4. Soft-deleting a case needs cases.delete
-- ===========================================================================
select ih_test.act_as('s_rec');
select ih_test.check(ih_test.error_of(format($$update public.cases set deleted_at = now() where id = %L$$, ih_test.id('case'))) like '42501:%case_delete_requires_permission%',
  'the owning RECRUITER cannot hide its case by setting deleted_at');
select ih_test.act_as('s_hr');
select ih_test.check(ih_test.error_of(format($$update public.cases set deleted_at = now() where id = %L$$, ih_test.id('case'))) like '42501:%case_delete_requires_permission%',
  'nor can HR_MANAGER (cases.update, no cases.delete)');
select ih_test.check(ih_test.error_of(format($$insert into public.cases (case_number, contact_id, case_type, pipeline_id, stage_id, owner_id, branch_id, deleted_at)
    select public.next_case_number('recruitment'), %L, 'recruitment', p.id, s.id, %L, %L, now()
      from public.pipelines p join public.pipeline_stages s on s.pipeline_id = p.id and s.key = 'new' where p.case_type = 'recruitment' and p.is_default$$,
    ih_test.id('c_other'), ih_test.id('s_hr'), ih_test.id('b_lko'))) like '42501:%case_delete_requires_permission%',
  'nor create a case already hidden');
-- Today no staff session can soft-delete at all: "staff read cases" hides deleted cases, and
-- PostgreSQL refuses an UPDATE whose new row its writer could no longer see. Whether soft
-- delete should become a working path (who, and how to restore) is a product decision.
select ih_test.act_as('s_admin');
select ih_test.check(ih_test.error_of(format($$update public.cases set deleted_at = now() where id = %L$$, ih_test.id('case'))) like '42501:%row-level security%',
  'even ADMIN (cases.delete) cannot soft-delete through the API today — recorded as a product decision');
reset role;
-- The data model itself keeps everything on a soft delete (system writer).
update public.cases set deleted_at = now() where id = ih_test.id('case');
select ih_test.check(ih_test.val(format('select count(*)::text from public.case_recruitment where case_id = %L', ih_test.id('case'))) = '1'
                 and exists (select 1 from public.audit_logs where action = 'cases.update' and entity_id = ih_test.id('case') and new_values ->> 'deleted_at' is not null),
  'a soft-deleted case keeps its recruitment details, and the change is audited');
update public.cases set deleted_at = null where id = ih_test.id('case');
set local role authenticated;

-- ===========================================================================
-- 5. `converted` belongs to conversion
-- ===========================================================================
select ih_test.act_as('s_hr');
select ih_test.check(ih_test.error_of(format($$update public.job_applications set status = 'converted' where id = %L$$, ih_test.id('app'))) like '23514:%application_converted_needs_case%',
  'HR_MANAGER cannot mark an application converted without converting it');
select ih_test.check(ih_test.affected(format($$update public.job_applications set status = 'screening' where id = %L$$, ih_test.id('app'))) = 1,
  'positive control: ordinary triage still works');
select ih_test.check(ih_test.error_of(format($$select public.convert_job_application(%L)$$, ih_test.id('app'))) is null,
  'positive control: HR_MANAGER converts the application');
reset role;
select ih_test.check(ih_test.val(format('select (status = ''converted'' and case_id is not null and contact_id is not null)::text from public.job_applications where id = %L', ih_test.id('app'))) = 'true',
  'the converted application has its contact and case');
set local role authenticated;
select ih_test.act_as('s_hr');
select ih_test.check(ih_test.error_of(format($$update public.job_applications set status = 'rejected' where id = %L$$, ih_test.id('app'))) like '23514:%application_converted_is_final%',
  'a converted application cannot be moved back by staff');
select ih_test.act_as('s_admin');
select ih_test.check(ih_test.error_of(format($$update public.job_applications set status = 'screening' where id = %L$$, ih_test.id('app'))) like '23514:%application_converted_is_final%',
  'nor by ADMIN');
reset role;
insert into public.job_applications (full_name, email, phone, job_title, cv_path, passport_path, page_source)
values ('IH Second Applicant', 'ih-app2@example.com', '+919000088003', 'General', 'ih/cv2', 'ih/pp2', 'ih-app2');
select ih_test.check(ih_test.error_of($$update public.job_applications set status = 'converted' where page_source = 'ih-app2'$$) like '23514:%application_converted_needs_case%',
  'even a system writer cannot mark an application converted without its case');
set local role authenticated;

-- ===========================================================================
-- 6. A note keeps its visibility
-- ===========================================================================
select ih_test.act_as('s_hr');
select ih_test.check(ih_test.error_of(format($$update public.notes set visibility = 'hr_private' where id = %L$$, ih_test.id('note'))) like '23514:%note_visibility_locked%',
  'the author cannot move a team note to HR-private');
select ih_test.check(ih_test.error_of(format($$update public.notes set visibility = 'finance_private' where id = %L$$, ih_test.id('note'))) like '23514:%note_visibility_locked%',
  'nor to finance-private, which it could not even read');
select ih_test.check(ih_test.affected(format($$update public.notes set body = 'IH note, corrected' where id = %L$$, ih_test.id('note'))) = 1,
  'positive control: the author can still correct the note''s text');
select ih_test.act_as('s_admin');
select ih_test.check(ih_test.affected(format($$update public.notes set visibility = 'hr_private' where id = %L$$, ih_test.id('note'))) <= 0,
  'nobody else can change it either');

rollback;
