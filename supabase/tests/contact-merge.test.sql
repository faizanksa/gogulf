-- =============================================================================
-- Contact editing and merging (0021).
--
-- DISPOSABLE DATABASE ONLY. One transaction, rolled back.
-- =============================================================================

begin;

create schema cm_test;
grant usage on schema cm_test to anon, authenticated, service_role;

create function cm_test.check(condition boolean, description text)
returns void language plpgsql as $$
begin
  if condition then raise notice 'PASS  %', description;
  else raise exception 'FAIL  %', description;
  end if;
end $$;

-- 'SQLSTATE: message' of a failing statement, or null when it succeeds.
create function cm_test.error_of(stmt text) returns text language plpgsql as $$
begin
  execute stmt;
  return null;
exception when others then
  return sqlstate || ': ' || sqlerrm;
end $$;

create function cm_test.affected(stmt text) returns bigint language plpgsql as $$
declare n bigint;
begin
  execute stmt;
  get diagnostics n = row_count;
  return n;
exception when insufficient_privilege then
  return -1;
end $$;

create table cm_test.ids (k text primary key, v uuid);
grant select, insert on cm_test.ids to anon, authenticated, service_role;

create function cm_test.id(p_key text) returns uuid
language sql stable security definer set search_path = '' as $$
  select v from cm_test.ids where k = p_key
$$;

create function cm_test.act_as_staff(p_key text) returns void
language plpgsql security definer set search_path = '' as $$
declare s record;
begin
  select su.id, su.role_key, su.branch_id into s from public.staff_users su where su.id = cm_test.id(p_key);
  perform set_config('request.jwt.claims', json_build_object(
    'sub', gen_random_uuid(), 'role', 'authenticated',
    'app_staff_id', s.id, 'app_role', s.role_key, 'app_branch', s.branch_id)::text, true);
end $$;

create function cm_test.merge(p_survivor text, p_merged text) returns uuid language sql as $$
  select public.merge_contacts(cm_test.id(p_survivor), cm_test.id(p_merged), 'cm test')
$$;

grant execute on all functions in schema cm_test to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Fixtures (as postgres)
-- ---------------------------------------------------------------------------
insert into public.branches (name, code, city, country_code) values ('CM Other Branch', 'CMO', 'Test City', 'IN');
insert into cm_test.ids select 'b_lko', id from public.branches where code = 'LKO';
insert into cm_test.ids select 'b_oth', id from public.branches where code = 'CMO';

insert into public.staff_users (email, full_name, role_key, branch_id) values
  ('cm-admin@gogulf.co',  'CM Admin',          'ADMIN',      cm_test.id('b_lko')),
  ('cm-hr@gogulf.co',     'CM HR Lucknow',     'HR_MANAGER', cm_test.id('b_lko')),
  ('cm-hroth@gogulf.co',  'CM HR Other',       'HR_MANAGER', cm_test.id('b_oth')),
  ('cm-rec@gogulf.co',    'CM Recruiter',      'RECRUITER',  cm_test.id('b_lko')),
  ('cm-view@gogulf.co',   'CM View Only',      'VIEW_ONLY',  cm_test.id('b_lko'));
insert into cm_test.ids select 's_' || split_part(split_part(email, '@', 1), '-', 2), id from public.staff_users where email like 'cm-%@gogulf.co';

insert into public.contacts (full_name, branch_id, owner_id, consent_email, legal_hold_until) values
  ('CM Survivor',        cm_test.id('b_lko'), cm_test.id('s_rec'), true,  null),
  ('CM Duplicate',       cm_test.id('b_lko'), cm_test.id('s_rec'), false, '2030-01-01'),
  ('CM Other Branch',    cm_test.id('b_oth'), null,                false, null),
  ('CM Third',           cm_test.id('b_lko'), null,                false, null),
  ('CM Rollback Target', cm_test.id('b_lko'), null,                false, null),
  ('CM Rollback Source', cm_test.id('b_lko'), null,                false, null);
insert into cm_test.ids select case full_name
    when 'CM Survivor' then 'c_s' when 'CM Duplicate' then 'c_d' when 'CM Other Branch' then 'c_o'
    when 'CM Third' then 'c_t' when 'CM Rollback Target' then 'c_rt' else 'c_rs' end, id
  from public.contacts where full_name like 'CM %';

