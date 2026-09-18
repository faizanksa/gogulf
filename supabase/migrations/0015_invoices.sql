-- =============================================================================
-- 0015 — Invoices: consultation/service billing, tied to the payments/webhook
--        infrastructure that already exists (0014). Additive only.
--
-- SCOPE — the same line 0014 drew, extended, not moved
--
--   * `payments.purpose` is still the single-value enum 'consultation'. Nothing
--     here adds a value to it, and nothing here gives an invoice a job or a job
--     application: `invoices` has no job_id and no job_application_id, in either
--     direction, and neither does the new payments.invoice_id column's target.
--   * `jobs_paid_application_not_public` (0012) and the job_applications intake
--     guard (0013) are untouched. Candidate/job-application payment stays
--     impossible — enforced by absence, not by discipline.
--   * An invoice bills a named customer for a named service. It is never linked
--     to a contact acting as a job applicant through anything but the same
--     `contacts` row a human already exists as — no new identity is invented.
--
-- WHY record_payment_event IS NOT TOUCHED
--
-- That function is tested and deployed (payment.authorized, order.paid,
-- payment.failed; idempotent by event id; monotonic status rank). Regressing it
-- is the one mistake this migration cannot afford. So invoices hook onto its
-- OUTPUT, not its logic: a new AFTER UPDATE trigger on `payments`
-- (sync_invoice_from_payment) reacts to the status column it already writes, in
-- the same transaction, and moves the linked invoice forward. record_payment_event
-- itself is not modified by one line.
--
-- WHY A CUSTOMER CAN WRITE HERE AT ALL
--
-- Razorpay Checkout runs in the payer's browser, unauthenticated — there is no
-- staff session at that point, the same way there is none when a job applicant
-- submits. `open_invoice_payment_request` is the one new capability granted to
-- `anon`, and it is deliberately narrow: it reads nothing but one invoice's
-- amount (server-computed, never taken from the caller), refuses unless that
-- invoice is issued and unpaid, reuses a live order instead of piling up new
-- ones, and writes nothing but a `payments` row through the same shape
-- `record_payment_event` already writes. It is the same pattern already in this
-- schema for anon on job_applications: one column-scoped capability, not a door.
--
-- GST — deliberately not computed
--
-- content/company.ts records GST certificate as decision D8, unresolved: the
-- GSTIN stays off structured data until it is supplied. This migration does not
-- assume GST applies, does not hard-code a rate, and the word "Tax Invoice"
-- appears nowhere in this codebase. `tax_rate_percent` is nullable and staff-
-- entered per invoice; null means no tax line, which is the default. The
-- business/legal owner decides the actual treatment (docs/PAYMENTS.md §9).
-- =============================================================================

do $$ begin
  create type public.invoice_status as enum (
    'draft', 'issued', 'payment_pending', 'paid', 'payment_failed', 'void'
  );
exception when duplicate_object then null; end $$;

create sequence if not exists public.invoice_reference_seq;

-- GG-INV-2026-00001 — the same shape as job (GG-JOB-), case (GG-REC-) and
-- payment (GG-PAY-) references. A database sequence is the whole collision-safety
-- mechanism: nextval() is atomic under concurrent issuers, and the reference is
-- stored once, on the row, so "auditable" is just reading the column.
create or replace function public.next_invoice_reference()
returns text
language sql
volatile
set search_path = ''
as $$
  select 'GG-INV-' || to_char(now() at time zone 'Asia/Kolkata', 'YYYY') || '-'
         || lpad(nextval('public.invoice_reference_seq')::text, 5, '0');
$$;

