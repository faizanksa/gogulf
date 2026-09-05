# Go Gulf — Pre-Implementation Decision Pack

**Date:** 5 September 2026
**Prerequisite:** [ARCHITECTURE-AUDIT.md](ARCHITECTURE-AUDIT.md) (Phase 0, approved)
**Status:** Awaiting decisions. **No Supabase project created. No production data touched. No platform code written.**

**Change since the audit:** commit `7bb3093` committed and pushed the legal-entity restoration.
Audit debt item #10 (uncommitted work at risk) is **closed**.

---

## Contents

| Part | Subject | Answers brief item |
| --- | --- | --- |
| A | Decision register — blocking / important / later | 1, 2 |
| B | Supabase access request + safe inspection protocol | 3 |
| C | Legacy data migration strategy | 4, 5, 6 |
| D | Production environment architecture | 8 |
| E | Database schema & ERD | 9 |
| F | Customer 360 requirement | 11 |
| G | Identity resolution requirement | 12 |
| H | Payment ledger requirement | 13 |
| I | Document security requirement | 14 |
| J | RBAC + RLS matrix | 10 |
| K | Legal & privacy migration checklist | 15 |
| L | Retention, deletion & export strategy | 16 |
| M | Backup, PITR & disaster recovery | 17 |
| N | Monitoring & error tracking | 18 |
| O | Deployment & rollback strategy | 19 |
| P | Parallel-run migration strategy | 20 |
| Q | Corrections to the Phase 0 audit | 21 |

---

# PART A — Decision register

Every decision carries an ID. Please answer inline or in a reply; I will not start Phase 1 until
all **BLOCKING** rows are closed.

## A.1 BLOCKING — Phase 1 cannot start

| ID | Decision | Options | Recommendation | Consequence if wrong |
| --- | --- | --- | --- | --- |
| **B1** | Who owns Supabase project `julbqkeyvzwluayokcdi`, and can we get access? | (a) Owner invite to our account · (b) project transferred to the new org · (c) time-boxed credentials + handover | (a) then (b) | Live candidate passports/CVs are unrecoverable. Everything in Part C depends on this |
| **B2** | Which Supabase org owns the new platform, and **in which region**? | `ap-south-1` (Mumbai) · `ap-southeast-1` (Singapore) · other | **`ap-south-1` (Mumbai)** | **Region cannot be changed after project creation.** Wrong choice = DPDP data-residency exposure + permanent latency penalty |
| **B3** | Hosting target | Vercel · self-hosted Node/Docker VPS · stay on static host | **Vercel, functions pinned to `bom1` (Mumbai)** | Self-hosting adds a DevOps role the team doesn't have. Static host cannot run the platform at all |
| **B4** | Who controls DNS for `gogulf.co`, and where is it hosted today? | — | Need registrar + current host named, and access | Blocks Vercel domain cutover, Resend DKIM, and WhatsApp domain verification. Three separate workstreams stall |
| **B5** | Who approves legal-page changes? Is there a lawyer/CS retained? | Internal · external counsel · none | Name one accountable person now | We cannot ship authentication without amending the privacy policy (Part K). No approver = no launch |
| **B6** | Razorpay: is the merchant account live and verified, under which entity, and do we hold API keys? | — | Confirm entity = Chaudhary Gulf Travels Pvt Ltd; obtain test keys now, live keys at Phase 7 | Phase 7 stalls. Also determines whether the compliance pages already passed review |
| **B7** | Is `+91 99363 09015` currently on the **WhatsApp Business App**? | Yes · No · Unsure | If yes: **acquire a second number for the Cloud API** and keep the existing one on the app | Migrating a number to the Cloud API is effectively one-way — the team loses the WhatsApp phone app for that number, permanently |
| **B8** | Monthly infrastructure budget envelope | — | ~**USD 190–260/mo** at launch (Part M.4), excluding per-message WhatsApp/SMS/IVR usage | A $0 expectation forces free-tier Supabase: no backups, project auto-pauses, no PITR. Not viable for passport storage |
| **B9** | Must all customer PII remain in India? | Strict · Best-effort · No constraint | **Best-effort**: DB + documents in India; accept that email/WhatsApp/error-tracking vendors are foreign, and disclose it (the policy already does) | Strict residency rules out Resend, Meta and Sentry as designed, and changes Part D materially |

## A.2 IMPORTANT — needed during Phases 1–3, not on day one

| ID | Decision | Recommendation | Needed by |
| --- | --- | --- | --- |
| **I1** | Staff authentication method | **Google Workspace SSO restricted to the `gogulf.co` hosted domain.** The business already runs Workspace (footer webmail link). Removing an employee from Workspace instantly revokes platform access — no password to forget, leak or reset | Phase 1 |
| **I2** | TypeScript strictness | `strict: true` for all new code; leave existing marketing JS until Phase 2 replaces it | Phase 1 |
| **I3** | SMS/OTP provider + **India DLT registration** | MSG91 (India-native, cheaper) or Twilio. **Start DLT header/template registration immediately — it takes weeks and is on the critical path for Phase 3** | Start now |
| **I4** | How many physical branches exist today? | If one (Lucknow), `branch_id` still ships in Phase 1 but the UI stays hidden | Phase 1 |
| **I5** | Real pipeline stages | A 90-minute workshop with the recruitment and travel leads. The stages in the audit are placeholders, not business truth | Phase 4 |
| **I6** | GST invoicing requirements | Confirm SAC code(s) for recruitment and travel services, place-of-supply rules, and invoice series format. See Part H.4 | Phase 7 |
| **I7** | Named Grievance Officer for DPDP | A person, with a role title and a monitored address, published on `/privacy-policy` | Phase 2 |
| **I8** | Document retention periods | Proposed defaults in Part L.2 — need business/legal sign-off | Phase 2 |
| **I9** | Are the six hardcoded jobs current and real? | Confirm before they seed the jobs table | Phase 5 |
| **I10** | Unverified claims: "20+ Years", "Since 2008", "Thousands of Placements", JSON-LD `foundingDate: 2008` | Substantiate (group history predating the 2024 entity is legitimate if stated as such) or reword | Phase 2 |
| **I11** | Homepage "14 Step Managed Process" vs the 10-step diagram | Pick the true number | Phase 2 |
| **I12** | Portal URL shape | `gogulf.co/portal` — one cookie scope, one certificate, simpler | Phase 3 |
| **I13** | Application tracking without login? | Offer OTP login only. A reference-number lookup leaks case status to anyone holding a number | Phase 5 |
| **I14** | Staging environment | Supabase **branching** on Pro rather than a second paid project — cheaper, and migrations are tested on a real copy | Phase 1 |
| **I15** | Brand direction for the redesign | Keep the green identity and evolve it, or rebrand? Affects Phase 2 scope significantly | Phase 2 |
| **I16** | Error tracking vendor | Sentry (cloud, EU or US region) | Phase 1 |

## A.3 CAN DECIDE LATER — no impact on foundation work

| ID | Decision | Decide by |
| --- | --- | --- |
| L1 | IVR/telephony provider (Exotel · MyOperator · Knowlarity) | Phase 10 |
| L2 | Depth of the tour/package module — do they sell fixed packages or only custom trips? | Phase 6 |
| L3 | BI/reporting tool beyond in-app dashboards (Metabase, etc.) | Phase 13 |
| L4 | AI features — lead scoring, CRM summaries, document classification | Post-launch |
| L5 | Multi-language UI (Hindi / Urdu / Malayalam). `preferred_language` ships in Phase 1 regardless | Post-launch |
| L6 | Supplier / partner module for travel | Phase 6+ |
| L7 | Calendar integration (Google Calendar for interviews) | Phase 11 |
| L8 | Read replicas / horizontal scaling | When load demands |
| L9 | Native mobile app vs PWA | Post-launch |
| L10 | WhatsApp catalogue / payments-in-chat | Post-launch |

---

# PART B — Supabase access & safe inspection protocol

## B.1 What to request from the client

Send this list verbatim:

1. **The email address of the Supabase account that owns the project** at
   `https://julbqkeyvzwluayokcdi.supabase.co`, and the organisation name it sits in.
2. **An Owner or Administrator invite** to that organisation for a named account we control
   (preferred), *or* the project transferred into the new organisation.
3. **The plan tier and region** of that project (Dashboard → Settings → Infrastructure / Billing).
4. **Whether the project is currently paused** — free-tier projects pause after 7 days of
   inactivity, and a paused project cannot be read until restored.
5. **Who else holds the `service_role` key** for it — every past developer, agency or contractor.
   That key bypasses RLS entirely, so we plan a rotation once we control the project.
6. **A business-side estimate of how many genuine applications exist**, so we can reconcile against
   the row count and detect spam.
7. **Confirmation that no other system writes to that project** (an old admin panel, a script, a
   Zapier/Make automation).
8. **Access to the DNS registrar** for `gogulf.co`, and the name of the current web host (B4).

If the account is genuinely unrecoverable, say so early — Part C.7 covers that path, and it means
accepting permanent loss of historical candidate documents.

## B.2 Inspection protocol — three tiers, in order

The rule for all of it: **read-only or don't run it.** Nothing below writes.

### Tier 0 — Dashboard only (zero write risk, do this first)

| Where | What to record |
| --- | --- |
| Table Editor → `job_applications` | Row count; earliest and latest `created_at`; visual scan for spam |
| Storage → `job-applications` | Number of folders; total size; spot-check that files open |
| Settings → Infrastructure | Region, Postgres version, compute size |
| Settings → Billing | Plan tier |
| Database → Backups | Whether any backup exists and its date |
| Database → Roles | Any unexpected roles or custom users |
| Advisors → Security | Existing warnings (do not act on them yet) |
| Logs → API / Postgres | Whether the live site is still writing, and at what rate |
| Auth → Users | Should be **empty**. If it is not, someone built something we don't know about |

### Tier 1 — SQL Editor inside an explicitly read-only transaction

Wrapping every query makes accidental writes **impossible** — Postgres raises
`ERROR: cannot execute INSERT in a read-only transaction` rather than executing it.