-- The survivor has a primary phone; the duplicate has a primary phone and a primary email.
insert into public.contact_identities (contact_id, type, value_raw, is_primary) values
  (cm_test.id('c_s'), 'phone', '+919811100001', true),
  (cm_test.id('c_d'), 'phone', '+919811100002', true),
  (cm_test.id('c_d'), 'email', 'cm-duplicate@example.com', true),
  (cm_test.id('c_rs'), 'phone', '+919811100009', true);

-- Everything that can hang off the duplicate.
insert into public.job_applications (full_name, email, phone, job_title, cv_path, passport_path, page_source, contact_id)
values ('CM Duplicate', 'cm-duplicate@example.com', '+919811100002', 'General application', 'cm/cv.pdf', 'cm/pp.pdf', 'cm-test', cm_test.id('c_d'));
insert into cm_test.ids select 'app', id from public.job_applications where page_source = 'cm-test';

insert into public.cases (case_number, contact_id, case_type, pipeline_id, stage_id, title, branch_id)
select public.next_case_number('recruitment'), cm_test.id('c_d'), 'recruitment', p.id, s.id, 'CM case', cm_test.id('b_lko')
  from public.pipelines p join public.pipeline_stages s on s.pipeline_id = p.id and s.key = 'new'
 where p.case_type = 'recruitment' and p.is_default;
insert into cm_test.ids select 'case', id from public.cases where title = 'CM case';

insert into public.notes (contact_id, body, visibility, branch_id) values (cm_test.id('c_d'), 'CM note', 'team', cm_test.id('b_lko'));
insert into public.tasks (title, contact_id, branch_id) values ('CM task', cm_test.id('c_d'), cm_test.id('b_lko'));
select public.log_activity(cm_test.id('c_d'), null, 'system', null, 'cm.test', 'CM history entry', null, null, '{}'::jsonb);

-- Billing: one draft invoice, one issued invoice, one payment — all for the duplicate.
insert into public.invoices (customer_name, purpose, line_items, contact_id, branch_id)
values ('CM Duplicate (draft)', 'CM service', '[{"description":"Fee","quantity":1,"unit_amount_minor":10000}]'::jsonb, cm_test.id('c_d'), cm_test.id('b_lko')),
       ('CM Duplicate (issued)', 'CM service', '[{"description":"Fee","quantity":1,"unit_amount_minor":20000}]'::jsonb, cm_test.id('c_d'), cm_test.id('b_lko'));
insert into cm_test.ids select case customer_name when 'CM Duplicate (draft)' then 'inv_draft' else 'inv_issued' end, id
  from public.invoices where customer_name like 'CM Duplicate (%';
update public.invoices set status = 'issued' where id = cm_test.id('inv_issued');
insert into public.payments (provider_order_id, amount_minor, branch_id, contact_id, invoice_id)
values ('order_CM_1', 20000, cm_test.id('b_lko'), cm_test.id('c_d'), cm_test.id('inv_issued'));
insert into cm_test.ids select 'pay', id from public.payments where provider_order_id = 'order_CM_1';

-- ===========================================================================
-- 1. Editing
-- ===========================================================================
set local role authenticated;

select cm_test.act_as_staff('s_rec');
select cm_test.check(
  cm_test.affected(format($$update public.contacts set full_name = 'CM Survivor (edited)', nationality = 'Indian' where id = %L$$, cm_test.id('c_s'))) = 1,
  'a RECRUITER edits the details of their own candidate');
select cm_test.check(
  cm_test.affected(format($$update public.contacts set full_name = 'x' where id = %L$$, cm_test.id('c_t'))) = 0,
  'a RECRUITER cannot edit a contact they do not own');
select cm_test.check(
  cm_test.error_of(format($$update public.contacts set owner_id = %L where id = %L$$, cm_test.id('s_hr'), cm_test.id('c_s'))) like '42501:%contacts_assign_required%',
  'a RECRUITER cannot reassign the owner (contacts.assign required)');
select cm_test.check(
  cm_test.affected(format($$update public.contacts set merged_into_id = %L where id = %L$$, cm_test.id('c_t'), cm_test.id('c_s'))) = -1,
  'no staff member can write merged_into_id directly — the privilege is withheld');
