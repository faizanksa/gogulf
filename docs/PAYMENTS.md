# Payments — Razorpay infrastructure

What exists, what deliberately does not, and what has to be configured by hand before a
rupee can move. Written 18 September 2026, with migration `0014_payments.sql`; **§10 (invoices,
the customer payment page and the QR code, migration `0015_invoices.sql`) was added on
19 September 2026.**

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

> **Update 19 Sep 2026:** the checkout this section calls "NOT BUILT" now exists, for **invoices**
> (§10). The consultation-order path below (`createConsultationOrder`) still has no call site; the
> invoice flow reaches the same webhook and the same `record_payment_event` through
> `lib/payments/provider-order.ts`, the one module that talks to Razorpay.

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

**Repeated against deployed staging** (`https://staging.gogulf.co`, deployment
`dpl_7hn67GZFTiL4q8HSFEnEyHDPHvii`, commit `f66a11a`, using the Preview webhook secret and the
`_2` order pair): the same ten statuses, and the same transitions — so the endpoint behaves
identically as deployed, not only when run locally. Across both runs Mumbai staging then held
**four** payments (two `paid`, two `failed`), **nine** `payment_events` rows with **nine
distinct event ids** (6 `processed`, 3 `ignored` — the ignored ones being deliveries for orders
that did not exist), **six** payment audit entries, and **zero** summaries containing
contact-shaped data.

Those staging rows are deliberate fixtures. `supabase/tests/payments.test.sql` scopes its counts
to its own `order_TEST_%` fixtures precisely so a shared environment holding them does not change
the result of the suite — 316/316 still passes on Mumbai staging with them in place.

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
4. A checkout exists **and has been exercised in Razorpay TEST mode.** The invoice checkout is
   built (§10) but has not been run against Razorpay's own test API, because no TEST key exists
   on any machine or in Vercel Preview (§10.9). Until it has, only the webhook half is proven.
5. Receipt/acknowledgement behaviour agreed, and the privacy policy checked for the new
   processing (a payment record is personal data). *(19 Sep: Razorpay is now named in the
   privacy policy's third-party list; the wording awaits the business's review.)*
6. `npm run check:secrets` clean on the production build.

---

## 10. Invoices, the customer payment page and the QR code (`0015`)

Consultation and service invoices. A staff member creates and issues an invoice; the customer
opens `/pay/GG-INV-YYYY-NNNNN` (or scans its QR code), pays through Razorpay Checkout, and the
signed webhook described above marks the invoice paid. **No new payment infrastructure was
built** — invoices hang off the tables, the function and the endpoint that already exist.

### 10.1 Architecture

```
staff: create draft → issue                 /admin/invoices            RLS + invoices_before_write
staff: copy / QR / print / share the link   /pay/<reference>           (the link IS the reference)
payer: opens the page, presses Pay           beginPayment(reference)    only input: the reference
  → 1. read invoice                          public_invoice_view()      explicit column allow-list
  → 2. live order already?                   open_invoice_payment_request(ref)          → reuse it
  → 3. else create the order at Razorpay     createProviderOrder()      mode guard, integer paise
  → 4. record it against the invoice         open_invoice_payment_request(ref, order)
payer: Razorpay Checkout (checkout.js, loaded only on click)
Razorpay: signed webhook                     /api/razorpay/webhook      UNCHANGED
  → record_payment_event()                   0014                       UNCHANGED
  → sync_invoice_from_payment()  (trigger)   0015                       invoice → paid / payment_failed
```

**A "payment link" is our own page, not a Razorpay Payment Link, and the QR encodes that page's
URL, not a Razorpay QR Code.** This was chosen deliberately: it keeps every state change on the
three event types already tested end to end (`payment.authorized`, `order.paid`,
`payment.failed`) instead of introducing `payment_link.*` and `qr_code.*` events whose payloads
have not been verified, and it means the QR carries no amount and no secret.

### 10.2 What is stored, and what is refused

| | |
| --- | --- |
| `invoices` | reference (`GG-INV`, from a sequence), status, optional `contact_id`/`case_id`, branch, bill-to **frozen at issue**, purpose, `line_items` (validated in the database), `discount_minor`, optional `tax_rate_percent`, derived `subtotal`/`tax`/`total` (INR paise), issue and due dates, `created_by/at`, `updated_by/at`, `issued_at`, `paid_at`, `voided_at`, `void_reason` |
| `payments.invoice_id` | the only change to `payments`; **still no job or job-application column** |
| Not stored | card data, raw webhook payloads, payer identity in events or audit entries (all unchanged) |
| No job link | `invoices` has no `job_id` and no `job_application_id`; `invoices.test.sql` and `boundaries.test.ts` assert it |

Totals are **derived by the database** from the line items (`invoices_before_write`), never
accepted from a form. A discount larger than the subtotal is refused, not clamped.