```sql
begin read only;

-- Volume and date range
select count(*) as rows,
       min(created_at) as earliest,
       max(created_at) as latest
from public.job_applications;

-- Distinct people, by the identifiers we will dedupe on
select count(distinct lower(trim(email)))                         as distinct_emails,
       count(distinct regexp_replace(phone, '[^0-9]', '', 'g'))   as distinct_phone_digits,
       count(*) filter (where email is null or email = '')        as missing_email,
       count(*) filter (where phone is null or phone = '')        as missing_phone
from public.job_applications;

-- Phone shapes we will have to normalise to E.164
select length(regexp_replace(phone, '[^0-9]', '', 'g')) as digit_count,
       count(*)
from public.job_applications
group by 1 order by 1;

-- Repeat applicants (one contact, several cases)
select regexp_replace(phone, '[^0-9]', '', 'g') as phone_digits, count(*) as applications
from public.job_applications
group by 1 having count(*) > 1 order by 2 desc;

-- What roles were applied for
select job_title, job_country, count(*)
from public.job_applications
group by 1, 2 order by 3 desc;

-- Storage inventory, per bucket
select bucket_id,
       count(*)                                                   as objects,
       pg_size_pretty(sum((metadata->>'size')::bigint))           as total_size,
       min(created_at), max(created_at)
from storage.objects
group by bucket_id;

-- Orphans in both directions — rows whose files vanished, files with no row
select count(*) as rows_with_missing_cv
from public.job_applications a
where not exists (
  select 1 from storage.objects o
  where o.bucket_id = 'job-applications' and o.name = a.cv_path
);

select count(*) as objects_with_no_application
from storage.objects o
where o.bucket_id = 'job-applications'
  and split_part(o.name, '/', 1)::uuid not in (select id from public.job_applications);

-- Everything that exists in this database
select table_schema, table_name
from information_schema.tables
where table_schema not in ('pg_catalog', 'information_schema')
order by 1, 2;

-- Existing RLS policies, verbatim
select schemaname, tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname in ('public', 'storage');

commit;
```

Save the full output. It becomes the reconciliation baseline for Part C.

### Tier 2 — Logical export (read-only by construction)

```bash
# Use --db-url, NOT `supabase link`.
# `supabase link` / `migration list` can create a supabase_migrations schema on the
# remote — a write. --db-url bypasses that entirely.

supabase db dump --db-url "$PROD_DB_URL" -f legacy-schema.sql
supabase db dump --db-url "$PROD_DB_URL" --data-only --use-copy -f legacy-data.sql
```

The connection string comes from Dashboard → Settings → Database → Connection string (URI), with
the password percent-encoded. Run `--dry-run` first to see the exact `pg_dump` invocation.

### Tier 3 — Storage export (needs `service_role`; still read-only)

The Supabase CLI's `storage ls` / `storage cp` require `--linked`, so we avoid them on production.
Use the JS client with **only** `list()` and `download()` — both are GET operations, so the script
physically cannot mutate anything.

```js
// tools/export-legacy-storage.mjs — READ ONLY. list() and download() only.
// Run: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node tools/export-legacy-storage.mjs ./export
import { createClient } from '@supabase/supabase-js';
import { mkdir, writeFile, appendFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const out = process.argv[2] ?? './export';
const BUCKET = 'job-applications';
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data: folders, error } = await db.storage.from(BUCKET).list('', { limit: 10000 });
if (error) throw error;

await mkdir(out, { recursive: true });
await writeFile(path.join(out, 'manifest.csv'), 'folder,file,bytes,sha256\n');

for (const folder of folders) {
  const { data: files } = await db.storage.from(BUCKET).list(folder.name, { limit: 1000 });
  await mkdir(path.join(out, folder.name), { recursive: true });
  for (const f of files ?? []) {
    const key = `${folder.name}/${f.name}`;
    const { data: blob } = await db.storage.from(BUCKET).download(key);
    const buf = Buffer.from(await blob.arrayBuffer());
    await writeFile(path.join(out, key), buf);
    const sha = createHash('sha256').update(buf).digest('hex');
    await appendFile(path.join(out, 'manifest.csv'),
      `${folder.name},${f.name},${buf.length},${sha}\n`);
    console.log(key, buf.length);
  }
}
```

I have **not** created this file. Say the word and I will add it under `tools/`.

## B.3 Explicitly forbidden on the production project

Until it is under our control and backed up:

| Never run | Why |
| --- | --- |
| `supabase link` against production | Can create `supabase_migrations` on the remote |
| `supabase db push` / `db reset` / `migration repair` | Writes or destroys schema |
| Any SQL Editor statement outside `begin read only` | One typo is irreversible |
| Changing or deleting RLS policies | Breaks the live `/jobs/apply` form immediately |
| Rotating or deleting the anon key | Same — the live site holds that key |
| Deleting storage objects or buckets | Irreversible; not covered by database backups (Part M.1) |
| Pausing, restoring or upgrading the project | Causes live downtime |
| Supabase **Advisor "fix" buttons** | They apply DDL |

## B.4 Handling the exported PII

The export contains passport scans. Treat it as a regulated dataset:

- Encrypted volume on one named machine. Not a synced cloud folder, not the repo.
- Add `export/`, `*.dump`, `legacy-data.sql` to `.gitignore` **before** the first export runs.
- Never paste rows, filenames or document contents into tickets, chat or an AI tool.
- Delete the working copy once the migration is verified and the archive is sealed (Part L.4).
- Record who ran the export, when, and where the archive lives — this is the first entry in the
  new platform's audit story, even though it predates the platform.

---

# PART C — Legacy data migration strategy

**Principle: copy, never move. Production is read-only until the client signs off on cutover.**

## C.1 Overview

```
LEGACY PROJECT (untouched, still serving the live site)
   job_applications rows ──┐
   job-applications bucket ┘
              │  read-only export (Part B, tiers 2 & 3)
              ▼
   Verified offline archive  ── checksums + manifest ──┐
              │                                        │  sealed, retained
              ▼                                        │  per Part L.4
NEW PROJECT
   legacy.job_applications_import   ← raw, verbatim, never edited
              │  idempotent transform (re-runnable)
              ▼
   contacts · contact_identities · cases · case_recruitment · documents · activities
              │
   storage: gogulf-documents (new path convention, new bucket)
```

## C.2 Step 1 — Inventory and reconcile

From the Tier 1 queries, produce a one-page reconciliation sheet:

- Total rows; date range; rows per month.
- Distinct phones, distinct emails, repeat applicants.
- Storage object count and total bytes; objects per application.
- **Orphans both ways**: rows whose `cv_path`/`passport_path` no longer exist, and stored objects
  with no matching row.
- Suspected spam (the anon-insert policy is open — expect some).

The client confirms the "real applications" figure against this before anything is imported.

## C.3 Step 2 — Snapshot with integrity proof

- `pg_dump` of `public.job_applications` (schema + data).
- Full recursive storage mirror, with a `manifest.csv` carrying **SHA-256 per file**.
- Re-verify every checksum after copying. A passport that silently truncated is worse than one
  that obviously failed.
- Seal the archive; record its location and hash.

## C.4 Step 3 — Raw import, then transform

Import verbatim into a `legacy` schema in the new project, adding nothing:

```sql
create schema legacy;
create table legacy.job_applications_import (
  -- identical columns to the source, plus:
  imported_at    timestamptz not null default now(),
  import_batch   uuid not null,
  transform_state text not null default 'pending',   -- pending|done|needs_review|rejected
  transform_note  text
);
```

Keeping the raw import separate means the transform can be re-run after a bug fix without
re-touching production.

## C.5 Step 4 — Transform into the new model

Per legacy row, inside one transaction:

**a. Normalise the phone.** Default region India (`+91`). If it does not resolve to a valid E.164
number, set `transform_state = 'needs_review'` and **stop for that row**. Never guess a phone
number — a wrong normalisation silently merges two different people.

**b. Resolve or create the contact.** Look up `contact_identities` on
`(type='phone', value_normalized)`. Found → reuse. Not found → create the `contact`, then insert
the phone identity. Then attach the email identity the same way, on
`(type='email', lower(trim(email)))`.

**c. Create the case.**

```
cases.case_type      = 'recruitment'
cases.pipeline_id    = recruitment pipeline
cases.stage_id       = "Legacy — imported, not triaged"   ← a real stage, so nobody
cases.status         = 'open'                                mistakes these for worked leads
cases.opened_at      = legacy created_at                   ← preserve original timing
cases.legacy_id      = legacy row id
cases.owner_id       = null                                ← unassigned, deliberately
```

`case_recruitment` stores `legacy_job_title` and `legacy_job_country` as free text — the historical
vacancies do not exist in the new `jobs` table and must not be invented.

**d. Create documents.**

| Legacy field | New document | Status |
| --- | --- | --- |
| `cv_path` | `type = 'cv'` | `uploaded` |
| `passport_path` | `type = 'passport'` | `uploaded` |
| `other_paths[]` | `type = 'other'`, one row each | `uploaded` |

**Status is `uploaded`, never `approved`.** Nobody verified these documents; recording them as
verified would be a fabricated audit trail. Each row keeps `legacy_path` alongside the new path.

**e. Write the timeline.** One `activities` row per case:
`"Application submitted"`, `occurred_at = legacy created_at`, `actor_type = 'system'`,
`metadata = { imported: true, batch, legacy_id }`. The customer's timeline then starts on the day
they actually applied, not the day we migrated.

**f. Consent.** Legacy applicants consented to a recruitment application, nothing more. Set
`consent_email = true`, and **`consent_whatsapp = false`, `consent_sms = false`,
`consent_marketing = false`** until they re-confirm. Do not manufacture consent — under DPDP that
is the expensive mistake.

**g. Dedupe.** One person who applied to three roles becomes **one contact and three cases**. This
will happen; the reconciliation sheet predicts how often.

## C.6 Step 5 — Storage migration

New bucket `gogulf-documents`, private, with the platform path convention:

```
contacts/{contact_id}/cases/{case_id}/{document_id}.{ext}
```

- Copy from the verified archive, not from the live bucket, so production is never read under load.
- Re-verify SHA-256 after upload; a mismatch fails the row, it does not warn.
- `documents.legacy_path` retains the original key for traceability.
- Sanitised original filename kept in `documents.original_filename` for recruiter recognition.

## C.7 Step 6 — Cutover and delta

1. New platform runs in parallel; the legacy site keeps accepting applications (Part P).
2. On the day the new `/jobs/apply` goes live, run a **delta migration** for rows created after the
   snapshot. The transform is idempotent and keyed on `legacy_id`, so re-running is safe.
3. Immediately after cutover, revoke the anon `INSERT` policy on the legacy project so nothing new
   can arrive there.
4. Legacy project stays **read-only for 90 days** as a fallback.
5. After 90 days and written client sign-off: final archive, then delete. Note Supabase's warning —
   deleting a project permanently removes its backups too.

**If B1 fails and access is never recovered:** the only recoverable artefacts are what current
staff hold in email (the EmailJS notifications carry the applicant's details and the
`submission_id`, but not the files). Historical CVs and passports would be permanently lost. The
new platform still launches — it simply starts with no history. The client should be told this
plainly and early.

