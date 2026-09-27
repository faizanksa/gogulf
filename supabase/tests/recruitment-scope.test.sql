-- =============================================================================
-- Go Gulf = recruitment + recruitment operations + candidate deployment (0019).
--
-- The standalone travel-agency model is gone. Everything a PLACED candidate needs to
-- reach the job — visa processing, travel preparation, flight bookings, deployment
-- suppliers, visa and ticket documents — is intact and still works.
--
-- DISPOSABLE DATABASE ONLY. One transaction, rolled back.
-- =============================================================================

begin;

create schema rs_test;
grant usage on schema rs_test to anon, authenticated, service_role;

create function rs_test.check(condition boolean, description text)
returns void language plpgsql as $$
begin
  if condition then raise notice 'PASS  %', description;
  else raise exception 'FAIL  %', description;
  end if;
end $$;

-- The SQLSTATE a statement fails with, or null when it succeeds.
create function rs_test.sqlstate(stmt text) returns text language plpgsql as $$
begin
  execute stmt;
  return null;
exception when others then
  return sqlstate;
end $$;

create table rs_test.ids (k text primary key, v uuid);
grant select on rs_test.ids to anon, authenticated, service_role;

create function rs_test.id(p_key text) returns uuid
language sql stable security definer set search_path = '' as $$
  select v from rs_test.ids where k = p_key
$$;

create function rs_test.act_as_staff(p_key text) returns void
language plpgsql security definer set search_path = '' as $$
declare s record;
begin
  select su.id, su.role_key, su.branch_id into s from public.staff_users su where su.id = rs_test.id(p_key);
  perform set_config('request.jwt.claims', json_build_object(
    'sub', gen_random_uuid(), 'role', 'authenticated',
    'app_staff_id', s.id, 'app_role', s.role_key, 'app_branch', s.branch_id)::text, true);
end $$;

grant execute on all functions in schema rs_test to anon, authenticated, service_role;

insert into public.staff_users (email, full_name, role_key, branch_id)
select e.email, e.name, e.role, b.id
from (values
  ('rs-ops@gogulf.co',   'RS Operations', 'OPERATIONS_MANAGER'),
  ('rs-admin@gogulf.co', 'RS Admin',      'ADMIN'),
  ('rs-rec@gogulf.co',   'RS Recruiter',  'RECRUITER'),
  ('rs-mkt@gogulf.co',   'RS Marketing',  'MARKETING_MANAGER')
) as e(email, name, role), public.branches b where b.code = 'LKO';

insert into rs_test.ids
select split_part(split_part(email, '@', 1), '-', 2), id from public.staff_users where email like 'rs-%@gogulf.co';

-- ===========================================================================
-- 1. The standalone travel-agency model is gone
-- ===========================================================================
select rs_test.check(
  enum_range(null::public.case_type)::text[] = array['recruitment', 'support'],
  'case_type is exactly recruitment and support: no standalone travel, visa or tour case');
select rs_test.check(
  to_regclass('public.case_travel') is null and to_regclass('public.case_visa') is null,
  'the standalone travel (holiday booking) and visa-customer case tables do not exist');
select rs_test.check(
  not exists (select 1 from pg_type where typname like 'case_type_retired%'),
  'the retired enum was dropped, not left behind');
select rs_test.check(
  not exists (select 1 from public.roles where key in ('TRAVEL_MANAGER', 'TRAVEL_AGENT'))
  and (select count(*) from public.roles) = 10,
  'the two travel-agency roles are retired; ten roles remain');
select rs_test.check(
  not exists (select 1 from public.role_permissions where role_key like 'TRAVEL%'),
  'no grant is left for a travel role');
select rs_test.check(
  not exists (select 1 from public.permissions where domain = 'travel'),
  'no permission is filed under a "travel" domain any more');
select rs_test.check(
  (select count(*) from public.pipelines) = 1
    and exists (select 1 from public.pipelines where case_type = 'recruitment' and is_default and is_active),
  'the travel-agency pipeline is gone; the only pipeline is the default recruitment pipeline');
