-- =============================================================================
-- 0005 — Immutable audit trail.
--
-- The absence of UPDATE and DELETE policies IS the control. No role — including
-- SUPER_ADMIN — is ever granted them (see 0008). Writes come only from
-- SECURITY DEFINER triggers, so application code cannot forge or skip an entry.
--
-- Retention is 8 years with no delete path, so the table is partitioned by year
-- from the start: dropping a partition is the only sane way to manage it later,
-- and retrofitting partitioning onto a large table is painful.
-- =============================================================================

create table if not exists public.audit_logs (
  id          uuid not null default gen_random_uuid(),
  actor_type  text not null check (actor_type in ('staff','customer','system','provider')),
  actor_id    uuid,
  actor_label text,                      -- denormalised: the actor may be deleted later
  action      text not null,             -- user.role_changed, payment.refunded, …
  entity_type text not null,
  entity_id   uuid,
  -- Redacted before insert. NEVER secrets, OTPs, tokens or document contents.
  old_values  jsonb,
  new_values  jsonb,
  ip_address  inet,
  user_agent  text,
  occurred_at timestamptz not null default now(),
  primary key (id, occurred_at)
) partition by range (occurred_at);

create index if not exists audit_logs_entity_idx on public.audit_logs (entity_type, entity_id, occurred_at desc);
create index if not exists audit_logs_actor_idx  on public.audit_logs (actor_id, occurred_at desc);
create index if not exists audit_logs_action_idx on public.audit_logs (action, occurred_at desc);

-- Partitions for the current and next year. A yearly cron job adds the next one;
-- the DEFAULT partition guarantees an insert can never fail for want of one.
create table if not exists public.audit_logs_2026 partition of public.audit_logs
  for values from ('2026-01-01') to ('2027-01-01');
create table if not exists public.audit_logs_2027 partition of public.audit_logs
  for values from ('2027-01-01') to ('2028-01-01');
create table if not exists public.audit_logs_default partition of public.audit_logs default;

-- -----------------------------------------------------------------------------
-- Redaction. Applied to every payload before it is stored.
--
-- An audit log that captures a password reset by recording the new password is
-- worse than no audit log. The key list is deliberately broad — over-redacting
-- costs nothing.
-- -----------------------------------------------------------------------------
create or replace function public.redact_audit_payload(payload jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare
  redacted jsonb := payload;
  k text;
  sensitive text[] := array[
    'password','password_hash','otp','otp_code','token','access_token',
    'refresh_token','api_key','secret','service_role_key','key_secret',
    'webhook_secret','card','cvv','upi_pin','private_key','authorization',
    'passport_number','full_passport_number','session'
  ];
begin
  if payload is null then return null; end if;

  foreach k in array sensitive loop
    if redacted ? k then
      redacted := jsonb_set(redacted, array[k], '"[REDACTED]"'::jsonb);
    end if;
  end loop;

  return redacted;
end;
$$;

-- -----------------------------------------------------------------------------
-- Writer. SECURITY DEFINER so it can insert where no INSERT policy exists —
-- which is what makes the trail unforgeable by ordinary code.
-- -----------------------------------------------------------------------------
create or replace function public.write_audit_log(
  p_actor_type  text,
  p_actor_id    uuid,
  p_actor_label text,
  p_action      text,
  p_entity_type text,
  p_entity_id   uuid,
  p_old_values  jsonb default null,
  p_new_values  jsonb default null,
  p_ip          inet default null,
  p_user_agent  text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_logs
    (actor_type, actor_id, actor_label, action, entity_type, entity_id,
     old_values, new_values, ip_address, user_agent)
  values
    (p_actor_type, p_actor_id, p_actor_label, p_action, p_entity_type, p_entity_id,
     public.redact_audit_payload(p_old_values),
     public.redact_audit_payload(p_new_values),
     p_ip, p_user_agent);
end;
$$;

-- -----------------------------------------------------------------------------
-- Generic table trigger, attached to tables whose changes must be traceable.
-- -----------------------------------------------------------------------------
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
  actor_staff := nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'app_staff_id', '')::uuid;
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

-- Attach to the tables where "who changed this, and when" is a real question.
-- Deliberately NOT on activities (already append-only) or on high-volume
-- machine-written tables, where it would double write cost for no benefit.
create trigger audit_staff_users
  after insert or update or delete on public.staff_users
  for each row execute function public.audit_table_change();

create trigger audit_role_permissions
  after insert or update or delete on public.role_permissions
  for each row execute function public.audit_table_change();

create trigger audit_contacts
  after update or delete on public.contacts
  for each row execute function public.audit_table_change();

create trigger audit_cases
  after update or delete on public.cases
  for each row execute function public.audit_table_change();

create trigger audit_settings
  after insert or update or delete on public.settings
  for each row execute function public.audit_table_change();

alter table public.audit_logs enable row level security;