---

# PART D — Production environment architecture

## D.1 Topology

```
                         ┌──────────────────────────────────────┐
   Browsers ──── HTTPS ──►  Vercel — Next.js 16 (region bom1)   │
                         │  ├── (marketing)  static / ISR       │
                         │  ├── (portal)     customer session   │
                         │  ├── (admin)      staff session      │
                         │  ├── proxy.js     route guard + CSP  │
                         │  ├── /api/webhooks/*                 │
                         │  └── /api/cron/*   (Vercel Cron)     │
                         └───────┬──────────────────────────────┘
                                 │ server-side only
   ┌─────────────────────────────┼───────────────────────────────┐
   ▼                ▼            ▼              ▼                ▼
Supabase        Resend       Razorpay      WhatsApp          Telephony
ap-south-1      email        payments      Cloud API         (Phase 10)
├ Postgres+RLS  ├ txn mail   ├ Orders      ├ send/receive     ├ inbound
├ Auth          └ webhooks   ├ webhooks    └ webhooks         └ webhooks
├ Storage                    └ refunds
└ Realtime                                    Sentry ◄── errors, all runtimes
```

**Every outbound integration is server-side.** The browser talks to Vercel and, for
RLS-scoped reads only, to Supabase with the user's own session JWT. It never holds a provider key.

## D.2 Environments

| | Production | Staging | Preview (per PR) | Local |
| --- | --- | --- | --- | --- |
| Vercel | `gogulf.co` | `staging.gogulf.co` | auto URL | `next dev` |
| Supabase | prod project, `ap-south-1` | **branch** off prod (Pro feature) | shares staging branch | `supabase start` |
| Resend | `gogulf.co` verified | `staging.gogulf.co` | staging key | console log only |
| Razorpay | **live keys** | test keys | test keys | test keys |
| WhatsApp | live WABA number | Meta test number | test number | mocked |
| Telephony | live DID | mocked | mocked | mocked |
| Sentry | `production` | `staging` | `preview` | disabled |
| Seed data | none | synthetic only | synthetic only | synthetic only |

**Production PII never leaves production.** Staging is seeded with generated data, never with a
copy of the real contacts table.

## D.3 Region strategy

Vercel functions pinned to **`bom1` (Mumbai)**, Supabase in **`ap-south-1` (Mumbai)**. Two reasons,
both material:

1. **Latency.** RLS-heavy CRM screens make several round trips per request. Co-located is single-digit
   milliseconds; Mumbai→Virginia is ~200 ms each way, which compounds into a sluggish admin UI.
2. **Residency.** Passports and payment records for Indian data principals stay in India by default,
   which is the defensible DPDP posture.

Cross-border processing still occurs for email (Resend), WhatsApp (Meta) and error tracking
(Sentry). The existing `#international-transfers` policy section already anticipates this — it
needs the new vendors named, not a new legal position.

## D.4 Secrets matrix

| Variable | Exposure | Environments | Notes |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Public | all | |
| `NEXT_PUBLIC_SUPABASE_URL` | Public | all | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | all | RLS-bounded by design |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server** | all | Webhooks, cron, system jobs **only** — never in a user request path |
| `SUPABASE_DB_URL` | **Server** | CI/migrations | |
| `RESEND_API_KEY` | **Server** | all | |
| `RESEND_FROM_EMAIL` / `RESEND_REPLY_TO` | Server | all | e.g. `no-reply@gogulf.co` / `careers@gogulf.co` |
| `RESEND_WEBHOOK_SECRET` | **Server** | all | Delivery + bounce events |
| `RAZORPAY_KEY_ID` | Public-safe | all | Required by Checkout |
| `RAZORPAY_KEY_SECRET` | **Server** | all | |
| `RAZORPAY_WEBHOOK_SECRET` | **Server** | all | HMAC-SHA256 over the **raw** body |
| `WHATSAPP_PHONE_NUMBER_ID` | Server | all | |
| `WHATSAPP_ACCESS_TOKEN` | **Server** | all | Long-lived system-user token, rotated |
| `WHATSAPP_APP_SECRET` | **Server** | all | Validates `X-Hub-Signature-256` |
| `WHATSAPP_VERIFY_TOKEN` | **Server** | all | Webhook subscription handshake |
| `TELEPHONY_*` | **Server** | Phase 10 | |
| `SENTRY_DSN` / `SENTRY_AUTH_TOKEN` | Public / **Server** | all | DSN is public by design |
| `CRON_SECRET` | **Server** | all | Authenticates Vercel Cron against `/api/cron/*` |

Guardrails: no secret is ever named `NEXT_PUBLIC_*`; CI fails the build if a non-public secret
appears in the client bundle; secrets live in Vercel's encrypted store, never in the repo;
`.env.example` documents names and shapes with empty values.

## D.5 Webhook security — uniform contract

Every inbound webhook, without exception:

1. Read the **raw** body before any JSON parsing (signatures are computed over raw bytes).
2. Verify the provider signature with a timing-safe comparison. Reject with `401` on failure.
3. Insert into `webhook_events` — `UNIQUE (provider, provider_event_id)`. A duplicate insert means
   we have already seen this event: acknowledge `200` and stop.
4. Process inside a transaction; record `processed_at` or the error.
5. Return `2xx` quickly. Slow processing goes to the outbox, because every provider retries on
   timeout.
6. Never trust anything in the payload as authorization — re-read the entity from our own database.

| Provider | Header | Scheme |
| --- | --- | --- |
| Razorpay | `X-Razorpay-Signature` | HMAC-SHA256(raw body, webhook secret) |
| WhatsApp | `X-Hub-Signature-256` | HMAC-SHA256(raw body, app secret) |
| Resend | Svix headers | Svix signature verification |
| Telephony | provider-specific | Signature **and** source-IP allowlist |

---

# PART E — Database schema & ERD

Postgres 17 on Supabase. Conventions: `uuid` primary keys (`gen_random_uuid()`), `timestamptz`
everywhere, money as `bigint` paise, `created_at`/`updated_at` on every table, soft delete via
`deleted_at` on customer-facing entities, RLS enabled on **every** table in `public`.

## E.1 ERD — core spine

```
                         ┌──────────────────┐
                         │    contacts      │  one row per human, ever
                         └────────┬─────────┘
             ┌────────────────────┼────────────────────┐
             ▼                    ▼                    ▼
   ┌──────────────────┐  ┌──────────────┐   ┌────────────────────┐
   │contact_identities│  │  activities  │   │      cases         │
   │ UNIQUE(type,     │  │  (timeline)  │   │ case_type,pipeline │
   │        value_norm)│ └──────────────┘   │ stage,owner,branch │
   └──────────────────┘                     └─────────┬──────────┘
             │                                        │
   phone · email · whatsapp_wa_id                     │
   auth_user · ivr_caller · social                    │
                              ┌─────────────┬─────────┼─────────┬──────────────┐
                              ▼             ▼         ▼         ▼              ▼
                    case_recruitment  case_travel  case_visa  documents    orders
                       │                  │                      │            │
                       ▼                  ▼                      │            ▼
                  jobs·employers   destinations·bookings         │      installments
                  interviews·offers   travelers                  │            │
                                                                 │            ▼
                              tasks · appointments · notes       │    payment_attempts
                              communications · calls             │            │
                                                                 │            ▼
                                                                 │        payments
                                                                 │       ├─ refunds
                                                                 │       └─ invoices
                                                                 ▼
                                                    document_requirements
```

## E.2 Identity & CRM core

```sql
create type lifecycle_stage as enum
  ('subscriber','lead','opportunity','customer','past_customer','disqualified');

create table contacts (
  id                  uuid primary key default gen_random_uuid(),
  full_name           text not null,
  display_name        text,
  primary_phone_e164  text,          -- maintained BY TRIGGER from contact_identities
  primary_email       citext,        -- maintained BY TRIGGER from contact_identities
  lifecycle_stage     lifecycle_stage not null default 'lead',
  source_id           uuid references lead_sources(id),
  campaign_id         uuid references campaigns(id),
  owner_id            uuid references staff_users(id),
  branch_id           uuid references branches(id),
  country_code        char(2),
  nationality         text,
  preferred_language  text default 'en',
  date_of_birth       date,
  gender              text,
  consent_email       boolean not null default false,
  consent_whatsapp    boolean not null default false,
  consent_sms         boolean not null default false,
  consent_calls       boolean not null default false,
  consent_marketing   boolean not null default false,
  consent_updated_at  timestamptz,
  first_touch         jsonb,         -- utm_source/medium/campaign/content, landing_page, referrer
  merged_into_id      uuid references contacts(id),
  legacy_id           uuid,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  last_activity_at    timestamptz,
  deleted_at          timestamptz
);

create type identity_type as enum
  ('phone','email','whatsapp_wa_id','auth_user','ivr_caller','social_handle','job_portal');

create table contact_identities (
  id               uuid primary key default gen_random_uuid(),
  contact_id       uuid not null references contacts(id) on delete cascade,
  type             identity_type not null,
  value_raw        text not null,
  value_normalized text not null,
  is_primary       boolean not null default false,
  verified_at      timestamptz,
  source           text,
  created_at       timestamptz not null default now(),
  constraint uq_identity unique (type, value_normalized)   -- ← the dedup guarantee
);
create index on contact_identities (contact_id);

create table contact_merges (          -- append-only
  id             uuid primary key default gen_random_uuid(),
  winner_id      uuid not null references contacts(id),
  loser_id       uuid not null references contacts(id),
  merged_by      uuid references staff_users(id),
  reason         text,
  snapshot       jsonb not null,       -- full loser record, for reversal
  merged_at      timestamptz not null default now()
);
```

`primary_phone_e164` / `primary_email` are **derived by trigger** from the `is_primary` identity
rows — not independently editable. See correction Q6.

## E.3 Cases

