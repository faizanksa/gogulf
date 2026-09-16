-- Did a real Google sign-in land, and did it resolve to SUPER_ADMIN?
-- Run after each administrator signs in:
--   node scripts/db-remote.mjs --target=mumbai-staging run supabase/snippets/verify-google-signin.sql
do $$
declare r record; c jsonb; g int;
begin
  for r in
    select u.id, u.email::text as email, u.last_sign_in_at,
           u.raw_app_meta_data ->> 'provider' as provider,
           u.raw_app_meta_data -> 'providers' as providers
      from auth.users u order by u.email
  loop
    select count(*) into g from auth.identities i where i.user_id = r.id and i.provider = 'google';
    c := (public.custom_access_token_hook(jsonb_build_object(
            'user_id', r.id::text,
            'claims', jsonb_build_object('sub', r.id::text, 'role','authenticated'))))->'claims';
    raise notice '% | google_identity=% | provider=% | providers=% | signed_in=% | app_role=% | staff_id=%',
      rpad(r.email, 20),
      g,
      coalesce(r.provider,'-'),
      coalesce(r.providers::text,'-'),
      coalesce(r.last_sign_in_at::text,'NEVER'),
      coalesce(c->>'app_role','(none)'),
      coalesce(left(c->>'app_staff_id',8),'(none)');
  end loop;
end $$;
