-- =============================================================================
-- 0022 — Employers (Recruitment Operations, increment 3).
--
-- An employer is the organisation a candidate is recruited FOR. It hangs off the existing
-- model rather than beside it: a recruitment case (case_recruitment.employer_id, declared
-- in 0004 without a target) and, optionally, a job (jobs.employer_id). No new customer or
-- case model.
--
-- WHAT THIS ADDS (additive only — no existing row is changed)
--
--   public.employers           name, country, optional registration number and website,
--                              contact person, email, phone, status, notes, branch.
--                              Every employer has a branch (NOT NULL).
--   jobs.employer_id           optional, staff-only. The public listing still shows
--                              employer_disclosure + employer_name exactly as before:
--                              the free-text name is the public wording and is never
--                              derived from, or overwritten by, the linked record. anon's
--                              column grant is unchanged, so the link is not public —
--                              which matters most for a confidential employer.
--   case_recruitment           the 0004 employer_id gets its foreign key.
--       .employer_id
--
-- ACCESS (existing permissions only: employers.view, employers.manage; nothing new)
--
--   RLS on employers is scope_allows(perm, branch_id, NULL). There is deliberately no
--   owner: with no owner the `own` clause can never match, so a branch-scoped holder can
--   read or write employers of its own branch only and can neither create one in, nor move
--   one to, another branch (the ownership hop in docs/BRANCH-SCOPE-AUDIT.md cannot arise).
--   No DELETE for staff: an employer is set inactive, and jobs and cases refer to it.
--
--   Linking (jobs, case_recruitment): the row's own policy decides whether the caller may
--   edit that job or case, as before. employer_link_guard adds that a staff member may
--   link only an employer they can SEE — a foreign key alone would accept any id, and
--   would let a link be made to an employer outside the caller's scope.
--
-- AUDIT
--
--   employers        audit_table_change: employers.insert / employers.update (full rows)
--   jobs, cases      employer_link_audit: job.employer_linked / _changed / _unlinked and
--                    case.employer_* (old and new employer id and name), plus a timeline
--                    entry on the case. jobs_audit's own job.updated diff also records it.
--
-- GUARD
--
--   Refuses to run if case_recruitment.employer_id already holds values: they could point
--   at nothing, and would need a decision, not an improvised backfill. On 28 Sep 2026 both
--   the local stack and Mumbai staging had none.
--
-- ROLLBACK (forward-only; if ever needed, in one transaction, before any employer exists
-- or after unlinking them):
--   drop trigger jobs_employer_link_guard on public.jobs;
--   drop trigger jobs_employer_link_audit on public.jobs;
--   drop trigger case_recruitment_employer_link_guard on public.case_recruitment;
--   drop trigger case_recruitment_employer_link_audit on public.case_recruitment;
--   alter table public.case_recruitment drop constraint case_recruitment_employer_fk;
--   drop index public.case_recruitment_employer_idx;
--   alter table public.jobs drop column employer_id;
--   drop table public.employers;
--   drop function public.employer_link_guard(), public.employer_link_audit(), public.employers_before_write();
--   drop type public.employer_status;
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Guard.
-- -----------------------------------------------------------------------------
do $$
declare n bigint;
begin
  select count(*) into n from public.case_recruitment where employer_id is not null;
  if n > 0 then
    raise exception '0022 refuses to run: case_recruitment.employer_id already holds % value(s) with no employer to point at. Decide what they are before applying.', n;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 1. The employer.
-- -----------------------------------------------------------------------------
do $$ begin
  create type public.employer_status as enum ('prospect', 'active', 'inactive');
exception when duplicate_object then null; end $$;

