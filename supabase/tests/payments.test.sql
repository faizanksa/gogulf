-- =============================================================================
-- Payments (0014) — what the webhook may do, and what nobody else may do.
--
-- The questions these answer are the ones money raises: can a replayed delivery
-- be applied twice, can a late failure erase a payment that succeeded, can a
-- signed-in user read or write payments they have no business with, and can a
-- payment be attached to a job application (it must not be possible at all).
--
-- DISPOSABLE DATABASE ONLY. One transaction, rolled back.
--
--   npm run db:test                 # local
--   npm run db:mumbai -- test       # Mumbai staging
-- =============================================================================

begin;

create schema pay_test;
grant usage on schema pay_test to anon, authenticated, service_role;

create function pay_test.check(condition boolean, description text)
returns void language plpgsql as $$
begin
  if condition then raise notice 'PASS  %', description;
  else raise exception 'FAIL  %', description;
  end if;
end $$;

create function pay_test.visible(q text) returns bigint language plpgsql as $$
declare n bigint;
begin
  execute format('select count(*) from (%s) s', q) into n;
  return n;
exception when insufficient_privilege then
  return -1;
end $$;

create function pay_test.error_of(stmt text) returns text language plpgsql as $$
begin
  execute stmt;
  return null;
exception when others then
  return sqlstate || ' ' || sqlerrm;
end $$;

create table pay_test.ids (k text primary key, v uuid);
grant select, insert, update on pay_test.ids to anon, authenticated, service_role;

-- SECURITY DEFINER, like the jobs suite: the helpers are read while acting as a
-- role under test, and the fixture table is not what is being tested.
create function pay_test.id(k text) returns uuid
language sql stable security definer set search_path = '' as $$ select v from pay_test.ids where k = $1 $$;

create function pay_test.act_as_staff(k text) returns void language plpgsql security definer set search_path = public as $$
declare s record;
begin
  select id, role_key, branch_id into s from public.staff_users where id = pay_test.id(k);
  perform set_config('request.jwt.claims', json_build_object(
    'sub', gen_random_uuid(), 'role', 'authenticated',
    'app_staff_id', s.id, 'app_role', s.role_key, 'app_branch', s.branch_id)::text, true);
end $$;

create function pay_test.act_as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
end $$;

grant execute on all functions in schema pay_test to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Fixtures (as postgres)
-- ---------------------------------------------------------------------------
insert into pay_test.ids select 'b_lko', id from public.branches where code = 'LKO';

insert into public.staff_users (email, full_name, role_key, branch_id)
select e.email, e.name, e.role, pay_test.id('b_lko')
from (values
  ('pt-admin@gogulf.co',   'PT Admin',    'ADMIN'),
  ('pt-finance@gogulf.co', 'PT Finance',  'FINANCE_MANAGER'),
  ('pt-rec@gogulf.co',     'PT Recruiter','RECRUITER'),
  ('pt-view@gogulf.co',    'PT View',     'VIEW_ONLY')
) as e(email, name, role);

insert into pay_test.ids
select 's_' || split_part(split_part(email, '@', 1), '-', 2), id
  from public.staff_users where email like 'pt-%@gogulf.co';

insert into public.payments (provider_order_id, amount_minor, branch_id)
values ('order_TEST_A', 500000, pay_test.id('b_lko'));

insert into pay_test.ids select 'p_a', id from public.payments where provider_order_id = 'order_TEST_A';

-- ---------------------------------------------------------------------------
-- The shape of the thing
-- ---------------------------------------------------------------------------
select pay_test.check(
  (select count(*) from pg_tables where schemaname = 'public' and tablename in ('payments', 'payment_events') and rowsecurity) = 2,
  'payments and payment_events both have RLS enabled');

