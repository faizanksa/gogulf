# Environment Matrix

---

## 1. Environments

| | Production | Staging | Preview (per PR) | Local |
| --- | --- | --- | --- | --- |
| **Vercel** | `gogulf.co` | `staging.gogulf.co` | auto URL | `next dev` |
| **Vercel region** | `bom1` (Mumbai) | `bom1` | `bom1` | — |
| **Supabase** | prod project, `ap-south-1` | **branch** off prod | shares staging branch | `supabase start` |
| **Razorpay** | **live keys** | test keys | test keys | test keys |
| **Resend** | `gogulf.co` verified | `staging.gogulf.co` | staging key | console only |
| **WhatsApp** | live WABA number | Meta test number | test number | mocked |
| **OTP** | live provider + DLT | test provider | mocked | mocked |
| **Telephony** | live DID | mocked | mocked | mocked |
| **Sentry env** | `production` | `staging` | `preview` | disabled |
| **Indexing** | indexable | **`noindex`** | **`noindex`** | — |
| **Data** | real | **synthetic only** | **synthetic only** | synthetic only |

**Production PII never leaves production.** Staging is seeded with generated data — never a copy of
the real `contacts` table. This is a hard rule, not a preference: the legacy project holds passport
scans.

Staging uses Supabase **branching** rather than a second paid project (decision I14) — cheaper, and
migrations are tested against a real copy of the schema.

### Regions

Vercel `bom1` and Supabase `ap-south-1` are both Mumbai. Two reasons:

1. **Latency.** RLS-heavy CRM screens make several round trips per request. Co-located that is
   single-digit milliseconds; Mumbai↔US is ~200 ms each way, compounding into a sluggish admin.
2. **Residency.** Candidate documents and payment records stay in India by default — the defensible
   DPDP posture under decision B9 (best-effort residency).

**The Supabase region cannot be changed after the project is created.** Confirm `ap-south-1` at
creation time.

---

## 2. Variable matrix

`.env.example` in the repository root is the canonical template. Nothing there holds a real value.

### 2a. PUBLIC — compiled into the browser bundle

Anything prefixed `NEXT_PUBLIC_` is public **permanently, to everyone**. A secret placed here is
disclosed the moment the site deploys.

| Variable | Purpose | Prod | Staging | Preview | Local |
| --- | --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Canonical URLs, OG, JSON-LD, sitemap | ✓ | ✓ | ✓ | ✓ |
| `NEXT_PUBLIC_SUPABASE_URL` | Project endpoint | ✓ | ✓ | ✓ | ✓ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public by design; bounded entirely by RLS | ✓ | ✓ | ✓ | ✓ |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Required by Razorpay Checkout in the browser | live | test | test | test |
| `NEXT_PUBLIC_SENTRY_DSN` | Identifies the project; grants no access | ✓ | ✓ | ✓ | — |

The anon key being public is not a weakness — it carries no privileges of its own. It is also **not
authorization**: RLS is.

### 2b. SERVER-ONLY — secrets

Never read from a Client Component, never returned in an API response, never embedded in HTML,
never logged.

| Variable | Purpose | Notes |
| --- | --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | **Bypasses all RLS** | Webhooks, cron, migration tooling, system automation **only**. Never in a user request path |
| `SUPABASE_DB_URL` | Direct Postgres | Migrations and CI only |
| `RAZORPAY_KEY_SECRET` | Signs orders | Live value exists only in production |
| `RAZORPAY_WEBHOOK_SECRET` | HMAC over the raw webhook body | **Distinct** from `RAZORPAY_KEY_SECRET` — set in the Razorpay dashboard |
| `RESEND_API_KEY` | Transactional email | |
| `RESEND_FROM_EMAIL` / `RESEND_REPLY_TO` | e.g. `no-reply@` / `careers@gogulf.co` | Not secret, but server-side by convention |
| `RESEND_WEBHOOK_SECRET` | Delivery and bounce events | |
| `CRON_SECRET` | Authenticates Vercel Cron against `/api/cron/*` | Without it the endpoints are openly callable |
| `SENTRY_AUTH_TOKEN` | Source-map upload at build | |

