-- =============================================================================
-- 0006 — RLS helper functions and the JWT claims hook.
--
-- DESIGN NOTE — why permissions are NOT baked into the JWT.
--
-- The obvious optimisation is to put the user's whole permission set into the
-- access token so policies read a claim instead of joining three tables. It was
-- the Phase 0 recommendation, and it is wrong: claims are fixed at token issue,
-- so revoking a grant — or dismissing an employee — would leave their access
-- working until the token expired.
--
-- Instead the token carries only stable identity (staff_id, role, branch), and
-- has_perm() resolves permissions live. Postgres caches a STABLE function for
-- the duration of a statement, so a list query evaluates it once, not once per
-- row. Nearly all the performance, none of the staleness.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Claims hook — small, stable identity only.
-- -----------------------------------------------------------------------------
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  claims jsonb;
  su     record;
begin
  select id, role_key, branch_id, is_active
    into su
    from public.staff_users
   where auth_user_id = (event ->> 'user_id')::uuid;

  claims := event -> 'claims';

  if su.id is not null and su.is_active then
    claims := jsonb_set(claims, '{app_staff_id}', to_jsonb(su.id::text));
    claims := jsonb_set(claims, '{app_role}',     to_jsonb(su.role_key));
    claims := jsonb_set(claims, '{app_branch}',
                        coalesce(to_jsonb(su.branch_id::text), 'null'::jsonb));
  end if;

  return jsonb_set(event, '{claims}', claims);
end;
$$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;

grant all on table public.staff_users to supabase_auth_admin;
revoke all on table public.staff_users from authenticated, anon, public;

drop policy if exists "auth admin reads staff" on public.staff_users;
create policy "auth admin reads staff"
  on public.staff_users for select to supabase_auth_admin using (true);

-- -----------------------------------------------------------------------------
-- Current-actor helpers
-- -----------------------------------------------------------------------------
create or replace function public.current_staff_id()
returns uuid
language sql
stable
as $$
  select nullif(auth.jwt() ->> 'app_staff_id', '')::uuid;
$$;

create or replace function public.current_branch_id()
returns uuid
language sql
stable
as $$
  select nullif(auth.jwt() ->> 'app_branch', '')::uuid;
$$;

create or replace function public.current_role_key()
returns text
language sql
stable
as $$
  select nullif(auth.jwt() ->> 'app_role', '');
$$;

-- The contact behind a customer session. A Supabase Auth user is ONE identity
-- of a contact, not the contact itself — which is what lets someone who applied
-- by phone in January attach to the same record when they log in by OTP later.
create or replace function public.current_contact_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select ci.contact_id
    from public.contact_identities ci
   where ci.type = 'auth_user'
     and ci.value_normalized = auth.uid()::text
   limit 1;
$$;

-- -----------------------------------------------------------------------------
-- has_perm — the single authorization predicate used by every staff policy.
--
-- `su.is_active` inside the query is the detail that matters: deactivating a
-- staff row revokes access on that user's NEXT QUERY, without waiting for their
-- token to expire.
-- -----------------------------------------------------------------------------
create or replace function public.has_perm(perm text, required_scope text default 'all')
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.staff_users su
      join public.roles r on r.key = su.role_key
     where su.id = public.current_staff_id()
       and su.is_active
       and (
         r.is_super              -- SUPER_ADMIN bypasses the permission lookup
         or exists (
           select 1
             from public.role_permissions rp
             join public.permissions p on p.id = rp.permission_id
            where rp.role_key = su.role_key
              and p.key = perm
              and case required_scope
                    when 'own'    then rp.scope in ('own','branch','all')
                    when 'branch' then rp.scope in ('branch','all')
                    else               rp.scope = 'all'
                  end
         )
       )
  );
$$;

comment on function public.has_perm is
  'Live permission check. STABLE so Postgres caches it per statement. Checks staff_users.is_active so deactivation takes effect immediately rather than at token expiry.';

-- True when the caller is any active staff member. Cheap gate for
-- staff-versus-customer branching inside a policy.
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff_users su
     where su.id = public.current_staff_id() and su.is_active
  );
$$;

-- -----------------------------------------------------------------------------
-- Scope predicate. Used by every staff read/write policy so the three-way
-- all/branch/own rule is written once rather than copy-pasted per table.
-- -----------------------------------------------------------------------------
create or replace function public.scope_allows(
  perm       text,
  row_branch uuid,
  row_owner  uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
       public.has_perm(perm, 'all')
    or (public.has_perm(perm, 'branch') and row_branch is not distinct from public.current_branch_id())
    or (public.has_perm(perm, 'own')    and row_owner  is not distinct from public.current_staff_id());
$$;

grant execute on function public.has_perm(text, text)              to authenticated;
grant execute on function public.scope_allows(text, uuid, uuid)    to authenticated;
grant execute on function public.is_staff()                        to authenticated;
grant execute on function public.current_staff_id()                to authenticated;
grant execute on function public.current_branch_id()               to authenticated;
grant execute on function public.current_role_key()                to authenticated;
grant execute on function public.current_contact_id()              to authenticated;
