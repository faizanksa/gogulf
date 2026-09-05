# Architecture

**Status:** approved direction, not yet implemented.
**Supersedes:** `ARCHITECTURE-AUDIT.md` §12 and Decision Pack Part D.

---

## 1. Shape

One Next.js 16 application, four route groups, one Vercel deployment. Not a monorepo — the team
size and the shared design-system and type surface do not justify the coordination cost, and a
single deployment keeps one cookie scope, one certificate and one release train.

```
app/
├── (marketing)/          public site · static / ISR · anonymous
│   ├── page.js                      home
│   ├── about/ services/ contact/
│   ├── jobs/ jobs/[slug]/ jobs/apply/
│   ├── travel/ visa/                (Phase 6)
│   └── privacy-policy/ terms-and-conditions/ pricing/
│       cancellation-and-refunds/ shipping-policy/
│
├── (portal)/portal/      customer · phone+OTP session · RLS: own records only
│   ├── page.js                      "where am I / what's pending / what's due"
│   ├── applications/ travel/ documents/ payments/ messages/ profile/
│
├── (admin)/admin/        staff · Google Workspace SSO · RLS: permission + scope
│   ├── page.js                      operational dashboard
│   ├── contacts/[id]/               Customer 360 — the core screen
│   ├── cases/ jobs/ payments/ documents/ communications/ tasks/
│   └── settings/{users,roles,pipelines,templates,audit}/
│
└── api/
    ├── webhooks/razorpay/  whatsapp/  telephony/  resend/
    └── cron/reminders/  document-expiry/  outbox/  reconcile/

proxy.js                  route protection + security headers
lib/
├── db/                   typed Supabase clients, queries
├── auth/                 session, permissions, OTP abstraction
├── providers/            whatsapp/ sms/ telephony/ email/ payments/
├── domain/               contacts, cases, documents, money — business rules
└── legal.js  seo.js      existing, retained
```

### Why route groups rather than separate apps

`(marketing)`, `(portal)` and `(admin)` share the design system, the database types, the permission
helpers and the deployment. Splitting them would mean three builds, three type-sync problems and a
cross-domain session. Route groups give the isolation that matters — separate layouts, separate
auth requirements, separate `proxy.js` matchers — at none of that cost.

---

## 2. Removing static export

`output: 'export'` is currently the constraint everything else follows from. Verified against the
Next.js 16.3 docs bundled in `node_modules/next/dist/docs/`, it makes these unsupported:

- Route Handlers that read the `Request`
- `cookies()`
- rewrites, redirects, headers
- `proxy.js`
- Incremental Static Regeneration
- dynamic routes without `generateStaticParams()`
- image optimisation with the default loader

Every roadmap item needs at least one of them. There is no partial workaround.

**It is removed in Phase 1**, deliberately as its own commit, so the diff that changes the
deployment model is reviewable in isolation. The current `next.config.mjs` documents this inline.

Until then it stays, so the live marketing site keeps deploying exactly as it does today while the
platform is built alongside it (see `MIGRATION-PLAN.md` §3).

---

## 3. Next.js 16 specifics that shape the code

Discovered in the bundled docs, and different from older Next.js:

| Concern | Next 16 behaviour |
| --- | --- |
| Middleware | Renamed to **`proxy.js`**. Node runtime only — the `edge` runtime is not supported in `proxy` |
| Request APIs | `params`, `searchParams`, `cookies()`, `headers()`, `draftMode()` are **async-only**. Synchronous access was removed |
| Bundler | Turbopack by default for `dev` **and** `build` |
| Linting | `next lint` **removed**; `next build` no longer lints. ESLint runs via its own CLI |
| PPR | `experimental.ppr` replaced by the `cacheComponents` config flag |
| Caching | `revalidateTag(tag, profile)` now takes a `cacheLife` argument; `updateTag` gives read-your-writes inside Server Actions; `refresh()` refreshes the client router |
| Image | Local images with query strings need `images.localPatterns.search` |

---

## 4. Stack

