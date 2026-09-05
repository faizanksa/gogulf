-- =============================================================================
-- 0002 — Platform foundation: extensions, shared helpers, org structure, RBAC.
--
-- ADDITIVE ONLY. Creates new objects. Touches nothing that exists:
-- `public.job_applications` and the `job-applications` storage bucket are not
-- referenced, altered or read by this migration.
--
-- Conventions established here and used by every later migration:
--   * uuid primary keys via gen_random_uuid()
--   * timestamptz everywhere, never timestamp
--   * money as bigint paise, never numeric/float
--   * updated_at maintained by trigger, never by application code
--   * RLS enabled on every table; policies land in 0008
-- =============================================================================

create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "citext";     -- case-insensitive email

-- -----------------------------------------------------------------------------
-- Shared trigger: updated_at
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at is
  'Maintains updated_at. Attached by trigger so application code can never forget it.';

-- -----------------------------------------------------------------------------
-- Branches — one physical branch today (Lucknow), but every business table
-- carries branch_id from day one so multi-branch is a switch to turn on later
-- rather than a migration. No branch-management UI is built yet.
-- -----------------------------------------------------------------------------
create table if not exists public.branches (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  code        text not null unique,
  city        text,
  region      text,
  country_code char(2) not null default 'IN',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger branches_updated_at
  before update on public.branches
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- RBAC: roles, permissions, grants.
--
-- Scope lives on the GRANT, not in the permission name. `contacts.view` granted
-- at scope 'own' to a recruiter and at 'branch' to an HR manager is one
-- permission string with two behaviours — instead of an unmaintainable
-- contacts.view.own / .branch / .all explosion.
-- -----------------------------------------------------------------------------
create table if not exists public.roles (
  key         text primary key,
  label       text not null,
  description text,
  -- Super admin bypasses permission lookup entirely (see has_perm in 0007).
  is_super    boolean not null default false,
  sort_order  int not null default 100,
  created_at  timestamptz not null default now()
);

create table if not exists public.permissions (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,
  domain      text not null,
  description text,
  created_at  timestamptz not null default now()
);

comment on table public.permissions is
  'Seeded by migration, never created at runtime. A permission string that no policy references is a security illusion.';

create table if not exists public.role_permissions (
  role_key      text not null references public.roles(key) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  scope         text not null check (scope in ('all','branch','own')),
  primary key (role_key, permission_id)
);

create index if not exists role_permissions_role_idx on public.role_permissions (role_key);

-- -----------------------------------------------------------------------------
-- Staff users — 1:1 with auth.users for employees.
--
-- Staff authenticate through Google Workspace SSO restricted to @gogulf.co.
-- `is_active` is checked inside has_perm(), so deactivating a row revokes
-- access on the user's NEXT QUERY rather than when their token expires.
-- -----------------------------------------------------------------------------
create table if not exists public.staff_users (
  id             uuid primary key default gen_random_uuid(),
  auth_user_id   uuid unique references auth.users(id) on delete set null,
  email          citext not null unique,
  full_name      text not null,
  role_key       text not null references public.roles(key),
  branch_id      uuid references public.branches(id),
  phone_e164     text,
  is_active      boolean not null default true,
  deactivated_at timestamptz,
  last_seen_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists staff_users_auth_idx   on public.staff_users (auth_user_id);
create index if not exists staff_users_role_idx   on public.staff_users (role_key);
create index if not exists staff_users_branch_idx on public.staff_users (branch_id);

create trigger staff_users_updated_at
  before update on public.staff_users
  for each row execute function public.set_updated_at();

-- Staff email must be on the company domain. Defence in depth behind the SSO
-- hosted-domain restriction: even a mistaken manual insert cannot create an
-- outside-domain staff account.
alter table public.staff_users
  drop constraint if exists staff_users_company_domain;
alter table public.staff_users
  add constraint staff_users_company_domain
  check (email like '%@gogulf.co');

-- -----------------------------------------------------------------------------
-- Settings — feature flags and business configuration. Read at runtime so a
-- flag can be flipped without a deploy.
-- -----------------------------------------------------------------------------
create table if not exists public.settings (
  key        text primary key,
  value      jsonb not null,
  description text,
  updated_by uuid references public.staff_users(id),
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- RLS on. Policies are defined in 0008; until then these tables are
-- default-deny for anon and authenticated, which is the correct posture for a
-- half-built schema.
-- -----------------------------------------------------------------------------
alter table public.branches         enable row level security;
alter table public.roles            enable row level security;
alter table public.permissions      enable row level security;
alter table public.role_permissions enable row level security;
alter table public.staff_users      enable row level security;
alter table public.settings         enable row level security;
