-- =============================================================================
-- Semantic validation for migrations 0002–0011.
--
-- The parser check (libpg_query) proves syntax only. This proves BEHAVIOUR:
-- that policies filter the way they claim to, that the JWT hook populates
-- claims, that the audit trail cannot be altered, and that deactivating a staff
-- member takes effect immediately.
--
-- NEVER RUN THIS AGAINST A DATABASE HOLDING REAL DATA. It inserts contacts and
-- identities to prove the constraints actually fire. Each file runs inside a
-- transaction and rolls back, so nothing should persist — but "should" is not
-- the standard to apply to a database holding passport scans.
--
-- An EMPTY project being provisioned is a different case and is explicitly fine:
-- it holds nothing to damage, and provisioning is the right moment to prove the
-- schema before it is trusted with anything. Mumbai production was verified this
-- way on 16 Sep 2026, before any data or user existed on it. Once a project is
-- live, use staging.
--
--   npm run db:test                     # local
--   npm run db:staging -- test          # Tokyo staging
--   npm run db:mumbai  -- test          # Mumbai rehearsal
--   supabase db reset                   # applies 0001–0011 from empty, locally
--   psql -v ON_ERROR_STOP=1 "$DB_URL" -f supabase/tests/rls.test.sql
--
-- ON_ERROR_STOP is passed on the command line rather than with a \set
-- meta-command, so this file stays pure SQL and can be checked by the same
-- parser that validates the migrations.
--
-- Any failure raises an exception and aborts. Silence is success.
-- =============================================================================

begin;

create or replace function test_assert(condition boolean, description text)
returns void language plpgsql as $$
begin
  if condition then
    raise notice 'PASS  %', description;
  else
    raise exception 'FAIL  %', description;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. Phone normalisation must agree with lib/phone.ts
-- ---------------------------------------------------------------------------
select test_assert(public.normalize_phone_e164('9936309015') = '+919936309015',
  'bare Indian mobile gets +91');
select test_assert(public.normalize_phone_e164('09936309015') = '+919936309015',
  'leading trunk zero stripped');
select test_assert(public.normalize_phone_e164('919936309015') = '+919936309015',
  'already country-coded accepted');
select test_assert(public.normalize_phone_e164('+91 99363 09015') = '+919936309015',
  'punctuation and spacing ignored');
select test_assert(public.normalize_phone_e164('00919936309015') = '+919936309015',
  '00 international prefix stripped');
select test_assert(public.normalize_phone_e164('971501234567') = '+971501234567',
  'foreign number keeps its own country code');

-- The critical property: ambiguity returns NULL so the caller quarantines the
-- row for human review. Guessing would silently merge two different people.
select test_assert(public.normalize_phone_e164('12345') is null,
  'too short returns NULL rather than guessing');
select test_assert(public.normalize_phone_e164('2234567890') is null,
  '10-digit non-mobile prefix returns NULL');
select test_assert(public.normalize_phone_e164('') is null, 'empty returns NULL');
select test_assert(public.normalize_phone_e164(null) is null, 'null returns NULL');
select test_assert(public.normalize_email('  Careers@GoGulf.CO ') = 'careers@gogulf.co',
  'email lowercased and trimmed');

-- ---------------------------------------------------------------------------
-- 2. Seed data matches docs/RBAC-RLS.md
-- ---------------------------------------------------------------------------
select test_assert((select count(*) from public.roles) = 12, 'twelve roles seeded');
select test_assert((select is_super from public.roles where key = 'SUPER_ADMIN'),
  'SUPER_ADMIN is flagged is_super');
-- Exact, not a lower bound: an unexpected permission is catalogue drift.
select test_assert((select count(*) from public.permissions) = 72,
  'permission catalogue seeded with exactly 72 permissions');
select test_assert(
  not exists (select 1 from public.role_permissions where role_key = 'SUPER_ADMIN'),
  'SUPER_ADMIN has no explicit grants — is_super short-circuits has_perm');
select test_assert(
  not exists (
    select 1 from public.role_permissions rp
    join public.permissions p on p.id = rp.permission_id
    where rp.role_key in ('FINANCE_MANAGER','ACCOUNTS')
      and p.key = 'documents.view.identity'),
  'finance roles cannot view identity documents');
select test_assert(
  not exists (
    select 1 from public.role_permissions rp
    join public.permissions p on p.id = rp.permission_id
    where rp.role_key = 'ADMIN' and p.key in ('roles.manage','permissions.manage')),
  'ADMIN cannot redefine roles or permissions');
select test_assert(
  not exists (
    select 1 from public.role_permissions rp
    join public.permissions p on p.id = rp.permission_id
    where rp.role_key = 'ACCOUNTS' and p.key = 'refunds.approve'),
  'ACCOUNTS cannot approve the refunds it raises');
