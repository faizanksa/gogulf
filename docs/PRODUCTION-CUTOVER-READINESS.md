# Production cutover readiness report — Tokyo → Mumbai, Phase 3

Written 18 September 2026, after the user's manual Phase 3 staging QA.

**This report is not an approval and contains no go/no-go decision.** It records what was
verified, by what method, and what remains outstanding, so the cutover decision can be made
from evidence. Nothing in production was changed to produce it: no migration was applied, no
data moved, no Vercel variable edited, no OAuth configuration touched, no staff account
created, no DNS change. Every production interaction below was a read.

It supersedes `docs/PRODUCTION-READINESS-REPORT.md` (12 Sep, Phase 2C website) for cutover
purposes; that report remains the page-by-page record of the website release candidate.

---

## A. Snapshot

| | |
| --- | --- |
| Branch / commit | `phase-2/redesign` @ **`384f58a`** ("feat(home): redesign the home page…"); working tree clean apart from untracked `.claude/` |
| `origin/staging` | **`384f58a`** — identical to the branch head |
| `origin/main` (production) | **`519cb85`** — unchanged; no merge, no push, no tag |
| Staging deployment | **`dpl_2qvaPGvcKZTGV17yiakPw47aXUzx`**, READY, branch `staging`, commit `384f58a`, created 2026-09-17T13:50:05Z → `https://staging.gogulf.co` |
| Production deployment (live now) | `dpl_9RaneE2dUCaRfmGifXYfumUjWDL9`, target production, branch `main`, commit `519cb85`, created 2026-09-13T04:54:08Z |
| Staging Supabase ref | **`noxireidrbeqcvsirjec`** (Mumbai staging, `ap-south-1`) — verified from the deployed bundle and the server-rendered page, not from the dashboard |
| Production Supabase (live now) | **`julbqkeyvzwluayokcdi`** (Tokyo) — unchanged |
| Mumbai production ref | **`exsnksrmkycloxiajwmx`** — empty of live data as last recorded; **not verifiable from this session** (§C) |
| Manual QA | Completed by the user on the deployed staging site, 18 Sep 2026: all planned Phase 3 flows work, **no issues reported**, nothing to fix |

### Checks run today (18 Sep 2026)

| Check | Command | Result |
| --- | --- | --- |
| Migration files parse | `npm run db:validate` | **PASS** — 13/13 files |
| Unit tests | `npx vitest run` | **PASS** — 201/201, 15 files |
| SQL assertions (Mumbai staging) | `db-remote --target=mumbai-staging test` | **PASS** — **280/280** (`jobs` 130, `rbac-behaviour` 84, `rls` 66) |
| Client secret scan | `npm run check:secrets` | **PASS** — 134 files, no server-only secret in client output |
| Deployed staging | `node scripts/verify-staging-deployment.mjs` | **PASS — 14/14**, including "exactly one Supabase project is referenced" and no trace of Tokyo staging, Tokyo production or Mumbai production |
| Tokyo production backup + delta | `npm run backup:prod -- verify` | **PASS** — 34/34 SHA-256 match; live 14 rows / 34 documents = backup 14 / 34; **unchanged since the backup** |
| Mumbai staging inventory | `db-remote … run supabase/snippets/readiness-inventory.sql` (read-only transaction) | migrations `0001`–`0013`; 25 tables, **all** RLS; 65 policies; 14 SECURITY DEFINER functions |
| Live production identity | Public HTTP reads of `www.gogulf.co` | Static Phase 2C build; no Supabase ref in the eagerly loaded bundle (the uploader is loaded on demand); sitemap lists 14 URLs |

Earlier results not re-run today, carried forward from the Phase 3 staging release (`5287b4a`,
`docs/PHASE-3-STAGING-RELEASE.md`): **E2E 125 passed / 0 failed** and **axe 64/64 routes with no
serious or critical violation**. After the home-page redesign (`384f58a`) a targeted subset was
run — 14 tests (home content, landmarks, mobile menu, reduced motion) plus axe on `/`, `/ar-XB`
and `/candidates` on both viewports — all passing, 0 violations. **The full E2E suite has not yet
been run against `384f58a`** (§19, prerequisite P1).

---

## B. Production data state (from the verified backup and today's delta read)

