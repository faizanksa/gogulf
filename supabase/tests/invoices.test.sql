-- =============================================================================
-- Invoices (0015, 0017) — lifecycle, RBAC/RLS, the SERVER-ONLY payment-request
-- function (no browser-reachable role may call it), the customer-safe read, and
-- the webhook-driven sync onto payments (0014).
--
-- DISPOSABLE DATABASE ONLY. One transaction, rolled back.
--
--   npm run db:test                 # local
--   npm run db:mumbai -- test       # Mumbai staging
-- =============================================================================

begin;

create schema invoices_test;
grant usage on schema invoices_test to anon, authenticated, service_role;

create function invoices_test.check(condition boolean, description text)
returns void language plpgsql as $$
begin
  if condition then raise notice 'PASS  %', description;
  else raise exception 'FAIL  %', description;
  end if;
end $$;

create function invoices_test.visible(q text) returns bigint language plpgsql as $$
declare n bigint;
begin
  execute format('select count(*) from (%s) s', q) into n;
  return n;
exception when insufficient_privilege then
  return -1;
end $$;

create function invoices_test.affected(stmt text) returns bigint language plpgsql as $$
declare n bigint;
begin
  execute stmt;
  get diagnostics n = row_count;
  return n;
exception when insufficient_privilege then
  return -1;
end $$;

create function invoices_test.error_of(stmt text) returns text language plpgsql as $$
declare d text;
begin
  execute stmt;
  return null;
exception when others then
  get stacked diagnostics d = pg_exception_detail;
  return sqlstate || ' ' || sqlerrm || coalesce(' [' || nullif(d, '') || ']', '');
end $$;

create table invoices_test.ids (k text primary key, v uuid);
grant select, insert, update on invoices_test.ids to anon, authenticated, service_role;

create function invoices_test.id(p_key text) returns uuid
language sql stable security definer set search_path = '' as $$
  select v from invoices_test.ids where k = p_key
$$;

-- SECURITY DEFINER on purpose: these read `invoices` directly to hand a caller
-- (often acting as anon, who cannot select from invoices at all) the one public
-- fact it legitimately needs — the reference string — without that lookup
-- itself becoming a second, undocumented door into the table.
create function invoices_test.ref(p_key text) returns text
language sql stable security definer set search_path = '' as $$
  select reference from public.invoices where id = invoices_test.id(p_key)
$$;

create function invoices_test.total_minor(p_key text) returns bigint
language sql stable security definer set search_path = '' as $$
  select total_minor from public.invoices where id = invoices_test.id(p_key)
$$;

create function invoices_test.act_as_staff(p_key text) returns void
language plpgsql security definer set search_path = '' as $$
declare s record;
begin
  select su.id, su.role_key, su.branch_id into s from public.staff_users su where su.id = invoices_test.id(p_key);
  perform set_config('request.jwt.claims', json_build_object(
    'sub', gen_random_uuid(), 'role', 'authenticated',
    'app_staff_id', s.id, 'app_role', s.role_key, 'app_branch', s.branch_id)::text, true);
end $$;

create function invoices_test.act_as_non_staff() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
end $$;

create function invoices_test.act_as_system() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
end $$;

create function invoices_test.act_as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
end $$;

grant execute on all functions in schema invoices_test to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Fixtures (as postgres). A second branch, purely for scope tests.
-- ---------------------------------------------------------------------------
insert into public.branches (name, code, city, region, country_code)
values ('Invoice Test Branch', 'IT-DXB', 'Dubai', 'Dubai', 'AE')
on conflict (code) do nothing;

insert into invoices_test.ids select 'b_lko', id from public.branches where code = 'LKO';
insert into invoices_test.ids select 'b_dxb', id from public.branches where code = 'IT-DXB';

insert into public.staff_users (email, full_name, role_key, branch_id)
select e.email, e.name, e.role,
       case when e.role in ('HR_MANAGER', 'FINANCE_MANAGER') then invoices_test.id('b_dxb') else invoices_test.id('b_lko') end