-- -----------------------------------------------------------------------------
-- Line-item shape, checked at the database, not only in the form.
--
--   [{ "description": "...", "quantity": 1, "unit_amount_minor": 500000 }, ...]
--
-- amount_minor per line is derived (quantity * unit_amount_minor), never stored
-- separately, so it cannot drift from its own inputs.
-- -----------------------------------------------------------------------------
-- CASE guarantees each branch is only evaluated when reached, unlike a plain
-- AND chain (not reliably short-circuited outside a query planner's filter
-- context). That matters here: jsonb_array_elements() on a non-array raises a
-- raw "cannot extract elements from a scalar" error rather than returning
-- false, and this function must never do that — it is also called directly by
-- the CHECK constraint below, which needs a clean rejection, not a crash.
create or replace function public.invoice_line_items_valid(items jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when jsonb_typeof(items) is distinct from 'array' then false
    when jsonb_array_length(items) not between 1 and 50 then false
    else not exists (
      select 1 from jsonb_array_elements(items) as item
       where jsonb_typeof(item) is distinct from 'object'
          or jsonb_typeof(item -> 'description') is distinct from 'string'
          or length(btrim(item ->> 'description')) = 0
          or length(item ->> 'description') > 200
          or jsonb_typeof(item -> 'quantity') is distinct from 'number'
          or (item ->> 'quantity')::numeric <= 0
          or (item ->> 'quantity')::numeric > 100000
          or jsonb_typeof(item -> 'unit_amount_minor') is distinct from 'number'
          or (item ->> 'unit_amount_minor')::numeric <= 0
          or (item ->> 'unit_amount_minor')::numeric <> trunc((item ->> 'unit_amount_minor')::numeric)
    )
  end;
$$;

create or replace function public.invoice_line_items_subtotal(items jsonb)
returns bigint
language sql
immutable
set search_path = ''
as $$
  select coalesce(sum(round((item ->> 'quantity')::numeric * (item ->> 'unit_amount_minor')::numeric)), 0)::bigint
    from jsonb_array_elements(items) as item;
$$;

-- -----------------------------------------------------------------------------
-- The invoice
-- -----------------------------------------------------------------------------
create table if not exists public.invoices (
  id         uuid primary key default gen_random_uuid(),
  reference  text not null unique default public.next_invoice_reference(),
  status     public.invoice_status not null default 'draft',

  -- CRM linkage, where it exists. A consultation may be billed before a contact
  -- record does; both stay optional, exactly like payments.contact_id/case_id.
  contact_id uuid references public.contacts(id) on delete set null,
  case_id    uuid references public.cases(id)    on delete set null,
  branch_id  uuid references public.branches(id),

  -- Bill-to, frozen as of issue. Deliberately NOT read live off `contacts`:
  -- a contact's details can change after the invoice is issued, and an invoice
  -- must stay historically accurate to what the customer was actually billed at.
  customer_name  text not null check (length(btrim(customer_name)) > 0),
  customer_email citext,
  customer_phone text,
  billing_address jsonb not null default '{}'::jsonb,

  -- What is being billed, and the line items behind the total.
  purpose     text not null check (length(btrim(purpose)) > 0 and length(purpose) <= 200),
  line_items  jsonb not null check (public.invoice_line_items_valid(line_items)),
  notes       text check (notes is null or length(notes) <= 2000),

  -- Money. Same convention as payments: integer paise, INR only, for now.
  subtotal_minor    bigint not null default 0 check (subtotal_minor >= 0),
  discount_minor    bigint not null default 0 check (discount_minor >= 0),
  -- Data-driven, not hard-coded: null means no tax line on this invoice. The
  -- rate the business actually charges is a decision this migration does not make.
  tax_rate_percent  numeric(5,2) check (tax_rate_percent is null or (tax_rate_percent >= 0 and tax_rate_percent <= 100)),
  tax_amount_minor  bigint not null default 0 check (tax_amount_minor >= 0),
  total_minor       bigint not null default 0 check (total_minor > 0),
  currency          text not null default 'INR' check (currency = 'INR'),

  -- GSTIN is recorded but never rendered — see the header. Off by default until D8.
  seller_gstin text,

  issue_date date not null default (now() at time zone 'Asia/Kolkata')::date,
  due_date   date,

  created_by uuid references public.staff_users(id) on delete set null,
  updated_by uuid references public.staff_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  issued_at  timestamptz,
  paid_at    timestamptz,
  voided_at  timestamptz,
  void_reason text check (void_reason is null or length(void_reason) <= 500),

  constraint invoices_discount_within_subtotal check (discount_minor <= subtotal_minor),
  constraint invoices_due_on_or_after_issue check (due_date is null or due_date >= issue_date),
  constraint invoices_totals_add_up check (total_minor = subtotal_minor - discount_minor + tax_amount_minor),
  -- A paid invoice must say when; a voided one must say when and why.
  constraint invoices_paid_is_evidenced check (status <> 'paid' or paid_at is not null),
  constraint invoices_void_is_evidenced check (status <> 'void' or (voided_at is not null and void_reason is not null))
);

create index if not exists invoices_status_idx     on public.invoices (status, created_at desc);
create index if not exists invoices_contact_idx    on public.invoices (contact_id);
create index if not exists invoices_case_idx       on public.invoices (case_id);
create index if not exists invoices_branch_idx     on public.invoices (branch_id);
create index if not exists invoices_created_by_idx on public.invoices (created_by);

comment on table public.invoices is
  'Consultation/service invoices. No job or job-application link exists by design — see the header of this migration.';
comment on column public.invoices.billing_address is
  'Free-form {line1, line2, city, state, postal_code, country}. Not validated per-field: business addresses vary too much to whitelist shapes.';

-- -----------------------------------------------------------------------------
-- payments gains an optional link back to the invoice it was raised for. Still
-- no job or job-application column anywhere on this table — that boundary is
-- untouched.
-- -----------------------------------------------------------------------------
alter table public.payments add column if not exists invoice_id uuid references public.invoices(id) on delete set null;
create index if not exists payments_invoice_idx on public.payments (invoice_id);

-- At most one LIVE (unresolved) payment per invoice. This is what makes
-- open_invoice_payment_request's "reuse instead of open a second order" safe
-- under a race (a double-click, two open tabs): the loser of the race hits
-- this index rather than silently creating a second order at Razorpay.
create unique index if not exists payments_invoice_open_order_uniq
  on public.payments (invoice_id)
  where invoice_id is not null and status in ('created', 'authorized');

-- -----------------------------------------------------------------------------
-- invoices_before_write — provenance, frozen financial fields after issue, and
-- the transition whitelist. Two whitelists, not one: a staff session (JWT
-- carries app_staff_id) may only drive the lifecycle a human is trusted with
-- (draft -> issued -> void, or payment_failed -> void). Getting to `paid` or
-- `payment_failed` is never something a staff UPDATE can request directly —
-- only the trusted system path can, and it says so explicitly by setting a
-- transaction-local marker before writing (see sync_invoice_from_payment below).
-- A staff session can never set that marker: it exists only inside a
-- SECURITY DEFINER function body, in the same transaction as its own write.
-- -----------------------------------------------------------------------------
create or replace function public.invoices_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  staff      uuid := public.current_staff_id();
  trusted    boolean := coalesce(nullif(current_setting('app.invoice_trusted_transition', true), ''), 'off') = 'on';
  transition text;
  computed_subtotal bigint;
begin
  if tg_op = 'INSERT' then
    if staff is not null then
      new.created_by := staff;
      new.updated_by := staff;
      new.branch_id := coalesce(new.branch_id, public.current_branch_id());
    end if;
    if new.status <> 'draft' then
      raise exception 'invoice_must_start_as_draft' using errcode = 'check_violation';
    end if;
  else
    -- Provenance is immutable.
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    new.reference  := old.reference;
    new.updated_by := coalesce(staff, new.updated_by);

    transition := case when old.status is distinct from new.status then old.status::text || '>' || new.status::text else null end;

    if transition is not null then
      if trusted then
        if not transition = any (array[
          'issued>payment_pending', 'payment_pending>payment_pending',
          'issued>paid', 'payment_pending>paid', 'payment_failed>paid', 'payment_failed>payment_pending',
          'issued>payment_failed', 'payment_pending>payment_failed'
        ]) then
          raise exception 'invoice_transition_not_allowed'
            using errcode = 'check_violation', detail = transition;
        end if;
      else
        if not transition = any (array[
          'draft>issued', 'draft>void',
          'issued>void', 'payment_failed>void'
        ]) then
          raise exception 'invoice_transition_not_allowed'
            using errcode = 'check_violation', detail = transition;
        end if;
      end if;
    end if;

    -- Once an invoice has left draft, what it bills for is frozen. Status,
    -- provenance and the lifecycle timestamps below are the only things that
    -- still move — never the customer, the amount or the line items.
    if old.status <> 'draft' then
      new.contact_id       := old.contact_id;
      new.case_id          := old.case_id;
      new.customer_name    := old.customer_name;
      new.customer_email   := old.customer_email;
      new.customer_phone   := old.customer_phone;
      new.billing_address  := old.billing_address;
      new.purpose          := old.purpose;
      new.line_items       := old.line_items;
      new.notes            := old.notes;
      new.subtotal_minor   := old.subtotal_minor;
      new.discount_minor   := old.discount_minor;
      new.tax_rate_percent := old.tax_rate_percent;
      new.tax_amount_minor := old.tax_amount_minor;
      new.total_minor      := old.total_minor;
      new.currency         := old.currency;
      new.seller_gstin     := old.seller_gstin;
      new.issue_date       := old.issue_date;
      new.due_date         := old.due_date;
    end if;
  end if;

  -- Totals are always derived from line_items for as long as the row WAS a
  -- draft going into this write — covering both "save the draft again" and
  -- "issue this draft" in the same statement, so issuing can never carry
  -- stale arithmetic forward. Once a row leaves draft, the freeze block above
  -- has already copied these columns from `old`, and this never runs again.
  if (tg_op = 'INSERT' or old.status = 'draft') and public.invoice_line_items_valid(new.line_items) then
    -- Malformed line_items is left uncomputed here on purpose: the table's own
    -- CHECK constraint (invoice_line_items_valid again) rejects the write with
    -- a clean, mapped error — this function must never be the thing that fails.
    -- A discount larger than the (recomputed) subtotal is not silently
    -- clamped — it is left for invoices_discount_within_subtotal to refuse
    -- with a clear, mapped error, the same way an out-of-range field on a
    -- job is refused rather than quietly corrected.
    computed_subtotal := public.invoice_line_items_subtotal(new.line_items);
    new.subtotal_minor := computed_subtotal;
    new.tax_amount_minor := case
      when new.tax_rate_percent is null then 0
      else round((computed_subtotal - new.discount_minor) * new.tax_rate_percent / 100)
    end;
    new.total_minor := new.subtotal_minor - new.discount_minor + new.tax_amount_minor;
  end if;

  -- Lifecycle timestamps.
  if new.status = 'issued' and (tg_op = 'INSERT' or old.status <> 'issued') then
    new.issued_at := coalesce(new.issued_at, now());
  end if;
  if new.status = 'paid' and (tg_op = 'INSERT' or old.status <> 'paid') then
    new.paid_at := coalesce(new.paid_at, now());
  end if;
  if new.status = 'void' and (tg_op = 'INSERT' or old.status <> 'void') then
    new.voided_at := coalesce(new.voided_at, now());
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists invoices_before_write_trg on public.invoices;
create trigger invoices_before_write_trg
  before insert or update on public.invoices
  for each row execute function public.invoices_before_write();

-- -----------------------------------------------------------------------------
-- Audit — meaningful actions, mirroring jobs_audit's shape.
-- -----------------------------------------------------------------------------
create or replace function public.invoices_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor       uuid := nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'app_staff_id', '')::uuid;
  actor_kind  text := case when actor is not null then 'staff' else 'system' end;
  actor_email text;
  action      text;
  o jsonb;
  n jsonb;
  k text;
  old_diff jsonb := '{}'::jsonb;
  new_diff jsonb := '{}'::jsonb;
  not_edits text[] := array['updated_at', 'updated_by', 'status', 'issued_at', 'paid_at', 'voided_at'];