| | |
| --- | --- |
| Tokyo production applications | **14** rows in `public.job_applications` |
| Of which a test | **1** — created `2026-09-13T05:00:20.505Z`, "General Application", documents `cv-cutover-test-cv.pdf` and `passport-cutover-test-passport.png` — six minutes after that day's deploy. So **≈13 real applicants** |
| Date range of applications | `2026-09-04T17:58:57Z` → `2026-09-15T06:31:10Z` |
| Storage | bucket `job-applications`, **private**, 10 MiB limit, **34 objects**, **29,368,182 bytes** (28.01 MiB) |
| Referenced vs present | 34 referenced paths, **0 missing** — no orphans in either direction |
| Auth users in Tokyo production | **0** |
| Backup location | `backups/julbqkeyvzwluayokcdi-2026-09-16T11-06-38-944Z/` (gitignored) |
| **Exact backup timestamp** | **`2026-09-16T11:07:53.025Z`** (`manifest.json` → `taken_at`) |
| Changed since the backup? | **No.** Re-verified today: row count, document count and every SHA-256 match |

---

## C. Verification limitations (read these before trusting anything below)

1. **Mumbai production could not be inspected from this session.** The read-only inventory
   (`begin read only; …`) was refused by Claude Code's auto-mode classifier as a production
   action, and the claude.ai Supabase connector authenticates to an unrelated organisation
   (it lists only `sparqitservices` projects — confirmed today). Its state below is therefore
   **last recorded on 16 Sep by an earlier session, not independently re-verified today**.
   To close this gap yourself, run:

   ```bash
   node scripts/db-remote.mjs --target=mumbai-production \
     --yes-i-am-provisioning-production run supabase/snippets/readiness-inventory.sql
   ```

   That snippet is new in this commit and runs entirely inside a read-only transaction, so it
   cannot write even if something in it is wrong. Compare its output with the Mumbai staging
   column in §1.
2. **`supabase db push` reports failure on success** on this machine: its pgdelta step dies
   reading a CA certificate inside its container and exits non-zero *after* applying and
   recording the migrations. `scripts/db-remote.mjs` therefore ignores the exit code and reads
   `supabase_migrations.schema_migrations` instead. Never conclude a push failed without asking
   the database.
3. **The Supabase CLI drifts between accounts mid-session.** Verify the org immediately before
   any management command; `.env.supabase-token.local` holds a PAT that overrides the drift.
   Database work through the pooler (`db-remote`) does not depend on CLI auth.
4. **`/auth/v1/settings` is cached and not authoritative** — confirm auth configuration with a
   real request (e.g. an actual `POST /auth/v1/signup` attempt that must be refused), not that
   endpoint. Supabase also rejects `example.com`/`.test` addresses before the signup gate, so
   probe with a `@gogulf.co` address.
5. **Admin UI cannot be driven by an automated signed-in browser** — staff sessions need a real
   Google consent. The authorisation underneath is proven by the SQL suites, a real ADMIN-shaped
   token probe and hosted REST probes; the screens themselves rest on your manual QA.

---

## 1. Mumbai production schema readiness

| | Mumbai staging (verified today) | Mumbai production (last recorded 16 Sep, **unverified today**) |
| --- | --- | --- |
| Migrations | `0001`–`0013` | `0001`–`0011` |
| Public tables | 25, **all** with RLS | 23, all with RLS |
| RLS policies | 65 | 55 |
| SECURITY DEFINER functions | 14 | 11 |
| RBAC catalogue | 12 roles, 72 permissions, 364 grants | 12 roles, 72 permissions |
| Storage | `job-applications`, private, 10 MiB, 34 objects (synthetic rehearsal data) | same bucket, private, 10 MiB, **0 objects** |
| Live data | 14 synthetic applications, 12 test jobs, 14 categories, 3 staff | **0 applications, 0 contacts, 0 cases, 0 staff, 0 auth users** |
| Audit rows | 389 (`system` + `staff`) | 370, all `actor_type=system` (364 from the `0008` RBAC seed, 6 from settings) |

