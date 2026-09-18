# Production cutover readiness report — Tokyo → Mumbai, Phase 3

Written 18 September 2026, after the user's manual Phase 3 staging QA. **Second pass** the same
day, after the staging hardening and Razorpay infrastructure work.

**This report is not an approval and contains no go/no-go decision.** It records what was
verified, by what method, and what remains outstanding, so the cutover decision can be made
from evidence.

> ### PRODUCTION DATABASE CUTOVER HAS NOT BEEN PERFORMED.
>
> Three things are deliberately distinct throughout this document:
>
> | | State |
> | --- | --- |
> | **Production website deployment** | Live at `www.gogulf.co`, serving the Phase 2C build from `main` (`519cb85`). Untouched by this work |
> | **Production Supabase** | **Tokyo** `julbqkeyvzwluayokcdi`. Still the live database. Untouched — no migration, no write, no data movement |
> | **Future Mumbai cutover** | `exsnksrmkycloxiajwmx`. Provisioned, empty, at migration `0011`. Not connected to anything. Gated on the user's explicit approval |

**What was changed outside the repository during this pass** (stated plainly, because the first
pass could say "nothing"):

| Change | Scope | Why |
| --- | --- | --- |
| Vercel automation-bypass secret **rotated** | Project deployment protection (preview access only) | The 10 Sep value leaked into a local Playwright log on 17 Sep and was still live |
| Razorpay variables **unscoped from Preview** | Vercel env targets; **Production values untouched** | They were live-mode credentials attached to staging. Approved by the user before the change |
| Migration `0014_payments.sql` applied to **Mumbai staging** and local | Staging and local databases only | Payments infrastructure. **Not applied to any production project** |

No production Vercel variable was edited, no OAuth configuration created, no staff or auth user
created, no data migrated, no DNS change, no merge to `main`.

It supersedes `docs/PRODUCTION-READINESS-REPORT.md` (12 Sep, Phase 2C website) for cutover
purposes; that report remains the page-by-page record of the website release candidate.

---