### 2c. THIRD-PARTY INTEGRATIONS — added per phase

All server-only. Every provider sits behind an adapter in `lib/providers/`, so any can be swapped
without touching application code.

| Variable | Phase | Notes |
| --- | --- | --- |
| `OTP_PROVIDER` | 3 | `firebase` \| `msg91` \| `twilio` |
| `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` | 3 | Initial provider. Credentials pending |
| `MSG91_AUTH_KEY` / `MSG91_DLT_TEMPLATE_ID` | 3+ | Likely production choice for India DLT compliance |
| `WHATSAPP_PROVIDER` | 9 | |
| `WHATSAPP_PHONE_NUMBER_ID` / `WHATSAPP_BUSINESS_ACCOUNT_ID` | 9 | **Number not yet chosen — decision B7** |
| `WHATSAPP_ACCESS_TOKEN` | 9 | Long-lived system-user token; rotated |
| `WHATSAPP_APP_SECRET` | 9 | Validates `X-Hub-Signature-256` |
| `WHATSAPP_VERIFY_TOKEN` | 9 | Meta subscription handshake |
| `TELEPHONY_PROVIDER` / `_API_KEY` / `_API_SECRET` / `_WEBHOOK_SECRET` | 10 | Provider undecided |
| `GOOGLE_OAUTH_CLIENT_ID` / `_SECRET` | 1 | Staff SSO; configured in Supabase Auth |

### 2d. LEGACY — being retired

| Variable | Status |
| --- | --- |
| `NEXT_PUBLIC_EMAILJS_PUBLIC_KEY` | No longer read by the code (removed 11 Sep 2026). Still set on **Production** — delete at the cutover |
| `NEXT_PUBLIC_EMAILJS_SERVICE_ID` | Same |
| `NEXT_PUBLIC_EMAILJS_TEMPLATE_ID` | Same |
| `NEXT_PUBLIC_EMAIL_PROVIDER` | No longer read — email has one path (Resend). Set only on the `staging` branch; safe to delete |

EmailJS was removed from the code at the business's instruction; every form now sends
through Resend on the server. Production still runs its EmailJS build from `main`, so its
three variables stay until the cutover, when they are deleted and the EmailJS account keys
revoked. The privacy-policy processor list already names Resend and ships with that cutover.

---

## 3. Current state — audited 5 Sep 2026

`.env.local` holds nine variables. Verified: **no secret is exposed through `NEXT_PUBLIC_*`.**

| Variable | Classification | Correct? |
| --- | --- | --- |
| `NEXT_PUBLIC_EMAILJS_PUBLIC_KEY` | Public by design (EmailJS publishable key) | ✓ legacy |
| `NEXT_PUBLIC_EMAILJS_SERVICE_ID` | Public by design | ✓ legacy |
| `NEXT_PUBLIC_EMAILJS_TEMPLATE_ID` | Public by design | ✓ legacy |
| `NEXT_PUBLIC_SUPABASE_URL` | Public by design | ✓ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public by design | ✓ |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secret** | ✓ correctly server-side |
| `RESEND_API_KEY` | **Secret** | ✓ correctly server-side |
| `RAZORPAY_KEY_ID` | Public-safe | ✓ (will be re-exported as `NEXT_PUBLIC_RAZORPAY_KEY_ID` when Checkout needs it) |
| `RAZORPAY_KEY_SECRET` | **Secret** | ✓ correctly server-side |

Missing and needed later: `RAZORPAY_WEBHOOK_SECRET`, `RESEND_FROM_EMAIL`, `RESEND_REPLY_TO`,
`CRON_SECRET`, `NEXT_PUBLIC_SITE_URL`, Sentry, and everything in §2c.