from (values
  ('it-super@gogulf.co', 'IT Super',    'SUPER_ADMIN'),
  ('it-admin@gogulf.co', 'IT Admin',    'ADMIN'),
  ('it-fin@gogulf.co',   'IT Finance',  'FINANCE_MANAGER'),
  ('it-acc@gogulf.co',   'IT Accounts', 'ACCOUNTS'),
  ('it-hr@gogulf.co',    'IT HR',       'HR_MANAGER'),
  ('it-view@gogulf.co',  'IT View',     'VIEW_ONLY')
) as e(email, name, role);

insert into invoices_test.ids
select 's_' || split_part(split_part(email, '@', 1), '-', 2), id
  from public.staff_users where email like 'it-%@gogulf.co';

-- ===========================================================================
-- 1. Creating and issuing an invoice — as ADMIN
-- ===========================================================================
set local role authenticated;
select invoices_test.act_as_staff('s_admin');

with i as (
  insert into public.invoices (customer_name, customer_email, customer_phone, purpose, line_items, due_date)
  values ('IT Customer Pvt Ltd', 'billing@it-customer.example', '+919812345670', 'Visa processing consultation',
          '[{"description":"Consultation fee","quantity":1,"unit_amount_minor":500000},
            {"description":"Document review","quantity":2,"unit_amount_minor":50000}]'::jsonb,
          current_date + 14)
  returning id
)
insert into invoices_test.ids select 'inv_a', id from i;

select invoices_test.check(
  (select status = 'draft' and created_by = invoices_test.id('s_admin') and updated_by = invoices_test.id('s_admin')
          and branch_id = invoices_test.id('b_lko') and subtotal_minor = 600000 and total_minor = 600000
     from public.invoices where id = invoices_test.id('inv_a')),
  'ADMIN creates a draft, attributed to themselves, subtotal derived from two line items');
select invoices_test.check(
  (select reference ~ '^GG-INV-[0-9]{4}-[0-9]{5}$' from public.invoices where id = invoices_test.id('inv_a')),
  'an invoice gets a GG-INV reference');

select invoices_test.check(
  invoices_test.error_of(format($$insert into public.invoices (customer_name, purpose, line_items, status)
    values ('X', 'x', '[{"description":"x","quantity":1,"unit_amount_minor":100}]'::jsonb, 'issued')$$))
    like '%invoice_must_start_as_draft%',
  'staff cannot create an invoice directly as issued');

select invoices_test.check(
  invoices_test.error_of(format($$insert into public.invoices (customer_name, purpose, line_items)
    values ('X', 'x', '[]'::jsonb)$$)) like '%invoices_line_items_check%',
  'an empty line-items array is refused');
select invoices_test.check(
  invoices_test.error_of(format($$insert into public.invoices (customer_name, purpose, line_items)
    values ('X', 'x', '[{"description":"","quantity":1,"unit_amount_minor":100}]'::jsonb)$$))
    like '%invoices_line_items_check%',
  'a blank line-item description is refused');
select invoices_test.check(
  invoices_test.error_of(format($$insert into public.invoices (customer_name, purpose, line_items)
    values ('X', 'x', '[{"description":"x","quantity":0,"unit_amount_minor":100}]'::jsonb)$$))
    like '%invoices_line_items_check%',
  'a zero quantity is refused');
select invoices_test.check(
  invoices_test.error_of(format($$insert into public.invoices (customer_name, purpose, line_items)
    values ('X', 'x', '[{"description":"x","quantity":1,"unit_amount_minor":-100}]'::jsonb)$$))
    like '%invoices_line_items_check%',
  'a negative unit amount is refused');

select invoices_test.check(
  invoices_test.error_of(format($$update public.invoices set discount_minor = 999999999 where id = %L$$, invoices_test.id('inv_a')))
    like '%invoices_discount_within_subtotal%',
  'a discount larger than the subtotal is refused, not clamped');

