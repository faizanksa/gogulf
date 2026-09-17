-- =============================================================================
-- 0012 — Jobs: categories, lifecycle, availability, promotion, application access.
--
-- Until now the public job listings were a file (content/jobs.ts) and
-- case_recruitment.job_id pointed at nothing. This migration gives jobs a home in
-- the database, managed from the staff workspace.
--
-- FIVE CONCEPTS, FIVE COLUMNS — never one flag standing in for several.
--
--   classification     general | professional       (via the category)
--   status             draft → review → published → closed → archived
--   availability       ongoing | time_limited       (+ closes_on)
--   promotion          standard | featured          (+ featured_until)
--   application_access free | paid
--
-- The failure this avoids is an `is_premium` boolean that later has to mean
-- "professional", "featured" and "costs money to apply" at once. Each of the
-- combinations the business described is representable without a redesign:
-- Professional + Featured + Free, General + Ongoing + Free, and — once an approved
-- payment flow exists — Professional + Standard + Paid.
--
-- PAID APPLICATIONS ARE NOT LIVE. A job may be *drafted* with paid access, so the
-- model is ready, but `jobs_paid_application_not_public` refuses any paid job
-- that is published or closed. That is a CHECK constraint on purpose, not a
-- settings flag: switching it on must be a reviewed migration shipped with the
-- approved payment flow, not something an administrator can toggle. Razorpay is
-- approved for consultation fees only.
--
-- Rules live in the database, not only in the form:
--   * status changes follow an explicit transition table (jobs_before_write);
--   * a job cannot reach review or published without the minimum facts of a
--     genuine listing (job_publish_problems) — and nothing is ever filled in for
--     it: no salary, employer, deadline or vacancy count is invented;
--   * contradictory states are refused by constraint (an ongoing job with a
--     closing date, a standard job with a featured-until date);
--   * the reference and URL slug freeze at first publication, because
--     applications, links shared on WhatsApp and search results depend on them.
--
-- "Featured" is never switched off by a job. A featured job whose featured_until
-- date has passed is simply not treated as featured when read. Its application
-- access is untouched.
--
-- Dates: closes_on and featured_until are calendar dates and are inclusive — a
-- job closing on 30 Sep accepts applications until the end of 30 Sep in India
-- (Asia/Kolkata), the business's own timezone.
--
-- ADDITIVE ONLY. Seeds reference categories; no job rows are created here.
-- Staging test jobs come from supabase/seeds/, which refuses production.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Types
-- -----------------------------------------------------------------------------
do $$ begin create type public.job_classification as enum ('general', 'professional');
exception when duplicate_object then null; end $$;