select test_assert(
  not exists (
    select 1 from public.role_permissions rp
    join public.permissions p on p.id = rp.permission_id
    where rp.role_key = 'MARKETING_MANAGER'
      and (p.key like 'documents.%' or p.key like 'payments.%')),
  'MARKETING_MANAGER has no document or payment access');

-- ---------------------------------------------------------------------------
-- 3. Identity uniqueness is enforced by the database, not by convention
-- ---------------------------------------------------------------------------
do $$
declare
  c1 uuid; c2 uuid; duplicate_rejected boolean := false;
begin
  insert into public.contacts (full_name) values ('Test One') returning id into c1;
  insert into public.contacts (full_name) values ('Test Two') returning id into c2;

  insert into public.contact_identities (contact_id, type, value_raw)
  values (c1, 'phone', '9936309015');

  begin
    insert into public.contact_identities (contact_id, type, value_raw)
    values (c2, 'phone', '+91 99363 09015');   -- same number, different format
  exception when unique_violation then
    duplicate_rejected := true;
  end;

  perform test_assert(duplicate_rejected,
    'two contacts cannot share one normalised phone, even in different formats');

  perform test_assert(
    (select primary_phone_e164 from public.contacts where id = c1) = '+919936309015',
    'contacts.primary_phone_e164 is maintained by trigger from the identity row');

  -- Unnormalisable input must be refused, not stored raw.
  declare bad_rejected boolean := false;
  begin
    begin
      insert into public.contact_identities (contact_id, type, value_raw)
      values (c2, 'phone', '12345');
    exception when others then
      bad_rejected := true;
    end;
    perform test_assert(bad_rejected,
      'an unnormalisable phone is refused rather than stored ambiguously');
  end;

  -- Resolution order and exactness
  perform test_assert(public.resolve_contact(null, '09936309015', null) = c1,
    'resolve_contact matches a differently-formatted phone to the same contact');
  perform test_assert(public.resolve_contact(null, '9000000001', null) is null,
    'resolve_contact returns NULL for an unknown number rather than a near match');

  delete from public.contacts where id in (c1, c2);
end $$;

-- ---------------------------------------------------------------------------
-- 4. RLS is enabled everywhere it must be
-- ---------------------------------------------------------------------------
do $$
declare missing text;
begin
  select string_agg(c.relname, ', ')
    into missing
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relkind = 'r'
     and not c.relrowsecurity;

  perform test_assert(missing is null,
    coalesce('every public table has RLS enabled (missing: ' || missing || ')',
             'every public table has RLS enabled'));
end $$;

-- ---------------------------------------------------------------------------
-- 5. Audit immutability — the absence of policies IS the control
-- ---------------------------------------------------------------------------
select test_assert(
  not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'audit_logs'
       and cmd in ('UPDATE','DELETE','ALL')),
  'audit_logs has no UPDATE, DELETE or ALL policy for any role');
select test_assert(
  exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'audit_logs' and cmd = 'SELECT'),
  'audit_logs is readable by audit.view holders');
select test_assert(
  not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'audit_logs' and cmd = 'INSERT'),
  'audit_logs has no INSERT policy — writes come only from SECURITY DEFINER triggers');

-- Redaction must strip secrets before they are stored.
select test_assert(
  public.redact_audit_payload('{"password":"hunter2","name":"Asha"}'::jsonb) ->> 'password'
    = '[REDACTED]',
  'audit redaction strips passwords');
select test_assert(
  public.redact_audit_payload('{"otp":"482913"}'::jsonb) ->> 'otp' = '[REDACTED]',
  'audit redaction strips OTP codes');
select test_assert(
  public.redact_audit_payload('{"name":"Asha"}'::jsonb) ->> 'name' = 'Asha',
  'audit redaction leaves ordinary fields intact');

-- A pooled connection can carry request.jwt.claims = '' left over from an
-- earlier client (regression guard for 0010, found on staging). Audited writes
-- must still succeed and be attributed to the system.
do $$
declare
  prev text := current_setting('request.jwt.claims', true);
  c uuid;
begin
  perform set_config('request.jwt.claims', '', true);
  insert into public.contacts (full_name) values ('Pooled connection probe') returning id into c;
  update public.contacts set full_name = 'Pooled connection probe (renamed)' where id = c;
  perform test_assert(
    exists (select 1 from public.audit_logs
             where entity_id = c and action = 'contacts.update' and actor_type = 'system'),
    'an audited write succeeds, attributed to the system, when claims are an empty string');
  delete from public.contacts where id = c;
  perform set_config('request.jwt.claims', coalesce(prev, ''), true);