select cm_test.check(
  cm_test.affected(format($$update public.contacts set primary_email = 'forged@example.com' where id = %L$$, cm_test.id('c_s'))) = -1
  and cm_test.affected(format($$update public.contacts set legal_hold_until = null where id = %L$$, cm_test.id('c_d'))) = -1,
  'system-managed columns (primary email, legal hold) cannot be written directly');

select cm_test.act_as_staff('s_hr');
select cm_test.check(
  cm_test.affected(format($$update public.contacts set owner_id = %L, lifecycle_stage = 'opportunity' where id = %L$$, cm_test.id('s_hr'), cm_test.id('c_t'))) = 1,
  'an HR Manager edits and reassigns within their branch');
select cm_test.check(
  cm_test.affected(format($$update public.contacts set branch_id = %L where id = %L$$, cm_test.id('b_oth'), cm_test.id('c_t'))) <= 0,
  'an HR Manager cannot move a contact to another branch');
select cm_test.check(
  cm_test.affected(format($$update public.contacts set full_name = 'x' where id = %L$$, cm_test.id('c_o'))) = 0,
  'an HR Manager cannot edit a contact in another branch');

select cm_test.act_as_staff('s_view');
select cm_test.check(
  cm_test.affected(format($$update public.contacts set full_name = 'x' where id = %L$$, cm_test.id('c_t'))) <= 0,
  'VIEW_ONLY cannot edit a contact');

select cm_test.act_as_staff('s_admin');
select cm_test.check(
  cm_test.affected(format($$update public.contacts set consent_whatsapp = true where id = %L$$, cm_test.id('c_t'))) = 1,
  'ADMIN changes a consent');
reset role;
select cm_test.check(
  (select consent_updated_at is not null and consent_updated_at > now() - interval '1 minute' from public.contacts where id = cm_test.id('c_t')),
  'a consent change stamps consent_updated_at');
select cm_test.check(
  exists (select 1 from public.audit_logs where action = 'contacts.update' and entity_id = cm_test.id('c_t')),
  'contact edits are on the audit trail');

-- ===========================================================================
-- 2. Refusals
-- ===========================================================================
set local role authenticated;
select cm_test.act_as_staff('s_rec');
select cm_test.check(cm_test.error_of($$select cm_test.merge('c_s', 'c_d')$$) like '42501:%',
  'a RECRUITER (no contacts.merge) cannot merge');
select cm_test.act_as_staff('s_view');
select cm_test.check(cm_test.error_of($$select cm_test.merge('c_s', 'c_d')$$) like '42501:%',
  'VIEW_ONLY cannot merge');

select cm_test.act_as_staff('s_hr');
select cm_test.check(cm_test.error_of($$select cm_test.merge('c_s', 'c_s')$$) like '23514:%cannot_merge_contact_into_itself%',
  'a contact cannot be merged into itself');
select cm_test.check(cm_test.error_of($$select cm_test.merge('c_s', 'c_o')$$) like '42501:%',
  'an HR Manager cannot merge across branches (Lucknow ← other branch)');
select cm_test.check(cm_test.error_of($$select cm_test.merge('c_o', 'c_s')$$) like '42501:%',
  'an HR Manager cannot merge across branches (other branch ← Lucknow)');
select cm_test.act_as_staff('s_hroth');
select cm_test.check(cm_test.error_of($$select cm_test.merge('c_o', 'c_s')$$) like '42501:%',
  'the other branch''s HR Manager cannot merge a Lucknow contact into theirs either');
reset role;

-- ===========================================================================
-- 3. Rollback: a failure part-way through undoes everything
-- ===========================================================================
create function cm_test.explode() returns trigger language plpgsql as $$
begin
  raise exception 'forced failure inside the merge';
end $$;
insert into public.notes (contact_id, body, visibility, branch_id) values (cm_test.id('c_rs'), 'rollback note', 'team', cm_test.id('b_lko'));
create trigger cm_explode before update of contact_id on public.notes for each row execute function cm_test.explode();