update public.invoices set tax_rate_percent = 18, discount_minor = 50000 where id = invoices_test.id('inv_a');
select invoices_test.check(
  (select tax_amount_minor = round((600000 - 50000) * 18 / 100.0) and total_minor = (600000 - 50000 + round((600000 - 50000) * 18 / 100.0))
     from public.invoices where id = invoices_test.id('inv_a')),
  'a configured tax rate computes the tax line; total = subtotal - discount + tax');

update public.invoices set tax_rate_percent = null where id = invoices_test.id('inv_a');
select invoices_test.check(
  (select tax_amount_minor = 0 from public.invoices where id = invoices_test.id('inv_a')),
  'no tax rate means no tax line — GST is never assumed');

select invoices_test.check(
  invoices_test.error_of(format($$update public.invoices set status = 'issued' where id = %L$$, invoices_test.id('inv_a'))) is null,
  'the draft issues cleanly');
select invoices_test.check(
  (select status = 'issued' and issued_at is not null from public.invoices where id = invoices_test.id('inv_a')),
  'issuing is timestamped by the database');

-- ===========================================================================
-- 2. Frozen after issue, and the transition whitelist
-- ===========================================================================
select invoices_test.check(
  invoices_test.affected(format($$update public.invoices set purpose = 'CHANGED', discount_minor = 0 where id = %L$$, invoices_test.id('inv_a'))) = 1,
  'the update itself succeeds (it is a legal no-status-change write)');
select invoices_test.check(
  (select purpose <> 'CHANGED' and discount_minor = 50000 from public.invoices where id = invoices_test.id('inv_a')),
  'but the financial fields it tried to change are silently held at their issued values');

select invoices_test.check(
  invoices_test.error_of(format($$update public.invoices set status = 'paid' where id = %L$$, invoices_test.id('inv_a')))
    like '%invoice_transition_not_allowed%issued>paid%',
  'staff cannot set status=paid directly — only the trusted webhook-sync path may');
select invoices_test.check(
  invoices_test.error_of(format($$update public.invoices set status = 'payment_pending' where id = %L$$, invoices_test.id('inv_a')))
    like '%invoice_transition_not_allowed%',
  'staff cannot set status=payment_pending directly either — that follows opening a payment request');
select invoices_test.check(
  invoices_test.error_of(format($$update public.invoices set status = 'void' where id = %L$$, invoices_test.id('inv_a')))
    like '%invoices_void_is_evidenced%',
  'voiding without a reason is refused');

-- A separate invoice for the void path, so inv_a stays issued for the
-- payment-request and webhook-sync sections below.
with i as (
  insert into public.invoices (customer_name, purpose, line_items, created_by)
  values ('Void Test Customer', 'Consultation, cancelled before payment',
          '[{"description":"Consultation fee","quantity":1,"unit_amount_minor":100000}]'::jsonb,
          invoices_test.id('s_admin'))
  returning id
)
insert into invoices_test.ids select 'inv_void', id from i;
update public.invoices set status = 'issued' where id = invoices_test.id('inv_void');

select invoices_test.check(
  invoices_test.error_of(format($$update public.invoices set status = 'void', void_reason = 'Client cancelled' where id = %L$$,
    invoices_test.id('inv_void'))) is null,
  'issued > void succeeds with a reason');
select invoices_test.check(
  (select voided_at is not null and void_reason = 'Client cancelled' from public.invoices where id = invoices_test.id('inv_void')),
  'voiding is timestamped and the reason is kept');
select invoices_test.check(
  invoices_test.error_of(format($$update public.invoices set status = 'issued' where id = %L$$, invoices_test.id('inv_void')))
    like '%invoice_transition_not_allowed%',
  'a voided invoice cannot be reopened');
-- open_invoice_payment_request is server-only (0017): only service_role may call it.
set local role service_role;
select invoices_test.check(
  invoices_test.error_of(format($$select public.open_invoice_payment_request(%L, 'order_TEST_VOIDED')$$,
    invoices_test.ref('inv_void')))
    like '%invoice_not_payable%',
  'a voided invoice refuses a payment request');
set local role authenticated; -- the staff claims set above are still in force