```sql
create type case_type   as enum ('recruitment','travel','visa','tour_booking','support');
create type case_status as enum ('open','won','lost','cancelled');

create table pipelines (
  id uuid primary key default gen_random_uuid(),
  case_type case_type not null, name text not null,
  is_default boolean not null default false, is_active boolean not null default true
);

create table pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  pipeline_id uuid not null references pipelines(id) on delete cascade,
  name text not null, position int not null,
  is_won boolean not null default false, is_lost boolean not null default false,
  sla_hours int,                       -- powers the "stalled case" report
  unique (pipeline_id, position)
);

create table cases (
  id                 uuid primary key default gen_random_uuid(),
  case_number        text not null unique,      -- GG-REC-2026-00184
  contact_id         uuid not null references contacts(id),
  case_type          case_type not null,
  pipeline_id        uuid not null references pipelines(id),
  stage_id           uuid not null references pipeline_stages(id),
  status             case_status not null default 'open',
  owner_id           uuid references staff_users(id),
  branch_id          uuid references branches(id),
  value_amount_paise bigint,
  priority           smallint default 3,
  legacy_id          uuid,
  opened_at          timestamptz not null default now(),
  stage_entered_at   timestamptz not null default now(),
  closed_at          timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz
);
create index on cases (contact_id);
create index on cases (owner_id, status);
create index on cases (pipeline_id, stage_id);

create table case_recruitment (
  case_id uuid primary key references cases(id) on delete cascade,
  job_id uuid references jobs(id),
  employer_id uuid references employers(id),
  legacy_job_title text, legacy_job_country text,
  expected_salary_paise bigint, years_experience numeric(4,1),
  passport_number_last4 text                       -- never the full number
);

create table case_travel (
  case_id uuid primary key references cases(id) on delete cascade,
  destination_id uuid references destinations(id),
  depart_date date, return_date date,
  pax_adults int default 1, pax_children int default 0,
  budget_paise bigint
);

create table case_visa (
  case_id uuid primary key references cases(id) on delete cascade,
  visa_type text, country_code char(2), application_ref text, submitted_at timestamptz
);
```

## E.4 Timeline, work management, communications

```sql
create table activities (              -- append-only; the Customer 360 spine
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references contacts(id) on delete cascade,
  case_id    uuid references cases(id) on delete cascade,
  actor_type text not null,            -- staff | customer | system | provider
  actor_id   uuid,
  verb       text not null,            -- case.created, stage.changed, document.uploaded …
  entity_type text, entity_id uuid,
  summary    text not null,            -- pre-rendered, so the timeline needs no joins
  metadata   jsonb not null default '{}',
  occurred_at timestamptz not null default now()
);
create index on activities (contact_id, occurred_at desc);
create index on activities (case_id, occurred_at desc);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null, description text,
  assignee_id uuid references staff_users(id),
  contact_id uuid references contacts(id), case_id uuid references cases(id),
  priority smallint default 3, status text not null default 'open',
  due_at timestamptz, completed_at timestamptz, completed_by uuid references staff_users(id),
  branch_id uuid references branches(id),
  created_by uuid references staff_users(id), created_at timestamptz not null default now()
);

create table appointments (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references cases(id), contact_id uuid references contacts(id),
  kind text not null,                  -- interview | medical | office_visit | call_back
  starts_at timestamptz not null, ends_at timestamptz,
  location text, meeting_url text, status text not null default 'scheduled',
  owner_id uuid references staff_users(id), branch_id uuid references branches(id)
);

create table notes (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references contacts(id), case_id uuid references cases(id),
  body text not null,
  visibility text not null default 'team',   -- team | hr_private | finance_private
  author_id uuid references staff_users(id),
  created_at timestamptz not null default now()
);

create type comm_channel   as enum ('email','whatsapp','sms','call','in_person','note');
create type comm_direction as enum ('inbound','outbound');

create table communications (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references contacts(id), case_id uuid references cases(id),
  channel comm_channel not null, direction comm_direction not null,
  provider text, provider_message_id text,
  template_key text, subject text, body_preview text,
  status text,                          -- queued|sent|delivered|read|failed|bounced
  status_updated_at timestamptz,
  agent_id uuid references staff_users(id),
  consent_basis text,                   -- what permitted this outbound send
  metadata jsonb not null default '{}',
  occurred_at timestamptz not null default now(),
  unique (provider, provider_message_id)
);

create table calls (
  id uuid primary key default gen_random_uuid(),
  communication_id uuid references communications(id),
  contact_id uuid references contacts(id),
  provider text, provider_call_id text unique,
  from_e164 text, to_e164 text, direction comm_direction not null,
  ivr_path text[], department text,
  agent_id uuid references staff_users(id),
  answered boolean, duration_seconds int, recording_path text,
  outcome text, notes text,
  started_at timestamptz, ended_at timestamptz
);
```

## E.5 System tables

```sql
create table audit_logs (              -- immutable
  id uuid primary key default gen_random_uuid(),
  actor_type text not null, actor_id uuid, actor_label text,
  action text not null,                -- user.role_changed, payment.refunded …
  entity_type text not null, entity_id uuid,
  old_values jsonb, new_values jsonb,  -- redacted: never secrets, OTPs or document bytes
  ip_address inet, user_agent text,
  occurred_at timestamptz not null default now()
);
create index on audit_logs (entity_type, entity_id, occurred_at desc);

create table events (                  -- the automation bus, append-only
  id uuid primary key default gen_random_uuid(),
  event_type text not null,            -- payment.succeeded, document.uploaded …
  payload jsonb not null,
  occurred_at timestamptz not null default now()
);

create table outbox (                  -- reliable side effects
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events(id),
  handler text not null, payload jsonb not null,
  status text not null default 'pending',
  attempts int not null default 0, next_attempt_at timestamptz not null default now(),
  last_error text, processed_at timestamptz
);
create index on outbox (status, next_attempt_at);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_staff_id uuid references staff_users(id),
  recipient_contact_id uuid references contacts(id),
  title text not null, body text, link_url text,
  read_at timestamptz, created_at timestamptz not null default now()
);

create table settings (
  key text primary key, value jsonb not null,
  updated_by uuid references staff_users(id), updated_at timestamptz not null default now()
);
```

## E.6 Indexing and integrity notes

- `contact_identities (type, value_normalized)` — the unique index doubles as the resolution lookup.
- `activities (contact_id, occurred_at desc)` — the single most-hit index in the product.
- Partial index `cases (owner_id) where status = 'open' and deleted_at is null` for "my open cases".
- `case_number` generated by a Postgres sequence per type per year, so numbers are gapless.
- `updated_at` maintained by trigger, never by application code.
- Every foreign key indexed — Postgres does not do this automatically, and it makes deletes crawl.

---

# PART F — Customer 360 requirement (formal)

**REQ-C360-01.** One contact record exposes, on one screen, without navigating away:

| Panel | Source | Must show |
| --- | --- | --- |
| Identity | `contacts`, `contact_identities` | Name, all phones/emails/WhatsApp IDs with verified state, language, nationality, branch, owner |
| Consent | `contacts.consent_*` | Per-channel state and when it last changed |
| Cases | `cases` + type extensions | Every case, type, pipeline, current stage, days in stage, owner |
| Applications | `case_recruitment` | Role, employer, country, current recruitment stage |
| Payments | `orders`, `installments`, `payments` | Total contracted, paid, outstanding, next due date and amount |
| Documents | `documents` | Type, status, uploaded date, verifier, expiry, what is still outstanding |
| Communications | `communications` | Every email, WhatsApp, SMS and note — inbound and outbound, with delivery state |
| Calls | `calls` | Date, direction, duration, IVR path, agent, outcome |
| Tasks | `tasks` | Open and completed, assignee, due date, overdue flag |
| Appointments | `appointments` | Upcoming and past interviews, medicals, office visits |
| **Timeline** | `activities` | All of the above merged, reverse-chronological, filterable by type |

**REQ-C360-02.** The timeline is complete: every state change writes an `activities` row in the
same transaction as the change itself. A change that does not appear on the timeline is a defect.

**REQ-C360-03.** The timeline renders **without joining eight tables at read time** — `activities`
carries a pre-rendered `summary`.

**REQ-C360-04.** The page respects RLS and permission scope: a `RECRUITER` viewing a contact they
don't own sees nothing, and an `ACCOUNTS` user never sees `hr_private` notes.

**REQ-C360-05.** First contentful render of a contact with 500 timeline entries: **under 800 ms**
at p95, paginated at 50 entries.

**REQ-C360-06.** The customer sees their own version of the same data in the portal, filtered to
what is appropriate — internal notes, staff assignment reasoning and internal task detail are never
exposed.

---

# PART G — Identity resolution requirement (formal)

**REQ-ID-01. Normalisation.** Before storage: phones to **E.164** (default region India);
emails lowercased and trimmed; WhatsApp IDs stored as the provider's `wa_id`, which is digits
without `+`, normalised to the same E.164 form. Normalisation happens in **one Postgres function**,
not in application code — so every write path produces identical values.

**REQ-ID-02. Uniqueness.** `UNIQUE (type, value_normalized)` on `contact_identities`. Two contacts
sharing a verified phone number is not an error to detect later; it is a state the database refuses
to enter.

**REQ-ID-03. Resolution order.** For every inbound touch:

```
1. Match WhatsApp wa_id        → exact, provider-supplied, highest confidence
2. Match phone (E.164)         → exact
3. Match email (normalised)    → exact
4. No match → create contact + identity, record the source
```

**REQ-ID-04. Never fuzzy-merge automatically.** Name similarity, shared address or same employer
may **suggest** a duplicate. Merging requires a human with `contacts.merge` permission. Automatic
fuzzy merging of people who share a name is how a CRM sends one candidate's passport to another.

**REQ-ID-05. Merge is reversible.** `contact_merges` stores a full JSON snapshot of the losing
record; `contacts.merged_into_id` preserves the pointer; nothing is hard-deleted.

**REQ-ID-06. Multi-value by default.** A contact may hold many phones and emails; exactly one of
each may be `is_primary`. Changing the primary is an audited action.

**REQ-ID-07. Verification is tracked separately from existence.** An identity captured from a form
is unverified; one that passed OTP has `verified_at` set. Only **verified** identities may be used
to authenticate into the portal.

**REQ-ID-08. Shared numbers.** A household or agent number legitimately reaching several people
is flagged for review rather than silently merged. Staff can mark an identity `is_shared`, which
excludes it from automatic resolution.

**REQ-ID-09. Legacy import.** Any phone that fails E.164 normalisation is quarantined for manual
review. Never guessed (Part C.5a).

---

# PART H — Payment ledger requirement (formal)

**REQ-PAY-01. Append-only.** Ledger rows are inserted, never edited. A correction is a new row.
Balances are derived, so history is always reconstructable and auditable.

**REQ-PAY-02. Integer paise.** All money is `bigint` in paise, with an explicit `currency`. No
floating point anywhere, including in reports.

**REQ-PAY-03. Webhooks are authoritative.** The Razorpay webhook is the only thing that may mark a
payment captured. The browser's success callback updates the UI and nothing else.

**REQ-PAY-04. Idempotent.** `webhook_events UNIQUE (provider, provider_event_id)`. Replays are
absorbed by the constraint, not by application logic.