set local role authenticated;
select cm_test.act_as_staff('s_hr');
select cm_test.check(cm_test.error_of($$select cm_test.merge('c_rt', 'c_rs')$$) like '%forced failure inside the merge%',
  'a merge that fails part-way raises the error');
reset role;
drop trigger cm_explode on public.notes;
select cm_test.check(
  (select merged_into_id is null from public.contacts where id = cm_test.id('c_rs'))
  and (select count(*) from public.contact_identities where contact_id = cm_test.id('c_rs')) = 1
  and not exists (select 1 from public.contact_merges where loser_id = cm_test.id('c_rs'))
  and not exists (select 1 from public.audit_logs where action = 'contacts.merged' and new_values ->> 'merge_id' is not null
                   and old_values ->> 'merged_contact_id' = cm_test.id('c_rs')::text),
  '… and nothing of it remains: identities not moved, not marked merged, no merge record, no audit entry');

-- ===========================================================================
-- 4. A same-branch merge by the Lucknow HR Manager
-- ===========================================================================
insert into cm_test.ids values ('audit_before', null);
create temp table cm_audit_before as select count(*) as n from public.audit_logs;

set local role authenticated;
select cm_test.act_as_staff('s_hr');
insert into cm_test.ids select 'merge1', cm_test.merge('c_s', 'c_d');
reset role;

select cm_test.check(cm_test.id('merge1') is not null, 'the Lucknow HR Manager merges two Lucknow contacts');
select cm_test.check(
  (select merged_into_id from public.contacts where id = cm_test.id('c_d')) = cm_test.id('c_s'),
  'the duplicate is marked merged into the survivor (merged_into_id)');
select cm_test.check(
  (select count(*) from public.contact_identities where contact_id = cm_test.id('c_s')) = 3
  and (select count(*) from public.contact_identities where contact_id = cm_test.id('c_d')) = 0,
  'identities moved to the survivor');
select cm_test.check(
  (select count(*) from public.contact_identities where contact_id = cm_test.id('c_s') and type = 'phone' and is_primary) = 1
  and (select value_normalized from public.contact_identities where contact_id = cm_test.id('c_s') and type = 'phone' and is_primary) like '%9811100001'
  and (select is_primary from public.contact_identities where contact_id = cm_test.id('c_s') and type = 'email'),
  'the survivor keeps its own primary phone; the moved phone is demoted; the moved email stays primary');
select cm_test.check(
  (select contact_id from public.job_applications where id = cm_test.id('app')) = cm_test.id('c_s')
  and (select contact_id from public.cases where id = cm_test.id('case')) = cm_test.id('c_s')
  and not exists (select 1 from public.notes where contact_id = cm_test.id('c_d'))
  and not exists (select 1 from public.tasks where contact_id = cm_test.id('c_d'))
  and not exists (select 1 from public.activities where contact_id = cm_test.id('c_d')),
  'application, case, note, task and history moved to the survivor');
select cm_test.check(
  exists (select 1 from public.activities where contact_id = cm_test.id('c_s') and verb = 'cm.test' and summary = 'CM history entry'),
  'the history entry is preserved unchanged on the survivor');
select cm_test.check(
  (select contact_id from public.invoices where id = cm_test.id('inv_draft')) = cm_test.id('c_s'),
  'the DRAFT invoice moved to the survivor');
select cm_test.check(
  (select contact_id from public.invoices where id = cm_test.id('inv_issued')) = cm_test.id('c_d')
  and (select customer_name from public.invoices where id = cm_test.id('inv_issued')) = 'CM Duplicate (issued)'
  and (select status from public.invoices where id = cm_test.id('inv_issued')) = 'issued',
  'the ISSUED invoice is untouched: same contact link, customer details and status');
select cm_test.check(
  (select contact_id from public.payments where id = cm_test.id('pay')) = cm_test.id('c_d')
  and (select status from public.payments where id = cm_test.id('pay')) = 'created',
  'the payment is untouched');
select cm_test.check(
  (select legal_hold_until from public.contacts where id = cm_test.id('c_s')) = '2030-01-01'
  and (select consent_email from public.contacts where id = cm_test.id('c_s')) = true,
  'the survivor takes the later legal hold and keeps its own consents');