-- ===========================================================================
-- 3. RBAC / RLS — who can see and write what
-- ===========================================================================
select invoices_test.act_as_staff('s_hr'); -- HR_MANAGER, invoices.view branch-scope only, own branch is IT-DXB
select invoices_test.check(
  invoices_test.visible(format('select 1 from public.invoices where id = %L', invoices_test.id('inv_a'))) = 0,
  'HR_MANAGER (invoices.view, branch) cannot see an invoice created in a different branch');
select invoices_test.check(
  invoices_test.affected(format($$insert into public.invoices (customer_name, purpose, line_items, branch_id)
    values ('X', 'x', '[{"description":"x","quantity":1,"unit_amount_minor":100}]'::jsonb, %L)$$, invoices_test.id('b_dxb'))) = -1,
  'HR_MANAGER cannot create an invoice at all — invoices.view is not invoices.issue');

select invoices_test.act_as_staff('s_view'); -- VIEW_ONLY, invoices.view branch-scope, same branch as inv_a (LKO)
select invoices_test.check(
  invoices_test.visible(format('select 1 from public.invoices where id = %L', invoices_test.id('inv_a'))) = 1,
  'VIEW_ONLY sees an invoice in their own branch');
select invoices_test.check(
  -- 0, not -1: VIEW_ONLY holds the table-level UPDATE grant (authenticated
  -- does), but RLS's USING clause filters the row out silently before any
  -- write is attempted — matching UPDATE's ordinary "no row matched" shape,
  -- not a privilege error. Only anon (no grant at all) sees a real -1 below.
  invoices_test.affected(format($$update public.invoices set notes = 'x' where id = %L$$, invoices_test.id('inv_a'))) = 0,
  'VIEW_ONLY cannot write to an invoice');

select invoices_test.act_as_staff('s_fin'); -- FINANCE_MANAGER, invoices.view/issue/void 'all'
select invoices_test.check(
  invoices_test.visible(format('select 1 from public.invoices where id = %L', invoices_test.id('inv_a'))) = 1,
  'FINANCE_MANAGER (all-scope) sees an invoice in a branch that is not their own');
select invoices_test.check(
  invoices_test.affected(format($$update public.invoices set notes = 'Reviewed by finance' where id = %L$$, invoices_test.id('inv_a'))) = 1,
  'FINANCE_MANAGER can write to it');

select invoices_test.act_as_staff('s_super'); -- SUPER_ADMIN: is_super short-circuits has_perm, in every branch
select invoices_test.check(
  invoices_test.visible(format('select 1 from public.invoices where id = %L', invoices_test.id('inv_a'))) = 1
    and (select creator.email from public.invoices i join public.staff_users creator on creator.id = i.created_by
          where i.id = invoices_test.id('inv_a')) = 'it-admin@gogulf.co',
  'SUPER_ADMIN sees every invoice, and who created it (creator and editor are recorded, not just visible)');
select invoices_test.check(
  invoices_test.affected(format($$update public.invoices set notes = 'Reviewed by super admin' where id = %L$$, invoices_test.id('inv_a'))) = 1,
  'SUPER_ADMIN can write to an invoice in any branch');
-- A separate statement: an AND does not promise the write runs before the read.
select invoices_test.check(
  (select updated_by from public.invoices where id = invoices_test.id('inv_a')) = invoices_test.id('s_super'),
  'and updated_by records the SUPER_ADMIN, while created_by still names the ADMIN who drafted it');

select invoices_test.act_as_staff('s_acc'); -- ACCOUNTS, branch scope, own branch LKO — same branch as inv_a
with i as (
  insert into public.invoices (customer_name, purpose, line_items)
  values ('ACCOUNTS Draft', 'Service fee', '[{"description":"x","quantity":1,"unit_amount_minor":100}]'::jsonb)
  returning id
)
insert into invoices_test.ids select 'inv_acc', id from i;
select invoices_test.check(
  (select branch_id = invoices_test.id('b_lko') from public.invoices where id = invoices_test.id('inv_acc')),
  'ACCOUNTS (branch-scoped invoices.issue) creates in their own branch');

