-- =============================================================================
-- 0014 — Payments: the record a consultation fee is written into, and the
--        webhook inbox that is allowed to write it.
--
-- SCOPE, AND THE LINE THIS MIGRATION DOES NOT CROSS
--
-- The business approval covers CONSULTATION FEES ONLY. Nothing here may be used
-- to charge a job seeker to apply for a job, and the schema is shaped so that is
-- not a matter of discipline:
--
--   * `payment_purpose` is an enum with exactly one value, 'consultation'.
--     Charging for anything else needs a migration, which needs a review.
--   * There is deliberately NO job_id and NO job_application_id on payments,
--     and no foreign key in either direction. A payment cannot be attached to an
--     application even by a mistaken UPDATE, because there is nowhere to put it.
--   * 0012's `jobs_paid_application_not_public` CHECK still refuses to publish a
--     paid-access job. This migration does not touch it.
--
-- WHY A WEBHOOK INBOX AND NOT JUST A STATUS COLUMN
--
-- A browser redirect saying "payment successful" is a claim by the payer's
-- device. The provider's signed webhook is the only statement we accept about
-- money, so every state change arrives through `record_payment_event`, and the
-- event is recorded whether or not it changes anything. Razorpay delivers
-- at-least-once and out of order: the same event id may arrive several times,
-- and `payment.failed` for one attempt can arrive after `order.paid` for the
-- next. Both are handled here (idempotency by event id, monotonic status rank)
-- rather than in the route, because only the database can make it atomic.
--
-- WHAT IS NOT STORED
--
-- No raw webhook payload, no card data, no payer name, email or phone. Razorpay
-- payloads carry contact details; we keep the ids we need to reconcile
-- (order id, payment id), the amount, the method and the provider's own error
-- code. If a dispute needs more, it is in the Razorpay dashboard, under their
-- PCI scope rather than ours.
-- =============================================================================

do $$ begin
  create type public.payment_provider as enum ('razorpay');
exception when duplicate_object then null; end $$;

do $$ begin
  -- One value, on purpose. See the header.
  create type public.payment_purpose as enum ('consultation');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_status as enum ('created', 'authorized', 'paid', 'failed', 'refunded');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_event_status as enum ('received', 'processed', 'ignored', 'failed');
exception when duplicate_object then null; end $$;

create sequence if not exists public.payment_reference_seq;

-- GG-PAY-2026-00001 — the same shape as job (GG-JOB-) and case references.
create or replace function public.next_payment_reference()
returns text
language sql
volatile
set search_path = ''
as $$
  select 'GG-PAY-' || to_char(now() at time zone 'Asia/Kolkata', 'YYYY') || '-'
         || lpad(nextval('public.payment_reference_seq')::text, 5, '0');
$$;

-- -----------------------------------------------------------------------------
-- The payment record
-- -----------------------------------------------------------------------------
create table if not exists public.payments (
  id                 uuid primary key default gen_random_uuid(),
  reference          text not null unique default public.next_payment_reference(),
  provider           public.payment_provider not null default 'razorpay',
  purpose            public.payment_purpose  not null default 'consultation',
  status             public.payment_status   not null default 'created',

  -- Provider identifiers: what reconciliation is done on. The order id is
  -- created by us before the payer sees a checkout; the payment id arrives with
  -- the first authorization.
  provider_order_id   text not null,
  provider_payment_id text,

  -- Money is stored in the currency's minor unit (paise), as an integer.
  -- Floating point has no business anywhere near an amount.
  amount_minor  bigint not null check (amount_minor > 0),
  currency      text   not null default 'INR' check (currency = 'INR'),
  method        text,

  -- Who it is for. Both optional: a consultation may be taken before a contact
  -- record exists, and the link is made when it does.
  contact_id uuid references public.contacts(id) on delete set null,
  case_id    uuid references public.cases(id)    on delete set null,
  branch_id  uuid references public.branches(id),

  -- The provider's own failure code and description. Not a message for the payer.
  failure_code   text,
  failure_reason text,

  authorized_at timestamptz,
  paid_at       timestamptz,
  failed_at     timestamptz,
  refunded_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint payments_provider_order_uniq unique (provider, provider_order_id),
  constraint payments_provider_payment_uniq unique (provider, provider_payment_id),
  -- A paid payment must say when, and carry the provider's payment id: a row
  -- claiming money arrived without either is a bug, not a record.
  constraint payments_paid_is_evidenced check (
    status <> 'paid' or (paid_at is not null and provider_payment_id is not null)
  )
);

