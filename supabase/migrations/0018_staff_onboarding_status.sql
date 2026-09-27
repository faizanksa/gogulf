-- =============================================================================
-- 0018 — Staff onboarding: can the Staff screen tell who has finished it?
--
-- WHAT ONBOARDING IS (docs/SECURITY-MODEL.md §3, unchanged)
--
--   1. an auth.users row, created with the admin API, email confirmed, NO password;
--   2. the matching staff_users row, with a catalogue role and a branch;
--   3. the person's first Google Workspace sign-in links a `google` identity to (1).
--
-- Steps 1 and 2 were a script (`npm run bootstrap:admins`) and are now also offered on
-- /admin/staff/new. Step 3 happens in Google and Supabase Auth — the platform only
-- observes it. Until now nothing could SHOW it: whether someone has signed in lives in
-- auth.users / auth.identities, which no API role may read, and the staff workspace must
-- not read it with the service-role key (lib/supabase/admin.ts).
--
-- WHAT THIS ADDS — one read-only function, nothing else
--
--   staff_sign_in_status() → one row per staff member:
--       has_login            an auth.users row is linked (steps 1 + 2 complete)
--       email_confirmed      the condition that makes Google link instead of refuse
--       google_linked        a `google` identity exists (step 3 happened)
--       google_last_sign_in  when that identity last signed in
--
--   * Gated by has_perm('users.manage') inside the function: anyone else gets no rows.
--     users.manage already decides who may see the staff list at all (0007/0009/0016).
--   * Returns no email, phone, token, provider id or metadata — booleans and one time.
--   * SECURITY DEFINER with an empty search_path, like every other helper (0006/0009).
--   * EXECUTE for `authenticated` only; anon and PUBLIC are revoked explicitly because
--     Supabase grants EXECUTE on new public functions to both by default.
--
-- No table, column, policy or grant on a table changes. Re-runnable.
-- =============================================================================

create or replace function public.staff_sign_in_status()
returns table (
  staff_id            uuid,
  has_login           boolean,
  email_confirmed     boolean,
  google_linked       boolean,
  google_last_sign_in timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select su.id,
         u.id is not null,
         u.email_confirmed_at is not null,
         g.user_id is not null,
         g.last_sign_in_at
    from public.staff_users su
    left join auth.users u on u.id = su.auth_user_id
    left join lateral (
      select i.user_id, max(i.last_sign_in_at) as last_sign_in_at
        from auth.identities i
       where i.user_id = u.id and i.provider = 'google'
       group by i.user_id
    ) g on true
   where public.has_perm('users.manage');
$$;

comment on function public.staff_sign_in_status() is
  'Onboarding state per staff member for users.manage holders only: whether a login is linked, confirmed, and has signed in with Google. No identifiers beyond staff_users.id (0018).';

revoke all on function public.staff_sign_in_status() from public, anon;
grant execute on function public.staff_sign_in_status() to authenticated;