**REQ-PAY-05. Verified.** HMAC-SHA256 over the raw body, timing-safe comparison, before parsing.

**REQ-PAY-06. Every attempt is recorded** — including failures, with the provider's failure reason.
"Why did my payment fail?" is a support question that must be answerable.

## H.1 Schema

```sql
create table orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  contact_id uuid not null references contacts(id),
  case_id uuid references cases(id),
  description text not null,
  subtotal_paise bigint not null,
  tax_paise bigint not null default 0,
  total_amount_paise bigint not null,
  currency char(3) not null default 'INR',
  status text not null default 'draft',      -- draft|active|completed|cancelled
  razorpay_order_id text unique,
  created_by uuid references staff_users(id),
  branch_id uuid references branches(id),
  created_at timestamptz not null default now()
);

create table installments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  seq int not null,
  label text,                                 -- "Registration", "Visa processing"
  amount_paise bigint not null,
  due_date date,
  status text not null default 'pending',     -- pending|due|paid|partial|overdue|waived
  paid_paise bigint not null default 0,
  waived_by uuid references staff_users(id), waived_reason text,
  unique (order_id, seq)
);

create table payment_attempts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id),
  installment_id uuid references installments(id),
  razorpay_payment_id text unique,
  amount_paise bigint not null,
  method text, status text not null,          -- created|authorized|captured|failed
  failure_code text, failure_reason text,
  raw jsonb, attempted_at timestamptz not null default now()
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id),
  installment_id uuid references installments(id),
  attempt_id uuid references payment_attempts(id),
  amount_paise bigint not null,
  method text, bank_reference text,
  razorpay_payment_id text not null unique,
  captured_at timestamptz not null,
  recorded_by uuid references staff_users(id), -- null = webhook (the normal case)
  created_at timestamptz not null default now()
);

create table refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references payments(id),
  amount_paise bigint not null,
  reason text not null,
  status text not null default 'pending',     -- pending|processing|processed|failed
  razorpay_refund_id text unique,
  requested_by uuid references staff_users(id),
  approved_by uuid references staff_users(id),  -- must differ from requested_by
  approved_at timestamptz, processed_at timestamptz
);

create table invoices (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id),
  invoice_number text not null unique,        -- gapless, per financial year
  financial_year text not null,               -- '2026-27'
  issued_at timestamptz not null,
  place_of_supply text not null,              -- GST state code
  supplier_gstin text not null,               -- from lib/legal.js
  customer_gstin text,
  subtotal_paise bigint not null,
  cgst_paise bigint not null default 0,
  sgst_paise bigint not null default 0,
  igst_paise bigint not null default 0,
  total_paise bigint not null,
  pdf_path text, status text not null default 'issued',   -- issued|cancelled
  cancelled_reason text
);

create table invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  description text not null, sac_code text,
  quantity numeric(10,2) not null default 1,
  unit_amount_paise bigint not null,
  tax_rate numeric(5,2) not null default 18.00,
  line_total_paise bigint not null
);

create table webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  signature_valid boolean not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz, error text,
  unique (provider, provider_event_id)
);
```

## H.2 Derived balance (never stored)

```sql
create view order_balances as
select o.id as order_id, o.total_amount_paise,
       coalesce(sum(p.amount_paise), 0)                                   as paid_paise,
       coalesce(sum(r.amount_paise), 0)                                   as refunded_paise,
       o.total_amount_paise - coalesce(sum(p.amount_paise), 0)
                            + coalesce(sum(r.amount_paise), 0)            as outstanding_paise
from orders o
left join payments p on p.order_id = o.id
left join refunds  r on r.payment_id = p.id and r.status = 'processed'
group by o.id;
```

## H.3 Refund control

Refunds require **two people**: one with `refunds.create`, a different one with `refunds.approve`
(enforced by a check that `approved_by <> requested_by`). Every refund writes an `audit_logs` row.
Only `FINANCE_MANAGER` and above may approve.

## H.4 GST invoicing — needs client input (decision I6)

An Indian private limited company with a GSTIN must issue tax invoices carrying: supplier GSTIN,
place of supply, SAC code per line, the CGST/SGST or IGST split, and a **consecutive, gapless serial
number per financial year**. Invoice numbering cannot be retrofitted without re-issuing history, so
the series format is confirmed before the first invoice is issued. Required from the client: the
SAC code(s) for recruitment and travel services, and whether overseas-employer billing is treated as
export of services (which changes the tax treatment).

---

# PART I — Document security requirement (formal)

**REQ-DOC-01. Private storage only.** All buckets `public = false`. No document is reachable by
URL without a signed, time-limited token. There is no "unlisted but public" tier.

**REQ-DOC-02. Server-authorized signed URLs.** A signed URL is minted **only** by a server route
that has already: authenticated the caller, confirmed permission for that document's category,
confirmed scope (own / branch / all), and written an access record. Signed URLs expire in
**5 minutes**, are single-purpose, and are never emailed or logged.

**REQ-DOC-03. Every access is recorded.** `document_access_log` captures who opened which document,
when, from which IP. For passport data this is the difference between a controlled system and an
unaccountable one.

**REQ-DOC-04. Server-side validation.** MIME type sniffed from content, not from the filename or
the client's `Content-Type`; extension allow-list; size cap enforced server-side as well as in the
bucket; filenames sanitised and never used as storage keys (the key is the document UUID).

**REQ-DOC-05. Verification workflow.**
`requested → uploaded → under_review → approved | rejected → expired`, with `verified_by`,
`verified_at` and `rejection_reason` recorded. Only `documents.verify` holders may approve.

**REQ-DOC-06. Expiry tracking.** Passports and visas carry `expires_at`. A daily job flags documents
expiring within 90 / 30 / 7 days, creates a task for the owner, and notifies the customer if
consented. A candidate deployed on an expiring passport is a live operational failure.

**REQ-DOC-07. Category-scoped permissions.** `identity` (passport, ID), `employment` (CV,
certificates), `financial` (receipts, bank), `travel` (visa, tickets), `medical`. Permissions are
granted per category — which is how `ACCOUNTS` can see financial documents without opening
passports, and `MARKETING_MANAGER` sees none.

**REQ-DOC-08. Customer access.** A customer may view and download **only** documents attached to
their own contact. Enforced by RLS on the metadata table *and* by the signing route.

**REQ-DOC-09. Deletion.** Deleting a document soft-deletes the row, moves the object to a
quarantine prefix, and purges it after the retention window (Part L). Storage objects are **not**
covered by database backups (Part M.1), so deletion is genuinely irreversible — it is gated on
`documents.delete`, which almost nobody holds.

```sql
create type document_status   as enum
  ('requested','uploaded','under_review','approved','rejected','expired');
create type document_category as enum
  ('identity','employment','financial','travel','medical','other');

create table documents (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts(id),
  case_id uuid references cases(id),
  category document_category not null,
  doc_type text not null,                      -- passport | cv | photo | visa | receipt …
  status document_status not null default 'requested',
  storage_path text,                           -- contacts/{c}/cases/{k}/{doc_id}.{ext}
  legacy_path text,
  original_filename text, mime_type text, size_bytes bigint, sha256 text,
  uploaded_by_staff uuid references staff_users(id),
  uploaded_by_contact uuid references contacts(id),
  uploaded_at timestamptz,
  verified_by uuid references staff_users(id), verified_at timestamptz,
  rejection_reason text,
  issued_on date, expires_at date,
  notes text, branch_id uuid references branches(id),
  created_at timestamptz not null default now(), deleted_at timestamptz
);

create table document_requirements (           -- drives "what's still missing"
  id uuid primary key default gen_random_uuid(),
  case_type case_type not null, doc_type text not null,
  category document_category not null,
  is_mandatory boolean not null default true,
  requires_expiry boolean not null default false,
  instructions text
);

create table document_access_log (             -- append-only
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id),
  accessed_by_staff uuid references staff_users(id),
  accessed_by_contact uuid references contacts(id),
  action text not null,                        -- view | download | sign_url
  ip_address inet, user_agent text,
  occurred_at timestamptz not null default now()
);
```

---

# PART J — RBAC + RLS matrix

## J.1 Model

- **Permission** = capability string (`contacts.view`). ~50 of them, seeded by migration.
- **Scope** = `all` | `branch` | `own`, stored on the **grant**, not baked into the name.
- **Role** = a named bundle of (permission, scope) grants.
- **`user_roles`** may pin a role to a branch, so one person can be HR_MANAGER in Lucknow only.

## J.2 Matrix

Legend: **A** = all records · **B** = branch · **O** = own/assigned · **✓** = unscoped capability ·
**–** = denied.