select pay_test.check(
  (select count(*) from pg_policies where schemaname = 'public' and tablename in ('payments', 'payment_events')
     and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')) = 0,
  'no INSERT, UPDATE, DELETE or ALL policy exists on either table — the API cannot write payments');

select pay_test.check(
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'payments'
      and column_name in ('job_id', 'job_application_id', 'application_id')) = 0,
  'payments has no column linking it to a job or an application — paid applications are structurally impossible');

select pay_test.check(
  (select count(*) from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'payment_purpose') = 1,
  'payment_purpose has exactly one value: consultation');

select pay_test.check(
  (select count(*) from information_schema.role_table_grants
    where table_schema = 'public' and table_name in ('payments', 'payment_events') and grantee = 'anon') = 0,
  'anon holds no privilege of any kind on payments or payment_events');

select pay_test.check(
  pay_test.error_of($$insert into public.payments (provider_order_id, amount_minor, status, paid_at)
                      values ('order_TEST_BAD', 100, 'paid', now())$$) is not null,
  'a payment cannot claim to be paid without a provider payment id');

select pay_test.check(
  pay_test.error_of($$insert into public.payments (provider_order_id, amount_minor) values ('order_TEST_ZERO', 0)$$) is not null,
  'a payment cannot be for zero');

-- ---------------------------------------------------------------------------
-- The webhook path: idempotency, ordering, and audit
-- ---------------------------------------------------------------------------
select pay_test.check(
  public.record_payment_event('evt_A1', 'payment.authorized', 'order_TEST_A', 'pay_A', 500000, 'INR', 'upi', null, null) = 'processed',
  'an authorization moves the payment to authorized');
select pay_test.check(
  (select status from public.payments where id = pay_test.id('p_a')) = 'authorized',
  'the payment now reads authorized');

select pay_test.check(
  public.record_payment_event('evt_A1', 'payment.authorized', 'order_TEST_A', 'pay_A', 500000, 'INR', 'upi', null, null) = 'duplicate',
  'the same event id delivered again is a duplicate, not a second application');
select pay_test.check(
  (select count(*) from public.payment_events where event_id = 'evt_A1') = 1,
  'the duplicate delivery did not create a second event row');

select pay_test.check(
  public.record_payment_event('evt_A2', 'order.paid', 'order_TEST_A', 'pay_A', 500000, 'INR', 'upi', null, null) = 'processed',
  'order.paid moves the payment to paid');
select pay_test.check(
  (select status = 'paid' and paid_at is not null and provider_payment_id = 'pay_A'
     from public.payments where id = pay_test.id('p_a')),
  'the paid payment records when it was paid and by which provider payment');

select pay_test.check(
  public.record_payment_event('evt_A3', 'payment.authorized', 'order_TEST_A', 'pay_A', 500000, 'INR', 'upi', null, null) = 'ignored',
  'an authorization arriving after the payment is a no-op (out-of-order delivery)');
select pay_test.check(
  (select status from public.payments where id = pay_test.id('p_a')) = 'paid',
  'the late authorization did not demote a paid payment');

select pay_test.check(
  public.record_payment_event('evt_A4', 'payment.failed', 'order_TEST_A', 'pay_A', 500000, 'INR', 'upi', 'GATEWAY_ERROR', 'failed') = 'ignored',
  'a failure for a payment that already succeeded is recorded but not applied');
select pay_test.check(
  (select status from public.payments where id = pay_test.id('p_a')) = 'paid',
  'money that arrived is not erased by a later failure');

select pay_test.check(
  public.record_payment_event('evt_X1', 'order.paid', 'order_UNKNOWN', 'pay_X', 100, 'INR', null, null, null) = 'ignored',
  'an event for an order we never created is recorded and ignored, not invented');
select pay_test.check(
  (select status from public.payment_events where event_id = 'evt_X1') = 'ignored',
  'that event is stored with its reason');

select pay_test.check(
  public.record_payment_event('evt_S1', 'payment.dispute.created', 'order_TEST_A', 'pay_A', 500000, 'INR', null, null, null) = 'ignored',
  'an event type with no state transition is recorded and ignored');

