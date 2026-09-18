# Payments — Razorpay infrastructure

What exists, what deliberately does not, and what has to be configured by hand before a
rupee can move. Written 18 September 2026, with migration `0014_payments.sql`.

---

## 1. Scope, and the line that is not crossed

The business approval covers **consultation fees only**.

**Not built, and not to be built without a separate written approval:** pay-to-apply jobs,
candidate application payments, any gate between a job seeker and an application, any
payment that unlocks access to a listing, and any wording that implies a licence or
government approval to recruit (`content/company.ts` claims register; `CLAIMS.recruitingAgentRegistration`
is **refuted** — the company holds no recruiting-agent registration).

Three things enforce that, none of which is a coding convention:

| Guard | Where | What it stops |
| --- | --- | --- |
| `payment_purpose` enum with one value, `consultation` | `0014` | Recording a payment for anything else without a migration |
| No `job_id` / `job_application_id` column on `payments`, in either direction | `0014` | Attaching a payment to an application at all — there is nowhere to put it |
| `jobs_paid_application_not_public` CHECK | `0012` | Publishing a job whose application access is `paid` |

`supabase/tests/payments.test.sql` asserts all three, so a future migration that quietly
relaxes one fails the suite.

## 2. The flow this prepares

```
consultation agreed
  → server creates a Razorpay order        lib/payments/consultation.ts   (built, not wired to any UI)
  → payer completes Razorpay Checkout      NOT BUILT — no page collects a payment
  → Razorpay sends a signed webhook        /api/razorpay/webhook          (built, deployed)
  → record_payment_event applies it        0014                            (built)
  → receipt / acknowledgement              NOT BUILT
```

**The webhook is the only authority on payment state.** A browser returning from checkout
proves nothing: nothing in this application reads a client callback, and `payments` cannot
be written through the API at all (no INSERT/UPDATE/DELETE policy exists — the service role
used by the webhook route is the only writer).

## 3. Data model (`0014`)

**`public.payments`** — one row per consultation fee.
`reference` (`GG-PAY-2026-00001`), `provider_order_id` (unique), `provider_payment_id`,
`amount_minor` (paise, integer — never a float), `currency` (INR), `status`
(`created → authorized → paid`, or `failed`, or `refunded`), optional `contact_id`,
`case_id`, `branch_id`, the provider's `failure_code`/`failure_reason`, and timestamps.
A row cannot claim `paid` without both `paid_at` and a provider payment id (CHECK).

**`public.payment_events`** — one row per provider delivery, unique on
`(provider, event_id)`. That uniqueness *is* the idempotency mechanism: a retry loses the
insert race and is reported as `duplicate`.

**What is never stored:** the raw payload, the payer's name, email, phone, or any card
data. Only allow-listed fields reach `summary` (amount, currency, method, the provider's
error code). Normalisation drops the rest in `lib/payments/razorpay.ts`, so identity cannot
reach the database even by accident — asserted in both the unit and SQL suites.

**Who can read it:** `payments.view` (scoped) for payments; `payments.reconcile` for the
raw event log. Both come from the existing RBAC catalogue seeded in `0008` — no new
permission was invented. `anon` holds no privilege on either table.

## 4. The endpoint

```
POST https://www.gogulf.co/api/razorpay/webhook          (production)
POST https://staging.gogulf.co/api/razorpay/webhook      (staging)
```

| Condition | Status | Razorpay's behaviour |
| --- | --- | --- |
| No `RAZORPAY_WEBHOOK_SECRET` configured | **503** `not_configured` | retries later — the delivery is deferred, not lost |
| Body larger than 1 MiB | **413** | stops |
| Signature missing or wrong | **401** `invalid_signature` | stops; nothing is explained, nothing is written |
| No `x-razorpay-event-id` header | **400** | stops |
| Body is not JSON, or not an event | **400** | stops |
| Recorded — including duplicates and ignored events | **200** | stops retrying |
| Recording threw (database down) | **500** | retries |

Order of checks matters and is tested: the **signature is verified before anything else**,
so an unsigned probe cannot learn whether an event id is known. The raw body is verified
exactly as received — it is never parsed and re-serialised before the HMAC, which is the
usual way this check gets broken.

