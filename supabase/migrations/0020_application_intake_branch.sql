-- =============================================================================
-- 0020 — Every application belongs to a branch.
--
-- THE GAP
--
-- Branch-scoped staff (HR Manager, Recruiter, Operations, …) see an application only when its
-- branch_id equals theirs (scope_allows, 0006). An application took its branch from its job
-- (0013), and a job takes the branch of the staff member who creates it (0012) — but an
-- application WITHOUT a job got no branch at all, and so was invisible to every
-- branch-scoped role. On 27 Sep 2026 that was 15 of 15 applications on staging, and the 19
-- imported from Tokyo on production. Nothing in the workspace could assign one.
--
-- THE RULE (decided 27 Sep 2026)
--
--   * an application to a job keeps inheriting the job's branch, exactly as before;
--   * anything still without a branch — an application with no job, or to a job that has
--     none — goes to the DEFAULT INTAKE BRANCH, which is Lucknow;
--   * existing applications without a branch are backfilled to it.
--
-- WHAT THIS CHANGES
--
--   1. branches.is_default_intake — the default intake branch is data, marked on one row
--      (a partial unique index allows at most one), not a name or id written into code.
--      Lucknow (code LKO) is marked. Moving intake later is a one-row update.
--   2. job_applications_intake() — unchanged for job-linked rows; one added step at the end
--      fills a still-empty branch from the default intake branch. If no default is marked,
--      the branch stays empty: public intake is never refused because of branch routing.
--   3. The backfill — every application with no branch gets the default intake branch. Each
--      is recorded on the audit trail by the existing job_applications_audit trigger.
--
-- WHAT DOES NOT CHANGE
--
--   No RLS policy, no grant (anon still cannot choose a branch — its INSERT grant excludes
--   branch_id), no role or permission, no scope. HR Manager stays branch-scoped. branch_id
--   stays nullable on purpose: a NOT NULL would turn a configuration mistake into refused
--   applicants; the tests assert that no application is left without a branch instead.
--
-- SAFE AND RE-RUNNABLE
--
--   Every step is idempotent: the column and index are "if not exists", Lucknow is marked
--   only if no branch is marked yet, the function is replaced, and the backfill touches only
--   rows that still have no branch. The backfill refuses — changing nothing — unless exactly
--   one ACTIVE branch is marked as the default.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. The default intake branch, as data.
-- -----------------------------------------------------------------------------
alter table public.branches
  add column if not exists is_default_intake boolean not null default false;

create unique index if not exists branches_one_default_intake
  on public.branches (is_default_intake) where is_default_intake;

comment on column public.branches.is_default_intake is
  'The branch that receives applications with no branch of their own (no job, or a job without a branch). At most one (0020).';

update public.branches
   set is_default_intake = true
 where code = 'LKO'
   and not exists (select 1 from public.branches where is_default_intake);

-- -----------------------------------------------------------------------------
-- 2. Intake: the job's branch first, exactly as 0013; the default intake branch only for
--    what is still empty. SECURITY DEFINER as before: it runs for the anonymous applicant,
--    who can read neither jobs' private columns nor branches.
-- -----------------------------------------------------------------------------
create or replace function public.job_applications_intake()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  j record;
begin
  if new.job_id is not null then
    select id, title, status, application_access, availability, closes_on, branch_id
      into j
      from public.jobs
     where id = new.job_id;

    if j.id is null then
      raise exception 'job_not_found' using errcode = 'foreign_key_violation';
    end if;

    if j.status <> 'published'
       or j.application_access <> 'free'
       or (j.availability = 'time_limited'
           and (j.closes_on is null or j.closes_on < (now() at time zone 'Asia/Kolkata')::date)) then
      raise exception 'job_not_accepting_applications' using errcode = 'check_violation';
    end if;

    -- The title staff see is the job's own, not whatever the browser sent.
    new.job_title := j.title;
    new.branch_id := coalesce(new.branch_id, j.branch_id);
  end if;

  -- 0020: anything still without a branch goes to the default intake branch, so that
  -- branch-scoped staff can see it. No default marked → left empty, never refused.
  if new.branch_id is null then
    new.branch_id := (select b.id from public.branches b where b.is_default_intake and b.is_active);
  end if;

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. Backfill applications that have no branch.
-- -----------------------------------------------------------------------------
do $$
declare
  intake uuid;
  n      bigint;
begin
  select count(*) into n from public.branches where is_default_intake and is_active;
  if n <> 1 then
    raise exception '0020 refused: expected exactly one active default intake branch, found %. Nothing was backfilled.', n;
  end if;
  select id into intake from public.branches where is_default_intake and is_active;

  update public.job_applications set branch_id = intake where branch_id is null;
  get diagnostics n = row_count;
  raise notice '0020: % application(s) backfilled to the default intake branch', n;
end $$;