select rs_test.check(
  not exists (select 1 from public.pipeline_stages where key in ('quoted', 'awaiting', 'requirement', 'ready')),
  'no quote / awaiting-payment / travel-ready stage of the retired pipeline survives');
select rs_test.check(
  rs_test.sqlstate($$insert into public.cases (case_number, contact_id, case_type, pipeline_id, stage_id)
                     select 'GG-TRV-X', gen_random_uuid(), 'travel', p.id, s.id
                       from public.pipelines p join public.pipeline_stages s on s.pipeline_id = p.id limit 1$$) = '22P02'
  and rs_test.sqlstate($$select 'visa'::public.case_type$$) = '22P02',
  'the database itself rejects a standalone travel or visa case');

-- ===========================================================================
-- 2. Candidate deployment is kept — relabelled, still granted, still working
-- ===========================================================================
select rs_test.check(
  (select count(*) from public.permissions) = 72,
  'no permission was retired: the catalogue still holds 72');
select rs_test.check(
  (select jsonb_object_agg(key, domain || ' | ' || description) from public.permissions
    where key in ('travel.manage', 'bookings.view', 'bookings.manage', 'suppliers.manage'))
  = jsonb_build_object(
      'travel.manage',    'deployment | Arrange and manage travel for a placed candidate',
      'bookings.view',    'deployment | View flight bookings for placed candidates',
      'bookings.manage',  'deployment | Manage flight bookings for placed candidates',
      'suppliers.manage', 'deployment | Manage recruitment and deployment suppliers (ticketing agents, medical centres, attestation providers)'),
  'travel, flight-booking and supplier permissions are kept, filed under "deployment" and described for placed candidates');
select rs_test.check(
  (select count(*) from public.role_permissions rp join public.permissions p on p.id = rp.permission_id
    where p.key in ('travel.manage', 'bookings.view', 'bookings.manage', 'suppliers.manage')) >= 10
  and exists (select 1 from public.role_permissions rp join public.permissions p on p.id = rp.permission_id
               where rp.role_key = 'OPERATIONS_MANAGER' and p.key = 'suppliers.manage'),
  'the remaining roles keep their deployment grants (operations included)');

set local role authenticated;
select rs_test.act_as_staff('ops');
select rs_test.check(
  public.has_perm('travel.manage', 'branch') and public.has_perm('bookings.manage', 'branch')
    and public.has_perm('suppliers.manage', 'branch'),
  'an OPERATIONS_MANAGER can still arrange a placed candidate''s travel, flights and suppliers (live has_perm)');
select rs_test.act_as_staff('admin');
select rs_test.check(
  public.has_perm('travel.manage') and public.has_perm('bookings.manage') and public.has_perm('suppliers.manage'),
  'ADMIN can still arrange deployment travel, flights and suppliers at every scope');
select rs_test.act_as_staff('rec');
select rs_test.check(
  public.has_perm('documents.view.travel', 'own') and not public.has_perm('suppliers.manage', 'own'),
  'a RECRUITER still sees a candidate''s visa and ticket documents, and does not manage suppliers');
select rs_test.act_as_staff('mkt');
select rs_test.check(
  not public.has_perm('travel.manage', 'own') and not public.has_perm('bookings.manage', 'own')
    and not public.has_perm('documents.view.travel', 'own'),
  'MARKETING still has no deployment or document access');
reset role;

-- ===========================================================================
-- 3. Recruitment is intact, including the candidate's deployment stages
-- ===========================================================================
select rs_test.check(
  (select array_agg(s.key order by s.position)
     from public.pipeline_stages s join public.pipelines p on p.id = s.pipeline_id
    where p.case_type = 'recruitment' and p.is_default)
  = array['legacy_imported', 'new', 'contacted', 'documents', 'screening', 'interview',
          'selected', 'processing', 'visa', 'travel', 'completed', 'lost'],
  'the recruitment pipeline keeps all twelve stages, Visa Processing and Travel Preparation included');