do $$ begin create type public.job_status as enum ('draft', 'review', 'published', 'closed', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin create type public.job_availability as enum ('ongoing', 'time_limited');
exception when duplicate_object then null; end $$;

do $$ begin create type public.job_promotion as enum ('standard', 'featured');
exception when duplicate_object then null; end $$;

do $$ begin create type public.job_application_access as enum ('free', 'paid');
exception when duplicate_object then null; end $$;

-- How a candidate applies. The online form is the documented path; WhatsApp is
-- the business's other official channel.
do $$ begin create type public.job_application_method as enum ('online_form', 'whatsapp');
exception when duplicate_object then null; end $$;

do $$ begin create type public.job_employment_type as enum ('full_time', 'part_time', 'contract', 'temporary');
exception when duplicate_object then null; end $$;

-- 'confidential' means the employer asked not to be named publicly. The name is
-- then not stored in a public column at all; staff record it in internal_notes.
do $$ begin create type public.job_employer_disclosure as enum ('named', 'confidential');
exception when duplicate_object then null; end $$;

do $$ begin create type public.job_salary_period as enum ('hour', 'day', 'month', 'year');
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- A list of short text items (responsibilities, requirements, benefits): at most
-- 30 entries, each 2–300 characters after trimming. Immutable so a CHECK can use it.
-- -----------------------------------------------------------------------------
create or replace function public.job_text_items_valid(items text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select items is not null
     and cardinality(items) <= 30
     and not exists (
       select 1 from unnest(items) as i(item)
        where item is null or length(btrim(item)) < 2 or length(item) > 300
     );
$$;

-- -----------------------------------------------------------------------------
-- Categories — data, not code. A new category is a row, never a deploy.
--
-- Each category belongs to one classification. parent_id makes a hierarchy
-- possible later (e.g. Engineer → Civil Engineer); a child must share its
-- parent's classification, so the two can never disagree.
-- -----------------------------------------------------------------------------
create table if not exists public.job_categories (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique
                 constraint job_categories_slug_format
                 check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 60),
  name           text not null
                 constraint job_categories_name_length check (length(btrim(name)) between 2 and 60),
  classification public.job_classification not null,
  parent_id      uuid references public.job_categories(id) on delete restrict,
  sort_order     int not null default 100,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint job_categories_not_own_parent check (parent_id is null or parent_id <> id)
);

create index if not exists job_categories_parent_idx on public.job_categories (parent_id);

create trigger job_categories_updated_at
  before update on public.job_categories
  for each row execute function public.set_updated_at();

create or replace function public.job_categories_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  parent_class public.job_classification;
begin
  if new.parent_id is not null then
    select c.classification into parent_class from public.job_categories c where c.id = new.parent_id;
    if parent_class is distinct from new.classification then
      raise exception 'job_category_parent_classification_mismatch'
        using errcode = 'check_violation',
              hint = 'A sub-category must have the same classification as its parent.';
    end if;
  end if;
  return new;
end;
$$;

create trigger job_categories_guard_trg
  before insert or update of parent_id, classification on public.job_categories
  for each row execute function public.job_categories_guard();

insert into public.job_categories (slug, name, classification, sort_order) values
  ('labour',             'Labour',                 'general',      10),
  ('helper',             'Helper',                 'general',      20),
  ('cleaner',            'Cleaner',                'general',      30),
  ('mall-cleaner',       'Mall Cleaner',           'general',      40),
  ('warehouse-helper',   'Warehouse Helper',       'general',      50),
  ('general-worker',     'General Worker',         'general',      60),
  ('other-general',      'Other General Hiring',   'general',     990),
  ('accountant',         'Accountant',             'professional', 10),
  ('engineer',           'Engineer',               'professional', 20),
  ('supervisor',         'Supervisor',             'professional', 30),
  ('sales',              'Sales',                  'professional', 40),
  ('technician',         'Technician',             'professional', 50),
  ('manager',            'Manager',                'professional', 60),
  ('other-professional', 'Other Professional',     'professional', 990)
on conflict (slug) do nothing;

-- -----------------------------------------------------------------------------
-- References and slugs
-- -----------------------------------------------------------------------------
create sequence if not exists public.job_reference_seq;

-- GG-JOB-2026-00001 — the same shape as case numbers (GG-REC-2026-00184).
create or replace function public.next_job_reference()
returns text
language sql
volatile
set search_path = ''
as $$
  select 'GG-JOB-' || to_char(now() at time zone 'Asia/Kolkata', 'YYYY') || '-'
         || lpad(nextval('public.job_reference_seq')::text, 5, '0');
$$;

-- "Warehouse Helper — Night Shift" + GG-JOB-2026-00007
--   → warehouse-helper-night-shift-gg-job-2026-00007
-- The reference keeps every slug unique without a lookup, and a title in a script
-- with no Latin letters still gets a readable, valid URL.
create or replace function public.job_slug(p_title text, p_reference text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  base text;
begin
  base := regexp_replace(lower(coalesce(p_title, '')), '[^a-z0-9]+', '-', 'g');
  base := trim(both '-' from left(trim(both '-' from base), 100));
  if base = '' then base := 'job'; end if;
  return base || '-' || regexp_replace(lower(p_reference), '[^a-z0-9]+', '-', 'g');
end;
$$;

-- -----------------------------------------------------------------------------
-- Jobs
-- -----------------------------------------------------------------------------
create table if not exists public.jobs (
  id                 uuid primary key default gen_random_uuid(),

  -- BASIC INFORMATION
  reference          text not null unique default public.next_job_reference()
                     constraint jobs_reference_format
                     check (reference ~ '^[A-Z0-9]+(-[A-Z0-9]+)*$' and length(reference) between 3 and 40),
  -- Derived from title + reference by jobs_before_write; '' only until then.
  slug               text not null default ''
                     constraint jobs_slug_format
                     check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 160),
  title              text not null
                     constraint jobs_title_length check (length(btrim(title)) between 2 and 120),
  category_id        uuid not null references public.job_categories(id) on delete restrict,
  -- Copied from the category by jobs_before_write; never set independently.
  classification     public.job_classification not null default 'general',
  country_code       char(2)
                     constraint jobs_country_code_format check (country_code ~ '^[A-Z]{2}$'),
  city               text
                     constraint jobs_city_length check (city is null or length(btrim(city)) between 2 and 80),
  employer_disclosure public.job_employer_disclosure,
  employer_name      text
                     constraint jobs_employer_name_length
                     check (employer_name is null or length(btrim(employer_name)) between 2 and 120),

  -- EMPLOYMENT
  employment_type    public.job_employment_type,
  vacancies          int
                     constraint jobs_vacancies_range check (vacancies is null or vacancies between 1 and 10000),
  -- Advertised salary in whole units of its currency. A salary is a statement in
  -- an advertisement, not a transaction, so the paise convention does not apply.
  salary_currency    text
                     constraint jobs_salary_currency
                     check (salary_currency is null or salary_currency in ('SAR', 'AED', 'QAR', 'OMR', 'KWD', 'BHD', 'INR')),
  salary_min         int,
  salary_max         int,
  salary_period      public.job_salary_period,
  experience         text constraint jobs_experience_length check (experience is null or length(btrim(experience)) between 2 and 200),
  education          text constraint jobs_education_length check (education is null or length(btrim(education)) between 2 and 200),
  languages          text constraint jobs_languages_length check (languages is null or length(btrim(languages)) between 2 and 200),

  -- DESCRIPTION
  summary            text constraint jobs_summary_length check (summary is null or length(btrim(summary)) between 20 and 600),
  responsibilities   text[] not null default '{}'
                     constraint jobs_responsibilities_valid check (public.job_text_items_valid(responsibilities)),
  requirements       text[] not null default '{}'
                     constraint jobs_requirements_valid check (public.job_text_items_valid(requirements)),
  benefits           text[] not null default '{}'
                     constraint jobs_benefits_valid check (public.job_text_items_valid(benefits)),
  additional_info    text constraint jobs_additional_info_length check (additional_info is null or length(btrim(additional_info)) between 2 and 2000),
  -- Staff only. Never granted to anon, never rendered publicly.
  internal_notes     text constraint jobs_internal_notes_length check (internal_notes is null or length(internal_notes) <= 4000),

  -- AVAILABILITY
  availability       public.job_availability not null default 'ongoing',
  closes_on          date,

  -- VISIBILITY
  promotion          public.job_promotion not null default 'standard',
  featured_until     date,

  -- APPLICATION
  application_access public.job_application_access not null default 'free',
  application_method public.job_application_method not null default 'online_form',

  -- LIFECYCLE — timestamps are maintained by jobs_before_write only.
  status             public.job_status not null default 'draft',
  published_at       timestamptz,           -- first publication; never moves
  last_published_at  timestamptz,
  closed_at          timestamptz,
  archived_at        timestamptz,

  branch_id          uuid references public.branches(id),
  duplicated_from    uuid references public.jobs(id) on delete set null,
  created_by         uuid references public.staff_users(id) on delete set null,
  updated_by         uuid references public.staff_users(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  -- A salary is stated completely or not at all.
  constraint jobs_salary_complete check (
       (salary_currency is null and salary_min is null and salary_max is null and salary_period is null)
    or (salary_currency is not null and salary_min is not null and salary_max is not null
        and salary_period is not null and salary_min > 0 and salary_max >= salary_min)
  ),
  -- Contradictory states the form normalises away; the database refuses them outright.
  constraint jobs_ongoing_has_no_closing_date check (availability <> 'ongoing' or closes_on is null),
  constraint jobs_standard_has_no_featured_until check (promotion = 'featured' or featured_until is null),
  constraint jobs_named_employer_has_name check (employer_disclosure is distinct from 'named' or employer_name is not null),
  constraint jobs_confidential_employer_not_named check (employer_disclosure is distinct from 'confidential' or employer_name is null),
  -- Paid application access cannot be public while no approved payment flow exists.
  constraint jobs_paid_application_not_public check (not (status in ('published', 'closed') and application_access = 'paid'))
);

create unique index if not exists jobs_slug_key on public.jobs (slug);
create index if not exists jobs_status_idx       on public.jobs (status, updated_at desc);
create index if not exists jobs_public_idx       on public.jobs (classification, published_at desc) where status = 'published';
create index if not exists jobs_category_idx     on public.jobs (category_id);
create index if not exists jobs_branch_idx       on public.jobs (branch_id);
create index if not exists jobs_created_by_idx   on public.jobs (created_by);

create trigger jobs_updated_at
  before update on public.jobs
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- What stops a job from being a genuine public listing. Empty array = publishable.
--
-- Codes, not sentences: the staff workspace renders them (lib/jobs/validation.ts
-- mirrors this function for instant feedback, and is tested against the same
-- cases). The database remains the authority.
-- -----------------------------------------------------------------------------
create or replace function public.job_publish_problems(j public.jobs)
returns text[]
language plpgsql
stable
set search_path = ''
as $$
declare
  problems text[] := '{}';
  category_active boolean;
begin
  select c.is_active into category_active from public.job_categories c where c.id = j.category_id;
  if category_active is null then
    problems := problems || 'category_missing'::text;
  elsif not category_active then
    problems := problems || 'category_inactive'::text;
  end if;

  if j.country_code is null then problems := problems || 'country_missing'::text; end if;
  if j.employment_type is null then problems := problems || 'employment_type_missing'::text; end if;
  if j.summary is null then problems := problems || 'summary_missing'::text; end if;
  if j.employer_disclosure is null then problems := problems || 'employer_disclosure_missing'::text; end if;

  if j.availability = 'time_limited' and j.closes_on is null then
    problems := problems || 'closing_date_missing'::text;
  end if;

  -- A professional opportunity states what it requires. General hiring may not
  -- have formal requirements, and is not made to invent them.
  if j.classification = 'professional' and cardinality(j.requirements) = 0 then
    problems := problems || 'requirements_missing'::text;
  end if;

  if j.application_access = 'paid' then
    problems := problems || 'paid_application_unavailable'::text;
  end if;

  return problems;
end;
$$;

-- -----------------------------------------------------------------------------
-- The write guard: derivations, locks, the transition table and validation.
-- SECURITY INVOKER — it reads only categories, which every writer can read.
-- -----------------------------------------------------------------------------
create or replace function public.jobs_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  staff       uuid := public.current_staff_id();
  today       date := (now() at time zone 'Asia/Kolkata')::date;
  cat_class   public.job_classification;
  transition  text;
  entering    boolean;
  problems    text[];
begin
  -- Classification always follows the category.
  select c.classification into cat_class from public.job_categories c where c.id = new.category_id;
  if cat_class is null then
    raise exception 'job_category_not_found' using errcode = 'foreign_key_violation';
  end if;
  new.classification := cat_class;

  if tg_op = 'INSERT' then
    -- A staff member creates drafts, as themselves. System inserts (the staging
    -- seed, imports) may state a status, and are validated like anything else.
    if staff is not null then
      if new.status <> 'draft' then
        raise exception 'job_must_start_as_draft' using errcode = 'check_violation';
      end if;
      new.created_by := staff;
      new.updated_by := staff;
      new.branch_id := coalesce(new.branch_id, public.current_branch_id());
    end if;
    new.published_at := null;
    new.last_published_at := null;
    new.closed_at := null;
    new.archived_at := null;
    entering := true;
  else
    -- Provenance and lifecycle timestamps are not editable.
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    new.duplicated_from := old.duplicated_from;
    new.published_at := old.published_at;
    new.last_published_at := old.last_published_at;
    new.closed_at := old.closed_at;
    new.archived_at := old.archived_at;
    new.updated_by := coalesce(staff, new.updated_by);

    entering := old.status is distinct from new.status;
    if entering then
      transition := old.status::text || '>' || new.status::text;
      if not transition = any (array[
        'draft>review',     'draft>archived',
        'review>draft',     'review>published', 'review>archived',
        'published>draft',  'published>closed', 'published>archived',
        'closed>published', 'closed>archived',
        'archived>draft'
      ]) then
        raise exception 'job_transition_not_allowed'
          using errcode = 'check_violation', detail = old.status::text || ' -> ' || new.status::text;
      end if;
    end if;
  end if;

  -- Reference and slug freeze at first publication.
  if tg_op = 'UPDATE' and old.published_at is not null then
    if new.reference is distinct from old.reference then
      raise exception 'job_reference_locked' using errcode = 'check_violation',
        hint = 'The reference of a job that has been published cannot change.';
    end if;
    new.slug := old.slug;
  else
    new.reference := upper(btrim(new.reference));
    new.slug := public.job_slug(new.title, new.reference);
  end if;

  -- Lifecycle timestamps.
  if new.status = 'published' and (tg_op = 'INSERT' or old.status <> 'published') then
    new.published_at := coalesce(new.published_at, now());
    new.last_published_at := now();
    new.closed_at := null;
  end if;
  if new.status = 'closed' and (tg_op = 'INSERT' or old.status <> 'closed') then
    new.closed_at := now();
  end if;
  if new.status = 'archived' and (tg_op = 'INSERT' or old.status <> 'archived') then
    new.archived_at := now();
  end if;
  if tg_op = 'UPDATE' and old.status = 'archived' and new.status <> 'archived' then
    new.archived_at := null;
  end if;

  -- Validation, whenever the job is (or is becoming) ready for the public.
  if new.status in ('review', 'published') then
    problems := public.job_publish_problems(new);

    -- Paid access may be drafted and reviewed; it is refused at publication.
    if new.status = 'review' then
      problems := array_remove(problems, 'paid_application_unavailable');
    end if;
    -- Deactivating a category must not freeze the jobs already live in it.
    if not entering then
      problems := array_remove(problems, 'category_inactive');
    end if;
    -- Publishing (or reopening) a time-limited job needs a deadline still ahead.
    if new.status = 'published' and entering and new.availability = 'time_limited'
       and new.closes_on is not null and new.closes_on < today then
      problems := problems || 'closing_date_passed'::text;
    end if;

    if cardinality(problems) > 0 then
      raise exception 'job_not_publishable'
        using errcode = 'check_violation',
              detail = array_to_string(problems, ','),
              hint = 'Complete the listed items before this job moves to ' || new.status::text || '.';
    end if;
  end if;

  return new;
end;
$$;

create trigger jobs_before_write_trg
  before insert or update on public.jobs
  for each row execute function public.jobs_before_write();

-- -----------------------------------------------------------------------------
-- Audit — meaningful actions, not raw row dumps.
--
-- One update can produce several entries: publishing a job and featuring it in
-- the same save records both. Ordinary edits record only the fields that changed.
-- SECURITY DEFINER for the same reason as audit_table_change: it writes where no
-- INSERT policy exists, which is what makes the trail unforgeable.
-- -----------------------------------------------------------------------------
create or replace function public.jobs_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor       uuid := nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'app_staff_id', '')::uuid;
  actor_kind  text;
  actor_email text;
  o           jsonb;
  n           jsonb;
  k           text;
  old_diff    jsonb := '{}'::jsonb;
  new_diff    jsonb := '{}'::jsonb;
  action      text;
  -- Derived or recorded by their own entries below.
  not_edits   text[] := array[
    'updated_at', 'updated_by', 'slug', 'classification', 'published_at', 'last_published_at',
    'closed_at', 'archived_at', 'status', 'promotion', 'featured_until', 'application_access'
  ];
begin
  actor_kind := case when actor is not null then 'staff' else 'system' end;
  if actor is not null then
    select su.email::text into actor_email from public.staff_users su where su.id = actor;
  end if;

  if tg_op = 'INSERT' then
    perform public.write_audit_log(
      actor_kind, actor, actor_email,
      case when new.duplicated_from is not null then 'job.duplicated' else 'job.created' end,
      'job', new.id, null,
      jsonb_build_object(
        'reference', new.reference, 'title', new.title, 'status', new.status,
        'classification', new.classification, 'availability', new.availability,
        'promotion', new.promotion, 'featured_until', new.featured_until,
        'application_access', new.application_access, 'duplicated_from', new.duplicated_from));
    return null;
  end if;

  if tg_op = 'DELETE' then
    perform public.write_audit_log(actor_kind, actor, actor_email, 'job.deleted', 'job', old.id, to_jsonb(old), null);
    return null;
  end if;

  if old.status is distinct from new.status then
    action := case old.status::text || '>' || new.status::text
      when 'draft>review'     then 'job.submitted_for_review'
      when 'review>draft'     then 'job.returned_to_draft'
      when 'review>published' then 'job.published'
      when 'published>draft'  then 'job.unpublished'
      when 'published>closed' then 'job.closed'
      when 'closed>published' then 'job.reopened'
      when 'archived>draft'   then 'job.restored'
      else case when new.status = 'archived' then 'job.archived' else 'job.status_changed' end
    end;
    perform public.write_audit_log(actor_kind, actor, actor_email, action, 'job', new.id,
      jsonb_build_object('status', old.status),
      jsonb_build_object('status', new.status, 'reference', new.reference));
  end if;

  if old.promotion is distinct from new.promotion then
    perform public.write_audit_log(actor_kind, actor, actor_email,
      case when new.promotion = 'featured' then 'job.featured' else 'job.unfeatured' end,
      'job', new.id,
      jsonb_build_object('promotion', old.promotion, 'featured_until', old.featured_until),
      jsonb_build_object('promotion', new.promotion, 'featured_until', new.featured_until));
  elsif new.promotion = 'featured' and old.featured_until is distinct from new.featured_until then
    perform public.write_audit_log(actor_kind, actor, actor_email, 'job.featured_until_changed', 'job', new.id,
      jsonb_build_object('featured_until', old.featured_until),
      jsonb_build_object('featured_until', new.featured_until));
  end if;

  if old.application_access is distinct from new.application_access then
    perform public.write_audit_log(actor_kind, actor, actor_email, 'job.application_access_changed', 'job', new.id,
      jsonb_build_object('application_access', old.application_access),
      jsonb_build_object('application_access', new.application_access));
  end if;

  o := to_jsonb(old);
  n := to_jsonb(new);
  for k in select jsonb_object_keys(n) loop
    continue when k = any (not_edits);
    if o -> k is distinct from n -> k then
      old_diff := old_diff || jsonb_build_object(k, o -> k);
      new_diff := new_diff || jsonb_build_object(k, n -> k);
    end if;
  end loop;
  if new_diff <> '{}'::jsonb then
    perform public.write_audit_log(actor_kind, actor, actor_email, 'job.updated', 'job', new.id, old_diff, new_diff);
  end if;

  return null;
end;
$$;

create trigger jobs_audit_trg
  after insert or update or delete on public.jobs
  for each row execute function public.jobs_audit();

create trigger audit_job_categories
  after insert or update or delete on public.job_categories
  for each row execute function public.audit_table_change();

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.job_categories enable row level security;
alter table public.jobs           enable row level security;

-- Categories are reference data with nothing sensitive in them. The public job
-- pages name the category of each job they show.
drop policy if exists "public reads job categories" on public.job_categories;
create policy "public reads job categories" on public.job_categories
  for select to anon using (true);

drop policy if exists "staff read job categories" on public.job_categories;
create policy "staff read job categories" on public.job_categories
  for select to authenticated using (public.is_staff());

drop policy if exists "jobs.manage creates job categories" on public.job_categories;
create policy "jobs.manage creates job categories" on public.job_categories
  for insert to authenticated with check (public.has_perm('jobs.manage'));

drop policy if exists "jobs.manage updates job categories" on public.job_categories;
create policy "jobs.manage updates job categories" on public.job_categories
  for update to authenticated
  using (public.has_perm('jobs.manage')) with check (public.has_perm('jobs.manage'));

-- The public website sees published jobs, and closed ones so that an old link
-- says "this job has closed" instead of vanishing. Never drafts, jobs in review
-- or archived jobs. Column privileges below keep internal fields out of reach.
drop policy if exists "public reads live jobs" on public.jobs;
create policy "public reads live jobs" on public.jobs
  for select to anon using (status in ('published', 'closed'));

drop policy if exists "staff read jobs" on public.jobs;
create policy "staff read jobs" on public.jobs
  for select to authenticated
  using (public.scope_allows('jobs.view', branch_id, created_by));

drop policy if exists "staff create jobs" on public.jobs;
create policy "staff create jobs" on public.jobs
  for insert to authenticated
  with check (public.scope_allows('jobs.manage', branch_id, created_by));

drop policy if exists "staff update jobs" on public.jobs;
create policy "staff update jobs" on public.jobs
  for update to authenticated
  using (public.scope_allows('jobs.manage', branch_id, created_by))
  with check (public.scope_allows('jobs.manage', branch_id, created_by));

-- No DELETE policy. A job is archived, never deleted: applications, cases and the
-- audit trail refer to it.

-- -----------------------------------------------------------------------------
-- Privileges — explicit, because a hosted project's defaults would otherwise
-- decide them (see 0011).
-- -----------------------------------------------------------------------------
revoke all on table public.job_categories, public.jobs from anon, authenticated, service_role;
revoke all on sequence public.job_reference_seq from anon, authenticated, service_role;

grant select on table public.job_categories to anon;
grant select, insert, update on table public.job_categories to authenticated;
grant select, insert, update, delete on table public.job_categories to service_role;

-- anon: the public columns only. Not internal_notes, not branch, not who created
-- or edited the job, not the lifecycle bookkeeping beyond what a listing shows.
grant select (
  id, reference, slug, title, category_id, classification, country_code, city,
  employer_disclosure, employer_name, employment_type, vacancies,
  salary_currency, salary_min, salary_max, salary_period,
  experience, education, languages, summary, responsibilities, requirements, benefits,
  additional_info, availability, closes_on, promotion, featured_until,
  application_access, application_method, status, published_at, updated_at
) on table public.jobs to anon;

grant select, insert, update on table public.jobs to authenticated;
grant select, insert, update, delete on table public.jobs to service_role;

grant usage on sequence public.job_reference_seq to authenticated, service_role;

-- Functions. PostgreSQL grants EXECUTE to PUBLIC by default; close each one.
revoke execute on function
  public.job_text_items_valid(text[]),
  public.next_job_reference(),
  public.job_slug(text, text),
  public.job_publish_problems(public.jobs)
from public, anon;
grant execute on function
  public.job_text_items_valid(text[]),
  public.next_job_reference(),
  public.job_slug(text, text),
  public.job_publish_problems(public.jobs)
to authenticated, service_role;

revoke execute on function
  public.job_categories_guard(),
  public.jobs_before_write(),
  public.jobs_audit()
from public, anon, authenticated;