**Idempotency and ordering.** Razorpay delivers at least once and out of order.
`record_payment_event` locks the payment row, applies a monotonic status rank, and:

- a replayed event id → `duplicate`, nothing changes;
- a late `payment.authorized` after `order.paid` → `ignored`, the payment stays `paid`;
- a `payment.failed` for a payment that already succeeded → `ignored` (money that arrived
  is never erased);
- `payment.failed` when nothing has succeeded → applied, with the provider's error code;
- an event for an order we never created → recorded and `ignored`, never invented.

Each applied transition writes an audit entry as `system` / `razorpay`, with no payer identity.

## 5. Environment variables

| Variable | Where it belongs | Notes |
| --- | --- | --- |
| `RAZORPAY_KEY_ID` | server-side env of the environment that transacts | Public-safe (it appears in Checkout), but kept server-side until a UI needs it |
| `RAZORPAY_KEY_SECRET` | server-side only | **Never** `NEXT_PUBLIC_*`, never in a client bundle |
| `RAZORPAY_WEBHOOK_SECRET` | server-side only | **Generated in the Razorpay dashboard when the webhook is created** — it is not derived from the API keys and is not the key secret |

Rules enforced in code, not by convention:

- **A live key may only be used by a production deployment**, and a test key only outside
  production (`ordersAllowed()` in `lib/payments/razorpay.ts`). Order creation is refused
  otherwise, before any request is made.
- `scripts/check-staging-isolation.mjs` **fails a staging or preview build** that carries a
  live key, and warns (does not fail) on a developer machine, where live credentials do
  legitimately sit in `.env.local`.
- `scripts/check-client-secrets.mjs` already scans the built client output for the values of
  `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET`.
- `node scripts/check-secret-config.mjs` reports presence, mode and shape of every secret
  **without printing a value**, so this can be reviewed without opening an env file.

**Current state (18 Sep 2026):** `.env.local` carries **live-mode** Razorpay credentials (key
id, key secret and a webhook secret). On Vercel, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` and
`RAZORPAY_WEBHOOK_SECRET` hold live values scoped to **`production` only** — they were briefly
scoped to preview as well, and that was removed. Preview carries a **generated test** webhook
secret and the Mumbai staging service-role key, nothing live.

## 6. Razorpay dashboard configuration

Nothing below has been done, and none of it should be done for **live** until the endpoint
is deployed and verified in test mode.

**Test mode — the environment side is already done.** On 18 Sep 2026 two **Preview-only**
variables were added to Vercel:

| Variable | Value | Type |
| --- | --- | --- |
| `RAZORPAY_WEBHOOK_SECRET` | a generated 24-byte test secret | `encrypted` — readable in the Vercel dashboard, which is how you copy it into Razorpay |
| `SUPABASE_SERVICE_ROLE_KEY` | the **Mumbai staging** key, so the webhook can write | `encrypted` |

Neither is a live credential and neither touches Production, where the live Razorpay
values and the Mumbai production service-role key remain scoped to `production` alone.

**What is left for you, in the Razorpay dashboard (Test Mode → Settings → Webhooks):**

| Field | Value |
| --- | --- |
| Webhook URL | `https://staging.gogulf.co/api/razorpay/webhook` |
| Secret | **Copy it from Vercel** → project `gogulf` → Settings → Environment Variables → Preview → `RAZORPAY_WEBHOOK_SECRET`. Do not generate a new one there, or signatures will not match |
| Active events | `order.paid`, `payment.authorized`, `payment.failed` |

One caveat about a delivery sent from Razorpay's own dashboard: **staging sits behind Vercel
deployment protection**, so a request without the bypass header is answered by the protection
wall and never reaches the route. Razorpay would report a failed delivery that says nothing
about this code. Proving the endpoint with the probe below (which carries the bypass) gives the
same evidence without opening staging to the internet.

**Live mode — only after §8's checklist passes:**

| Field | Value |
| --- | --- |
| Webhook URL | `https://www.gogulf.co/api/razorpay/webhook` |
| Secret | A **new** random secret, generated for this webhook alone. Put it in Vercel **Production** as `RAZORPAY_WEBHOOK_SECRET` before saving the webhook |
| Active events | `order.paid`, `payment.authorized`, `payment.failed` |