| Layer | Choice | Note |
| --- | --- | --- |
| Framework | Next.js 16.3, App Router | Already in place |
| Language | TypeScript, `strict` | Foundation laid in Phase 0.5. New code is TS; existing marketing JS migrates as Phase 2 replaces it |
| Hosting | Vercel, functions in **`bom1`** (Mumbai) | Account `vercel.com/faizan-chaudhary` |
| Database | Supabase Postgres, **`ap-south-1`** (Mumbai), RLS on every table | |
| Auth — customer | Phone + OTP, Supabase Auth session | OTP provider behind an adapter; Firebase first |
| Auth — staff | Google Workspace SSO restricted to `@gogulf.co` | Removing an employee from Workspace revokes platform access immediately |
| Storage | Supabase Storage, private buckets, 5-minute signed URLs | |
| Email | Resend, server-only | Replaces EmailJS in Phase 1.5 |
| Payments | Razorpay Orders API, webhook-authoritative | Test mode until Phase 7 sign-off |
| WhatsApp | Meta Cloud API behind an adapter | Number not yet chosen — decision B7 |
| Telephony | Adapter; provider chosen in Phase 10 | |
| Errors | Sentry | |
| Validation | Zod schemas shared client ↔ server; the server always re-validates | |
| Background work | Postgres `outbox` + Vercel Cron | No queue service needed at this scale |
| Styling | Tailwind v4 for admin/portal; bespoke for marketing | ~40 admin screens will not survive hand-written CSS |

### Region co-location

Vercel `bom1` and Supabase `ap-south-1` are both Mumbai. RLS-heavy CRM screens make several round
trips per request; co-located that is single-digit milliseconds, versus roughly 200 ms each way to
a US region. It also keeps candidate documents and payment records in India by default, which is
the defensible DPDP posture (decision B9: best-effort residency).

---

## 5. Provider abstraction

Every external communication provider sits behind an interface in `lib/providers/`. Application
code calls the service, never the vendor.

```
                  ┌────────────────────────────────┐
  domain code ───►│ CommunicationService           │
                  │  send(channel, to, template)   │
                  │  — checks consent BEFORE send  │
                  │  — writes communications row   │
                  │  — writes activities row       │
                  └───────────────┬────────────────┘
      ┌─────────────┬─────────────┼─────────────┬──────────────┐
      ▼             ▼             ▼             ▼              ▼
 WhatsAppProvider EmailProvider OtpProvider VoiceProvider  SmsProvider
 Meta Cloud API    Resend       Firebase     Exotel/…      MSG91/Twilio
                                 ↑
                        replaceable without touching
                        a single line of auth logic
```

This is not speculative generality — three of the five providers are explicitly unsettled:
the WhatsApp number (B7), the OTP provider (Firebase first, likely MSG91 later for DLT), and
telephony (undecided). The adapter is the cheapest way to keep those decisions reversible.

Inbound is symmetric: webhook → normalise to a provider-neutral shape → resolve identity via
`contact_identities` → write `communications` + `activities` → route to an agent → optionally open
a case.

---

## 6. Request paths and trust

```
Browser
  │
  ├─ marketing pages ──────────► static / ISR, no auth, no data access
  │
  ├─ portal / admin reads ─────► Supabase with the USER'S OWN session JWT
  │                              RLS applies. Defence in depth: an application-layer
  │                              authorization bug still cannot leak another
  │                              customer's rows.
  │
  └─ every mutation ───────────► Server Action / Route Handler
                                   1. authenticate
                                   2. re-validate input with Zod
                                   3. re-check permission server-side
                                   4. write + audit + activity, one transaction

Vercel Cron ───► /api/cron/*  (CRON_SECRET) ──┐
Providers   ───► /api/webhooks/* (signature) ─┴─► service role, RLS bypassed,
                                                  never in a user request path
```

**The service-role key is used in exactly three places:** verified webhooks, cron jobs, and
controlled migration tooling. Never to serve a customer or staff request — those use the caller's
own session so that RLS remains the last line of defence. See `SECURITY-MODEL.md`.

---

## 7. Event-driven side effects

Domain writes emit events; side effects are queued, not inlined. A failed WhatsApp send must never
roll back a payment.

```
payment.succeeded  ──► events ──► outbox ──► handlers
                                              ├── Resend receipt
                                              ├── WhatsApp confirmation (consent-gated)
                                              ├── invoice generation
                                              ├── activities entry
                                              └── audit_logs entry
```

`outbox` rows carry `attempts`, `next_attempt_at` and `last_error`; a cron job drains them with
exponential backoff. This is the standard transactional-outbox pattern and it avoids adding a queue
service in Phase 1.

---

## 8. What is deliberately not being built

Lead scoring, AI summaries, AI document classification, calendar integration, SLA tracking,
supplier management, marketing automation, and multi-branch **UI**. `branch_id` ships in Phase 1 on
every table, so multi-branch is a switch to turn on later rather than a migration — the business
currently has one branch (decision I4).

The product principle from the brief holds: **prioritise operational workflows over screen count.**
The admin surface starts at Dashboard, Contacts, Customer 360, Cases, Jobs, Payments, Documents,
Communications, Tasks, Users, Roles, Audit — and expands only when a real workflow demands it.
