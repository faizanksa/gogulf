-- =============================================================================
-- 0004 — Cases, the activity timeline, and tasks.
--
-- Recruitment applications, travel inquiries, visa services and tour bookings
-- each need a pipeline, a stage, an owner, a timeline, tasks, documents,
-- payments and notifications. Building those seven subsystems four times over
-- is how CRMs rot.
--
-- So: ONE `cases` table with 1:1 typed extensions. Adding a service line later
-- is a new case_type, one extension table and some pipeline rows — not a new
-- subsystem.
--
-- ADDITIVE ONLY.
-- =============================================================================

do $$ begin
  create type public.case_type as enum
    ('recruitment','travel','visa','tour_booking','support');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.case_status as enum ('open','won','lost','cancelled');
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- Pipelines — stages are DATA, not code. An administrator adds or reorders a
-- stage without a deploy. The stages seeded in 0009 are a starting point, to be
-- replaced by whatever the recruitment and travel leads actually use.
-- -----------------------------------------------------------------------------
create table if not exists public.pipelines (
  id         uuid primary key default gen_random_uuid(),
  case_type  public.case_type not null,
  name       text not null,
  is_default boolean not null default false,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists pipelines_one_default_per_type
  on public.pipelines (case_type) where is_default;

create trigger pipelines_updated_at
  before update on public.pipelines
  for each row execute function public.set_updated_at();

create table if not exists public.pipeline_stages (
  id          uuid primary key default gen_random_uuid(),
  pipeline_id uuid not null references public.pipelines(id) on delete cascade,
  key         text not null,
  name        text not null,
  position    int not null,
  is_won      boolean not null default false,
  is_lost     boolean not null default false,
  -- Drives the "stalled case" report: a case sitting past this many hours in
  -- one stage needs attention.
  sla_hours   int,
  created_at  timestamptz not null default now(),
  unique (pipeline_id, position),
  unique (pipeline_id, key)
);

-- -----------------------------------------------------------------------------
-- Cases
-- -----------------------------------------------------------------------------
create table if not exists public.cases (
  id                 uuid primary key default gen_random_uuid(),
  case_number        text not null unique,          -- GG-REC-2026-00184
  contact_id         uuid not null references public.contacts(id) on delete restrict,
  case_type          public.case_type not null,
  pipeline_id        uuid not null references public.pipelines(id),
  stage_id           uuid not null references public.pipeline_stages(id),
  status             public.case_status not null default 'open',
  title              text,
  owner_id           uuid references public.staff_users(id) on delete set null,
  branch_id          uuid references public.branches(id),
  value_amount_paise bigint,                        -- integer paise, never float
  priority           smallint not null default 3 check (priority between 1 and 5),
  source_id          uuid,                          -- FK added with lead_sources
  legacy_id          uuid,
  opened_at          timestamptz not null default now(),
  stage_entered_at   timestamptz not null default now(),
  closed_at          timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz
);

create index if not exists cases_contact_idx  on public.cases (contact_id) where deleted_at is null;
create index if not exists cases_stage_idx    on public.cases (pipeline_id, stage_id) where deleted_at is null;
create index if not exists cases_branch_idx   on public.cases (branch_id) where deleted_at is null;
create index if not exists cases_legacy_idx   on public.cases (legacy_id) where legacy_id is not null;
-- Partial index for the most common admin query: "my open cases".
create index if not exists cases_my_open_idx
  on public.cases (owner_id) where status = 'open' and deleted_at is null;

create trigger cases_updated_at
  before update on public.cases
  for each row execute function public.set_updated_at();

-- Gapless case numbers per type per year. Support conversations are much easier
-- with a short human reference than a UUID.
create sequence if not exists public.case_number_seq;

create or replace function public.next_case_number(p_type public.case_type)
returns text
language plpgsql
as $$
declare
  prefix text;
  n      bigint;
begin
  prefix := case p_type
              when 'recruitment'  then 'REC'
              when 'travel'       then 'TRV'
              when 'visa'         then 'VIS'
              when 'tour_booking' then 'TUR'
              else 'SUP'
            end;
  n := nextval('public.case_number_seq');
  return 'GG-' || prefix || '-' || to_char(now(), 'YYYY') || '-' || lpad(n::text, 5, '0');
end;
$$;

-- Stage changes must record when they happened — "days in stage" is a core
-- operational metric and cannot be reconstructed after the fact.
create or replace function public.cases_touch_stage_entered()
returns trigger
language plpgsql
as $$
begin
  if new.stage_id is distinct from old.stage_id then
    new.stage_entered_at = now();
  end if;
  return new;
end;
$$;

create trigger cases_stage_entered
  before update on public.cases
  for each row execute function public.cases_touch_stage_entered();

-- -----------------------------------------------------------------------------
-- Typed 1:1 extensions — only the fields that type actually needs.
-- -----------------------------------------------------------------------------
create table if not exists public.case_recruitment (
  case_id               uuid primary key references public.cases(id) on delete cascade,
  job_id                uuid,                 -- FK added in Phase 5 with jobs
  employer_id           uuid,                 -- FK added in Phase 5 with employers
  -- Legacy applications reference vacancies that no longer exist as records.
  -- Kept as free text rather than inventing job rows for them.
  legacy_job_title      text,
  legacy_job_country    text,
  expected_salary_paise bigint,
  years_experience      numeric(4,1),
  -- Last four digits only. The full number lives in the passport document,
  -- behind category-scoped permissions and signed URLs.
  passport_number_last4 text check (passport_number_last4 ~ '^[0-9A-Za-z]{4}$'),
  created_at            timestamptz not null default now()
);

create table if not exists public.case_travel (
  case_id        uuid primary key references public.cases(id) on delete cascade,
  destination    text,
  depart_date    date,
  return_date    date,
  pax_adults     int not null default 1,
  pax_children   int not null default 0,
  budget_paise   bigint,
  created_at     timestamptz not null default now()
);

create table if not exists public.case_visa (
  case_id         uuid primary key references public.cases(id) on delete cascade,
  visa_type       text,
  country_code    char(2),
  application_ref text,
  submitted_at    timestamptz,
  created_at      timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Activities — the Customer 360 timeline.
--
-- Written at the moment something happens, in the SAME TRANSACTION as the
-- change. `summary` is pre-rendered so the timeline needs no joins at read
-- time. The alternative — a UNION view across eight source tables — is cleaner
-- in theory and unusably slow on the busiest screen in the product.
--
-- Append-only: no UPDATE or DELETE policy is ever granted.
-- -----------------------------------------------------------------------------
create table if not exists public.activities (
  id          uuid primary key default gen_random_uuid(),
  contact_id  uuid references public.contacts(id) on delete cascade,
  case_id     uuid references public.cases(id) on delete cascade,
  actor_type  text not null check (actor_type in ('staff','customer','system','provider')),
  actor_id    uuid,
  actor_label text,
  verb        text not null,          -- case.created, stage.changed, document.uploaded …
  entity_type text,
  entity_id   uuid,
  summary     text not null,
  metadata    jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

-- The single most-hit index in the product.
create index if not exists activities_contact_idx on public.activities (contact_id, occurred_at desc);
create index if not exists activities_case_idx    on public.activities (case_id, occurred_at desc);
create index if not exists activities_verb_idx    on public.activities (verb, occurred_at desc);

-- Convenience writer so every call site records a timeline entry the same way.
create or replace function public.log_activity(
  p_contact_id  uuid,
  p_case_id     uuid,
  p_actor_type  text,
  p_actor_id    uuid,
  p_verb        text,
  p_summary     text,
  p_entity_type text default null,
  p_entity_id   uuid default null,
  p_metadata    jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
begin
  insert into public.activities
    (contact_id, case_id, actor_type, actor_id, verb, summary, entity_type, entity_id, metadata)
  values
    (p_contact_id, p_case_id, p_actor_type, p_actor_id, p_verb, p_summary, p_entity_type, p_entity_id, p_metadata)
  returning id into new_id;

  if p_contact_id is not null then
    update public.contacts set last_activity_at = now() where id = p_contact_id;
  end if;

  return new_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Tasks and notes
-- -----------------------------------------------------------------------------
create table if not exists public.tasks (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  description  text,
  assignee_id  uuid references public.staff_users(id) on delete set null,
  contact_id   uuid references public.contacts(id) on delete cascade,
  case_id      uuid references public.cases(id) on delete cascade,
  priority     smallint not null default 3 check (priority between 1 and 5),
  status       text not null default 'open' check (status in ('open','in_progress','done','cancelled')),
  due_at       timestamptz,
  completed_at timestamptz,
  completed_by uuid references public.staff_users(id),
  branch_id    uuid references public.branches(id),
  created_by   uuid references public.staff_users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists tasks_assignee_open_idx on public.tasks (assignee_id, due_at) where status in ('open','in_progress');
create index if not exists tasks_contact_idx       on public.tasks (contact_id);
create index if not exists tasks_case_idx          on public.tasks (case_id);

create trigger tasks_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

-- Note visibility is part of the RLS predicate, not an application filter.
-- This is how Accounts is prevented from reading private HR assessments.
create table if not exists public.notes (
  id         uuid primary key default gen_random_uuid(),
  contact_id uuid references public.contacts(id) on delete cascade,
  case_id    uuid references public.cases(id) on delete cascade,
  body       text not null,
  visibility text not null default 'team'
             check (visibility in ('team','hr_private','finance_private')),
  author_id  uuid references public.staff_users(id),
  branch_id  uuid references public.branches(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notes_contact_idx on public.notes (contact_id, created_at desc);
create index if not exists notes_case_idx    on public.notes (case_id, created_at desc);

create trigger notes_updated_at
  before update on public.notes
  for each row execute function public.set_updated_at();

alter table public.pipelines        enable row level security;
alter table public.pipeline_stages  enable row level security;
alter table public.cases            enable row level security;
alter table public.case_recruitment enable row level security;
alter table public.case_travel      enable row level security;
alter table public.case_visa        enable row level security;
alter table public.activities       enable row level security;
alter table public.tasks            enable row level security;
alter table public.notes            enable row level security;