create table if not exists public.employers (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null
                      constraint employers_name_length check (length(btrim(name)) between 2 and 160),
  country_code        char(2) not null
                      constraint employers_country_code_format check (country_code ~ '^[A-Z]{2}$'),
  -- Generic on purpose: CR number, trade licence, CIN — whatever the employer's country uses.
  registration_number text
                      constraint employers_registration_number_length
                      check (registration_number is null or length(btrim(registration_number)) between 2 and 60),
  website             text
                      constraint employers_website_format
                      check (website is null or (length(website) <= 300 and website ~* '^https?://[^[:space:]/]+\.[^[:space:]]+$')),
  contact_person      text
                      constraint employers_contact_person_length
                      check (contact_person is null or length(btrim(contact_person)) between 2 and 120),
  email               citext
                      constraint employers_email_format
                      check (email is null or (length(email) <= 254 and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')),
  phone               text
                      constraint employers_phone_format
                      check (phone is null or phone ~ '^\+?[0-9][0-9 ()-]{5,24}$'),
  status              public.employer_status not null default 'active',
  notes               text
                      constraint employers_notes_length check (notes is null or length(notes) <= 4000),
  branch_id           uuid not null references public.branches(id),
  created_by          uuid references public.staff_users(id) on delete set null,
  updated_by          uuid references public.staff_users(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- One record per employer: the same name in the same country is the same employer.
create unique index if not exists employers_name_country_key on public.employers (lower(btrim(name)), country_code);
create index if not exists employers_branch_idx on public.employers (branch_id);

drop trigger if exists employers_updated_at on public.employers;
create trigger employers_updated_at
  before update on public.employers
  for each row execute function public.set_updated_at();

-- Tidies the name and country, and makes provenance the database's: a staff member
-- creates as themselves, and nobody rewrites who created a record.
-- SECURITY INVOKER: current_user tells a staff session from the server (see 0021).
create or replace function public.employers_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  staff uuid := public.current_staff_id();
begin
  new.name := btrim(regexp_replace(new.name, '[[:space:]]+', ' ', 'g'));
  new.country_code := upper(new.country_code);

  if tg_op = 'INSERT' then
    new.branch_id := coalesce(new.branch_id, public.current_branch_id());
    if current_user = 'authenticated' then
      new.created_by := staff;
      new.updated_by := staff;
    end if;
  else
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    if current_user = 'authenticated' then
      new.updated_by := staff;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists employers_before_write_trg on public.employers;
create trigger employers_before_write_trg
  before insert or update on public.employers
  for each row execute function public.employers_before_write();

drop trigger if exists audit_employers on public.employers;
create trigger audit_employers
  after insert or update or delete on public.employers
  for each row execute function public.audit_table_change();

alter table public.employers enable row level security;

drop policy if exists "staff read employers" on public.employers;
create policy "staff read employers" on public.employers
  for select to authenticated
  using (public.scope_allows('employers.view', branch_id, null::uuid));

drop policy if exists "staff create employers" on public.employers;
create policy "staff create employers" on public.employers
  for insert to authenticated
  with check (public.scope_allows('employers.manage', branch_id, null::uuid));

drop policy if exists "staff update employers" on public.employers;
create policy "staff update employers" on public.employers
  for update to authenticated
  using (public.scope_allows('employers.manage', branch_id, null::uuid))
  with check (public.scope_allows('employers.manage', branch_id, null::uuid));

-- No DELETE policy and no DELETE privilege: an employer is made inactive, never deleted.
revoke all on table public.employers from anon, authenticated, service_role;
grant select, insert on table public.employers to authenticated;
grant update (
  name, country_code, registration_number, website, contact_person,
  email, phone, status, notes, branch_id
) on table public.employers to authenticated;
grant select, insert, update, delete on table public.employers to service_role;

-- -----------------------------------------------------------------------------
-- 2. The links.
-- -----------------------------------------------------------------------------
alter table public.jobs add column if not exists employer_id uuid;
alter table public.jobs drop constraint if exists jobs_employer_fk;
alter table public.jobs
  add constraint jobs_employer_fk foreign key (employer_id) references public.employers(id) on delete restrict;
create index if not exists jobs_employer_idx on public.jobs (employer_id) where employer_id is not null;
-- anon's column-level SELECT on jobs (0012) is deliberately NOT extended.

alter table public.case_recruitment drop constraint if exists case_recruitment_employer_fk;
alter table public.case_recruitment
  add constraint case_recruitment_employer_fk foreign key (employer_id) references public.employers(id) on delete restrict;
create index if not exists case_recruitment_employer_idx on public.case_recruitment (employer_id) where employer_id is not null;

-- A staff member links only an employer they can see. SECURITY INVOKER, so the lookup
-- runs under the caller's own RLS; the server and definer functions are not limited.
create or replace function public.employer_link_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'authenticated'
     and new.employer_id is not null
     and (tg_op = 'INSERT' or new.employer_id is distinct from old.employer_id)
     and not exists (select 1 from public.employers e where e.id = new.employer_id) then
    raise exception 'employer_not_available: link only an employer you can see'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

drop trigger if exists jobs_employer_link_guard on public.jobs;
create trigger jobs_employer_link_guard
  before insert or update of employer_id on public.jobs
  for each row execute function public.employer_link_guard();

drop trigger if exists case_recruitment_employer_link_guard on public.case_recruitment;
create trigger case_recruitment_employer_link_guard
  before insert or update of employer_id on public.case_recruitment
  for each row execute function public.employer_link_guard();

-- Linking, changing and unlinking an employer, as meaningful audit entries; on a case,
-- also on its timeline. SECURITY DEFINER like the other audit writers: it writes where no
-- INSERT policy exists, which is what makes the trail unforgeable.
create or replace function public.employer_link_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor      uuid := nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'app_staff_id', '')::uuid;
  actor_kind text;
  old_emp    uuid;
  new_emp    uuid := new.employer_id;
  old_name   text;
  new_name   text;
  what       text;
  kind       text;
  entity     uuid;
  contact    uuid;
begin
  if tg_op = 'UPDATE' then old_emp := old.employer_id; end if;
  if old_emp is not distinct from new_emp then return null; end if;

  actor_kind := case when actor is not null then 'staff' else 'system' end;
  select e.name into old_name from public.employers e where e.id = old_emp;
  select e.name into new_name from public.employers e where e.id = new_emp;
  what := case when old_emp is null then 'employer_linked'
               when new_emp is null then 'employer_unlinked'
               else 'employer_changed' end;

  if tg_table_name = 'jobs' then
    kind := 'job';
    entity := (to_jsonb(new) ->> 'id')::uuid;
  else
    kind := 'case';
    entity := (to_jsonb(new) ->> 'case_id')::uuid;
  end if;

  perform public.write_audit_log(
    actor_kind, actor, null, kind || '.' || what, kind, entity,
    jsonb_build_object('employer_id', old_emp, 'employer_name', old_name),
    jsonb_build_object('employer_id', new_emp, 'employer_name', new_name));

  if kind = 'case' then
    select c.contact_id into contact from public.cases c where c.id = entity;
    perform public.log_activity(
      contact, entity, actor_kind, actor, 'case.' || what,
      case what when 'employer_linked'   then 'Employer linked: ' || new_name
                when 'employer_unlinked' then 'Employer unlinked: ' || old_name
                else 'Employer changed: ' || old_name || ' → ' || new_name end,
      'employer', coalesce(new_emp, old_emp), '{}'::jsonb);
  end if;

  return null;
end;
$$;

drop trigger if exists jobs_employer_link_audit on public.jobs;
create trigger jobs_employer_link_audit
  after insert or update of employer_id on public.jobs
  for each row execute function public.employer_link_audit();

drop trigger if exists case_recruitment_employer_link_audit on public.case_recruitment;
create trigger case_recruitment_employer_link_audit
  after insert or update of employer_id on public.case_recruitment
  for each row execute function public.employer_link_audit();

-- Trigger functions: nobody calls them directly.
revoke execute on function
  public.employers_before_write(),
  public.employer_link_guard(),
  public.employer_link_audit()
from public, anon, authenticated;