create index if not exists payments_status_idx     on public.payments (status, created_at desc);
create index if not exists payments_contact_idx    on public.payments (contact_id);
create index if not exists payments_case_idx       on public.payments (case_id);
create index if not exists payments_order_idx      on public.payments (provider_order_id);

drop trigger if exists payments_set_updated_at on public.payments;
create trigger payments_set_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();

comment on table public.payments is
  'Consultation fee payments. No job or job-application link exists by design: paid job applications are not approved (docs/PAYMENTS.md).';

-- -----------------------------------------------------------------------------
-- The webhook inbox. One row per provider event id, ever.
-- -----------------------------------------------------------------------------
create table if not exists public.payment_events (
  id         uuid primary key default gen_random_uuid(),
  provider   public.payment_provider not null default 'razorpay',
  -- Razorpay's `x-razorpay-event-id` header. The uniqueness of this column is
  -- the whole idempotency mechanism: a retry loses the insert race and is
  -- reported as a duplicate instead of being applied twice.
  event_id   text not null,
  event_type text not null,
  status     public.payment_event_status not null default 'received',

  provider_order_id   text,
  provider_payment_id text,
  payment_id          uuid references public.payments(id) on delete set null,

  -- Allow-listed, non-identifying fields only (amount, currency, method, the
  -- provider's status and error code). Never the raw payload.
  summary jsonb not null default '{}'::jsonb,
  error   text,

  received_at  timestamptz not null default now(),
  processed_at timestamptz,

  constraint payment_events_event_uniq unique (provider, event_id)
);

create index if not exists payment_events_type_idx    on public.payment_events (event_type, received_at desc);
create index if not exists payment_events_payment_idx on public.payment_events (payment_id);
create index if not exists payment_events_status_idx  on public.payment_events (status, received_at desc);

comment on table public.payment_events is
  'Signed provider webhook deliveries, deduplicated by provider event id. Holds no payer identity and no raw payload.';

-- -----------------------------------------------------------------------------
-- Applying an event. The only way a payment changes state.
--
-- SECURITY DEFINER because the caller is the webhook route holding the
-- service-role key, and because the insert, the state transition and the audit
-- entry must be one atomic step. Returns what happened, so the route can answer
-- Razorpay honestly without a second query:
--
--   duplicate  this event id has been applied before — nothing changed
--   processed  the payment moved forward
--   ignored    recorded, but it does not move this payment (stale or unrelated)
-- -----------------------------------------------------------------------------
create or replace function public.record_payment_event(
  p_event_id   text,
  p_event_type text,
  -- Everything the provider may omit is optional here too, so a caller states
  -- absence by leaving it out rather than by inventing an empty string.
  p_order_id   text   default null,
  p_payment_id text   default null,
  p_amount     bigint default null,
  p_currency   text   default null,
  p_method     text   default null,
  p_error_code text   default null,
  p_error_desc text   default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment   public.payments%rowtype;
  v_event_row uuid;
  v_new_status public.payment_status;
  v_rank       int;
  v_current    int;
  v_outcome    text;
begin
  if p_event_id is null or length(trim(p_event_id)) = 0 then
    raise exception 'record_payment_event: an event id is required';
  end if;

  insert into public.payment_events
    (provider, event_id, event_type, provider_order_id, provider_payment_id, summary)
  values
    ('razorpay', p_event_id, p_event_type, p_order_id, p_payment_id,
     jsonb_strip_nulls(jsonb_build_object(
       'amount_minor', p_amount, 'currency', p_currency, 'method', p_method,
       'error_code', p_error_code, 'error_description', p_error_desc)))
  on conflict (provider, event_id) do nothing
  returning id into v_event_row;

  -- Lost the race, or arrived again: already recorded, so do nothing else.
  if v_event_row is null then
    return 'duplicate';
  end if;

  -- Lock the payment row: two different events for the same order can arrive
  -- concurrently, and the last writer must not win by accident.
  select * into v_payment from public.payments
   where provider_order_id = p_order_id and provider = 'razorpay'
   for update;

  if not found then
    update public.payment_events
       set status = 'ignored', processed_at = now(),
           error = 'no payment record for this order id'
     where id = v_event_row;
    return 'ignored';
  end if;

  v_new_status := case p_event_type
                    when 'order.paid'          then 'paid'
                    when 'payment.captured'    then 'paid'
                    when 'payment.authorized'  then 'authorized'
                    when 'payment.failed'      then 'failed'
                    else null
                  end::public.payment_status;

  if v_new_status is null then
    update public.payment_events
       set status = 'ignored', processed_at = now(), payment_id = v_payment.id,
           error = 'event type carries no state transition'
     where id = v_event_row;
    return 'ignored';
  end if;

  -- Monotonic rank. Out-of-order delivery is normal, so a late `authorized`
  -- never demotes a `paid`, and `failed` never overwrites money that arrived.
  v_rank    := case v_new_status     when 'created' then 0 when 'authorized' then 1 when 'paid' then 2 when 'refunded' then 3 else -1 end;
  v_current := case v_payment.status when 'created' then 0 when 'authorized' then 1 when 'paid' then 2 when 'refunded' then 3 else -1 end;

  if v_new_status = 'failed' then
    if v_payment.status in ('created', 'authorized') then
      update public.payments
         set status = 'failed', failed_at = now(),
             failure_code = p_error_code, failure_reason = p_error_desc,
             provider_payment_id = coalesce(provider_payment_id, p_payment_id),
             method = coalesce(p_method, method)
       where id = v_payment.id;
      v_outcome := 'processed';
    else
      v_outcome := 'ignored';
    end if;
  elsif v_rank > v_current then
    update public.payments
       set status = v_new_status,
           provider_payment_id = coalesce(p_payment_id, provider_payment_id),
           method = coalesce(p_method, method),
           authorized_at = case when v_new_status = 'authorized' then coalesce(authorized_at, now()) else authorized_at end,
           paid_at       = case when v_new_status = 'paid'       then coalesce(paid_at, now())       else paid_at end
     where id = v_payment.id;
    v_outcome := 'processed';
  else
    v_outcome := 'ignored';
  end if;

  update public.payment_events
     set status = (case when v_outcome = 'processed' then 'processed' else 'ignored' end)::public.payment_event_status,
         processed_at = now(),
         payment_id = v_payment.id,
         error = case when v_outcome = 'ignored' then 'no state change: ' || v_payment.status::text || ' is at or beyond ' || v_new_status::text else null end
   where id = v_event_row;

  if v_outcome = 'processed' then
    -- Actor is the provider, not a person. No payer identity is written.
    perform public.write_audit_log(
      'system', null, 'razorpay',
      'payment.' || v_new_status::text,
      'payment', v_payment.id,
      jsonb_build_object('status', v_payment.status),
      jsonb_build_object('status', v_new_status, 'event_type', p_event_type, 'event_id', p_event_id,
                         'amount_minor', p_amount, 'currency', p_currency));
  end if;

  return v_outcome;
end;
$$;

comment on function public.record_payment_event is
  'Applies one signed provider webhook event. Idempotent by provider event id; never demotes a paid payment.';

-- -----------------------------------------------------------------------------
-- Privileges. Neither table is reachable by the public, and neither is writable
-- through the API: the only writer is the webhook route, which holds the
-- service-role key and calls record_payment_event.
-- -----------------------------------------------------------------------------
revoke all on table public.payments       from anon, authenticated;
revoke all on table public.payment_events from anon, authenticated;

grant select on table public.payments       to authenticated;
grant select on table public.payment_events to authenticated;

grant select, insert, update on table public.payments       to service_role;
grant select, insert, update on table public.payment_events to service_role;
grant usage, select on sequence public.payment_reference_seq to service_role;

revoke execute on function public.record_payment_event(text, text, text, text, bigint, text, text, text, text) from public, anon, authenticated;
grant  execute on function public.record_payment_event(text, text, text, text, bigint, text, text, text, text) to service_role;
grant  execute on function public.next_payment_reference() to service_role;

-- -----------------------------------------------------------------------------
-- Row level security. Finance reads; nobody writes through the API.
-- -----------------------------------------------------------------------------
alter table public.payments       enable row level security;
alter table public.payment_events enable row level security;
alter table public.payments       force row level security;
alter table public.payment_events force row level security;

drop policy if exists "staff read payments" on public.payments;
create policy "staff read payments" on public.payments
  for select to authenticated
  using (public.scope_allows('payments.view', branch_id, null));

-- Reconciliation is the job that needs the raw delivery log, so it is the
-- permission that opens it — not payments.view, which finance and HR share.
drop policy if exists "reconcilers read payment events" on public.payment_events;
create policy "reconcilers read payment events" on public.payment_events
  for select to authenticated
  using (public.has_perm('payments.reconcile', 'all'));

-- No INSERT, UPDATE or DELETE policy exists for either table, so authenticated
-- callers cannot write one even with the table privileges above. Recording an
-- offline payment (permission payments.record) will need its own policy and its
-- own migration when that flow is built.