**Gap to close at cutover: `0012_jobs.sql` and `0013_job_applications_bridge.sql`.** They add the
`jobs` and `job_categories` tables (23 → 25), 10 policies, 3 SECURITY DEFINER functions, the paid-access
CHECK constraint and the column-level `anon` INSERT grants on `job_applications`. Both are additive;
neither drops or rewrites an existing object.

The tables on Mumbai staging, for comparison: `activities, audit_logs, audit_logs_2026,
audit_logs_2027, audit_logs_default, branches, case_recruitment, case_travel, case_visa, cases,
contact_identities, contact_merges, contacts, job_applications, job_categories, jobs, notes,
permissions, pipeline_stages, pipelines, role_permissions, roles, settings, staff_users, tasks`.

## 2. Migrations 0001–0013 readiness

- All 13 files parse cleanly (`npm run db:validate`, today).
- The same 13 have been applied and proven twice: on Mumbai staging, and from empty on a local
  reset — 280/280 SQL assertions in both cases.
- Numbering is gapless and each file is immutable once applied; nothing in `0012`/`0013` alters
  the shape of `0001`'s `job_applications` data, so the Tokyo rows can be imported afterwards.
- Applying to Mumbai production is a single command, and it is the only schema write the cutover
  needs:

  ```bash
  node scripts/db-remote.mjs --target=mumbai-production push --yes-i-am-provisioning-production
  ```

  The target refuses any project other than `exsnksrmkycloxiajwmx`, refuses Tokyo by name, and
  verifies the outcome by reading `schema_migrations` rather than trusting the CLI exit code.
- Immediately afterwards, run the suites there (each test rolls itself back):

  ```bash
  node scripts/db-remote.mjs --target=mumbai-production test --yes-i-am-provisioning-production
  ```

  Expect **280/280**. Run this **while the project still holds no live data**, or not at all.

## 3. Tokyo production backup and SHA-256 verification

- Backup `backups/julbqkeyvzwluayokcdi-2026-09-16T11-06-38-944Z/`, taken **2026-09-16T11:07:53.025Z**,
  contains `job_applications.json` (14 rows), `documents/` (34 files) and `manifest.json`.
- Re-verified today: **34/34 documents match their recorded SHA-256**; 34 referenced paths, 0 missing.
- The backup covers **both** Postgres rows and Storage objects. This matters because a Supabase
  database backup does not include Storage — the CVs and passports exist only in the bucket.
- The backup script is GET-only by construction and the production ref is hard-coded, so it cannot
  write to or delete from the source project.
- Re-run `npm run backup:prod -- verify` immediately before the cutover; it is also the delta check (§4).

## 4. Production delta-check procedure

The window that matters is between the backup (16 Sep 11:07 UTC) and the moment Tokyo stops
accepting applications. The live static site still writes applications and documents directly into
Tokyo, so this window is not theoretical — row 14 arrived on 15 Sep.

1. `npm run backup:prod -- verify` — prints `rows: backup N, live M` and `documents: …`, and names
   any application that arrived since. Equal counts and "has not changed since the backup" means no delta.
2. If it reports a delta, take a fresh backup (`npm run backup:prod`) so the archive and the live
   project agree, and re-verify before going further.
3. Migrate from the **verified archive**, never from the live bucket, so every byte is hash-checked.
4. Repeat the check **after** Tokyo intake is closed and before the archive is declared final. The
   last run must report zero delta.
5. Keep the printed output of the final run with the cutover record.

## 5. Rollback procedure

Rollback is cheap for as long as Tokyo keeps its data and its intake. The plan keeps it that way
until the last step.

| Stage | How to roll back | Data risk |
| --- | --- | --- |
| Mumbai production migrated (`0012`/`0013`), nothing else changed | Nothing to undo: the project holds no live data and serves no traffic. Leave it, or leave it empty | None |
| Vercel production variables switched, deployment promoted | In Vercel: promote `dpl_9RaneE2dUCaRfmGifXYfumUjWDL9` (commit `519cb85`) back to production, then restore the Supabase variables to their Tokyo values | None — Tokyo is untouched and still holds every row |
| Traffic live on the new build, before Tokyo intake is revoked | Same promote + variable restore. Any application submitted to Mumbai during the window must be exported and replayed into Tokyo (or accepted as living only in Mumbai — decide before starting, not during) | The delta in the window |
| After Tokyo `anon` INSERT is revoked | **This is the one-way door.** Rolling back now means restoring the Tokyo grant as well, and reconciling both directions | Real |

