-- What a project actually contains, for the cutover readiness check. READ ONLY: the
-- whole file runs inside a read-only transaction, so it cannot write even by mistake.
--
--   node scripts/db-remote.mjs --target=mumbai-staging run supabase/snippets/readiness-inventory.sql
--   node scripts/db-remote.mjs --target=mumbai-production --yes-i-am-provisioning-production \
--     run supabase/snippets/readiness-inventory.sql
--
-- Compare the two: before the cutover, production must carry the same migrations,
-- tables, RLS policies and privileges as the rehearsal, and none of its data.
begin read only;

select 'migrations' as section, string_agg(version, ', ' order by version) as value
  from supabase_migrations.schema_migrations;

select 'schema' as section,
       (select count(*) from pg_tables where schemaname = 'public')::text || ' tables, ' ||
       (select count(*) from pg_tables where schemaname = 'public' and rowsecurity)::text || ' with RLS, ' ||
       (select count(*) from pg_policies where schemaname = 'public')::text || ' policies, ' ||
       (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.prosecdef)::text || ' security-definer functions' as value;

select 'rbac' as section,
       (select count(*) from public.roles)::text || ' roles, ' ||
       (select count(*) from public.permissions)::text || ' permissions, ' ||
       (select count(*) from public.role_permissions)::text || ' grants' as value;

select 'data' as section,
       (select count(*) from public.job_applications)::text || ' applications, ' ||
       (select count(*) from public.contacts)::text || ' contacts, ' ||
       (select count(*) from public.cases)::text || ' cases, ' ||
       (select count(*) from public.jobs)::text || ' jobs, ' ||
       (select count(*) from public.job_categories)::text || ' categories' as value;

select 'identity' as section,
       (select count(*) from public.staff_users)::text || ' staff_users, ' ||
       (select count(*) from auth.users)::text || ' auth users, ' ||
       (select count(*) from auth.identities)::text || ' identities' as value;

select 'audit' as section,
       (select count(*) from public.audit_logs)::text || ' rows, actor types: ' ||
       coalesce((select string_agg(distinct actor_type::text, ', ') from public.audit_logs), '(none)') as value;

select 'storage' as section,
       coalesce((select string_agg(id || ' ' || case when public then 'PUBLIC' else 'private' end ||
              ' limit=' || coalesce((file_size_limit / 1024 / 1024)::text || 'MiB', 'none'), '; ' order by id)
         from storage.buckets), '(no buckets)') ||
       ', objects: ' || (select count(*) from storage.objects)::text as value;

select 'job_applications privileges' as section,
       coalesce(string_agg(grantee || '=' || privileges, ' ' order by grantee), '(none)') as value
  from (select grantee, string_agg(distinct left(privilege_type, 1), '' order by left(privilege_type, 1)) as privileges
          from information_schema.role_table_grants
         where table_schema = 'public' and table_name = 'job_applications' and grantee in ('anon', 'authenticated', 'service_role')
         group by grantee) g;

select 'anon column INSERT on job_applications' as section,
       coalesce(string_agg(column_name, ', ' order by column_name), '(none)') as value
  from information_schema.column_privileges
 where table_schema = 'public' and table_name = 'job_applications' and grantee = 'anon' and privilege_type = 'INSERT';

commit;