| Permission | SA | AD | HRM | REC | TVM | TVA | FIN | ACC | OPS | SUP | MKT | VO |
| --- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| `contacts.view` | A | A | B | O | B | O | A | B | B | B | B | B |
| `contacts.create` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | – | – | ✓ | ✓ | ✓ | – |
| `contacts.update` | A | A | B | O | B | O | – | – | B | O | – | – |
| `contacts.delete` | A | A | – | – | – | – | – | – | – | – | – | – |
| `contacts.merge` | A | A | B | – | B | – | – | – | B | – | – | – |
| `contacts.assign` | A | A | B | – | B | – | – | – | B | – | – | – |
| `contacts.export` | A | A | – | – | – | – | – | – | – | – | – | – |
| `notes.team.view` | A | A | B | O | B | O | B | B | B | B | – | B |
| `notes.hr_private.*` | A | A | B | – | – | – | – | – | – | – | – | – |
| `notes.finance_private.*` | A | A | – | – | – | – | A | B | – | – | – | – |
| `cases.view` | A | A | B | O | B | O | A | B | B | B | – | B |
| `cases.create` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | – | – | ✓ | ✓ | – | – |
| `cases.update` | A | A | B | O | B | O | – | – | B | – | – | – |
| `cases.stage.change` | A | A | B | O | B | O | – | – | B | – | – | – |
| `cases.assign` | A | A | B | – | B | – | – | – | B | – | – | – |
| `cases.close` | A | A | B | – | B | – | – | – | B | – | – | – |
| `cases.delete` | A | A | – | – | – | – | – | – | – | – | – | – |
| `jobs.view` | A | A | A | A | – | – | – | – | A | A | A | A |
| `jobs.manage` | ✓ | ✓ | ✓ | – | – | – | – | – | ✓ | – | – | – |
| `employers.view` | A | A | A | B | – | – | A | B | A | – | – | B |
| `employers.manage` | ✓ | ✓ | ✓ | – | – | – | – | – | – | – | – | – |
| `interviews.manage` | A | A | B | O | – | – | – | – | B | – | – | – |
| `offers.manage` | A | A | B | – | – | – | – | – | B | – | – | – |
| `travel.manage` | A | A | – | – | B | O | – | – | B | – | – | – |
| `bookings.view` | A | A | – | – | B | O | A | B | B | B | – | B |
| `bookings.manage` | A | A | – | – | B | O | – | – | B | – | – | – |
| `documents.view.identity` | A | A | B | O | B | O | – | – | B | – | – | – |
| `documents.view.employment` | A | A | B | O | B | O | – | – | B | B | – | – |
| `documents.view.financial` | A | A | – | – | – | – | A | B | B | – | – | – |
| `documents.view.travel` | A | A | B | O | B | O | – | – | B | B | – | – |
| `documents.view.medical` | A | A | B | – | – | – | – | – | B | – | – | – |
| `documents.upload` | A | A | B | O | B | O | B | B | B | B | – | – |
| `documents.verify` | A | A | B | – | B | – | – | – | B | – | – | – |
| `documents.download` | A | A | B | O | B | O | B | B | B | – | – | – |
| `documents.delete` | A | A | – | – | – | – | – | – | – | – | – | – |
| `orders.view` | A | A | B | O | B | O | A | B | B | B | – | B |
| `orders.create` | ✓ | ✓ | ✓ | – | ✓ | – | ✓ | ✓ | – | – | – | – |
| `payments.view` | A | A | B | O | B | O | A | B | B | B | – | B |
| `payments.record` | ✓ | ✓ | – | – | – | – | ✓ | ✓ | – | – | – | – |
| `installments.manage` | A | A | – | – | – | – | A | B | – | – | – | – |
| `refunds.create` | ✓ | ✓ | – | – | – | – | ✓ | ✓ | – | – | – | – |
| `refunds.approve` | ✓ | ✓ | – | – | – | – | ✓ | – | – | – | – | – |
| `invoices.view` | A | A | B | – | B | – | A | B | B | – | – | B |
| `invoices.issue` | ✓ | ✓ | – | – | – | – | ✓ | ✓ | – | – | – | – |
| `invoices.void` | ✓ | ✓ | – | – | – | – | ✓ | – | – | – | – | – |
| `payments.reconcile` | ✓ | ✓ | – | – | – | – | ✓ | ✓ | – | – | – | – |
| `communications.view` | A | A | B | O | B | O | B | B | B | B | – | B |
| `communications.send` | A | A | B | O | B | O | B | B | B | B | – | – |
| `whatsapp.reply` | A | A | B | O | B | O | – | – | B | B | – | – |
| `calls.view` | A | A | B | O | B | O | – | – | B | B | – | B |
| `calls.log` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | – | – | ✓ | ✓ | – | – |
| `templates.manage` | ✓ | ✓ | ✓ | – | ✓ | – | – | – | ✓ | – | ✓ | – |
| `campaigns.manage` | ✓ | ✓ | – | – | – | – | – | – | – | – | ✓ | – |
| `lead_sources.manage` | ✓ | ✓ | – | – | – | – | – | – | ✓ | – | ✓ | – |
| `tasks.view` | A | A | B | O | B | O | B | B | B | O | O | B |
| `tasks.manage` | A | A | B | O | B | O | B | B | A | O | O | – |
| `appointments.manage` | A | A | B | O | B | O | – | – | B | O | – | – |
| `reports.operational` | A | A | B | O | B | O | A | B | A | B | B | B |
| `reports.financial` | A | A | – | – | – | – | A | B | – | – | – | – |
| `reports.marketing` | A | A | B | – | B | – | – | – | B | – | A | B |
| `reports.staff_performance` | A | A | B | – | B | – | – | – | B | – | – | – |
| `imports.run` | ✓ | ✓ | ✓ | – | ✓ | – | – | – | ✓ | – | ✓ | – |
| `users.manage` | ✓ | ✓ | – | – | – | – | – | – | – | – | – | – |
| `roles.manage` | ✓ | – | – | – | – | – | – | – | – | – | – | – |
| `permissions.manage` | ✓ | – | – | – | – | – | – | – | – | – | – | – |
| `settings.manage` | ✓ | ✓ | – | – | – | – | – | – | – | – | – | – |
| `integrations.manage` | ✓ | – | – | – | – | – | – | – | – | – | – | – |
| `audit.view` | ✓ | ✓ | – | – | – | – | ✓ | – | – | – | – | – |

### Deliberate exclusions, and why

| Denial | Reason |
| --- | --- |
| `ACCOUNTS` / `FINANCE_MANAGER` → `documents.view.identity` | Finance never needs to open a passport. Explicitly required by the brief |
| `ACCOUNTS` / `FINANCE_MANAGER` → `notes.hr_private.*` | HR assessments are not finance's business |
| `MARKETING_MANAGER` → any document, any payment | Marketing works with aggregates and campaigns, not candidate PII |
| `SUPPORT_AGENT` → `documents.view.identity`, all finance write | Support answers questions; it does not handle passports or money |
| `RECRUITER` → `documents.verify` | Separation of duties: the person progressing a candidate does not also approve their documents |
| `ADMIN` → `roles.manage`, `permissions.manage`, `integrations.manage` | Privilege escalation guard. Only `SUPER_ADMIN` can change who can do what |
| Everyone → `audit_logs` UPDATE/DELETE | No policy exists. The table is append-only for every role including `SUPER_ADMIN` |
| Everyone except `SA`/`AD` → `contacts.export` | Bulk PII extraction is the single highest-impact insider risk |

## J.3 RLS implementation

Per correction **Q3**: the JWT carries small, stable identity claims; **permissions are resolved in
the database**, so a revoked grant takes effect on the next query rather than after the token
expires.

```sql
-- Injected at token issue: staff_id, role, branch_id. Nothing more.
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb language plpgsql stable as $$
declare claims jsonb; su record;
begin
  select id, role_key, branch_id into su
  from public.staff_users where auth_user_id = (event->>'user_id')::uuid;

  claims := event->'claims';
  if su.id is not null then
    claims := jsonb_set(claims, '{app_staff_id}', to_jsonb(su.id));
    claims := jsonb_set(claims, '{app_role}',     to_jsonb(su.role_key));
    claims := jsonb_set(claims, '{app_branch}',   to_jsonb(su.branch_id));
  end if;
  return jsonb_set(event, '{claims}', claims);
end; $$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook from authenticated, anon, public;

-- Permission check: live against the DB, cached per statement by Postgres.
create or replace function public.has_perm(perm text, required_scope text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.role_permissions rp
    join public.permissions p on p.id = rp.permission_id
    where rp.role_key = (auth.jwt() ->> 'app_role')
      and p.key = perm
      and case required_scope
            when 'own'    then rp.scope in ('own','branch','all')
            when 'branch' then rp.scope in ('branch','all')
            else               rp.scope = 'all'
          end
  );
$$;

create or replace function public.current_staff_id() returns uuid
language sql stable as $$ select nullif(auth.jwt() ->> 'app_staff_id','')::uuid $$;

create or replace function public.current_branch_id() returns uuid
language sql stable as $$ select nullif(auth.jwt() ->> 'app_branch','')::uuid $$;

create or replace function public.current_contact_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select ci.contact_id from public.contact_identities ci
  where ci.type = 'auth_user' and ci.value_normalized = auth.uid()::text
$$;
```

**Staff read template** (applied to `contacts`, `cases`, `documents`, `tasks`, `communications`,
`orders`, `payments` — same shape, different permission string):

```sql
create policy "staff read contacts" on contacts for select to authenticated
using (
  deleted_at is null and (
       has_perm('contacts.view','all')
    or (has_perm('contacts.view','branch') and branch_id = current_branch_id())
    or (has_perm('contacts.view','own')    and owner_id  = current_staff_id())
  )
);

create policy "staff update contacts" on contacts for update to authenticated
using (
       has_perm('contacts.update','all')
    or (has_perm('contacts.update','branch') and branch_id = current_branch_id())
    or (has_perm('contacts.update','own')    and owner_id  = current_staff_id())
)
with check (   -- prevents moving a record out of your own scope to escape the policy
       has_perm('contacts.update','all')
    or (has_perm('contacts.update','branch') and branch_id = current_branch_id())
);
```

**Customer template** — simple by design, so it is easy to prove correct:

```sql
create policy "customer reads own cases" on cases for select to authenticated
using (contact_id = current_contact_id());

create policy "customer reads own documents" on documents for select to authenticated
using (contact_id = current_contact_id() and deleted_at is null);
```

**Audit immutability** — the absence of a policy is the control:

```sql
alter table audit_logs enable row level security;
create policy "read audit" on audit_logs for select to authenticated using (has_perm('audit.view','all'));
-- No INSERT policy: writes come from SECURITY DEFINER triggers only.
-- No UPDATE policy. No DELETE policy. For anyone. Ever.
```

## J.4 RLS test matrix (Phase 14 gate, written in Phase 1)

Automated tests, one per cell, asserting **allow** and **deny** for all 12 roles:

1. Customer A cannot read Customer B's cases, documents, payments or communications — by direct
   query, by ID guess, and by API route.
2. `RECRUITER` cannot read a contact owned by another recruiter.
3. `HR_MANAGER` in branch X cannot read branch Y.
4. `ACCOUNTS` receives zero rows querying `documents` where `category = 'identity'`.
5. `MARKETING_MANAGER` receives zero rows from `payments` and `documents`.
6. `VIEW_ONLY` receives a permission error on every mutation, at both the route and the database.
7. `ADMIN` cannot grant themselves `roles.manage`.
8. No role can `UPDATE` or `DELETE` `audit_logs`.
9. An anonymous request reaches nothing but published jobs and public marketing content.
10. A staff member removed from Google Workspace loses access on their next request.

---

# PART K — Legal & privacy migration checklist

Every item below is a **published factual statement that becomes false** when the corresponding
feature ships. Grouped by the release that breaks it.

## K.1 Breaks when authentication ships (Phase 3)

| Location | Current published text | Required change |
| --- | --- | --- |
| `#cookies` | "This website does not set cookies of its own" | **False** once sessions exist. Rewrite to describe strictly-necessary session cookies, their purpose and lifetime |
| `#cookies` | "There is no login and no user account" | **False.** Describe the customer portal, phone+OTP authentication and what is stored |
| `#cookies` | "we do not need a cookie banner" | Re-assess. Strictly-necessary cookies generally need no consent banner, but the claim must be re-justified, not inherited |
| `#security` | "the storage rules permit submissions to be written but not read back by the public" | Becomes an inaccurate description once access is server-mediated with signed URLs. Rewrite |
| `#security` | "treat any message that asks for an OTP or password as fraudulent" | Needs nuance: we will *send* login OTPs. Reword to "we will never ask you to *share* an OTP with anyone, including our staff" |
| `#what-we-collect` | — | Add: authentication identifiers, login timestamps, device/IP for security |
| New section | — | Add an account/portal section: what an account is, how to close it, what happens to data on closure |