Supporting conditions: DNS TTL lowered to 300 s at least 48 h before; the previous production
deployment kept for 30 days; Tokyo kept read-only-but-alive through the soak; `main` only ever
moved by a reviewed merge.

## 6. Vercel production environment changes required

Project `gogulf`, team `faizan-chaudhary`, production branch `main`, region `bom1`, Node 24.x.
**Production environment variables today** (names only; no value was decrypted):
`NEXT_PUBLIC_EMAIL_PROVIDER`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`NEXT_PUBLIC_SUPABASE_URL`, `PLATFORM_MODE`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_REPLY_TO`.

| Change | Detail | Why |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | → `https://exsnksrmkycloxiajwmx.supabase.co` | Point the live site at Mumbai production |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | → Mumbai production anon key | Same |
| `SUPABASE_SERVICE_ROLE_KEY` | **Add** — absent from production today | `lib/supabase/admin.ts` requires it in server mode (document access, intake paths). Server-only; never `NEXT_PUBLIC_*` |
| `PLATFORM_MODE` | Confirm it is `server` | Static export has no API routes; the forms post to `/api/forms/*` |
| Build command | Comes with the merge: `main`'s `vercel.json` is `npm run build` (static export); the branch's is `cross-env PLATFORM_MODE=server npm run build` | The cutover commit is what turns production into a server build |
| `APP_ENV` | **Not required** in production — `deploymentStage()` resolves production from `VERCEL_ENV=production`. Do not set `APP_ENV=staging` there | Unconfirmed content must stay hidden in production |
| `NEXT_PUBLIC_EMAIL_PROVIDER` / `RESEND_*` | Already present; confirm the Resend values are the production sender and reply-to | Email is Resend-only; EmailJS is gone from the code |
| `NEXT_PUBLIC_EMAILJS_*` | Retire if any still exist on the project | Dead after the cutover |
| Razorpay variables | **Do not add.** No candidate payment flow exists (§14) | Adding keys would create a surface with nothing behind it |

After the promote, re-run the deployed-bundle check against production (the staging script with
`STAGING_ORIGIN` pointed at `https://www.gogulf.co`, or the equivalent manual grep) and confirm the
live chunks name **exactly one** Supabase ref, `exsnksrmkycloxiajwmx`.

## 7. Production Google OAuth configuration required

Exact values are in `docs/GOOGLE-OAUTH.md` §3. Nothing here is applied yet.

| Setting | Production value |
| --- | --- |
| OAuth client | One **Web application** client, in a Google Cloud project owned by the `gogulf.co` Workspace |
| Consent screen user type | **Internal** — not External |
| Authorized redirect URI | `https://exsnksrmkycloxiajwmx.supabase.co/auth/v1/callback` |
| Authorized JavaScript origins | `https://www.gogulf.co` **and** `https://gogulf.co` (the apex 308-redirects) |
| Supabase `site_url` | `https://www.gogulf.co` |
| Supabase `additional_redirect_urls` | `https://www.gogulf.co/**` |
| Supabase auth | Google provider on; **`enable_signup = false`**; JWT hook `custom_access_token_hook` on |

**Supabase ignores Google's `hd` claim.** The Workspace restriction comes from three independent
controls: an Internal consent screen, signups disabled, and the `staff_users` row requirement in the
JWT hook. The third is the real authorisation boundary — an authenticated `@gmail.com` identity was
proven on Mumbai staging to receive no claims, no role and zero rows.

Verify the signup gate with a real refused `POST /auth/v1/signup` using an `@gogulf.co` address, not
with `/auth/v1/settings` (§C.4).

## 8. Production SUPER_ADMIN bootstrap plan

Roster (from `scripts/bootstrap-super-admins.mjs`, not invented at run time):
`admin@gogulf.co` and `hello@gogulf.co` → **SUPER_ADMIN**.

```bash
npm run bootstrap:admins -- --target=mumbai-production --yes-bootstrap-production-admins
npm run bootstrap:admins -- --target=mumbai-production --report   # read back
```

- Creates an `auth.users` row with a **confirmed email and no password**, plus a `staff_users` row
  with the catalogue role, Lucknow branch, active. No password means there is no second, weaker door.