select invoices_test.act_as_non_staff();
select invoices_test.check(
  invoices_test.visible(format('select 1 from public.invoices where id = %L', invoices_test.id('inv_a'))) = 0,
  'a signed-in non-staff user reads no invoices');
select invoices_test.check(
  invoices_test.affected(format($$update public.invoices set notes = 'x' where id = %L$$, invoices_test.id('inv_a'))) = 0,
  'a signed-in non-staff user cannot write an invoice (row filtered by RLS, not a privilege error)');

set local role anon;
select invoices_test.act_as_anon();
select invoices_test.check(
  invoices_test.visible(format('select 1 from public.invoices where id = %L', invoices_test.id('inv_a'))) = -1,
  'anon cannot select from invoices at all');
select invoices_test.check(
  invoices_test.affected(format($$update public.invoices set status = 'paid' where id = %L$$, invoices_test.id('inv_a'))) = -1,
  'anon cannot write to invoices at all');
select invoices_test.check(
  invoices_test.visible('select 1 from public.payments') = -1,
  'anon cannot select from payments at all — the same door as before, still shut');

-- ===========================================================================
-- 4. open_invoice_payment_request — SERVER-ONLY (0017)
--
-- It stores a caller-supplied provider order id, and an order id is only real if
-- Razorpay issued it to the server. With the public anon key anyone could plant an
-- invented one on any issued invoice (sequential references) and jam it — found on
-- staging during the first real TEST payment. So neither anon nor authenticated may
-- call it; the server does, after creating the order.
-- ===========================================================================
select invoices_test.check(
  invoices_test.error_of(format($$select public.open_invoice_payment_request(%L, 'order_PLANTED_BY_ANON')$$, invoices_test.ref('inv_a')))
    like '42501%',
  'anon cannot plant an order id on an issued invoice — permission denied (the 0017 finding)');
select invoices_test.check(
  invoices_test.error_of(format($$select public.open_invoice_payment_request(%L)$$, invoices_test.ref('inv_a')))
    like '42501%',
  'anon cannot even ask whether an invoice has a live order');
select invoices_test.check(
  not has_function_privilege('anon', 'public.open_invoice_payment_request(text, text)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.open_invoice_payment_request(text, text)', 'EXECUTE')
    and has_function_privilege('service_role', 'public.open_invoice_payment_request(text, text)', 'EXECUTE'),
  'EXECUTE belongs to service_role alone: not anon, not authenticated');

set local role authenticated;
select invoices_test.act_as_staff('s_admin');
select invoices_test.check(
  invoices_test.error_of(format($$select public.open_invoice_payment_request(%L, 'order_PLANTED_BY_STAFF')$$, invoices_test.ref('inv_a')))
    like '42501%',
  'a signed-in ADMIN cannot call it either — only the server can vouch for an order id');
select invoices_test.check(
  (select count(*) from public.payments where invoice_id = invoices_test.id('inv_a')) = 0
    and (select status = 'issued' from public.invoices where id = invoices_test.id('inv_a')),
  'the refused attempts wrote nothing: no payments row, the invoice is still issued');

set local role service_role;
select invoices_test.check(
  invoices_test.error_of('select public.open_invoice_payment_request(''GG-INV-0000-99999'', ''order_TEST_X'')')
    like '%invoice_not_found%',
  'an unknown reference is refused, not silently accepted');

with req as (
  select * from public.open_invoice_payment_request(
    invoices_test.ref('inv_a'), 'order_TEST_A001')
)
insert into invoices_test.ids select 'pay_a', payment_id from req;

-- The write above is what the server does after creating the order at Razorpay.
-- Verifying what it wrote is done as staff, who can read payments and invoices.
set local role authenticated;
select invoices_test.act_as_staff('s_admin');

select invoices_test.check(
  (select p.provider_order_id = 'order_TEST_A001' and p.amount_minor = i.total_minor and p.status = 'created'
     from public.payments p join public.invoices i on i.id = p.invoice_id
    where p.id = invoices_test.id('pay_a')),
  'the opened payment carries the exact order id and the invoice''s own total — never a client-supplied amount');