begin
  if actor is not null then
    select su.email::text into actor_email from public.staff_users su where su.id = actor;
  end if;

  if tg_op = 'INSERT' then
    perform public.write_audit_log(actor_kind, actor, actor_email, 'invoice.created', 'invoice', new.id, null,
      jsonb_build_object('reference', new.reference, 'status', new.status, 'purpose', new.purpose,
                          'total_minor', new.total_minor, 'currency', new.currency));
    return null;
  end if;

  if old.status is distinct from new.status then
    action := case old.status::text || '>' || new.status::text
      when 'draft>issued'             then 'invoice.issued'
      when 'draft>void'               then 'invoice.voided'
      when 'issued>void'              then 'invoice.voided'
      when 'payment_failed>void'      then 'invoice.voided'
      when 'issued>payment_pending'   then 'invoice.payment_link_opened'
      when 'payment_pending>payment_pending' then 'invoice.payment_link_reopened'
      when 'payment_failed>payment_pending'  then 'invoice.payment_link_reopened'
      when 'payment_failed>paid'      then 'invoice.paid'
      when 'issued>paid'              then 'invoice.paid'
      when 'payment_pending>paid'     then 'invoice.paid'
      when 'issued>payment_failed'    then 'invoice.payment_failed'
      when 'payment_pending>payment_failed' then 'invoice.payment_failed'
      else 'invoice.status_changed'
    end;
    perform public.write_audit_log(actor_kind, actor, actor_email, action, 'invoice', new.id,
      jsonb_build_object('status', old.status),
      jsonb_build_object('status', new.status, 'reference', new.reference,
                          'void_reason', case when new.status = 'void' then new.void_reason else null end));
  end if;

  o := to_jsonb(old);
  n := to_jsonb(new);
  for k in select jsonb_object_keys(n) loop
    continue when k = any (not_edits);
    if o -> k is distinct from n -> k then
      old_diff := old_diff || jsonb_build_object(k, o -> k);
      new_diff := new_diff || jsonb_build_object(k, n -> k);
    end if;
  end loop;
  if new_diff <> '{}'::jsonb then
    perform public.write_audit_log(actor_kind, actor, actor_email, 'invoice.updated', 'invoice', new.id, old_diff, new_diff);
  end if;

  return null;