- Idempotent: an existing user or staff row is adopted, never duplicated or silently overwritten.
  It fails outright if two people resolve to the same record.
- It grants nothing directly — authority flows from `staff_users` → JWT hook → `has_perm()` → RLS.
  A role not already in `public.roles` is refused rather than created.
- Each administrator must then complete a **real Google sign-in** and be verified individually
  (`supabase/snippets/verify-google-signin.sql`), because one working login proves nothing about another.
- On Mumbai staging this produced exactly the expected result: 2 SUPER_ADMIN + 1 ADMIN, all active,
  3 auth users, 4 identities.

## 9. Production ADMIN bootstrap plan

Same script and same roster entry: `careers@gogulf.co` → **ADMIN** (Lucknow, active).

Proven on staging: an ADMIN can run the whole job lifecycle and work applications, and **cannot**
manage roles or permissions, promote itself, alter a SUPER_ADMIN, or insert audit rows. Those refusals
are asserted in `rbac-behaviour.test.sql` (84 assertions), which must pass on Mumbai production before
the first real sign-in.

Sequencing note: `careers@gogulf.co` and `admin@gogulf.co` are still pending on Google's side. Until
each mailbox can actually complete Google sign-in, an ADMIN exists in the database but cannot log in.
Confirm the Workspace accounts before treating staff access as ready.

## 10. RLS and security verification

- **25 tables, all with RLS**, 65 policies, 14 SECURITY DEFINER functions on Mumbai staging
  (`has_perm`, `is_staff`, `scope_allows`, `write_audit_log`, `record_document_access`,
  `job_applications_intake`, `jobs_audit`, `resolve_contact`, …).
- **280/280 SQL assertions** pass, covering anon, non-staff, VIEW_ONLY, RECRUITER, MARKETING, HR,
  ADMIN and SUPER_ADMIN behaviour — not just policy existence.
- Named anon guarantees, asserted rather than assumed: no table-wide SELECT on `jobs`; only the public
  columns a listing shows; `internal_notes` unreadable; drafts and archived jobs invisible; no job may
  be deleted by any API role (archive only); `job_applications` writable by column, never readable.
- `job_applications` privileges on Mumbai staging: `authenticated=SELECT`, `service_role=DISU`, and
  column-level `anon` INSERT limited to `cv_path, email, experience, full_name, id, job_country, job_id,
  job_title, message, other_paths, page_source, passport_path, phone` — notably **not** `status`.
- Storage: 2 policies on a private bucket; staff read is policy-gated, and the public has no path to
  an object.
- `npm run check:secrets`: 134 build-output files scanned, no server-only secret reachable from the client.
- Hosted REST probes recorded at the staging release: closed-job application 400, anon `status` 401,
  anon read 401, draft invisible, `internal_notes` 401.

**These results are from Mumbai staging.** The same suites must be run on Mumbai production after
`0012`/`0013` and before any real data exists.

## 11. Application → Contact → Case: privacy and data-processing implications

`0013` lets staff convert a job application into a CRM **contact** and a **case**. That is new
processing of applicant personal data, and it is the item on this list with a legal, not technical,
gate.

- **What changes:** an applicant who submitted a CV and passport scan for one job becomes a durable
  contact record with a case history, retained beyond the life of that application.
- **Lawful basis and notice:** the privacy policy must say that applications become contact and case
  records, for what purpose, for how long, and how to ask for deletion (DPDP data-principal rights).
  The current policy was written for a form that emails a CV — it does not describe a CRM.
- **Consent flags on import:** email `true`; **WhatsApp, SMS and marketing `false`**. They consented to
  a job application, nothing more. Manufacturing consent is the expensive mistake here.
- **Imported cases** land in a "Legacy — imported, not triaged" stage, unassigned, with `opened_at` set
  to the original application date — so nobody mistakes them for worked leads.
- **Documents import as `uploaded`, never `approved`** — nobody verified them, and recording otherwise
  fabricates an audit trail.
- **Minimisation in the audit trail:** triage and conversion are audited without PII (§15).
- **Not yet done:** the privacy review itself. It is listed as a blocker (§19, B4), and it should
  precede the first real conversion, not the cutover of the website.