Do not reuse the webhook secret between test and live, and do not reuse the API key secret
as the webhook secret.

## 7. Testing it

**Automated, and run on every change:**

- `lib/payments/razorpay.test.ts` — 22 assertions: a correct signature, a wrong secret, a
  body altered after signing, a non-hex or truncated signature, a missing secret, order of
  checks, duplicates, malformed payloads, oversized bodies, a failing database, and that no
  secret, signature or payer identity reaches the log.
- `supabase/tests/payments.test.sql` — 36 assertions: the structural guards of §1, replay,
  out-of-order delivery, failure-after-success, unknown orders, audit content, and who may
  read what.

**By hand, against a running server** (the honest end-to-end test — real route, real database
function, real HMAC):

```bash
npm run build:server
# A test secret for this run only; never the live one.
RAZORPAY_WEBHOOK_SECRET=whsec_local_test npm run start -- -p 3100
node scripts/razorpay-webhook-probe.mjs --base=http://127.0.0.1:3100 --secret=whsec_local_test

# Against deployed staging (the probe fetches the Vercel bypass itself):
node scripts/razorpay-webhook-probe.mjs --base=https://staging.gogulf.co --secret=<the Preview secret> \
  --order=order_STG_TEST_PAID_1 --failed-order=order_STG_TEST_FAILED_1
```

`scripts/razorpay-webhook-probe.mjs` sends a signed `payment.authorized`, a signed `order.paid`,
a replay of the same event id, a tampered body, an unsigned request, one signed with the wrong
secret, one with no event id, a non-JSON body, JSON that is not an event, and a signed
`payment.failed` — printing the status for each. It never prints a secret or a signature.
Without `--order` it uses an order id that matches no payment, so a run against a live
environment records ignored events and moves no money state.

**Result on 18 Sep 2026, against the Mumbai staging database** (`noxireidrbeqcvsirjec`), using
the deployed code built for that project:

| Delivery | Status | Outcome |
| --- | --- | --- |
| signed `payment.authorized` | 200 | `processed` — payment → `authorized` |
| signed `order.paid` | 200 | `processed` — payment → `paid`, `paid_at` and provider payment id set |
| same event id again | 200 | `duplicate` — no second event row, no second transition |
| body altered after signing | 401 | refused |
| no signature header | 401 | refused |
| signed with a different secret | 401 | refused |
| signed, no event id header | 400 | refused |
| signed body that is not JSON | 400 | refused |
| signed JSON that is not an event | 400 | refused |
| signed `payment.failed` (second payment) | 200 | `processed` — payment → `failed` with `BAD_REQUEST_ERROR` |

Database afterwards: `order_STG_TEST_PAID_1` = `paid` (stamped, with payment id),
`order_STG_TEST_FAILED_1` = `failed` (stamped, with the provider code), three `payment_events`
rows, three audit entries as `system` / `razorpay`, and **zero** event rows containing
contact-shaped data.

## 8. Why production still answers 503, and must

`RAZORPAY_WEBHOOK_SECRET` exists in Production, so the endpoint there would accept a signed
delivery — but **no live webhook is configured in Razorpay, and none should be yet**. Production
also still points at Tokyo, which has no `payments` table (`0014` is not applied there), so a
delivery that did arrive would be recorded against a database that cannot hold it. Both reasons
point the same way: leave the live webhook off until the checklist below is met.

## 9. Before the live webhook is enabled

1. `/api/razorpay/webhook` deployed and reachable at the production URL.
2. Test-mode probe passes: 200 for a signed event, 401 for a tampered one, 200 +
   `duplicate` for a replay, 400 for malformed input.
3. `RAZORPAY_WEBHOOK_SECRET` set in Vercel Production **before** the webhook is saved in
   the dashboard, so the first delivery is never refused with 503.
4. A consultation checkout exists (it does not yet) — otherwise there are no orders for the
   webhook to be about.
5. Receipt/acknowledgement behaviour agreed, and the privacy policy checked for the new
   processing (a payment record is personal data).
6. `npm run check:secrets` clean on the production build.
