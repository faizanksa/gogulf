-- =============================================================================
-- Remove the 0025 Step 1 QA fixture — ONLY its fixed ids. MUMBAI STAGING ONLY.
--
--   npm run db:mumbai -- run supabase/seeds/qa/0025-case-fixture-cleanup.sql
--
-- Refuses, changing nothing, if anything outside the fixture points at it (an application,
-- invoice, payment, merge, another case or a merged contact). Dependency-safe order:
-- the case's tasks and notes, the case (its recruitment row and timeline cascade), then
-- the contact's own tasks, notes and identities, then the contact (its timeline cascades).
-- Audit rows are append-only and stay, including those the QA session wrote.
-- =============================================================================

begin;

do $$
declare
  c_id constant uuid := '0025ca5e-0000-4000-8000-000000000001';
  k_id constant uuid := '0025ca5e-0000-4000-8000-000000000002';
  n    bigint;
  r    record;
begin
  if (select count(*) from public.jobs where reference like 'STG-JOB-%') = 0 then
    raise exception 'qa cleanup refuses to run: this database has no STG-JOB test jobs, so it is not staging';
  end if;

  select count(*) into n from (
    select 1 from public.job_applications where contact_id = c_id or case_id = k_id
    union all select 1 from public.invoices where contact_id = c_id or case_id = k_id
    union all select 1 from public.payments where contact_id = c_id or case_id = k_id
    union all select 1 from public.contact_merges where winner_id = c_id or loser_id = c_id
    union all select 1 from public.contacts where merged_into_id = c_id
    union all select 1 from public.cases where contact_id = c_id and id <> k_id
  ) x;
  if n > 0 then
    raise exception 'qa cleanup refuses to run: % record(s) outside the fixture reference it. Nothing was changed.', n;
  end if;

  delete from public.tasks where case_id = k_id;
  delete from public.notes where case_id = k_id;
  delete from public.cases where id = k_id;
  get diagnostics n = row_count;
  raise notice 'cases removed: %', n;

  delete from public.tasks where contact_id = c_id;
  delete from public.notes where contact_id = c_id;
  delete from public.contact_identities where contact_id = c_id;
  delete from public.contacts where id = c_id;
  get diagnostics n = row_count;
  raise notice 'contacts removed: %', n;

  if exists (select 1 from public.cases where id = k_id) or exists (select 1 from public.contacts where id = c_id)
     or exists (select 1 from public.activities where case_id = k_id or contact_id = c_id) then
    raise exception 'qa cleanup: fixture records remain';
  end if;
end $$;

commit;