## 12. Job publishing safeguards

- Lifecycle `draft → review → published → closed → archived`, with the reverse moves that make sense
  (unpublish, reopen, restore). **Jobs are archived, never deleted** — no API role holds DELETE, and
  `jobs` carries no DELETE or ALL policy.
- Staff create **drafts only**. `job_publish_problems` blocks review/publish unless the listing states
  the minimum a genuine vacancy needs: title, place, category, a closing date that is still ahead if it
  is time-limited, requirements if professional, and free application access.
- Public exposure is RLS-bounded to `status in ('published','closed')`; drafts, in-review and archived
  jobs 404 for everyone, including by direct URL.
- Closed jobs explain themselves and refuse applications; `JobPosting` structured data appears only on
  open jobs; the sitemap lists open jobs only.
- Every lifecycle action is audited with the acting staff email and the changed fields only
  (`job.published`, `job.unpublished`, `job.closed`, `job.reopened`, `job.archived`, `job.restored`,
  `job.featured`, `job.featured_until_changed`, …).
- Publishing revalidates the public paths, so a publish is visible on the next request — no deploy needed.
- **Content rule for production (decision D4):** publish only confirmed listings. The 12 `STAGING TEST`
  jobs exist only on staging; the seed refuses any production target and refuses to run without the
  staging marker.

## 13. Free/Ongoing vs Professional/Featured architecture

Five independent concepts, deliberately not collapsed into one "job type":

| Concept | Column(s) | Values |
| --- | --- | --- |
| Classification | `classification` (from the category) | `general`, `professional` |
| Lifecycle | `status` | `draft`, `review`, `published`, `closed`, `archived` |
| Availability | `availability`, `closes_on` | `ongoing` (no date), `time_limited` (date required to publish) |
| Promotion | `promotion`, `featured_until` | `standard`, `featured` (optionally until a date) |
| Application access | `application_access`, `application_method` | `free`, `paid` · `online_form`, `whatsapp` |

Live combinations today: **Professional + Featured + Free**, **General + Ongoing + Free**, and —
only once an approved payment flow exists — Professional + Standard + Paid.

**Featured is read, never written back:** a job is featured while `promotion = 'featured'` and
`featured_until` has not passed (inclusive, India time). Nothing mutates when it lapses, so there is no
scheduled job to fail and no stale flag to clean up. Presentation order is featured, then ongoing and
general hiring, then professional. No urgency is derived from data — a closing date is shown as a date,
never as "closing soon".

## 14. Paid application protection and the Razorpay boundary

Paid application access is modelled but **cannot go live by configuration**. Four independent guards:

1. **`jobs_paid_application_not_public`** — a CHECK constraint:
   `NOT (status IN ('published','closed') AND application_access = 'paid')`. A constraint, not a
   settings flag, so switching paid applications on requires a migration and a review.
2. **`jobs_before_write`** names the problem (`paid_application_unavailable`) when a publish is attempted.
3. **`job_applications_intake`** refuses an application to any job that is not published **and** free.
4. The staff form states that paid application access is not currently available.

The SQL suite asserts exactly this, in these words: *"paid application access cannot be public:
enforced by a CHECK constraint, not a setting."*

**Razorpay boundary:** approved for consultation fees only. There is no candidate payment flow, no
Razorpay code path in the application, and **no Razorpay variable in the Vercel production
environment** — confirmed today. Keep it that way at cutover; adding keys would create a payment
surface with nothing behind it.

## 15. Audit-log coverage

- `audit_logs` is partitioned (`audit_logs_2026`, `audit_logs_2027`, `audit_logs_default`) with
  `ensure_audit_partition` maintaining it.
- Writes go through `write_audit_log` (SECURITY DEFINER). **Staff cannot insert audit rows directly** —
  asserted for ADMIN and below, including SUPER_ADMIN for the self-service cases.
- Covered: every job lifecycle action with the acting staff email and changed fields; application triage
  and conversion (without PII); document opening, recorded by document kind; system seeding.
- Mumbai staging currently holds 389 rows with `actor_type` in (`staff`, `system`) — 370 of them the
  expected seed baseline, the rest produced by the rehearsal and your QA.