select invoices_test.check(
  (select status = 'payment_pending' from public.invoices where id = invoices_test.id('inv_a')),
  'the invoice moves to payment_pending once a payment request is open — a trusted, not staff, transition');

set local role service_role;
select invoices_test.check(
  (select r.reused and r.payment_id = invoices_test.id('pay_a')
     from public.open_invoice_payment_request(
       invoices_test.ref('inv_a'), 'order_TEST_A_DIFFERENT') r),
  'a second request for the same invoice reuses the live order instead of opening another one');

select invoices_test.check(
  (select count(*) from public.payments where invoice_id = invoices_test.id('inv_a')) = 1,
  'exactly one payments row exists for the invoice — the reuse really did not insert a second one');

select invoices_test.check(
  (select r.reused and r.provider_order_id = 'order_TEST_A001' and r.payment_id = invoices_test.id('pay_a')
     from public.open_invoice_payment_request(invoices_test.ref('inv_a')) r),
  'asking with no order id returns the live order (and its order id), so a page reload never mints another at the provider');

set local role authenticated;
select invoices_test.act_as_staff('s_admin');

-- ===========================================================================
-- 5. public_invoice_view — exactly the customer-safe columns
-- ===========================================================================
select invoices_test.check(
  (select row_to_json(v)::jsonb ?& array['reference','status','purpose','total_minor','currency','due_date','issued_at']
          and not (row_to_json(v)::jsonb ?| array['customer_name','customer_email','customer_phone','billing_address','notes','seller_gstin','id','contact_id','case_id','created_by'])
     from public.public_invoice_view(invoices_test.ref('inv_a')) v),
  'public_invoice_view returns exactly the customer-safe columns — never billing address, contact, notes or gstin');

select invoices_test.check(
  (select count(*) from public.public_invoice_view(
     invoices_test.ref('inv_acc'))) = 0,
  'a draft invoice (ACCOUNTS'' unissued one) is invisible through the public view');

-- ===========================================================================
-- 6. Webhook sync onto the invoice — atomic with record_payment_event,
--    never regressing what 0014 already proved.
-- ===========================================================================
set local role service_role;
select public.record_payment_event('evt_TEST_inv_a_auth', 'payment.authorized', 'order_TEST_A001', 'pay_TEST_A001',
  invoices_test.total_minor('inv_a'), 'INR', 'card') as outcome \gset auth_
select invoices_test.check(:'auth_outcome' = 'processed', 'authorized processes at the payment layer');
select invoices_test.check(
  (select status = 'payment_pending' from public.invoices where id = invoices_test.id('inv_a')),
  'authorized (not yet paid) does not move the invoice past payment_pending');

select public.record_payment_event('evt_TEST_inv_a_paid', 'order.paid', 'order_TEST_A001', 'pay_TEST_A001',
  invoices_test.total_minor('inv_a'), 'INR', 'card') as outcome \gset paid_
select invoices_test.check(:'paid_outcome' = 'processed', 'order.paid processes');
select invoices_test.check(
  (select status = 'paid' and paid_at is not null from public.invoices where id = invoices_test.id('inv_a')),
  'the invoice is synced to paid, in the same transaction as record_payment_event — no second round trip');

-- A late, out-of-order failure for the SAME order must never un-pay a paid invoice.
select public.record_payment_event('evt_TEST_inv_a_late_fail', 'payment.failed', 'order_TEST_A001', 'pay_TEST_A001',
  null, null, null, 'LATE_ARRIVAL', 'stale failure notice') as outcome \gset late_
select invoices_test.check(:'late_outcome' = 'ignored', 'a late failed event for an already-paid order is ignored at the payment layer');
select invoices_test.check(
  (select status = 'paid' from public.invoices where id = invoices_test.id('inv_a')),
  'and the invoice is never regressed off paid by it');