### 10.3 States and who may move them

```
draft ──issue──▶ issued ──customer opens checkout──▶ payment_pending ──webhook: order.paid──▶ paid
  │                │ ▲                                    │
  └──void──▶ void ◀┘ └── retry (new order) ◀── payment_failed ◀──webhook: payment.failed──┘
```

| Move | Who / what | Enforced by |
| --- | --- | --- |
| draft → issued, draft → void, issued → void, payment_failed → void | a **staff** session with `invoices.issue` / `invoices.void` | `invoices_before_write` staff whitelist |
| issued / payment_failed → payment_pending | `open_invoice_payment_request` (a payer's request) | trusted transition, set inside a SECURITY DEFINER function and reset straight after |
| issued / payment_pending / payment_failed → paid, → payment_failed | the payments trigger, i.e. a **verified webhook event** | trusted transition |
| anything → **unpaid**, paid → anything, void → anything | **nobody** | no path exists |
| payment_pending → void | **nobody** (money may be in flight) | in neither whitelist |

A staff `UPDATE ... SET status = 'paid'` is refused by the database whatever the UI sends.
After issue, the customer, amounts, line items, tax, discount and dates are **frozen**: an edit
that touches them succeeds as a write but leaves them unchanged. To correct an issued invoice,
void it and create a new one. Reversing received money is a **refund**, which has no flow and
needs its own approved, audited design — nothing here pretends otherwise.

A late `order.paid` for an order already reported failed still ends the invoice **paid** (money
arrived); a late `payment.failed` never un-pays a paid invoice. The sync trigger updates zero
rows rather than raising in any other case, so it cannot turn a recorded payment into a webhook
500 that makes Razorpay retry.

### 10.4 The two doors an unauthenticated payer has

`anon` has **no privilege on `invoices` or `payments`**. It may execute exactly two
SECURITY DEFINER functions, named in `rls.test.sql` so adding a third is a deliberate, reviewed change:

| Function | Does | Cannot |
| --- | --- | --- |
| `public_invoice_view(reference)` | returns reference, status, purpose, total, currency, due date, issue date for a non-draft invoice | return a draft; return billing address, contact, notes, GSTIN, ids or staff fields; take an id |
| `open_invoice_payment_request(reference, order_id?)` | with no order id: returns the live order if there is one. With one: records it against the invoice, amount **read from the invoice** | accept an amount; open a second live order (partial unique index `payments_invoice_open_order_uniq`); act on a draft, paid or void invoice |

`/pay/[reference]` shows Go Gulf, the invoice number, the service, the amount, the status and
the Pay button — nothing else. It is never cached, never indexed (`noindex`, and `/pay/` is in
`robots.txt`), and rate limited per address and per invoice (per-instance, as the limiter says).

### 10.5 Razorpay

* **One module calls Razorpay:** `lib/payments/provider-order.ts`. It refuses a live key outside
  production and a test key inside it *before* anything is written or sent, requires a positive
  integer number of paise, restricts order notes to three names and a character set with no
  `@` or `+` (so an email or phone cannot ride along), and refuses an order whose amount or
  currency differs from the request. `createConsultationOrder` now uses it too.
* **The browser is never authoritative.** Checkout's success callback only starts the page
  re-reading; the status shown is what the server read from the invoice, which only the webhook
  moves. The callback's arguments (payment id, signature) are not read.
* `checkout.js` is loaded **only when the payer presses Pay**, so opening the page contacts no
  third party. There is no Content-Security-Policy anywhere in this application today
  (`lib/security-headers.mjs` sets none); adding one is a recommended follow-up, and would need
  `script-src`/`frame-src`/`connect-src` for `checkout.razorpay.com` and `api.razorpay.com`.
* The webhook, `record_payment_event`, `normaliseEvent` and `verifyWebhookSignature` are
  **unchanged**; the verified webhook behaviours were re-run against this build (§10.8).

### 10.6 Permissions (existing catalogue, nothing invented)

| Capability | Permission | ADMIN | SUPER_ADMIN |
| --- | --- | --- | --- |
| See invoices and payment status | `invoices.view` | all | all |
| Create, edit a draft, issue | `invoices.issue` | all | all |
| Void | `invoices.void` | all | all |
| See payment attempts on an invoice | `payments.view` | all | all |
| See the audit history | `audit.view` | **yes** | yes |
| Roles / permissions | `roles.manage` / `permissions.manage` | **no** | yes |

Scope is enforced in the database (`scope_allows`): FINANCE_MANAGER is all-scope; ACCOUNTS
issues within its branch; HR_MANAGER, TRAVEL_MANAGER, OPERATIONS_MANAGER and VIEW_ONLY can view
in their branch only and cannot create — asserted in `invoices.test.sql`. Creator and last
editor are shown to every role that can read the invoice, not only SUPER_ADMIN.

**Open finding, not changed (you asked for no unilateral policy change).** In the `0008`
catalogue ADMIN also holds `audit.view`, `settings.manage` and `users.manage`, which is broader
than "SUPER_ADMIN sees the audit history and privileged settings". Making history SUPER_ADMIN-only
would be a small migration (remove `ADMIN → audit.view`; the invoice and job history panels
already hide themselves without it). It is one reviewed change if you want it.

### 10.7 Audit

Written by the database in the same transaction, attributed from the JWT or to the system:
`invoice.created`, `invoice.updated` (changed fields only), `invoice.issued`,
`invoice.payment_link_opened` / `_reopened`, `invoice.paid`, `invoice.payment_failed`,
`invoice.voided` (with the reason), and — from 0014 — `payment.authorized/paid/failed`. Staff cannot
insert audit rows. `invoice.paid` is attributed to the **system**, not a person. No entry carries
the customer's name, email or phone (checked on staging), and no raw Razorpay payload is stored.

### 10.8 Verified, and how

| | Result |
| --- | --- |
| SQL, local from empty and Mumbai staging | **386/386** (316 before: +69 in the new `invoices.test.sql`, +1 in `rls.test.sql` — the two anon doors are now named and asserted) |
| Unit | **277/277** (223 before), including the order guards, the payment starter and structural boundary tests |
| Local E2E on the payment page | 8/8 (draft, unknown and malformed → 404; no internal data in the HTML; noindex; paid and void offer no payment; Pay fails closed; axe on phone and desktop) |
| **Deployed staging** (`staging.gogulf.co` → Mumbai staging) | **38/38** — page, leak checks, 404s, order reuse, no orphan order, signed `payment.authorized` / `order.paid` / duplicate / tampered / unsigned / malformed, invoice paid **by the webhook**, late failure cannot un-pay, failure → retry with a new order → paid, audit trail, no payer identity in events or audit |

### 10.9 Not verified, and why

* **A real Razorpay test-mode checkout has not been run.** No TEST API key exists on this machine
  or in Vercel Preview (only live credentials, which are Production-only and must never be copied
  to Preview). Everything up to the Razorpay API call and everything after Razorpay's signed event
  is verified; the call itself and `checkout.js` opening in a browser are not. **Required:** add
  `RAZORPAY_KEY_ID` (`rzp_test_…`) and `RAZORPAY_KEY_SECRET` to the Vercel **Preview** scope, then
  pay one synthetic invoice (§10.10).
* **The admin screens have no automated browser test.** A staff session needs a real Google
  sign-in (the guard checks the sign-in method), which cannot be minted honestly here. Their
  behaviour is covered by the SQL role tests, unit tests and the build; the visual flow needs
  the manual QA below.
* **Razorpay's own test delivery to staging** still cannot reach the route (Vercel deployment
  protection answers first); deliveries were signed and sent by a flow script instead.