- Mumbai production should show **exactly 370 rows, all `actor_type=system`,** before any staff activity.
  A different number means something has already used the project and needs explaining before cutover.
- **Known caveat:** `record_document_access` writes its audit entry *before* the signed link is issued,
  so a Storage failure afterwards leaves an "opened" entry for a document that never opened. The bias is
  toward over-recording access, which is the safer direction, but it is not a precise record of what a
  member of staff actually saw.

## 16. Document migration and secure access

**Access (already built):** documents live in a private bucket; staff reach them only through a server
route that checks permission, issues a short-lived signed URL and records the access. There is no public
path to an object, and the anon role cannot read `job_applications` at all.

**Migration procedure (not yet run):**

1. Copy from the **verified archive**, never the live bucket, into
   `contacts/{contact}/cases/{case}/{document}.{ext}`.
2. Re-verify SHA-256 after upload; **a mismatch fails that row** rather than logging a warning.
3. Import documents with status `uploaded`, never `approved`.
4. Quarantine any phone number that fails E.164 for manual review — never guess a normalisation, because
   a wrong one silently merges two different people.
5. Keep the working copy on an encrypted volume on one named machine — not a synced folder, not the repo,
   not a ticket, not an AI tool. Delete it once the migration is verified, and record who ran it, when,
   and where the archive lives.
6. Revoke Tokyo's legacy anon INSERT **after** the delta is zero (this is the one-way door in §5).
7. Retain Tokyo read-only for 30 days, then archive, then delete with written sign-off.

Note for the smoke test: the 14 rehearsal applications on staging carry **synthetic documents (random
bytes by design)**, so opening one shows an unreadable file. That is expected and is not a defect. A
genuine end-to-end document check needs a freshly submitted application.

## 17. Production smoke-test plan (after cutover, before announcing)

Run in this order; stop at the first failure and consult §18.

1. **Build and isolation** — the deployment's build log shows the isolation guard passing and names the
   Mumbai production project.
2. **Bundle identity** — the live chunks name exactly one Supabase ref, `exsnksrmkycloxiajwmx`; no
   `julbqkeyvzwluayokcdi`, `wxolbnhyzktfjdvcnixc` or `noxireidrbeqcvsirjec` anywhere.
3. **Public pages** — `/`, `/jobs`, a job page, `/candidates`, `/employers`, `/services`, `/about`,
   `/contact`, `/verify`, `/pricing`, both policies: all 200, correct company facts, no "STAGING TEST"
   content anywhere.
4. **Structured data and indexing** — `Organization` JSON-LD asserts only verified facts; `JobPosting`
   only on open jobs; `robots.txt` and `sitemap.xml` correct; production is **not** `noindex`.
5. **Job visibility** — a draft and an archived job 404 by direct URL; a closed job explains itself and
   refuses applications.
6. **Application intake** — submit one real test application with a real CV and passport file; confirm
   the row lands in Mumbai production, the documents upload, the acknowledgement email arrives through
   Resend, and the internal notification reaches the right desk.
7. **Document access** — open that application's CV and passport from `/admin` as staff; confirm both
   render and that the access is audited by kind.
8. **Staff sign-in** — each administrator signs in with Google individually; verify the claims
   (`app_role`, `app_staff_id`, `app_branch`) with `verify-google-signin.sql`; confirm an `@gmail.com`
   identity gets nothing.
9. **Admin gate** — `/admin` without a session redirects to `/admin/login?next=…`; `/admin/login` is
   `noindex`.
10. **Authorisation** — ADMIN can run the job lifecycle; ADMIN cannot manage roles or permissions,
    promote itself, or alter a SUPER_ADMIN.
11. **Security headers** — `x-content-type-options`, `x-frame-options`, `referrer-policy`,
    `strict-transport-security`, `permissions-policy` present; no `x-powered-by`.
12. **Clean up** — delete the test application and its documents from Mumbai production, and record that
    you did.

## 18. Exact conditions that must stop or reverse the cutover

**Stop before switching traffic** if any of these is true:

- `0012`/`0013` do not both appear in `schema_migrations` on Mumbai production, or the SQL suites do not
  report 280/280 there.
- Mumbai production shows any pre-existing live data: applications, contacts, cases, staff, auth users or
  storage objects — or an audit-row count other than 370, all `system`.