> **Update 19 September 2026.** Billing was added after this report was written. **The gap to
> close on Mumbai production is now `0012`–`0015`, and the SQL suites expect 386 assertions**
> (this report's "0012–0014" and "316" are the 18 Sep figures). The ordered procedure, exact
> commands, rollback and stop conditions are now in `docs/PRODUCTION-CUTOVER-RUNBOOK.md`; the
> release state is in `docs/MAIN-RELEASE-READINESS.md`; billing is `docs/PAYMENTS.md` §10.

## A. Snapshot

| | |
| --- | --- |
| Branch / commit | `phase-2/redesign` @ **`8714b78`** ("feat(payments): Razorpay webhook infrastructure, and the staging hardening"), plus the documentation commit that records these results |
| `origin/staging` | **`8714b78`** — fast-forward from `384f58a` |
| `origin/main` (production) | **`519cb85`** — unchanged; no merge, no push, no tag |
| Staging deployment | **`dpl_Cjxt2BY9UWZX3ZyhuwgCzvqaCkJG`**, READY, branch `staging`, commit `8714b78` → `https://staging.gogulf.co` |
| Production deployment (live now) | `dpl_9RaneE2dUCaRfmGifXYfumUjWDL9`, branch `main`, commit `519cb85`, created 2026-09-13T04:54:08Z |
| Staging Supabase ref | **`noxireidrbeqcvsirjec`** (Mumbai staging, `ap-south-1`) — verified from the deployed bundle and the server-rendered page, not from a dashboard |
| Mumbai production ref | **`exsnksrmkycloxiajwmx`** — inventoried directly this pass (§1) |
| Tokyo production ref | **`julbqkeyvzwluayokcdi`** — still live, still the source of truth |
| Manual QA | Completed by the user on deployed staging, 18 Sep 2026: all planned Phase 3 flows work, **no issues reported** |

### Test and check results (this pass, 18 September 2026)

| Check | Command | Result |
| --- | --- | --- |
| Migration files parse | `npm run db:validate` | **PASS — 14/14 files** |
| Unit tests | `npx vitest run` | **PASS — 223/223**, 16 files (was 201; +22 payment tests) |
| SQL assertions (local, from empty) | `npm run db:test` | **PASS — 316/316** across 4 files (was 280; +36 payment assertions) |
| SQL assertions (Mumbai staging) | `db-remote --target=mumbai-staging test` | **PASS — 316/316** |
| E2E + accessibility (local production build) | `npx playwright test --workers=2` | **188 passed, 39 skipped, 1 flake** (228 total, 8.9 min). The one failure — `guard.spec` "email + password sessions reach neither area" — passes when re-run alone (14/14), a known timeout under parallel load on this machine, not a regression |
| Accessibility (axe) | part of the E2E run | **PASS — 64/64 route scans**, mobile and desktop, no serious or critical violation |
| Lint | `npm run lint` | **PASS** — clean |
| Typecheck | `npm run typecheck` | **PASS** — clean |
| Production build | `npm run build:server` | **PASS** — includes `ƒ /api/razorpay/webhook` |
| Client bundle secret scan | `npm run check:secrets` | **PASS** — 134 files scanned against **10** distinct server-only secret values |
| Repository secret exposure scan | `node scripts/check-secret-config.mjs` | **PASS** — 12 distinct secret values searched across **865** files (git-tracked, build output, docs, public assets, logs); none found |
| Webhook behaviour, live HTTP | `node scripts/razorpay-webhook-probe.mjs` | **PASS — 9/9** cases (§11) |
| Deployed staging | `node scripts/verify-staging-deployment.mjs` | **PASS — 14/14** on `8714b78` |
| Deployed webhook (staging) | `razorpay-webhook-probe.mjs --base=https://staging.gogulf.co` | **PASS** — 9/9 deliveries answered **503 `not_configured`**: deployed, and closed until a webhook secret exists |
| Tokyo backup + delta | `npm run backup:prod -- verify` | **PASS** — 34/34 SHA-256; live 14 rows / 34 documents = backup; **unchanged since the backup** |

---

## B. Production data state (Tokyo, from the verified backup and today's delta read)

| | |
| --- | --- |
| Applications | **14** rows in `public.job_applications` |
| Of which a test | **1** — `2026-09-13T05:00:20.505Z`, "General Application", documents `cv-cutover-test-cv.pdf` / `passport-cutover-test-passport.png`. So **≈13 real applicants** |
| Date range | `2026-09-04T17:58:57Z` → `2026-09-15T06:31:10Z` |
| Storage | bucket `job-applications`, **private**, 10 MiB limit, **34 objects**, **29,368,182 bytes** (28.01 MiB) |
| Referenced vs present | 34 referenced paths, **0 missing** — no orphans either way |
| Auth users in Tokyo production | **0** |
| Backup | `backups/julbqkeyvzwluayokcdi-2026-09-16T11-06-38-944Z/`, taken **`2026-09-16T11:07:53.025Z`** |
| Changed since the backup? | **No** — re-verified today |

---

## C. Verification limitations

1. **Mumbai production is now inventoried** — the gap in the first pass is closed (§1). The
   read-only snippet is `supabase/snippets/readiness-inventory.sql`; it runs inside a read-only
   transaction and is version-tolerant, so it works on a project that predates `0012`.
2. **`supabase db push` reports failure on success** on this machine (pgdelta certificate error
   after applying). `scripts/db-remote.mjs` ignores the exit code and reads `schema_migrations`.
3. **The Supabase CLI drifts between accounts mid-session.** Verify the org immediately before a
   management command; database work through the pooler does not depend on CLI auth.
4. **`/auth/v1/settings` is cached and not authoritative** — verify auth configuration with a real
   refused `POST /auth/v1/signup` using an `@gogulf.co` address.
5. **Vercel keeps secret values write-only.** `SUPABASE_SERVICE_ROLE_KEY` in Production is stored
   as type `sensitive`, so its value cannot be read back through the API. Its **presence** is
   verified; **which project it belongs to cannot be proved from here** (§10).
6. **Admin UI still needs a human** — staff sessions require real Google consent, which cannot be
   automated. The authorization underneath is proven by the SQL suites and REST probes.

---

## 1. Mumbai production schema readiness — verified directly this pass

Read-only inventory, `exsnksrmkycloxiajwmx`, 18 September 2026:

| | Mumbai production (verified) | Mumbai staging (verified) |
| --- | --- | --- |
| Migrations | **`0001`–`0011`** | `0001`–`0014` |
| Public tables | 23, **all** with RLS | 25 (+`payments`, `payment_events` = 27 after `0014`) |
| RLS policies | 55 | 65 (+2) |
| SECURITY DEFINER functions | 11 | 14 (+2) |
| RBAC catalogue | 12 roles, 72 permissions, 364 grants | identical |
| `jobs` / `job_categories` | **not present** | present |
| Applications / contacts / cases | **0 / 0 / 0** | 14 / 0 / 0 (synthetic) |
| staff_users / auth users / identities | **0 / 0 / 0** | 3 / 3 / 4 |
| Audit rows | **370, all `actor_type=system`** — exactly the expected seed baseline | 389 (`system` + `staff`) |
| Storage | `job-applications`, private, 10 MiB, **0 objects** | same bucket, 34 synthetic objects |
| `job_applications` privileges | `anon=INSERT` (table-level, the `0011` state), `service_role=DISU` | `authenticated=SELECT`, `service_role=DISU`, **column-level** anon INSERT (`0013`) |

**Gap to close at cutover: `0012`, `0013`, `0014`.** All three are additive — new tables, new
policies, narrower privileges. `0013` also *narrows* anon's INSERT from the whole table to named
columns, which is a security improvement, not a break.

## 2. Migrations 0001–0014 readiness

- 14/14 files parse (`npm run db:validate`).
- Applied and proven twice: Mumbai staging, and locally from empty (`supabase db reset`) — **316
  assertions pass in both**.
- Numbering gapless; each file immutable once applied. `0014` is new in this pass (§11).
- The command, when approved:

  ```bash
  node scripts/db-remote.mjs --target=mumbai-production push --yes-i-am-provisioning-production
  node scripts/db-remote.mjs --target=mumbai-production test --yes-i-am-provisioning-production
  ```

  Run the suites **only while the project holds no live data**. Expect 316/316.

## 3. Tokyo production backup and SHA-256 verification

Unchanged from the first pass and re-verified today: 34/34 document hashes match, 14 rows and 34
objects live and in the archive, 0 missing referenced paths, and the live project has not changed
since `2026-09-16T11:07:53.025Z`. The backup covers Postgres **and** Storage; a Supabase database
backup alone would omit every CV and passport.

## 4. Production delta-check procedure

1. `npm run backup:prod -- verify` — prints live-vs-backup row and document counts and names
   anything new.
2. On a delta: take a fresh backup, re-verify, then migrate from the **archive**, never the live bucket.
3. Repeat after Tokyo intake is closed; the final run must report zero delta.
4. Keep the output of the final run with the cutover record.

## 5. Rollback procedure and triggers

| Stage | Rollback | Data risk |
| --- | --- | --- |
| Mumbai production migrated only | Nothing to undo — it serves no traffic and holds no data | None |
| Vercel variables switched, build promoted | Promote `dpl_9RaneE2dUCaRfmGifXYfumUjWDL9` (`519cb85`) back; restore Tokyo Supabase variables | None — Tokyo still holds every row |
| Traffic live on the new build, Tokyo intake still open | Same promote + restore; replay any Mumbai-side applications into Tokyo (decide the policy **before** starting) | The switch-window delta |
| After Tokyo `anon` INSERT is revoked | **One-way door.** Restore the grant and reconcile both directions | Real |

Supporting conditions: DNS TTL 300 s at least 48 h ahead; previous production deployment kept 30
days; Tokyo read-only-but-alive through the soak; `main` moved only by reviewed merge.

Exact stop/rollback triggers are in §18.

## 6. Vercel production environment changes required

Production variables **today** (names only; values are write-only or unread):
`NEXT_PUBLIC_EMAIL_PROVIDER`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`NEXT_PUBLIC_SUPABASE_URL`, `PLATFORM_MODE`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`,
`RESEND_REPLY_TO`, **`SUPABASE_SERVICE_ROLE_KEY` (added by the user this pass)**,
**`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` (added by the user this
pass; now Production-only)**.

| Change still required at cutover | Detail |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | → `https://exsnksrmkycloxiajwmx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | → Mumbai production anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | **Present.** Confirm it is Mumbai production's, not Tokyo's — see §10; it cannot be read back |
| `PLATFORM_MODE` | Confirm `server`. *(Corrected 18 Sep: the live `519cb85` build is already server mode — this variable took effect although `main`'s `vercel.json` is `npm run build`. See `docs/MAIN-RELEASE-READINESS.md` §1.)* |
| Build command | Comes with the merge: the branch's `vercel.json` is `cross-env PLATFORM_MODE=server npm run build` |
| `APP_ENV` | **Not required** — `deploymentStage()` resolves production from `VERCEL_ENV=production`. Never set `APP_ENV=staging` there |
| `NEXT_PUBLIC_EMAILJS_*` | Retire if any remain |

After promoting, re-check the live bundle names exactly one Supabase ref: `exsnksrmkycloxiajwmx`.

## 7. Production Google OAuth configuration required

Unchanged and still outstanding. Exact values in `docs/GOOGLE-OAUTH.md` §3:

| Setting | Production value |
| --- | --- |
| OAuth client | One **Web application** client in a Google Cloud project owned by the `gogulf.co` Workspace |
| Consent screen | **Internal** |
| Authorized redirect URI | `https://exsnksrmkycloxiajwmx.supabase.co/auth/v1/callback` |
| Authorized JavaScript origins | `https://www.gogulf.co` **and** `https://gogulf.co` |
| Supabase `site_url` / redirects | `https://www.gogulf.co` / `https://www.gogulf.co/**` |
| Supabase auth | Google on; **`enable_signup = false`**; JWT hook on |

Supabase ignores Google's `hd` claim: the Workspace restriction comes from the Internal consent
screen, signups disabled, and the `staff_users` row requirement — the third being the real
authorization boundary.

## 8. Production SUPER_ADMIN bootstrap plan

`admin@gogulf.co` and `hello@gogulf.co` → **SUPER_ADMIN**.

```bash
npm run bootstrap:admins -- --target=mumbai-production --yes-bootstrap-production-admins
npm run bootstrap:admins -- --target=mumbai-production --report
```

Creates a confirmed-email, **password-less** `auth.users` row plus a `staff_users` row with the
catalogue role, Lucknow branch, active. Idempotent; refuses a role not in `public.roles`; grants
nothing directly — authority flows `staff_users` → JWT hook → `has_perm()` → RLS. Each person must
then complete a real Google sign-in and be verified individually
(`supabase/snippets/verify-google-signin.sql`).

## 9. Production ADMIN bootstrap plan

`careers@gogulf.co` → **ADMIN**, same script and safeguards. Proven on staging: ADMIN runs the
whole job lifecycle and cannot manage roles or permissions, promote itself, alter a SUPER_ADMIN or
insert audit rows (`rbac-behaviour.test.sql`, 84 assertions). Until the Workspace mailboxes can
actually complete Google sign-in, an ADMIN exists in the database but cannot log in.

## 10. Production environment verification, and `SUPABASE_SERVICE_ROLE_KEY`

**Read directly from Vercel on 18 Sep 2026** (project refs are public; no key was printed):

| Variable | Production | Preview |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | **Tokyo** `julbqkeyvzwluayokcdi` | Mumbai staging `noxireidrbeqcvsirjec` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Tokyo** (project claim read from the key) | Mumbai staging |
| `SUPABASE_SERVICE_ROLE_KEY` | present, type `sensitive` (write-only) — **Mumbai production**, per the user's own dashboard check | Mumbai staging (added 18 Sep, preview-only) |
| `PLATFORM_MODE` | `server` | `server` |
| `NEXT_PUBLIC_SITE_URL` | `https://www.gogulf.co` | `https://staging.gogulf.co` |

**Internal consistency:** the production URL and anon key name the **same** project (Tokyo) —
that pair is consistent and correct for today. The service-role key is **deliberately from a
different project** (Mumbai production), which is the one inconsistency in the environment and
is expected at this stage.

**What that means, precisely:**

- ✅ Today nothing breaks: the live `519cb85` build has no `createAdminClient()` call site and
  predates the key, so no code path uses the service-role key. *(Corrected 18 Sep: it is a server
  build, not a static export — `docs/MAIN-RELEASE-READINESS.md` §1.)* From `304130c` a production
  build that pairs a Tokyo URL with this key is refused at prebuild.
- ⚠️ **The URL, the anon key and the service-role key must be switched together, in one change.**
  Merging the server build to `main` while `NEXT_PUBLIC_SUPABASE_URL` still names Tokyo would
  send a Mumbai key to a Tokyo endpoint; the result is `PGRST301` (rejected JWT) on every
  privileged call — exactly the failure seen while testing the webhook locally.
- ✅ It is **not** `NEXT_PUBLIC_*`, and no `NEXT_PUBLIC_*` variable carries a secret-shaped name.
- ✅ `lib/supabase/admin.ts` requires it through `requireServerEnv`, imports `server-only`, and
  throws if called in a browser; the client-bundle scan finds no server-only secret in 134 files.
- ❓ Vercel stores it write-only, so **this session cannot re-verify which project it belongs to**.
  That check remains the user's dashboard comparison, which they have confirmed.

What that means for the cutover, stated precisely:

- ✅ The variable exists in the Production environment.
- ✅ It is **not** `NEXT_PUBLIC_*`, and no `NEXT_PUBLIC_*` variable carries a secret-shaped name.
- ✅ `lib/supabase/admin.ts` requires it through `requireServerEnv`, imports `server-only`, and
  throws if called in a browser; the client-bundle scan finds no server-only secret in 134 files.
- ❓ **Whether the value is Mumbai production's key and not Tokyo's cannot be proved from here.**
  The safe check is on the Supabase side: in the **Mumbai production** project (`exsnksrmkycloxiajwmx`)
  → Settings → API, compare the service-role key's first and last six characters with what was
  pasted into Vercel. Do not paste the key anywhere else to compare it.
- ⚠️ Adding it **does not** bring the cutover forward: while `NEXT_PUBLIC_SUPABASE_URL` still names
  Tokyo, a production server-side call would use a Mumbai key against a Tokyo URL and fail. The
  URL and the keys must change **together**, at cutover.

Local files, checked without printing any value (`node scripts/check-secret-config.mjs`):
`.env.prod-supabase.local` → Mumbai production (`exsnksrmkycloxiajwmx`) with a service-role key;
`.env.development.local` / `.env.production.local` → local Supabase; `.env.local` → no Supabase URL.

## 11. Razorpay infrastructure — built, deployed, not enabled

**Scope: consultation fees only.** No pay-to-apply, no candidate payment UI, no payment gate on
any application. `docs/PAYMENTS.md` is the full document; the guards are:

| Guard | Where |
| --- | --- |
| `payment_purpose` enum has exactly one value, `consultation` | `0014` |
| `payments` has **no** job or application column, in either direction | `0014` |
| `jobs_paid_application_not_public` CHECK still refuses to publish a paid-access job | `0012`, untouched |

**Schema (`0014_payments.sql`)** — `payments` (reference `GG-PAY-2026-00001`, provider order/payment
ids, `amount_minor` in paise, status, optional contact/case/branch, provider failure code,
timestamps; a row cannot claim `paid` without `paid_at` **and** a provider payment id) and
`payment_events` (one row per provider event id, unique — that uniqueness *is* the idempotency
mechanism). **No raw payload, no payer name, email, phone or card data is stored**; only
allow-listed fields (amount, currency, method, provider error code).

**Endpoint** — `POST /api/razorpay/webhook`, production URL
`https://www.gogulf.co/api/razorpay/webhook`. Reads the raw body, verifies
`x-razorpay-signature` (HMAC SHA-256, constant-time compare, hex-validated), never parses before
verifying, dedupes on `x-razorpay-event-id`, and returns 503 (unconfigured) / 401 (bad signature) /
400 (malformed) / 200 (recorded, including duplicates) / 500 (our failure, so Razorpay retries).
The webhook is the **only** authority on payment state; no client callback writes payment state,
and `payments` has no INSERT/UPDATE/DELETE policy at all.

**Idempotency and ordering**, asserted in SQL: a replayed event id is a `duplicate`; a late
`payment.authorized` after `order.paid` is `ignored`; `payment.failed` never erases a payment that
succeeded; a failure for a payment that had not succeeded applies and keeps the provider's error
code; an event for an unknown order is recorded and ignored, never invented. Each applied
transition writes a `system` / `razorpay` audit entry with no payer identity.

**Test-mode result (live HTTP against a local production server, 9/9):**

| Case | Expected | Got |
| --- | --- | --- |
| Signed `order.paid` | 200 | 200 `ok / ignored` (no matching order — correct) |
| Same event id replayed | 200 `duplicate` | 200 `duplicate` |
| Body altered after signing | 401 | 401 |
| No signature header | 401 | 401 |
| Signed with a different secret | 401 | 401 |
| Signed, no event id header | 400 | 400 |
| Signed body that is not JSON | 400 | 400 |
| Signed JSON that is not an event | 400 | 400 |
| Signed `payment.failed` | 200 | 200 |

The database then held exactly **two** event rows (the replay deduplicated, the unsigned and
malformed requests never reached it) — the full chain, not just the HTTP layer.

**Not built, deliberately:** the consultation checkout UI, any receipt workflow, and any call site
for `createConsultationOrder()` (which exists, refuses live keys outside production, and writes the
payment row *before* the provider call).

**Staging test-mode webhook — environment configured 18 Sep 2026.** Two **Preview-only**
variables were added with the user's approval: a generated 24-byte `RAZORPAY_WEBHOOK_SECRET`
(test, not live) and the **Mumbai staging** `SUPABASE_SERVICE_ROLE_KEY`, without which the
webhook could reach the database step but not write. Live Razorpay credentials stay scoped to
`production` alone.

**Full HTTP + database flow verified twice against Mumbai staging** — once with the app run
locally against that project, and again against **deployed staging**
(`dpl_7hn67GZFTiL4q8HSFEnEyHDPHvii`): `payment.authorized` → payment `authorized`; `order.paid` →
`paid` with `paid_at` and the provider payment id; the same event id replayed → `duplicate` with
no second row and no second transition; `payment.failed` on a second payment → `failed` with
`BAD_REQUEST_ERROR`; tampered, unsigned and wrongly signed bodies → 401; missing event id,
non-JSON and non-event bodies → 400.

Mumbai staging afterwards: four payments (two `paid`, two `failed`), nine `payment_events` rows
with nine distinct event ids (6 `processed`, 3 `ignored`), six `system`/`razorpay` audit entries,
and **zero** event summaries containing contact-shaped data. The SQL suite was tightened to scope
its counts to its own fixtures, so it still reports **316/316** on that environment with these
rows present.

**Razorpay dashboard configuration required** (still nothing done there):

| | Test mode | Live mode |
| --- | --- | --- |
| Webhook URL | `https://staging.gogulf.co/api/razorpay/webhook` | `https://www.gogulf.co/api/razorpay/webhook` |
| Secret | New random secret → Vercel **Preview** `RAZORPAY_WEBHOOK_SECRET` | New random secret → Vercel **Production** `RAZORPAY_WEBHOOK_SECRET`, set **before** saving the webhook |
| Events | `order.paid`, `payment.authorized`, `payment.failed` | same |

Do not enable the live webhook until §8 of `docs/PAYMENTS.md` passes — in particular, there is no
checkout yet, so there would be no orders for it to be about.

**Credential state.** `.env.local` holds **live-mode** Razorpay credentials. On Vercel the three
Razorpay variables were set to **preview + production**; with the user's approval the **Preview
scope was removed this pass**, so live credentials no longer reach staging. Two guards now enforce
that: `scripts/check-staging-isolation.mjs` fails a staging/preview build carrying a live key id
(warning only on a developer machine), and `ordersAllowed()` refuses order creation with a live key
outside a production deployment.

## 12. Job publishing safeguards

Unchanged by this pass. Lifecycle `draft → review → published → closed → archived`; jobs are
archived, never deleted (no DELETE privilege, no DELETE/ALL policy); `job_publish_problems` blocks
publication until the listing states place, category, a future closing date if time-limited,
requirements if professional, and free application access; drafts/in-review/archived 404 publicly;
`JobPosting` only on open jobs; sitemap lists open jobs only; every lifecycle action audited with
the acting staff email and changed fields; publishing revalidates the public paths.

## 13. Free/Ongoing vs Professional/Featured architecture

Five independent concepts — classification, lifecycle, availability, promotion, application access
— never collapsed into one "job type". Live combinations: Professional + Featured + Free, General +
Ongoing + Free, and (only with an approved payment flow) Professional + Standard + Paid. Featured is
**read, never written back**: a job is featured while `promotion = 'featured'` and `featured_until`
has not passed, so nothing mutates when it lapses. No urgency is derived from data.

## 14. Paid application protection and the Razorpay boundary

Four independent guards, unchanged and now re-asserted alongside the payments schema: the CHECK
constraint refusing paid + published/closed; `jobs_before_write` naming `paid_application_unavailable`;
`job_applications_intake` refusing an application to any job that is not published **and** free; and
the staff form stating that paid application access is unavailable. `0014` adds a fifth: there is no
column anywhere that could link a payment to an application.

Razorpay is approved for consultation fees only. The live credentials are Production-only and no
code path charges a candidate.

## 15. Audit-log coverage

`audit_logs` partitioned (`2026`, `2027`, default) with `ensure_audit_partition`. Writes go through
`write_audit_log` (SECURITY DEFINER); staff cannot insert audit rows. Covered: job lifecycle,
application triage and conversion (without PII), document opening by kind, system seeding, and now
**payment transitions** (`payment.paid`, `payment.authorized`, `payment.failed` as `system`/`razorpay`,
asserted to contain no payer identity). Mumbai production must read **exactly 370 rows, all
`system`**, before any staff activity — verified today.

**Known caveat:** `record_document_access` writes its audit entry *before* the signed link is
issued, so a Storage failure afterwards leaves an "opened" entry for a document that did not open.

## 16. Document migration and secure access

Access is built: private bucket, staff-only signed URLs through a permission-checked server route,
every access recorded. Migration procedure (not run): copy from the **verified archive**, re-verify
SHA-256 per object and fail the row on mismatch, import documents as `uploaded` (never `approved`),
quarantine phone numbers that fail E.164, keep the working copy on an encrypted volume on one named
machine, revoke Tokyo's anon INSERT only after the delta is zero, retain read-only 30 days.

Note for smoke-testing: staging's rehearsal documents are synthetic random bytes by design, so they
open as unreadable files. A genuine document check needs a freshly submitted application.

## 17. Production smoke-test plan (after cutover, before announcing)

1. Build log shows the isolation guard passing and names Mumbai production.
2. Live bundle names exactly one Supabase ref, `exsnksrmkycloxiajwmx`.
3. Public pages 200 with correct company facts and no "STAGING TEST" content anywhere.
4. `Organization` JSON-LD asserts only verified facts; `JobPosting` only on open jobs; robots and
   sitemap correct; production is **not** `noindex`.
5. A draft and an archived job 404 by direct URL; a closed job refuses applications.
6. Submit one real test application with real files: row lands in Mumbai production, documents
   upload, acknowledgement and internal emails arrive through Resend.
7. Open that application's CV and passport from `/admin`; both render; access is audited by kind.
8. Each administrator signs in with Google individually; claims verified; an `@gmail.com` identity
   gets nothing.
9. `/admin` without a session redirects; `/admin/login` is `noindex`.
10. ADMIN can run the job lifecycle; cannot manage roles or permissions.
11. Security headers present; no `x-powered-by`.
12. `POST /api/razorpay/webhook` with no signature returns 401 (or 503 if no secret is set) —
    confirming the endpoint is live but closed.
13. Delete the test application and its documents, and record that you did.

## 18. Exact conditions that must stop or reverse the cutover

**Stop before switching traffic** if any of these is true:

- `0012`, `0013`, `0014` are not all in `schema_migrations` on Mumbai production, or the SQL suites
  do not report 316/316 there.
- Mumbai production shows any pre-existing live data, or an audit-row count other than 370 all `system`.
- The delta check reports a difference the archive does not contain, or any SHA-256 mismatch.
- The deployed bundle names more than one Supabase project, or names Tokyo.
- `SUPABASE_SERVICE_ROLE_KEY` is missing, or is not the Mumbai production key (§10), or any
  server-only secret appears in client output.
- Google sign-in does not work for **every** administrator, or a non-Workspace account obtains a role.
- A draft, in-review or archived job is publicly reachable, or a paid job can be published.
- The full E2E suite has not been run against the exact cutover commit.

**Roll back after switching** if any of these appears:

- Applications fail to submit, documents fail to upload, or a submitted document cannot be retrieved.
- Applicant data is written to the wrong project, or an application arrives with missing document paths.
- Any unauthenticated access to `job_applications`, `contacts`, `cases`, `payments` or the bucket succeeds.
- Staff cannot sign in, or a member of staff receives the wrong role.
- The live site serves staging or test content, or `noindex` reaches production.
- 5xx rates rise materially above the pre-cutover baseline and are unexplained within the first hour.

## 19. Remaining blockers and prerequisites

**Closed this pass:** the automation-bypass rotation, the Mumbai production inventory, the full E2E
run against the current commit, and live Razorpay credentials sitting in the staging environment.

**Prerequisites still to complete (in order):**

| | Item | Owner |
| --- | --- | --- |
| P1 | Apply `0012`–`0014` to Mumbai production and run the suites there — **only while it holds no live data** | You, or me with explicit approval |
| P2 | Create the production Google OAuth client (Internal) and apply the Supabase auth settings | You (Google Cloud) |
| P3 | Bootstrap production staff, then verify a real Google sign-in per person | You, or me with explicit approval |
| P4 | Switch the production `NEXT_PUBLIC_SUPABASE_URL` **and** anon key to Mumbai production **in the same change** as promoting the server build — the service-role key already there is Mumbai's, so a half-switch fails every privileged call (§10) | You |
| P5 | Post-cutover smoke test (§17), then the final delta check and Tokyo intake revocation | Both |

**Closed 18 Sep 2026 (second pass):** the Production service-role key is confirmed by the user as
Mumbai production's; production URL/anon verified internally consistent (Tokyo); the staging
test-mode webhook environment is configured and the full HTTP + database flow is proven against
Mumbai staging.

**Blockers not owned by engineering:**

| | Item |
| --- | --- |
| B1 | `careers@gogulf.co` and `admin@gogulf.co` Workspace accounts must actually be able to sign in |
| B2 | Real job content: only confirmed listings may be published (D4) |
| B3 | A decision on applications that arrive during the switch window |
| B4 | **Privacy review** of converting applications into CRM contacts and cases, and a privacy-policy update describing it — plus payment records as personal data (§11) before any consultation charge |
| B5 | Written sign-off for deleting the Tokyo data after the 30-day retention |

**Security-sensitive items still needing manual handling:**

- **Razorpay live webhook**: not configured, and must not be until `docs/PAYMENTS.md` §8 passes.
- **Razorpay test webhook**: needs a dashboard secret and a Vercel **Preview** variable before
  staging can receive a real delivery; local probing covers the same code paths meanwhile.
- Google OAuth client creation and every staff sign-in need a human in a browser.
- `.env.prod-supabase.local` is misleadingly named: it holds **Mumbai** keys, not Tokyo.
- `.env.local` holds **live** payment credentials; treat that machine accordingly.
- Applicant documents are regulated data: encrypted volume, one named machine, no ticket, no chat,
  no AI tool.
- The rotated automation-bypass secret is fetched from the Vercel API at call time by the test
  tooling — nothing needs updating by hand, and nothing should paste it anywhere.

---

**This report makes no recommendation and grants no approval. Production database cutover has NOT
been performed. The decision is yours.**
