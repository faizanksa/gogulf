-- =============================================================================
-- 0017 — Only the server may record a payment request against an invoice.
--
-- WHAT WAS WRONG (found by the first real Razorpay TEST payment on staging)
--
-- 0015 granted open_invoice_payment_request(text, text) to anon so the customer payment
-- page could use the public anon key. The function computes the AMOUNT from the invoice,
-- which was the property we cared about — but it also accepts a caller-supplied
-- p_provider_order_id and stores it. The anon key is public by design (it ships in the
-- browser bundle) and invoice references are sequential (GG-INV-2026-00052), so anyone could
-- call the function directly on any issued invoice with an invented order id. Confirmed on
-- Mumbai staging with a synthetic invoice: the call succeeded, a payments row carrying
-- "order_PLANTED_BY_ANON" was created, and the invoice moved to payment_pending. The real
-- payer's next "Pay securely" would then be handed that fake order, Razorpay would refuse
-- it, and the invoice stayed jammed. No money moves and no data leaks, but any stranger
-- could stop any invoice being paid.
--
-- WHAT THIS CHANGES
--
--   An order id is only meaningful if it is one Razorpay actually issued to us, and only
--   the server knows that: it creates the order with the secret key and only then records
--   it. So the function is now executable by service_role ONLY — not anon, not authenticated,
--   not PUBLIC. The customer page's server action (lib/payments/invoice-payment.ts) calls it
--   with the privileged client after it has an order in hand; the browser never can.
--
--   public_invoice_view stays anon-executable: it is read-only, returns an explicit column
--   allow-list, and takes only the reference string.
--
-- WHAT DOES NOT CHANGE
--
--   The function body: amount still comes from the invoice, a live order is still reused,
--   payments_invoice_open_order_uniq is still the real concurrency guarantee, and the
--   invoice still moves to payment_pending through the trusted-transition switch. The
--   webhook (record_payment_event) is untouched.
--
-- Idempotent: revoke and grant may be repeated.
-- =============================================================================

revoke execute on function public.open_invoice_payment_request(text, text) from public;
revoke execute on function public.open_invoice_payment_request(text, text) from anon, authenticated;
grant  execute on function public.open_invoice_payment_request(text, text) to service_role;

comment on function public.open_invoice_payment_request is
  'Server-only (0017): open (or reuse) a payment request for an issued invoice. Amount is read from the invoice, never from the caller. The caller supplies a provider order id, so only service_role may call it — the server creates the order at the provider first.';
