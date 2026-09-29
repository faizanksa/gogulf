-- =============================================================================
-- QA fixture for 0025 Step 1 (case lifecycle) browser checks. MUMBAI STAGING ONLY.
--
--   npm run db:mumbai -- run supabase/seeds/qa/0025-case-fixture.sql
--
-- Two synthetic records with fixed ids, both marked QA SYNTHETIC:
--   contact 0025ca5e-0000-4000-8000-000000000001  (Lucknow, no owner, no identities)
--   case    0025ca5e-0000-4000-8000-000000000002  GG-QA-0025-00001, recruitment, open,
--           New Lead, Lucknow, owned by the one active SUPER_ADMIN of Lucknow
--
-- Nothing existing is modified. Remove with 0025-case-fixture-cleanup.sql.
-- Not run by `supabase db reset` (only supabase/seed.sql is).
-- =============================================================================

begin;

do $$
declare
  c_id     constant uuid := '0025ca5e-0000-4000-8000-000000000001';
  k_id     constant uuid := '0025ca5e-0000-4000-8000-000000000002';
  lko      uuid;
  owner    uuid;
  pipe     uuid;
  stage    uuid;
  n        bigint;
begin
  -- Staging only: the synthetic STG-JOB jobs exist nowhere else.
  if (select count(*) from public.jobs where reference like 'STG-JOB-%') = 0 then
    raise exception 'qa fixture refuses to run: this database has no STG-JOB test jobs, so it is not staging';
  end if;
  if exists (select 1 from public.contacts where id = c_id) or exists (select 1 from public.cases where id = k_id)
     or exists (select 1 from public.cases where case_number = 'GG-QA-0025-00001') then
    raise exception 'qa fixture refuses to run: the fixture already exists (run the cleanup first)';
  end if;

  select id into lko from public.branches where code = 'LKO' and is_active;
  select count(*), min(su.id::text)::uuid into n, owner
    from public.staff_users su where su.role_key = 'SUPER_ADMIN' and su.is_active and su.branch_id = lko;
  if lko is null or n <> 1 then
    raise exception 'qa fixture refuses to run: expected exactly one active Lucknow SUPER_ADMIN, found %', n;
  end if;
  select p.id into pipe from public.pipelines p where p.case_type = 'recruitment' and p.is_default and p.is_active;
  select s.id into stage from public.pipeline_stages s where s.pipeline_id = pipe and s.key = 'new';
  if stage is null then
    raise exception 'qa fixture refuses to run: no New Lead stage';
  end if;

  insert into public.contacts (id, full_name, branch_id, first_touch)
  values (c_id, 'QA SYNTHETIC — 0025 Candidate', lko,
          jsonb_build_object('channel', 'qa_fixture', 'fixture', '0025-step1'));

  insert into public.cases (id, case_number, contact_id, case_type, pipeline_id, stage_id, title, owner_id, branch_id)
  values (k_id, 'GG-QA-0025-00001', c_id, 'recruitment', pipe, stage,
          'QA SYNTHETIC — 0025 Step 1 lifecycle check', owner, lko);

  -- Verify inside the same transaction.
  if not exists (
    select 1 from public.cases k
      join public.pipeline_stages s on s.id = k.stage_id
      join public.staff_users su on su.id = k.owner_id
     where k.id = k_id and k.status = 'open' and s.key = 'new' and su.role_key = 'SUPER_ADMIN' and k.branch_id = lko) then
    raise exception 'qa fixture: the created case is not open + New Lead + SUPER_ADMIN + Lucknow';
  end if;
end $$;

select k.id, k.case_number, k.status, s.name as stage, su.email as owner, su.role_key, b.name as branch, c.full_name as contact
  from public.cases k
  join public.pipeline_stages s on s.id = k.stage_id
  join public.staff_users su on su.id = k.owner_id
  join public.branches b on b.id = k.branch_id
  join public.contacts c on c.id = k.contact_id
 where k.id = '0025ca5e-0000-4000-8000-000000000002';

commit;