-- Snapshot and audit
select cm_test.check(
  (select snapshot -> 'merged_before' ->> 'full_name' from public.contact_merges where id = cm_test.id('merge1')) = 'CM Duplicate'
  and (select jsonb_array_length(snapshot -> 'merged_identities') from public.contact_merges where id = cm_test.id('merge1')) = 2
  and (select jsonb_array_length(snapshot -> 'moved' -> 'activities') from public.contact_merges where id = cm_test.id('merge1')) = 1
  and (select snapshot -> 'untouched' -> 'issued_invoices' ? cm_test.id('inv_issued')::text from public.contact_merges where id = cm_test.id('merge1'))
  and (select snapshot -> 'untouched' -> 'payments' ? cm_test.id('pay')::text from public.contact_merges where id = cm_test.id('merge1')),
  'the merge snapshot keeps the duplicate as it was, its identities, every moved id and the untouched invoice and payment');
select cm_test.check(
  (select merged_by from public.contact_merges where id = cm_test.id('merge1')) = cm_test.id('s_hr'),
  'the merge record names who merged');
select cm_test.check(
  exists (select 1 from public.audit_logs where action = 'contacts.merged' and actor_id = cm_test.id('s_hr')
           and entity_id = cm_test.id('c_s') and new_values ->> 'merge_id' = cm_test.id('merge1')::text)
  and exists (select 1 from public.audit_logs where action = 'contacts.update' and entity_id = cm_test.id('c_d')
               and new_values ->> 'merged_into_id' = cm_test.id('c_s')::text),
  'the merge is on the audit trail, attributed to the HR Manager, and so is the duplicate being marked merged');
select cm_test.check(
  exists (select 1 from public.activities where contact_id = cm_test.id('c_s') and verb = 'contact.merged'),
  'the survivor''s timeline records the merge');

-- ===========================================================================
-- 5. Retry and repeated merges
-- ===========================================================================
create temp table cm_counts as
  select (select count(*) from public.audit_logs) as audit, (select count(*) from public.contact_merges) as merges;
set local role authenticated;
select cm_test.act_as_staff('s_hr');
select cm_test.check(cm_test.merge('c_s', 'c_d') = cm_test.id('merge1'),
  'retrying the same merge returns the original merge');
reset role;
select cm_test.check(
  (select count(*) from public.audit_logs) = (select audit from cm_counts)
  and (select count(*) from public.contact_merges) = (select merges from cm_counts),
  '… and changes nothing: no new merge record, no new audit entry');

set local role authenticated;
select cm_test.act_as_staff('s_hr');
select cm_test.check(cm_test.error_of($$select cm_test.merge('c_t', 'c_d')$$) like '23514:%contact_already_merged%',
  'an already-merged contact cannot be merged again into a different contact');
select cm_test.check(cm_test.error_of($$select cm_test.merge('c_d', 'c_t')$$) like '23514:%survivor_is_merged%',
  'a merged contact cannot be the survivor');
select cm_test.check(
  cm_test.error_of(format($$update public.contacts set notes_summary = 'x' where id = %L$$, cm_test.id('c_d'))) like '23514:%contact_merged%',
  'a merged contact is read-only');
reset role;

-- ===========================================================================
-- 6. Cross-branch: all-scope staff only
-- ===========================================================================
set local role authenticated;
select cm_test.act_as_staff('s_admin');
insert into cm_test.ids select 'merge2', cm_test.merge('c_s', 'c_o');
reset role;
select cm_test.check(
  cm_test.id('merge2') is not null and (select merged_into_id from public.contacts where id = cm_test.id('c_o')) = cm_test.id('c_s'),
  'ADMIN (all scope) merges a contact from another branch');

-- A chain is flattened: merging the survivor itself into the third contact re-points earlier merges.
set local role authenticated;
select cm_test.act_as_staff('s_admin');
insert into cm_test.ids select 'merge3', cm_test.merge('c_t', 'c_s');
reset role;
select cm_test.check(
  (select merged_into_id from public.contacts where id = cm_test.id('c_d')) = cm_test.id('c_t')
  and (select merged_into_id from public.contacts where id = cm_test.id('c_o')) = cm_test.id('c_t'),
  'contacts merged earlier are re-pointed to the new survivor: merged_into_id always names an active contact');

rollback;