## K.2 Breaks when Resend ships (Phase 1.5)

| Location | Change |
| --- | --- |
| `#third-parties` | **Remove EmailJS. Add Resend.** The list is prefaced "This is the complete list… There are no others" — so it must be exactly right |
| `#third-parties` | Add Vercel (hosting/processing) and Sentry (error diagnostics) — both process personal data |
| `#international-transfers` | Names the section-10 list; it inherits the additions automatically, but re-read it once updated |

## K.3 Breaks when payments ship (Phase 7)

| Location | Change |
| --- | --- |
| `#payments` | Substance already holds (it anticipates a regulated gateway). **Name Razorpay** and confirm exactly which fields return to us |
| `#third-parties` | Add Razorpay |
| `#retention` | Replace "the period Indian tax law requires" with the concrete period once retention automation exists (Part L.2) |
| `/pricing`, `/cancellation-and-refunds` | Re-verify against actual implemented refund behaviour. `REFUND_BANK_CREDIT_WINDOW` must match what Razorpay really does |

## K.4 Breaks when WhatsApp / IVR ship (Phases 9–10)

| Location | Change |
| --- | --- |
| `#third-parties` | Extend the WhatsApp entry: we now *send* template messages via the Business API, and store conversations |
| `#third-parties` | Add the telephony provider |
| New | **Call recording**, if enabled, requires disclosure and — under Indian practice — an announcement at the start of the call. Confirm whether recording is wanted (decision, not assumption) |
| `#how-we-use` | Add automated notifications and the consent basis for each channel |
| `#withdraw-consent` | Must describe per-channel opt-out, matching the `consent_*` fields actually implemented |

## K.5 DPDP Act 2023 — required regardless of phase

| Requirement | Current state | Action |
| --- | --- | --- |
| Named Grievance Officer | Section exists; **no named person** | Name one, with title and monitored address (decision I7) |
| Consent notice at collection | Implicit | Add an explicit, itemised consent notice at signup and on every form |
| Consent records | None | `contacts.consent_*` + `consent_updated_at` + audit trail. Phase 1 |
| Data-principal requests (access, correction, erasure) | Email-based only | Build a portal request flow + an SLA-tracked internal queue. Phase 3 |
| Right to nominate | Not covered | Add to the policy |
| Breach notification process | Policy commits to it | Needs a written internal runbook, not just a promise |
| Children's data | Section exists | Confirm the platform's minimum age and enforce it at signup |

## K.6 Process rules

1. **Legal changes ship in the same release as the feature that makes them necessary.** Never after.
2. `POLICY_EFFECTIVE_DATE` and `POLICY_EFFECTIVE_ISO` in `lib/legal.js` are bumped together on
   every substantive change.
3. `public/llms.txt` mirrors the legal facts — update it in the same commit or it contradicts the
   policy pages to AI crawlers.
4. Every published version of the policy is archived (git history suffices) so we can show what a
   given customer agreed to on a given date.
5. **Do not touch the values in `lib/legal.js`.** They are transcribed from the GST certificate.
6. `/pricing`, `/cancellation-and-refunds` and `/shipping-policy` back a Razorpay merchant
   verification — changes to them are reviewed against that, not just for style.

---

# PART L — Retention, deletion & export strategy

## L.1 Principles

Retention is enforced by **scheduled jobs and database state**, not by good intentions. Every record
has an owner, a purpose and a defined end. Legal holds override deletion, and say so to the customer.

## L.2 Proposed schedule — needs sign-off (decision I8)

| Data | Retention | Trigger | Basis |
| --- | --- | --- | --- |
| Unconverted lead (no case) | 24 months from last activity | Auto-anonymise | Legitimate follow-up window |
| Candidate profile, active | While active + 24 months | Auto-flag for review | Matching to future roles — the current policy already says this |
| Identity documents (passport, ID) | **12 months** after case closes, unless a placement completed | Auto-purge, notify first | Minimise the highest-risk data |
| Documents for a completed placement | 7 years | Manual review | Employer/authority queries, claim defence |
| Financial records, invoices, tax | **8 years** | Never auto-deleted | Companies Act 2013 / income-tax requirements |
| Payment gateway references | 8 years, with the financial record | — | Reconciliation and audit |
| Communications (email/WhatsApp/SMS) | 3 years from last message | Auto-purge body, keep metadata | Dispute resolution |
| Call recordings (if enabled) | 6 months | Auto-purge | Minimisation; long retention is hard to justify |
| Audit logs | 8 years | **Never deleted**, partitioned by year | Immutability is the point |
| `webhook_events` payloads | 90 days for the raw payload; the event row is permanent | Auto-strip payload | Payloads are bulky and contain PII |
| Sentry error data | 90 days | Vendor default | Diagnostics only |
| Legacy migration archive | Until migration signed off + 90 days | Manual, witnessed | Part C |

Note the tension worth flagging to the client: keeping candidate documents indefinitely "for future
roles" is commercially attractive and is exactly what DPDP's storage-limitation expectation pushes
against. The 12-month identity-document rule is the compromise I recommend.

## L.3 Deletion mechanics

- **Soft delete first.** `deleted_at` set, record excluded by RLS, recoverable for 30 days.
- **Then anonymise or purge.** Anonymise when the record must survive for aggregate reporting
  (replace name/phone/email with a stable pseudonym, keep the case shape). Purge when it must not.
- **Storage purge is real deletion.** Objects move to a `quarantine/` prefix for 30 days, then are
  removed. Since database backups do **not** cover Storage (Part M.1), this is irreversible — so it
  runs from an explicit job with a dry-run mode and a logged, reviewed manifest.
- **Cascade rules are explicit**, never `on delete cascade` on anything financial. Deleting a
  contact must never silently delete an invoice.
- **Legal hold**: `contacts.legal_hold_until`. Set it and every automated deletion skips the record
  and logs why.
- Every deletion writes an `audit_logs` row: what, whose, why, on whose authority.

## L.4 Data-principal request handling (DPDP)

| Request | SLA | Mechanism |
| --- | --- | --- |
| Access / copy | 30 days | Self-service export in the portal → JSON + PDF summary + documents in a ZIP |
| Correction | 7 days | Portal edit for self-editable fields; staff task for the rest |
| Erasure | 30 days | Portal request → staff review (legal-hold and tax-retention check) → execution → written confirmation |
| Nomination | On request | Stored against the contact |
| Grievance | Acknowledge 48h, resolve 30 days | Named Grievance Officer, tracked as a support case with an SLA |

**Export format** must be genuinely portable: `profile.json`, `cases.json`, `payments.json`,
`communications.json`, `documents/` with originals, plus a human-readable `summary.pdf`. Generated
server-side, delivered as a signed URL valid 24 hours, and the generation itself is audited.

---

# PART M — Backup, PITR & disaster recovery

## M.1 The finding that changes the design

> Supabase: *"Database backups do not include objects you store via the Storage API, as the
> database only includes metadata about these objects. Restoring an old backup does not restore
> objects you deleted after that backup."*

**Passports and CVs are not protected by any database backup.** Storage needs its own,
independent backup. My Phase 0 audit did not say this. It is the single most important correction
in this pack — see Q1.

## M.2 Requirements

| Layer | Mechanism | RPO | RTO |
| --- | --- | --- | --- |
| Postgres | Supabase **PITR add-on**, 7-day retention | ~2 min | 1–4 h (size-dependent) |
| Postgres (secondary) | Weekly `pg_dump` to independent off-platform storage, encrypted | 7 days | 4–8 h |
| **Storage objects** | **Nightly incremental mirror to independent object storage** (different vendor), with checksum manifest | 24 h | 2–6 h |
| Application code | Git + Vercel immutable deployments | 0 | < 5 min (instant rollback) |
| Schema | Migrations in git, replayable from empty | 0 | < 30 min |
| Secrets | Documented in a password manager, not only in Vercel | 0 | < 15 min |
| Config (RLS, roles, settings) | Captured in migrations, not clicked in the dashboard | 0 | with schema |

**A backup that has never been restored is a hypothesis.** Quarterly restore drill into a scratch
project, timed, with the result written down.

## M.3 Additional platform hardening

From Supabase's production checklist, applied here:

- **SSL enforcement** on the database — on.
- **Network restrictions** — restrict direct Postgres access to known IPs; the app connects via the
  API, so this is nearly free security.
- **Organisation MFA enforcement** — mandatory for every Supabase account with access.
- **Multiple org owners** — so a single lost account cannot orphan the project (exactly the
  situation blocker B1 describes).
- **Custom SMTP for auth email** — so OTP and auth mail comes from `gogulf.co` and is not rate-capped.
- **Auth rate limits** — Supabase defaults to 360 OTPs/hour with a 60-second per-request window;
  both are configurable and must be tuned, then layered with our own per-phone and per-IP limits.
- **Security Advisor and Performance Advisor** reviewed before each production release.

## M.4 Cost of doing this properly (decision B8)

| Item | Monthly (USD) |
| --- | --- |
| Supabase Pro | 25 |
| Small compute add-on (**required for PITR**) | 15 |
| PITR, 7-day retention | ~100 |
| Independent storage mirror (S3/R2 class) | 5–15 |
| Vercel Pro | 20 |
| Resend | 0–20 |
| Sentry | 0–26 |
| **Baseline total** | **~190–260** |

Excludes usage-based costs: WhatsApp conversations, SMS/OTP, IVR minutes, Razorpay transaction fees.

**If PITR is rejected on cost**, the fallback is Pro's daily backups (7-day retention) plus the
independent storage mirror — RPO degrades from ~2 minutes to 24 hours. For a system holding
payment records, I recommend against it, but it is a legitimate business call to make with the
number in front of you.

---

# PART N — Monitoring & error tracking