**Verified:** `.env.local` is untracked and matched by `.gitignore`; `.gitignore` now also covers
production dumps, exports, backups and document archives.

---

## 4. Enforcement

| Control | Mechanism |
| --- | --- |
| No secret in the client bundle | `npm run check:secrets` — `scripts/check-client-secrets.mjs` reads the real values and scans the built output for them. Reports the **variable name and file**, never the value |
| Naming discipline | `.env.example` states the rule at the top; review checklist in `SECURITY-MODEL.md` |
| Lint | `npm run lint` (ESLint CLI — `next lint` was removed in Next 16) |
| Types | `npm run typecheck` (`tsc --noEmit`) |
| Secrets at rest | Vercel encrypted environment store. Never in the repo. Documented in a password manager for recovery |

`check:secrets` currently passes: 121 files scanned across `out/` and `.next/static/`, three
server-only secrets present in the environment, none found in client output.

### If a secret is ever found in the bundle

Removing it is not enough — it has already shipped to every visitor. **Rotate it.** The script says
so in its failure message, because that is the step people skip.

---

## 5. Deployment and rollback

### Pipeline

```
feature branch
  → PR: lint · typecheck · unit tests · RLS policy tests · build · check:secrets
  → Vercel Preview + Supabase branch (migrations applied to the branch)
  → review + manual QA on the preview URL
  → merge to main
  → staging deploy + migrations → smoke tests
  → MANUAL promotion to production
  → production deploy → migrations → post-deploy smoke tests
```

**Production promotion is a deliberate human action.** For a system handling payments and
passports, push-to-production-on-merge is not appropriate.

### Migration discipline

- **Expand → migrate → contract.** Add the column, backfill, dual-write, switch reads, and only then
  drop the old column — in separate releases. A single release that both adds and removes cannot be
  rolled back.
- Backfills run as batched jobs, never inline in a migration that locks a table.
- A destructive migration requires a fresh PITR checkpoint recorded immediately before it, plus a
  named person watching.
- Migrations are tested against a Supabase branch with realistic volume, not an empty database.

### Rollback

| Failure | Action | Time |
| --- | --- | --- |
| Bad application code | Vercel instant rollback to the previous immutable deployment | < 2 min |
| Bad migration, additive only | Roll back code; the extra column is harmless | < 5 min |
| Bad migration, data-affecting | **Forward-fix.** Not a down-migration — down-migrations on production data lose data | 15–60 min |
| Data corruption | PITR restore to the pre-incident timestamp; project offline during restore | 1–4 h |
| Storage loss | Restore from the independent mirror | 2–6 h |
| Provider outage | Degrade gracefully — queue in the outbox, show honest status, never silently drop | immediate |
| Bad DNS cutover | TTL lowered to 300 s beforehand; old host stays deployed 30 days | minutes |

### Release gates

No production release proceeds unless: CI green; RLS test matrix green; `check:secrets` green;
migrations applied cleanly to staging; a fresh backup checkpoint exists; the legal-page checklist is
satisfied for anything in the release that touches it; and a rollback plan is written for that
specific release.

### Feature flags

Portal, payments, WhatsApp and IVR each ship behind a flag in `settings`. This decouples deploying
code from launching a feature, allows a pilot with one branch or a handful of candidates, and gives
an instant off-switch that needs no deploy.

---

## 6. Cost

| Item | USD/month |
| --- | --- |
| Supabase Pro | 25 |
| Small compute add-on (**required for PITR**) | 15 |
| PITR, 7-day retention | ~100 |
| Independent storage mirror | 5–15 |
| Vercel Pro | 20 |
| Resend | 0–20 |
| Sentry | 0–26 |
| **Baseline** | **~190–260** |

Excludes usage-based costs: WhatsApp conversations, SMS/OTP, IVR minutes, Razorpay transaction fees.
Budget approved under decision B8.