- The delta check reports a difference the archive does not contain, or any SHA-256 mismatch.
- The deployed bundle names more than one Supabase project, or names Tokyo.
- `SUPABASE_SERVICE_ROLE_KEY` is missing in production, or any server-only secret appears in client output.
- Google sign-in does not work for **every** administrator, or a non-Workspace account can obtain a role.
- A draft, in-review or archived job is publicly reachable; or a paid job can be published.
- The full E2E suite has not been run against the cutover commit (§19, P1).

**Roll back after switching** if any of these appears:

- Applications fail to submit, or documents fail to upload, or a submitted document cannot be retrieved.
- Any applicant data is written to the wrong project, or an application arrives with missing document paths.
- Any unauthenticated access to `job_applications`, `contacts`, `cases` or the storage bucket succeeds.
- Staff cannot sign in, or a member of staff receives the wrong role.
- The live site serves staging or test content, or `noindex` reaches production.
- Error rates or 5xx responses rise materially above the pre-cutover baseline and are not explained
  within the first hour.

Roll back by promoting `dpl_9RaneE2dUCaRfmGifXYfumUjWDL9` and restoring the Tokyo Supabase variables
(§5). While Tokyo still holds its data and its intake grant, this is a five-minute reversal.

## 19. Remaining blockers and prerequisites

**Prerequisites still to complete (in order):**

| | Item | Owner |
| --- | --- | --- |
| P1 | Run the **full E2E and axe suites against `384f58a`** — the home page changed after the last full run. Do it on an idle machine with `--workers=1` or `2`; free memory was 232 MB today, and heavy runs under ~1 GB produce false timeouts | Me, on your word |
| P2 | **Rotate the Vercel automation-bypass secret** — see below; it is still the 10 Sep value | You (Vercel dashboard) |
| P3 | Independently verify Mumbai production's current state with the read-only snippet (§C.1) | You |
| P4 | Apply `0012`/`0013` to Mumbai production and run the suites there — **only while it holds no live data** | You, or me with explicit approval |
| P5 | Create the production Google OAuth client (Internal) and apply the Supabase auth settings | You (Google Cloud) |
| P6 | Bootstrap production staff, then verify a real Google sign-in per person | You, or me with explicit approval |
| P7 | Switch the Vercel production variables and promote the cutover build | You |

**Blockers not owned by engineering:**

| | Item |
| --- | --- |
| B1 | `careers@gogulf.co` and `admin@gogulf.co` Google Workspace accounts must actually be able to sign in |
| B2 | Real job content: only confirmed listings may be published (D4) |
| B3 | A decision on what happens to applications that arrive during the switch window (§5, row 3) |
| B4 | **Privacy review** of converting applications into CRM contacts and cases, and a privacy-policy update that describes it, before the first real conversion (§11) |
| B5 | Written sign-off for the eventual deletion of the Tokyo data after the 30-day retention |

**Security-sensitive items that still need manual handling:**

- **Vercel automation-bypass secret — not rotated.** The project's `automation-bypass` entry was created
  **2026-09-10T15:18:55Z**, and the leak into a local Playwright log happened on 17 Sep, so the exposed
  value is still live. Regenerate it at Project → Settings → Deployment Protection. Nothing in this
  report printed it, and staging e2e output must stay filtered because Playwright prints request headers
  on failure.
- Service-role keys and database passwords live only in gitignored env files; `.env.prod-supabase.local`
  is misleadingly named — it holds **Mumbai** keys, not Tokyo. Read the URL in a file before using it.
- Google OAuth client creation and every staff sign-in need a human in a browser; they cannot be automated.
- Applicant documents are regulated data: encrypted volume, one named machine, no ticket, no chat, no AI tool.
- Production reads from this session are blocked by the auto-mode classifier — if you want me to verify
  Mumbai production directly, you will need to allow it explicitly.

---

## What I have not done

No production change of any kind: Tokyo untouched, Mumbai production untouched, no Vercel variable
edited, no OAuth configuration created, no staff or auth user created, no data migrated, no DNS change,
no merge to `main`, no tag pushed. The only repository change accompanying this report is the read-only
inventory snippet it references.

**This report makes no recommendation and grants no approval. The cutover decision is yours.**