end;
$$;

drop trigger if exists invoices_audit_trg on public.invoices;
create trigger invoices_audit_trg
  after insert or update on public.invoices
  for each row execute function public.invoices_audit();

-- -----------------------------------------------------------------------------
-- Opening a payment request. The one thing an unauthenticated payer may do.
--
-- Reuses a live, unpaid order instead of minting a new one on every page load
-- or double-click: if a 'created' or 'authorized' payment already exists for
-- this invoice, its order is returned again rather than opening a second one.
-- The amount is read from the invoice, never accepted as an argument — nothing
-- about what the payer owes is ever taken from the request.
--
-- SECURITY DEFINER because `payments` has no INSERT policy at all (0014) and
-- `invoices` has none for anon — both by design. This function is the one
-- door, and it is narrow: it moves an already-issued invoice into
-- payment_pending and opens exactly one payments row, nothing else.
-- -----------------------------------------------------------------------------
create or replace function public.open_invoice_payment_request(p_reference text, p_provider_order_id text default null)
returns table (payment_id uuid, payment_reference text, amount_minor bigint, currency text, provider_order_id text, reused boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice public.invoices%rowtype;
  v_existing public.payments%rowtype;
  v_payment_id uuid;
  v_reference  text;
begin
  -- Locks the invoice for the rest of this transaction, so two concurrent
  -- callers for the same invoice serialise here rather than both reaching the
  -- "no live payment yet" conclusion at once.
  select * into v_invoice from public.invoices where reference = upper(btrim(p_reference)) for update;
  if not found then
    raise exception 'invoice_not_found' using errcode = 'no_data_found';
  end if;
  if v_invoice.status not in ('issued', 'payment_pending', 'payment_failed') then
    raise exception 'invoice_not_payable' using errcode = 'check_violation', detail = v_invoice.status::text;
  end if;

  select * into v_existing from public.payments
   where invoice_id = v_invoice.id and status in ('created', 'authorized')
   order by created_at desc
   limit 1;

  if found then
    return query select v_existing.id, v_existing.reference, v_existing.amount_minor, v_existing.currency, v_existing.provider_order_id, true;
    return;
  end if;

  -- A caller with no order yet is asking "is there a live one?" and there is not: it
  -- must create an order at the provider first, then call again with that order's id.
  -- Asking first is what stops every page load minting a fresh order at Razorpay.
  if p_provider_order_id is null or length(trim(p_provider_order_id)) = 0 then
    return;
  end if;

  begin
    insert into public.payments (provider, purpose, status, provider_order_id, amount_minor, currency,
                                  contact_id, case_id, branch_id, invoice_id)
    values ('razorpay', 'consultation', 'created', p_provider_order_id, v_invoice.total_minor, v_invoice.currency,
            v_invoice.contact_id, v_invoice.case_id, v_invoice.branch_id, v_invoice.id)
    returning id, reference into v_payment_id, v_reference;
  exception when unique_violation then
    -- The invoice lock above should make this unreachable, but the partial
    -- unique index is the real guarantee, not the lock — if it ever fires,
    -- hand back whichever row won rather than erroring the payer's browser.
    select * into v_existing from public.payments
     where invoice_id = v_invoice.id and status in ('created', 'authorized')
     order by created_at desc limit 1;
    return query select v_existing.id, v_existing.reference, v_existing.amount_minor, v_existing.currency, v_existing.provider_order_id, true;
    return;
  end;

  -- Reset immediately after use, not left to the transaction boundary: a
  -- future caller that performs more than one invoice write inside a single
  -- transaction must not find this door still propped open.
  perform set_config('app.invoice_trusted_transition', 'on', true);
  update public.invoices set status = 'payment_pending' where id = v_invoice.id and status in ('issued', 'payment_failed');
  perform set_config('app.invoice_trusted_transition', 'off', true);

  return query select v_payment_id, v_reference, v_invoice.total_minor, v_invoice.currency, p_provider_order_id, false;
end;
$$;

comment on function public.open_invoice_payment_request is
  'The one write anon may make: open (or reuse) a payment request for an issued invoice. Amount is read from the invoice, never from the caller.';

-- -----------------------------------------------------------------------------
-- The customer-facing read. An explicit column allow-list, not an RLS policy on
-- the whole table — so a column added to `invoices` later is safe by default
-- rather than newly exposed by accident.
-- -----------------------------------------------------------------------------
create or replace function public.public_invoice_view(p_reference text)
returns table (
  reference text, status public.invoice_status, purpose text,
  total_minor bigint, currency text, due_date date, issued_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select reference, status, purpose, total_minor, currency, due_date, issued_at
    from public.invoices
   where reference = upper(btrim(p_reference))
     and status <> 'draft';
$$;

comment on function public.public_invoice_view is
  'Exactly the fields the customer payment page may show. Never billing address, contact_id, notes, seller_gstin or any staff/internal column.';

-- -----------------------------------------------------------------------------
-- sync_invoice_from_payment — the one hook into the tested webhook path, and it
-- must never fail. The WHERE clause (not the transition whitelist above) is
-- what makes this safe to call unconditionally from a trigger that runs inside
-- record_payment_event's own transaction: an invoice already paid or voided
-- simply updates zero rows, never raises, so a stray or late event can never
-- turn a successful, recorded Razorpay payment into a 500 that makes Razorpay
-- retry a webhook that already succeeded.
-- -----------------------------------------------------------------------------
create or replace function public.sync_invoice_from_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.invoice_status;
begin
  if new.invoice_id is null then
    return new;
  end if;

  v_status := case new.status when 'paid' then 'paid' when 'failed' then 'payment_failed' else null end;
  if v_status is null then
    return new;
  end if;

  perform set_config('app.invoice_trusted_transition', 'on', true);
  update public.invoices
     set status = v_status
   where id = new.invoice_id
     and status in ('issued', 'payment_pending', 'payment_failed')
     and status <> v_status;
  perform set_config('app.invoice_trusted_transition', 'off', true);

  return new;
end;
$$;

drop trigger if exists payments_invoice_sync_trg on public.payments;
create trigger payments_invoice_sync_trg
  after update of status on public.payments
  for each row
  when (new.invoice_id is not null and new.status is distinct from old.status)
  execute function public.sync_invoice_from_payment();

-- -----------------------------------------------------------------------------
-- Privileges
-- -----------------------------------------------------------------------------
-- service_role gets the same broad table grant 0014 already gives payments and
-- payment_events — for operational tooling (a future admin script, reporting),
-- not because the webhook path needs it: applyPaymentEvent only ever calls
-- record_payment_event, and the sync onto invoices happens inside a
-- SECURITY DEFINER trigger, which does not depend on this grant either.
revoke all on table public.invoices from anon, authenticated;
grant select, insert, update on table public.invoices to authenticated, service_role;
grant usage, select on sequence public.invoice_reference_seq to authenticated;

revoke execute on function public.open_invoice_payment_request(text, text) from public;
grant  execute on function public.open_invoice_payment_request(text, text) to anon, authenticated;

revoke execute on function public.public_invoice_view(text) from public;
grant  execute on function public.public_invoice_view(text) to anon, authenticated;

alter table public.invoices enable row level security;
alter table public.invoices force row level security;

drop policy if exists "staff read invoices" on public.invoices;
create policy "staff read invoices" on public.invoices
  for select to authenticated
  using (public.scope_allows('invoices.view', branch_id, created_by));

drop policy if exists "staff create invoices" on public.invoices;
create policy "staff create invoices" on public.invoices
  for insert to authenticated
  with check (public.scope_allows('invoices.issue', branch_id, created_by));

-- Issuing and voiding are different permissions in the 0008 catalogue (today
-- always granted together, but not assumed to stay that way); either is enough
-- to reach this policy, and invoices_before_write's transition whitelist is
-- what actually limits which statuses a given write may move between.
drop policy if exists "staff update invoices" on public.invoices;
create policy "staff update invoices" on public.invoices
  for update to authenticated
  using (public.scope_allows('invoices.issue', branch_id, created_by) or public.scope_allows('invoices.void', branch_id, created_by))
  with check (public.scope_allows('invoices.issue', branch_id, created_by) or public.scope_allows('invoices.void', branch_id, created_by));

-- No DELETE policy: an invoice is voided, never deleted — the same choice
-- already made for jobs and for payments.