end $$;

-- ---------------------------------------------------------------------------
-- 6. Helper functions are SECURITY DEFINER with a pinned search_path
--    (an unpinned search_path on a definer function is a privilege-escalation
--    route, and Supabase's own advisor flags it)
-- ---------------------------------------------------------------------------
do $$
declare bad text;
begin
  select string_agg(p.proname, ', ')
    into bad
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.prosecdef
     and not exists (
       select 1 from unnest(coalesce(p.proconfig, '{}')) cfg
        where cfg like 'search_path=%');

  perform test_assert(bad is null,
    coalesce('every SECURITY DEFINER function pins search_path (missing: ' || bad || ')',
             'every SECURITY DEFINER function pins search_path'));
end $$;

-- ---------------------------------------------------------------------------
-- 7. JWT hook shape
-- ---------------------------------------------------------------------------
do $$
declare result jsonb;
begin
  result := public.custom_access_token_hook(
    jsonb_build_object('user_id', gen_random_uuid()::text,
                       'claims', jsonb_build_object('sub', 'x')));
  perform test_assert(result ? 'claims',
    'hook returns a claims object for an unknown user without failing login');
  perform test_assert(not (result -> 'claims' ? 'app_staff_id'),
    'a non-staff user receives no staff claims');
end $$;

-- ---------------------------------------------------------------------------
-- 8. Case numbering is well-formed
-- ---------------------------------------------------------------------------
select test_assert(public.next_case_number('recruitment') like 'GG-REC-%',
  'recruitment case numbers are prefixed GG-REC');
select test_assert(public.next_case_number('travel') like 'GG-TRV-%',
  'travel case numbers are prefixed GG-TRV');
select test_assert(
  public.next_case_number('recruitment') <> public.next_case_number('recruitment'),
  'case numbers are unique across calls');

-- ---------------------------------------------------------------------------
-- 9. No side doors reachable through the API (regression guard for 0009, 0011)
--    job_applications is excluded from the blanket "anon holds nothing" check
--    only because anon legitimately holds INSERT there — the public applicant
--    path. Section 9a pins that down exactly, so the table is covered more
--    tightly than the platform tables rather than exempted from scrutiny.
-- ---------------------------------------------------------------------------
do $$
declare bad text;
begin
  -- Functions returning trigger or event_trigger are excluded throughout this
  -- section. PostgreSQL refuses to invoke them from SQL at all -- "trigger
  -- functions can only be called as triggers", SQLSTATE 0A000 -- so an EXECUTE
  -- grant on one conveys nothing and is not attack surface. Verified as anon on
  -- the Mumbai project.
  --
  -- This is not a convenience exemption. Mumbai production ships a Supabase
  -- platform function, public.rls_auto_enable(), which backs the ensure_rls
  -- event trigger: SECURITY DEFINER, search_path pinned, EXECUTE granted to
  -- PUBLIC, and owned by the platform rather than by these migrations. Revoking
  -- from it would drift from the platform's own expected state and be restored
  -- by the next platform update. Narrowing the assertion to functions that can
  -- actually be called states the real security property and is stable.
  --
  -- Our own trigger functions keep their explicit revokes in 0009 regardless.
  select string_agg(p.proname, ', ') into bad
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prosecdef
     and p.prorettype not in ('pg_catalog.trigger'::regtype, 'pg_catalog.event_trigger'::regtype)
     and has_function_privilege('anon', p.oid, 'EXECUTE');
  perform test_assert(bad is null,
    coalesce('no SECURITY DEFINER function is executable by anon (found: ' || bad || ')',
             'no SECURITY DEFINER function is executable by anon'));

  select string_agg(p.proname, ', ') into bad
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prosecdef
     and p.prorettype not in ('pg_catalog.trigger'::regtype, 'pg_catalog.event_trigger'::regtype)
     and has_function_privilege('authenticated', p.oid, 'EXECUTE')
     and p.proname not in ('has_perm', 'scope_allows', 'is_staff', 'current_contact_id');
  perform test_assert(bad is null,
    coalesce('authenticated can execute no system-only SECURITY DEFINER function (found: ' || bad || ')',
             'authenticated can execute no system-only SECURITY DEFINER function'));

  -- TRUNCATE is not subject to RLS at all. job_applications is included here:
  -- 0011 removed the inherited TRUNCATE that let anon empty the applications
  -- table outright, and no table in this schema should ever grant it back.
  select string_agg(distinct c.relname, ', ') into bad
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    cross join (values ('anon'), ('authenticated')) r(role)
   where n.nspname = 'public' and c.relkind in ('r', 'p')
     and has_table_privilege(r.role, c.oid, 'TRUNCATE');
  perform test_assert(bad is null,
    coalesce('no API role can TRUNCATE a platform table (found: ' || bad || ')',
             'no API role can TRUNCATE a platform table'));

  select string_agg(c.relname, ', ') into bad
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('r', 'p') and c.relname <> 'job_applications'
     and (has_table_privilege('anon', c.oid, 'SELECT') or has_table_privilege('anon', c.oid, 'INSERT')
       or has_table_privilege('anon', c.oid, 'UPDATE') or has_table_privilege('anon', c.oid, 'DELETE'));
  perform test_assert(bad is null,
    coalesce('anon holds no privilege on any platform table (found: ' || bad || ')',
             'anon holds no privilege on any platform table'));

  -- Append-only is enforced by privilege too, which binds service_role as well.
  select string_agg(c.relname || ':' || r.role, ', ') into bad
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    cross join (values ('anon'), ('authenticated'), ('service_role')) r(role)
   where n.nspname = 'public' and c.relname in ('audit_logs', 'activities', 'contact_merges')
     and (has_table_privilege(r.role, c.oid, 'UPDATE') or has_table_privilege(r.role, c.oid, 'DELETE'));
  perform test_assert(bad is null,
    coalesce('append-only tables grant no UPDATE or DELETE to any API role (found: ' || bad || ')',
             'append-only tables grant no UPDATE or DELETE to any API role'));

  -- The policies must be reachable: authenticated needs table privileges.
  perform test_assert(has_table_privilege('authenticated', 'public.contacts', 'SELECT'),
    'authenticated holds SELECT on contacts, so its RLS policies are reachable');
  perform test_assert(has_table_privilege('service_role', 'public.contacts', 'INSERT'),
    'service_role holds INSERT on contacts for webhooks and jobs');
end $$;

-- ---------------------------------------------------------------------------
-- 9a. job_applications privileges (0011)
--
--     The one table holding applicant PII and passport/CV paths. 0001 granted
--     nothing explicitly and inherited the platform default, which differed per
--     environment: arwdDxtm for anon on both hosted projects, Dxtm locally.
--     These assertions pin the end state so it can no longer drift, and so the
--     difference cannot reappear in a newly created project.
-- ---------------------------------------------------------------------------
do $$
declare bad text;
begin
  -- The public applicant path must keep working. This is the assertion that
  -- would have caught the local stack being unable to accept an application.
  perform test_assert(has_table_privilege('anon', 'public.job_applications', 'INSERT'),
    'anon can INSERT a job application — the public applicant path');

  -- ...and must hold nothing else. SELECT is the one that matters most: it is
  -- all that stands between a mistaken policy and every applicant's PII.
  select string_agg(p.priv, ', ') into bad
    from (values ('SELECT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) p(priv)
   where has_table_privilege('anon', 'public.job_applications', p.priv);
  perform test_assert(bad is null,
    coalesce('anon holds INSERT and nothing else on job_applications (also found: ' || bad || ')',
             'anon holds INSERT and nothing else on job_applications'));

  -- authenticated has no policy on this table, so it must hold no privilege
  -- either. The Applications inbox will grant SELECT back together with the
  -- policy that scopes it.
  select string_agg(p.priv, ', ') into bad
    from (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE')) p(priv)
   where has_table_privilege('authenticated', 'public.job_applications', p.priv);
  perform test_assert(bad is null,
    coalesce('authenticated holds no privilege on job_applications (found: ' || bad || ')',
             'authenticated holds no privilege on job_applications'));

  -- The back-office path must be able to read and triage applications, and must
  -- be identical locally and on a hosted project.
  select string_agg(p.priv, ', ') into bad
    from (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')) p(priv)
   where not has_table_privilege('service_role', 'public.job_applications', p.priv);
  perform test_assert(bad is null,
    coalesce('service_role can read and triage job applications (missing: ' || bad || ')',
             'service_role can read and triage job applications'));

  perform test_assert(
    not has_table_privilege('service_role', 'public.job_applications', 'TRUNCATE'),
    'service_role cannot TRUNCATE job_applications');

  -- RLS is the second layer and must still be the one deciding rows.
  perform test_assert(
    (select relrowsecurity from pg_class where oid = 'public.job_applications'::regclass),
    'job_applications still has RLS enabled');

  select string_agg(policyname || ':' || cmd, ', ') into bad
    from pg_policies
   where schemaname = 'public' and tablename = 'job_applications' and cmd <> 'INSERT';
  perform test_assert(bad is null,
    coalesce('job_applications has no policy other than the anon INSERT (found: ' || bad || ')',
             'job_applications has no policy other than the anon INSERT'));
end $$;

drop function test_assert(boolean, text);

rollback;   -- leave the database exactly as found