| Concern | Tool | What it must catch |
| --- | --- | --- |
| Application errors | Sentry (server + client + edge) | Unhandled exceptions, Server Action failures, hydration errors — with release tagging and source maps |
| **Webhook failures** | Sentry alert + a DB check on `webhook_events.error is not null` | A silently failing Razorpay webhook means customers pay and the system doesn't know. Highest-severity alert in the system |
| Outbox backlog | Cron check on `outbox where status='pending' and next_attempt_at < now() - 15min` | Stuck notifications, unsent emails |
| Database health | Supabase Reports + Advisors | Slow queries, missing indexes, connection saturation, RLS gaps |
| Uptime | Vercel Analytics + external HTTP monitor | `/`, `/jobs`, `/portal`, `/api/health` |
| Auth anomalies | Supabase auth logs + custom alerts | OTP brute force, unusual admin login times/locations |
| Payment reconciliation | Daily job | Razorpay settlement report vs `payments` — any divergence raises a task for `FINANCE_MANAGER` |
| Document access | Weekly report on `document_access_log` | Unusual volume of identity-document views by one user |
| Delivery health | Resend + WhatsApp webhooks into `communications.status` | Bounce and failure rates trending up |

**Alert routing:** critical (payment webhook failure, auth outage, DB down) → phone/WhatsApp to the
on-call person. High (outbox backlog, elevated errors) → email + in-app. Everything else → a daily
digest. Alerts that page a human at night are limited to those where a human can actually act.

**Never logged, anywhere:** OTP codes, passwords, API keys, full card/UPI data, full passport
numbers, document contents, session tokens. Enforced by a Sentry `beforeSend` scrubber **and** a
logging helper that redacts by key name — belt and braces, because this is the class of mistake
that ends up in a breach notification.

**Health endpoint:** `/api/health` checks database reachability, storage reachability and outbox
lag, returning a machine-readable status for the external monitor.

---

# PART O — Deployment & rollback strategy

## O.1 Pipeline

```
feature branch
   → PR: lint · typecheck · unit tests · RLS policy tests · build
   → Vercel Preview + Supabase branch (migrations applied to the branch)
   → review + manual QA on the preview URL
   → merge to main
   → staging deploy + migrations → smoke tests
   → manual promotion to production (never automatic on merge)
   → production deploy → migrations → post-deploy smoke tests
```

**Production promotion is a deliberate human action.** For a system handling payments and passports,
push-to-production-on-merge is not appropriate.

## O.2 Migration discipline

- **Expand → migrate → contract.** Add the new column, backfill, dual-write, switch reads, and only
  then drop the old column — in separate releases. A single release that both adds and removes
  cannot be rolled back.
- **Every migration is forward-only and additive within a release.** No destructive DDL in the same
  deploy as the code that depends on it.
- **Backfills run as batched jobs**, never inline in a migration that locks a table.
- **A destructive migration requires a fresh PITR checkpoint recorded immediately before it**, plus
  a named person watching.
- Migrations are tested against a Supabase **branch** seeded with realistic volume, not an empty DB.

## O.3 Rollback

| Failure | Action | Time |
| --- | --- | --- |
| Bad application code | Vercel instant rollback to the previous immutable deployment | < 2 min |
| Bad migration, additive only | Roll back code; the extra column is harmless | < 5 min |
| Bad migration, data-affecting | Forward-fix migration. **Not** a down-migration — down-migrations on production data lose data | 15–60 min |
| Data corruption | PITR restore to the pre-incident timestamp; project is offline during restore | 1–4 h |
| Storage loss | Restore from the independent mirror (Part M.2) | 2–6 h |
| Provider outage (Razorpay/WhatsApp) | Degrade gracefully: queue in the outbox, show honest status, never silently drop | Immediate |

## O.4 Release gates

No production release proceeds unless: CI green (lint, types, tests, build); RLS test matrix green;
migrations applied cleanly to staging; a fresh backup checkpoint exists; the legal-page checklist
(Part K) is satisfied for anything in the release that touches it; and a rollback plan is written
down for that specific release.

## O.5 Feature flags

Portal, payments, WhatsApp and IVR each ship behind a flag in `settings`. This decouples deploying
code from launching a feature, allows a limited pilot (one branch, a few candidates), and gives an
instant off-switch that does not require a deploy.

---

# PART P — Parallel-run migration strategy

**The existing website stays live and fully operational throughout.** No customer-visible downtime.

## P.1 Stages

```
NOW          gogulf.co (static) ──► legacy Supabase           [untouched]

STAGE 1      gogulf.co (static) ──► legacy Supabase           [still live]
Phases 1-2   staging.gogulf.co ──► new Supabase               [new build, internal only]
             robots: noindex on staging

STAGE 2      gogulf.co (NEW, dynamic) ──► new Supabase        [marketing pages cut over]
Phase 2 end  /jobs/apply still writes to LEGACY               [unchanged, still working]
             DNS switched; old host kept warm for 30 days

STAGE 3      gogulf.co ──► new Supabase for everything        [apply form cut over]
Phase 5      delta migration runs; legacy write access revoked

STAGE 4      /portal, /admin enabled behind feature flags     [staff pilot first]
Phases 3,4

STAGE 5      legacy project read-only 90 days → archive → delete (with sign-off)
```

## P.2 Why the marketing site cuts over before the apply form

The public pages are stateless — switching them is low-risk and reversible by a DNS change. The
apply form owns real candidate data, so it moves only once the new pipeline is proven end to end.
Splitting the two means the highest-risk cutover happens on its own, with everything else already
stable.

## P.3 URL and SEO continuity — non-negotiable

- All 13 existing URLs resolve identically. Verified by an automated crawl comparing old and new.
- `sitemap.xml`, `robots.txt`, `llms.txt`, canonicals and every JSON-LD block ported and validated
  with Google's Rich Results Test **before** DNS switches.
- Any URL that must change gets a `301`, listed in the release notes.
- Search Console monitored daily for two weeks post-cutover; coverage and JobPosting validity are
  the two signals that matter.
- Staging carries `noindex` throughout — a duplicate indexed staging site would be a real SEO
  regression.

## P.4 Cutover rollback

DNS TTL lowered to 300 seconds 48 hours before switching. The old static host stays fully deployed
for 30 days. If the new site fails badly, reverting DNS restores the previous site within minutes —
and because the apply form still points at the legacy project during Stage 2, no application data is
at risk during the riskiest window.

## P.5 Communications during migration

Staff are trained on the new admin before Stage 4, not after. During the overlap, recruiters may
need to check both the old Supabase dashboard and the new CRM — that window is kept as short as
possible and is explicitly time-boxed, because dual-system periods are where records get lost.

---

# PART Q — Corrections to the Phase 0 audit

Ten items I now believe were wrong, incomplete or under-weighted.

**Q1 — Storage is not covered by database backups. (Material)**
The audit recommended Supabase Pro "for PITR/daily backups" and implied the data was then
protected. Supabase's documentation is explicit that backups exclude Storage objects. Passports and
CVs — the most sensitive and least replaceable data in the system — would have had **no backup at
all**. Part M now requires an independent nightly storage mirror. This was the most consequential
gap in the audit.

**Q2 — PITR is a paid add-on, not part of Pro. (Material, cost)**
The audit conflated them. PITR requires Pro *plus* at least a Small compute add-on, and costs
~$100/month at 7-day retention. Real baseline is ~$190–260/month, not the ~$25 the audit implied.
Enabling PITR also *replaces* daily backups rather than supplementing them.

**Q3 — Baking permissions into the JWT was the wrong call. (Material, security)**
The audit recommended putting the full permission set in the token for RLS performance. That
creates a revocation lag of up to the token lifetime — so a dismissed employee could retain access
for the remainder of their session. Corrected in Part J.3: the JWT carries only `staff_id`, `role`
and `branch_id`; permissions resolve through a `stable security definer` function, which Postgres
caches per statement. Nearly all the performance, none of the staleness.

**Q4 — Data residency and region pinning were entirely absent. (Material)**
For an Indian company holding passports under the DPDP Act, `ap-south-1` + Vercel `bom1` should
have been in the audit's recommendations. Region **cannot be changed after a Supabase project is
created**, making this a one-shot decision the audit failed to flag. Now blocker B2.

**Q5 — Staff auth should be Google Workspace SSO, not email + password. (Improvement)**
The business already runs Google Workspace on `gogulf.co` — the evidence was in the footer of the
site I audited, and I read past it. SSO restricted to the `gogulf.co` hosted domain is better
security at lower cost, and removing someone from Workspace revokes platform access immediately.
Now decision I1.

**Q6 — `contacts.primary_phone_e164` as a plain column is a dual source of truth. (Design)**
As drafted it could drift from `contact_identities`. Corrected: maintained by trigger from the
`is_primary` identity row, not independently writable.

**Q7 — GST tax invoicing was missing from the payment model. (Material, compliance)**
The audit's `invoices` sketch had no supplier GSTIN, place of supply, SAC code, CGST/SGST/IGST split
or gapless per-financial-year numbering. An Indian company with a GSTIN cannot issue compliant
invoices without these, and invoice numbering in particular cannot be retrofitted without
re-issuing history. Added in Part H.4, with the open questions as decision I6.

**Q8 — Resend should move from Phase 8 to Phase 1.5. (Sequencing)**
The audit noted it "could be pulled forward" then left it at Phase 8. Formally re-sequenced: OTP
(Phase 3) and receipts (Phase 7) both depend on transactional email, and shipping it early also
retires a browser-side key. It is a small, self-contained piece of work with two downstream
dependencies — it belongs early.

**Q9 — DNS and domain control was never identified as a blocker. (Gap)**
Vercel domain cutover, Resend DKIM/SPF/DMARC and WhatsApp domain verification all require DNS
access. Three workstreams would have stalled on something the audit never asked about. Now blocker
B4.

**Q10 — WhatsApp was treated as a technical task; it is an operational decision. (Gap)**
`+91 99363 09015` appears as a click-to-chat link across the site. If it is currently on the
WhatsApp Business **App**, migrating it to the Cloud API is effectively irreversible and the team
loses the phone app for that number. The audit scheduled WhatsApp for Phase 9 without noticing this
one-way door. Now blocker B7, with a recommendation to acquire a second number.

**Reconsidered and unchanged:** one Next.js app with route groups (not a monorepo); Tailwind for
the admin surface with a bespoke marketing site; `cases` with typed 1:1 extensions rather than
parallel per-module tables; `contacts` + `contact_identities` as the identity spine (with the Q6
refinement); write-side `activities` denormalisation for the timeline.

---

## What I need from you to start Phase 1

1. Answers to **B1–B9**.
2. Preferably, answers to **I1, I3, I4, I15** — they shape the first two weeks.
3. Confirmation of the retention schedule in **L.2**, or a redline.
4. Permission to add `tools/export-legacy-storage.mjs` (read-only) once B1 is resolved.

Nothing else is blocked on you. Once B1–B3 are answered I can begin Phase 0.5 housekeeping
(linting, `turbopack.root`, `.env.example`) immediately, since none of it touches production.