-- A payment_failed on a DIFFERENT invoice's order. Staff issue the invoice; the request
-- itself is the server's call (0017: service_role only). The webhook never opens payment
-- requests, it only ever resolves ones already open — record_payment_event is a separate
-- function.
set local role authenticated;
select invoices_test.act_as_staff('s_admin');
update public.invoices set status = 'issued' where id = invoices_test.id('inv_acc'); -- was draft; issue then request

set local role service_role;
-- One provider order belongs to one invoice: inv_acc cannot claim the order id inv_a already
-- holds. Nothing is written for inv_acc and it stays issued.
select count(*) as attempted from public.open_invoice_payment_request(invoices_test.ref('inv_acc'), 'order_TEST_A001');
select invoices_test.check(
  (select count(*) from public.payments where invoice_id = invoices_test.id('inv_acc')) = 0
    and (select status = 'issued' from public.invoices where id = invoices_test.id('inv_acc'))
    and (select invoice_id = invoices_test.id('inv_a') from public.payments where provider_order_id = 'order_TEST_A001'),
  'an order id already bound to one invoice cannot be attached to another: no row for the second, the first is unchanged');
-- A plain top-level call, not an unreferenced CTE: a WITH branch nothing
-- selects from is not guaranteed to execute a volatile function inside it.
select public.open_invoice_payment_request(invoices_test.ref('inv_acc'), 'order_TEST_ACC002');

select public.record_payment_event('evt_TEST_inv_acc_fail', 'payment.failed', 'order_TEST_ACC002', 'pay_TEST_ACC002',
  null, null, null, 'BAD_REQUEST_ERROR', 'card declined') as outcome \gset fail_
select invoices_test.check(:'fail_outcome' = 'processed', 'a genuine failure processes');
select invoices_test.check(
  (select status = 'payment_failed' from public.invoices where id = invoices_test.id('inv_acc')),
  'the failed invoice is synced to payment_failed, independently of inv_a which stays paid');
select invoices_test.check(
  (select status = 'paid' from public.invoices where id = invoices_test.id('inv_a')),
  'inv_a — a completely different invoice — is untouched by inv_acc''s failure');

