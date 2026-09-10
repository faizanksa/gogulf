-- Go Gulf — 0010: audited writes must survive empty JWT claims.
--
-- Found on staging, where the SQL suites run through Supabase's connection
-- pooler. After a transaction that set request.jwt.claims ends, Postgres keeps
-- the setting on that server connection as '' rather than removing it. The
-- pooler hands that connection to the next client, where
--
--     current_setting('request.jwt.claims', true)::jsonb
--
-- raises "invalid input syntax for type json" — and because the expression is
-- in audit_table_change(), EVERY audited write on that connection fails:
-- staff_users, role_permissions, settings, and updates/deletes of contacts and
-- cases. Server-side jobs and webhooks connecting through the pooler would hit
-- it in production.
--
-- 0005 applied nullif() after the cast; it must come before, as in Supabase's
-- own auth.jwt(). Nothing else changes. CREATE OR REPLACE keeps the function's
-- owner and the EXECUTE revocations made in 0009.

create or replace function public.audit_table_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_staff uuid;
  entity      uuid;
begin
  actor_staff := nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'app_staff_id', '')::uuid;
  entity      := coalesce(
                   case when tg_op = 'DELETE' then (to_jsonb(old) ->> 'id') else (to_jsonb(new) ->> 'id') end
                 )::uuid;

  perform public.write_audit_log(
    case when actor_staff is not null then 'staff' else 'system' end,
    actor_staff,
    null,
    tg_table_name || '.' || lower(tg_op),
    tg_table_name,
    entity,
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end
  );

  return null;
end;
$$;