### 10.10 Manual QA on staging (needs a Google-signed-in ADMIN or SUPER_ADMIN)

1. `/admin/invoices/new`: customer, service, two line items, a discount, no tax rate → the total updates live. **Save draft**, reload, edit, save again.
2. **Issue invoice.** The amounts are now read-only; the payment link and QR appear. Copy the link, download and print the QR, scan it with a phone → the Go Gulf page opens with only number, service, amount and status.
3. With TEST keys in Preview: press **Pay**, complete a test payment, see "confirming", then "Payment received". The staff page shows **Paid**, one payment row, and the history (issued → payment opened → paid, the last as *System*).
4. Repeat with a test **failure**, then retry from the same link.
5. Void an unpaid invoice with a reason; its link now says it cannot be paid.
6. As a role without `invoices.issue` (VIEW_ONLY, HR_MANAGER) confirm there is no New invoice button and a direct visit to `/admin/invoices/new` says the role lacks access.

### 10.11 Still to decide or build

| | |
| --- | --- |
| **GST / "Tax Invoice"** | Decision D8 (GST certificate) is unresolved. The rate field is optional and per invoice; nothing defaults it, and no page says "Tax Invoice". The business/legal owner decides treatment, GSTIN display and numbering rules before real invoices go out |
| Refunds and reversals | No flow. Required before a paid invoice can ever be corrected |
| Receipts / emails to the customer | Not built; staff share the link themselves |
| PDF invoice | Not built |
| Link a customer to a contact/case | The columns exist and are honoured; the form does not offer them yet |
| Privacy policy wording | Razorpay is added to the third-party list; the business should review the text. `POLICY_EFFECTIVE_DATE` was **not** changed |
| Content-Security-Policy | None exists site-wide; recommended (§10.5) |
| Live webhook | Still not configured; must not be until §9 is met |