-- Retry after a decline: the payer's request opens a NEW order against the same invoice
-- (the server's call — service_role, 0017).
select invoices_test.check(
  (select not r.reused and r.payment_id <> invoices_test.id('pay_a')
     from public.open_invoice_payment_request(invoices_test.ref('inv_acc'), 'order_TEST_ACC003') r),
  'after a decline the payer gets a NEW order (the failed one is not reused)');
set local role authenticated;
select invoices_test.act_as_staff('s_admin');
select invoices_test.check(
  (select status = 'payment_pending' from public.invoices where id = invoices_test.id('inv_acc')),
  'and the invoice moves payment_failed > payment_pending, a trusted transition');
select invoices_test.check(
  invoices_test.error_of(format($$update public.invoices set status = 'paid' where id = %L$$, invoices_test.id('inv_acc')))
    like '%invoice_transition_not_allowed%',
  'staff still cannot mark it paid — retry does not open that door');
set local role service_role;
select public.record_payment_event('evt_TEST_inv_acc_paid', 'order.paid', 'order_TEST_ACC003', 'pay_TEST_ACC003', 100, 'INR', 'upi') as outcome \gset retry_
select invoices_test.check(:'retry_outcome' = 'processed', 'the retried payment succeeds');
select invoices_test.check(
  (select status = 'paid' from public.invoices where id = invoices_test.id('inv_acc')),
  'and the invoice ends paid, after failed then pending then paid');

-- A late success for an order that had ALREADY been reported failed: money did
-- arrive, so the invoice must not be left unpaid.
set local role authenticated;
select invoices_test.act_as_staff('s_admin');
with i as (
  insert into public.invoices (customer_name, purpose, line_items)
  values ('Late Success Customer', 'Consultation', '[{"description":"Consultation fee","quantity":1,"unit_amount_minor":250000}]'::jsonb)
  returning id
)
insert into invoices_test.ids select 'inv_late', id from i;
update public.invoices set status = 'issued' where id = invoices_test.id('inv_late');
set local role service_role; -- the server's calls from here (0017)
select invoices_test.check(
  (select count(*) from public.open_invoice_payment_request(invoices_test.ref('inv_late'))) = 0,
  'asking with no order id, when no live order exists, returns nothing and creates nothing');
select invoices_test.check(
  (select count(*) from public.payments where invoice_id = invoices_test.id('inv_late')) = 0,
  'and no payments row appeared from the lookup');
select public.open_invoice_payment_request(invoices_test.ref('inv_late'), 'order_TEST_LATE001');
select public.record_payment_event('evt_TEST_late_fail', 'payment.failed', 'order_TEST_LATE001', 'pay_TEST_LATE001', null, null, null, 'GATEWAY_ERROR', 'timeout') as outcome \gset lf_
select invoices_test.check(
  (select status = 'payment_failed' from public.invoices where id = invoices_test.id('inv_late')),
  'a failure marks the invoice payment_failed');
select public.record_payment_event('evt_TEST_late_paid', 'order.paid', 'order_TEST_LATE001', 'pay_TEST_LATE001', 250000, 'INR', 'upi') as outcome \gset lp_
select invoices_test.check(:'lp_outcome' = 'processed', 'a late success is processed at the payment layer');
select invoices_test.check(
  (select status = 'paid' and paid_at is not null from public.invoices where id = invoices_test.id('inv_late')),
  'and the invoice becomes paid — money that arrived is never left as an unpaid invoice');

-- A payment event for an order that matches no invoice-linked payment (the
-- pre-existing consultation-order path, 0014) must still behave exactly as
-- before: ignored, never an error, and it touches no invoice.
select public.record_payment_event('evt_TEST_no_invoice', 'order.paid', 'order_TEST_NO_INVOICE_LINK', 'pay_TEST_X', 100000, 'INR', 'upi') as outcome \gset noinv_
select invoices_test.check(:'noinv_outcome' = 'ignored', 'an event for an order with no matching payment is still just ignored — 0014''s behaviour, untouched');

-- ===========================================================================
-- 7. Audit trail
-- ===========================================================================
set local role authenticated;
select invoices_test.act_as_staff('s_admin');
select array_agg(action order by occurred_at) as actions
  from public.audit_logs where entity_type = 'invoice' and entity_id = invoices_test.id('inv_a') \gset trail_
select invoices_test.check(
  :'trail_actions' like '%invoice.created%' and :'trail_actions' like '%invoice.issued%'
    and :'trail_actions' like '%invoice.payment_link_opened%' and :'trail_actions' like '%invoice.paid%',
  format('the full lifecycle is audited: %s', :'trail_actions'));

select invoices_test.check(
  invoices_test.affected(format($$insert into public.audit_logs (actor_type, action, entity_type, entity_id)
    values ('staff', 'invoice.forged', 'invoice', %L)$$, invoices_test.id('inv_a'))) = -1,
  'no signed-in role can insert an audit row directly — the same guarantee 0005 already gives everything else');

-- ===========================================================================
-- 8. payments.invoice_id — the link, and that it is the ONLY thing invoices
--    added to payments. The 0014 boundary (no job, no job-application) stands.
-- ===========================================================================
select invoices_test.check(
  (select p.invoice_id = i.id and p.purpose = 'consultation'
     from public.payments p join public.invoices i on i.id = p.invoice_id
    where i.id = invoices_test.id('inv_a')),
  'the payment carries the invoice link, and its purpose is still consultation only');
select invoices_test.check(
  not exists (select 1 from information_schema.columns
               where table_schema = 'public' and table_name = 'payments'
                 and column_name in ('job_id', 'job_application_id')),
  'payments still has no job or job-application column, in either direction — 0014''s scope line holds');
select invoices_test.check(
  not exists (select 1 from information_schema.columns
               where table_schema = 'public' and table_name = 'invoices'
                 and column_name in ('job_id', 'job_application_id')),
  'and invoices never gained one either');

reset role;

rollback;