select rs_test.check(
  (select string_agg(s.name, ' / ' order by s.position)
     from public.pipeline_stages s join public.pipelines p on p.id = s.pipeline_id
    where p.case_type = 'recruitment' and s.key in ('visa', 'travel')) = 'Visa Processing / Travel Preparation',
  'Visa Processing and Travel Preparation keep their names');
select rs_test.check(
  to_regclass('public.case_recruitment') is not null,
  'case_recruitment, the recruitment extension of a case, still exists');
select rs_test.check(
  (select domain || ' | ' || description from public.permissions where key = 'documents.view.travel')
    = 'documents | View a candidate''s deployment documents (visa, tickets)',
  'documents.view.travel stays a document permission, described as the candidate''s visa and tickets');
select rs_test.check(
  public.next_case_number('recruitment') like 'GG-REC-%' and public.next_case_number('support') like 'GG-SUP-%',
  'case numbering still works for both case types');
select rs_test.check(
  not has_function_privilege('anon', 'public.next_case_number(public.case_type)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.next_case_number(public.case_type)', 'EXECUTE')
    and has_function_privilege('service_role', 'public.next_case_number(public.case_type)', 'EXECUTE'),
  'the recreated next_case_number keeps its 0009 grants: not anon; authenticated and service_role');

-- A selected candidate's case walks through visa processing to travel preparation and joining.
do $$
declare
  contact uuid;
  pipe    uuid;
  kase    uuid;
begin
  insert into public.contacts (full_name) values ('RS Test Candidate') returning id into contact;
  select id into pipe from public.pipelines where case_type = 'recruitment' and is_default;
  insert into public.cases (case_number, contact_id, case_type, pipeline_id, stage_id, title)
  values (public.next_case_number('recruitment'), contact, 'recruitment', pipe,
          (select id from public.pipeline_stages where pipeline_id = pipe and key = 'selected'), 'RS deployment')
  returning id into kase;
  update public.cases set stage_id = (select id from public.pipeline_stages where pipeline_id = pipe and key = 'visa') where id = kase;
  update public.cases set stage_id = (select id from public.pipeline_stages where pipeline_id = pipe and key = 'travel') where id = kase;
  perform rs_test.check(
    (select s.key from public.cases c join public.pipeline_stages s on s.id = c.stage_id where c.id = kase) = 'travel',
    'a selected candidate''s recruitment case moves through Visa Processing to Travel Preparation');
  update public.cases set stage_id = (select id from public.pipeline_stages where pipeline_id = pipe and key = 'completed') where id = kase;
  perform rs_test.check(
    (select s.is_won from public.cases c join public.pipeline_stages s on s.id = c.stage_id where c.id = kase),
    'and on to Joined, the won stage');
end $$;

-- ===========================================================================
-- 4. The change is on the audit trail, gated like the rest of it (0016)
-- ===========================================================================
select rs_test.check(
  (select count(*) from public.audit_logs where action = 'roles.retire' and actor_type = 'system') = 2
  and (select count(*) from public.audit_logs where action = 'pipelines.retire' and actor_type = 'system') = 1
  and (select count(*) from public.audit_logs where action = 'permissions.relabel' and actor_type = 'system') = 5,
  'the two retired roles, the retired pipeline and the five relabelled permissions are each on the audit trail');
select rs_test.check(
  exists (select 1 from public.audit_logs
           where action = 'permissions.relabel'
             and old_values ->> 'domain' = 'travel' and new_values ->> 'domain' = 'deployment'
             and new_values ->> 'permission' = 'suppliers.manage'),
  'each relabel records the old and the new wording');
select rs_test.check(
  exists (select 1 from public.audit_logs
           where action = 'role_permissions.delete' and old_values ->> 'role_key' = 'TRAVEL_MANAGER'),
  'the travel roles'' removed grants are on the audit trail, recorded by the role_permissions trigger');
select rs_test.check(
  (select old_values -> 'stages' from public.audit_logs where action = 'pipelines.retire' limit 1) ? 'quoted',
  'the retired travel-agency pipeline''s stages are preserved in its audit entry');

rollback;