select pay_test.check(
  pay_test.error_of($$select public.record_payment_event(null, 'order.paid', 'order_TEST_A', 'pay_A', 1, 'INR', null, null, null)$$) is not null,
  'an event without an id is refused outright');

-- A second payment, to prove a failure does apply when nothing has succeeded yet.
insert into public.payments (provider_order_id, amount_minor, branch_id) values ('order_TEST_B', 250000, pay_test.id('b_lko'));
select pay_test.check(
  public.record_payment_event('evt_B1', 'payment.failed', 'order_TEST_B', 'pay_B', 250000, 'INR', 'card', 'BAD_REQUEST_ERROR', 'declined') = 'processed',
  'a failure applies to a payment that had not succeeded');
select pay_test.check(
  (select status = 'failed' and failure_code = 'BAD_REQUEST_ERROR' and failed_at is not null
     from public.payments where provider_order_id = 'order_TEST_B'),
  'the failed payment keeps the provider failure code, distinct from a paid one');

select pay_test.check(
  (select count(*) from public.audit_logs
    where entity_type = 'payment' and action in ('payment.paid', 'payment.authorized', 'payment.failed')
      and actor_type = 'system' and actor_label = 'razorpay') >= 3,
  'each applied transition wrote a system audit entry attributed to the provider');

select pay_test.check(
  (select count(*) from public.audit_logs a
    where a.entity_type = 'payment'
      and (a.new_values::text ilike '%@%' or a.new_values::text ~ '[0-9]{10}')) = 0,
  'no payer identity reached the audit trail');

select pay_test.check(
  (select count(*) from public.payment_events where summary::text ilike '%email%' or summary::text ilike '%contact%') = 0,
  'no payer identity reached the stored event summary');

-- ---------------------------------------------------------------------------
-- Who may read it
-- ---------------------------------------------------------------------------
set local role anon;
select pay_test.act_as_anon();
select pay_test.check(pay_test.visible('select 1 from public.payments') <= 0, 'anon cannot read payments');
select pay_test.check(pay_test.visible('select 1 from public.payment_events') <= 0, 'anon cannot read payment events');
reset role;

set local role authenticated;
select pay_test.act_as_staff('s_finance');
select pay_test.check(pay_test.visible('select 1 from public.payments') = 2, 'a finance manager reads payments');
select pay_test.check(
  pay_test.error_of($$update public.payments set status = 'paid' where provider_order_id = 'order_TEST_B'$$) is not null
  or (select status from public.payments where provider_order_id = 'order_TEST_B') = 'failed',
  'a finance manager cannot mark a payment paid by hand');

select pay_test.act_as_staff('s_rec');
select pay_test.check(pay_test.visible('select 1 from public.payments') = 0, 'a recruiter sees no payments');
select pay_test.check(pay_test.visible('select 1 from public.payment_events') = 0, 'a recruiter sees no payment events');

select pay_test.act_as_staff('s_view');
select pay_test.check(pay_test.visible('select 1 from public.payment_events') = 0,
  'view-only cannot read the raw webhook log — that needs payments.reconcile');

select pay_test.act_as_staff('s_admin');
select pay_test.check(pay_test.visible('select 1 from public.payments') = 2, 'an admin reads payments');
-- Seven deliveries were made above: A1, A2, A3, A4, X1, S1, B1. The replay of A1
-- is deliberately not among them — that is the point of the idempotency check.
select pay_test.check(pay_test.visible('select 1 from public.payment_events') = 7, 'an admin reconciles the whole webhook log');
select pay_test.check(
  pay_test.error_of($$select public.record_payment_event('evt_HACK', 'order.paid', 'order_TEST_B', 'pay_B', 250000, 'INR', null, null, null)$$) is not null,
  'a signed-in admin cannot call the webhook function — it belongs to the service role alone');
reset role;

rollback;
