# Main release readiness — Phase 3 platform onto `main`

Written 18 September 2026. This is a **release-preparation record**, not an approval, and it
contains no go/no-go recommendation. Statuses are factual:

| Status | Meaning |
| --- | --- |
| **VERIFIED** | Proven by a test or probe run for this document, with the result stated |
| **VERIFIED — STAGING** | Proven against Mumbai staging; the production equivalent needs the cutover |
| **NOT BUILT** | No code exists for it |
| **BLOCKED** | Built, but cannot run in production until a named prerequisite is done |
| **NEEDS A HUMAN** | Cannot be automated (browser consent, dashboards, business decisions) |

> ### What merging this into `main` does, in one paragraph
>
> A push to `main` starts a Vercel **production** build. This release makes the public job
> pages read the `jobs` table (`0012`), makes every application write `job_id` (`0013`), and
> adds a staff workspace that needs `0002`–`0014`. **Tokyo production has migration `0001`
> only.** So the release cannot run against Tokyo, and nothing in the live-operations scope
> (real vacancies, applications linked to jobs, the admin workspace) can operate on Tokyo. From
> commit `304130c`, a production build whose `NEXT_PUBLIC_SUPABASE_URL` names Tokyo **fails at
> its first step with an explicit message**, and Vercel keeps serving the current deployment.
> **In practice, the merge takes effect together with the Mumbai cutover** (§14).

No production system was changed while preparing this document (§15.8).

---

## 1. Current `main`

| | |
| --- | --- |
| `origin/main` | **`519cb85`** — "docs: final release-candidate report after the pre-cutover corrections" |
| Live production deployment | `dpl_9RaneE2dUCaRfmGifXYfumUjWDL9` (`gogulf-mob4x494m`), built from `519cb85` on 2026-09-13 04:54 UTC, aliased to `www.gogulf.co` |
| Build mode of the live site | **Server mode** — verified 18 Sep with plain GET requests: `/api/forms/contact` and `/api/forms/job-application` answer `405` (the routes exist; they only accept POST), and `/admin` answers `307 → /admin/login`. `PLATFORM_MODE=server` in the Vercel Production environment took effect at that build, although `main`'s `vercel.json` says only `npm run build` |
| Live database | Tokyo `julbqkeyvzwluayokcdi`, migration `0001` only |
| Live `/jobs` | "No jobs are listed right now"; no `JobPosting` markup (all six static jobs on `main` are `unconfirmed`) |
| Service-role key in the live build | **None used.** `519cb85` has no `createAdminClient()` call site and no server-side table read, and the live deployment predates the key being added to the environment |

**Correction to earlier documents.** `docs/PRODUCTION-CUTOVER-READINESS.md` §6 and §10 describe
production as "a static export from `main` with no server routes". Live requests show otherwise
(above). The conclusion drawn there still holds, for a different reason: the live build uses no
service-role key.

The local `main` ref on the development machine is stale (`b9ff284`, 29 behind). Use `origin/main`.

## 2. Release candidate

| | |
| --- | --- |
| Branch | `phase-2/redesign`, pushed to **`origin/staging`** only |
| Code under test | **`304130c`** — every test in §12 ran against this code |
| Release head | the commit adding this document (documentation only on top of `304130c`) |
| Commits above `main` | 28 code/test/doc commits plus this document; `main` is an ancestor, so the merge is a fast-forward |
| Staging deployment of `304130c` | **`dpl_GGVPsG47cV2jewXJ63pPtEc7cTY9`**, READY, aliased to `staging.gogulf.co`; build log shows `Commit: 304130c`, `Environment: staging`, `Supabase API: project noxireidrbeqcvsirjec`, `Razorpay: no key`, isolation guard `PASS` |
| Staging Supabase | Mumbai staging `noxireidrbeqcvsirjec`, migrations `0001`–`0014` (read back 18 Sep) |

## 3. Change summary

136 files changed from `519cb85` to `427aaac` (+16,784 / −1,595), plus 5 files in `304130c`.

| Area | Commits | Size | What changed |
| --- | --- | --- | --- |
| Public website / redesign | `384f58a` | 10 files, +702/−308 | Home page rebuilt around the company record and a jobs board (`JobRow`, `CopyButton`, `ProcessSteps`); `RouteGraphic` removed |
| Jobs (public) | `625c9c1` | 28 files, +2,539/−693 | Job pages and listings read the database; `content/jobs.ts` deleted; `JobPosting` only on open jobs; sitemap lists open jobs only; apply form carries the job reference |
| Applications | `2299f14`, `27ee3f1` | in migrations | `0011` anon INSERT only; `0013` column-level anon INSERT, `job_id`, status, assignee, branch, contact/case links, conversion function, audited document access |
| Candidate / contact / case | `2299f14`, `0fa1c0d` | — | Application → contact → recruitment case via `convert_job_application()`; **no separate candidates table** |
| CRM / admin | `0fa1c0d` | 40 files, +4,202/−23 | Google staff sign-in (`/auth/callback`); workspace for jobs, categories, applications, contacts, cases; audit history panel |
| RBAC | `59671df`, `74b2d6f`, `284418d` | — | Per-person roles on the staff roster; bootstrap script; claim-shape tests. The role catalogue itself (`0008`) is unchanged and already on Mumbai production |
| Billing / payments | `8714b78` | 6 files, +668 | `0014` `payments` + `payment_events`; consultation purpose only |
| Razorpay infrastructure | `8714b78` | — | `POST /api/razorpay/webhook`; `createConsultationOrder()` with no call site |
| Email | `625c9c1` | small | Application email template shows the job reference; still Resend, server-side |
| Security | `27ee3f1`, `4c6fcf6`, `8714b78`, `304130c` | — | Narrower anon grants; production build guards; live-key isolation; probe guard |
| Database migrations | `27ee3f1`, `2299f14`, `8714b78` | 4 files, +1,567 | `0011`–`0014` |
| Tests | `1b34aaf`, `284418d`, `8a60e82`, `427aaac` | SQL +1,251; e2e +160; unit +22 | Jobs, payments, RBAC behaviour, RLS; e2e for DB jobs, apply bridge, admin gate |
| Documentation | 9 commits | 8 files, +1,383 | JOBS, PAYMENTS, GOOGLE-OAUTH, PHASE-3 release, cutover readiness, this file |
| Tooling | `647ac38`, `f529e03`, `eea570b`, `bf81b02`, `86038d3`, `8714b78` | 11 files, +1,707/−128 | Backup/restore, remote DB runner, bootstrap, probes, bypass rotation, staging verifier |
| Deployment / environment | `4c6fcf6`, `20083e7`, `d40e774`, `304130c` | — | `vercel.json` forces server mode; production prebuild guard; `[remotes.*]` Supabase auth settings |
| Types | `2299f14`, `8714b78` | 2 files | Generated database types |

### Classification of what is not ordinary application code

| Item | Class | In the production bundle? | Guard |
| --- | --- | --- | --- |
| `supabase/seeds/staging-jobs.sql` (12 STAGING TEST jobs) | Staging / test only | No | `config.toml` seeds only `./seed.sql` (absent); remote runners refuse production; `lib/jobs/seed-safety.test.ts` fails if a migration writes a job |
| `scripts/db-seed-local.mjs`, `db-test-local.mjs`, `use-local-supabase.mjs` | Development only | No | Talk to the local container over `docker exec`; no URL or credential |
| `scripts/db-remote.mjs` | Operations | No | One pinned ref per target; Tokyo refused by name; Mumbai production needs `--yes-i-am-provisioning-production` |
| `scripts/bootstrap-super-admins.mjs` | Operations | No | Pinned refs; production needs `--yes-bootstrap-production-admins` |
| `scripts/backup-production.mjs` | Operations | No | Tokyo only, GET only by construction |
| `scripts/restore-backup.mjs` | Operations | No | Refuses both production refs |
| `scripts/razorpay-webhook-probe.mjs` | Test tooling | No | **New in `304130c`:** outside local/staging, `--secret`, `--order`, `--failed-order` are refused |
| `scripts/verify-staging-deployment.mjs`, `rotate-bypass-secret.mjs`, `scripts/perf/*` | Staging tooling | No | Staging origin / preview protection only |
| `supabase/snippets/*.sql` | Read-only operator snippets | No | Never run automatically |
| `supabase/config.toml` `[remotes.*]` | Hosted auth settings | No | Applied only by an explicit `supabase config push` |
| `tests/e2e/*`, `supabase/tests/*` | Test only | No | — |

**Depends on Mumbai production being connected:** public job pages and the jobs board, applying
to a specific job, the whole `/admin` workspace, staff Google sign-in, applicant document access,
the webhook.

**Depends on environment not yet correct in production:** the three Supabase values must name
Mumbai production (§5). No variable is missing by name.

**Production-unsafe items found in runtime code:** none. Two tooling gaps and two leftovers were
fixed in `304130c` (§6).

## 4. Database migration requirements

| Migration | Tokyo production | Mumbai production | Mumbai staging | Local (from empty) |
| --- | --- | --- | --- | --- |
| `0001` job_applications | ✅ | ✅ | ✅ | ✅ |
| `0002`–`0010` platform, identity, CRM, audit, RLS, RBAC seed, hardening | — | ✅ | ✅ | ✅ |
| `0011` job_applications privileges | — | ✅ | ✅ | ✅ |
| `0012` jobs | — | **required** | ✅ | ✅ |
| `0013` applications bridge | — | **required** | ✅ | ✅ |
| `0014` payments | — | **required** | ✅ | ✅ |

**Required on Mumbai production before the cutover: `0012`, `0013`, `0014`, in that order.**
Nothing is ever applied to Tokyo. Mumbai production state is from the read-only inventory of 18
Sep (`docs/PRODUCTION-CUTOVER-READINESS.md` §1); it was not re-read for this document.

| Property | Result |
| --- | --- |
| Ordered, gapless | **VERIFIED** — `0001`–`0014`; `npm run db:validate` 14/14 parse |
| From an empty database | **VERIFIED** — `supabase db reset --local` applied `0001`–`0014`; 316/316 assertions |
| On Mumbai staging | **VERIFIED — STAGING** — 316/316; `schema_migrations` reads `0001`…`0014` |
| RLS coverage | **VERIFIED** — `rls.test.sql` asserts every public table has RLS enabled, and pins the anon/authenticated privileges on `job_applications`, `payments`, `payment_events`, `jobs` |
| Re-runnable (applied a second time on top of itself, rolled back) | `0011` ✅, `0013` ✅, `0014` ✅. **`0012` is not**: tables, types and policies are guarded, but its six `create trigger` statements are not, so a second run stops at the first one |

`0012` is already applied on Mumbai staging, and applied migrations are not edited. The CLI
applies and records each file once. **If a push to Mumbai production fails partway, read
`supabase_migrations.schema_migrations` and the object list before retrying.** Do not trust
the exit code: `db push` reports failure on success on this machine.

Command, when the cutover is approved:

```bash
node scripts/db-remote.mjs --target=mumbai-production push --yes-i-am-provisioning-production
node scripts/db-remote.mjs --target=mumbai-production test --yes-i-am-provisioning-production   # expect 316/316, only while it holds no live data
```

## 5. Environment requirements

Vercel project `gogulf`, team `faizan-chaudhary`. Names read 18 Sep with `vercel env ls`; no value
was decrypted.

| Variable (Production) | Today | Required when `main` deploys |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Tokyo | **→ `https://exsnksrmkycloxiajwmx.supabase.co`** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Tokyo | **→ Mumbai production anon key** |
| `SUPABASE_SERVICE_ROLE_KEY` | Mumbai production (user-verified; write-only in Vercel) | unchanged |
| `PLATFORM_MODE` | `server` | unchanged (`vercel.json` now also forces it) |
| `NEXT_PUBLIC_SITE_URL` | `https://www.gogulf.co` | unchanged |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_REPLY_TO`, `NEXT_PUBLIC_EMAIL_PROVIDER` | present | unchanged |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | present, **live**, Production only | unchanged; no live webhook configured |
| `APP_ENV` | absent | **must stay absent** — `staging` would add `noindex` to production |
| `NEXT_PUBLIC_EMAILJS_*` | absent | nothing to retire |

**The first two change together, in one edit, and only as part of the cutover.** From `304130c`,
the production prebuild enforces it:

| Production build sees | Result |
| --- | --- |
| Tokyo URL (today's environment) | **FAIL**, explicit message; live deployment untouched |
| Mumbai URL + Mumbai anon + Mumbai service role | PASS |
| Mumbai URL + Tokyo anon, or + a service-role key from another project | **FAIL** (half-switched cutover) |
| Keys that are not JWTs (new Supabase key format) | PASS on the URL check; cross-project check not possible |
| `PLATFORM_MODE` or a Supabase variable missing | FAIL (existing check) |

Preview (staging) today: Mumbai staging URL/anon/service role, a generated **test**
`RAZORPAY_WEBHOOK_SECRET`, `APP_ENV=staging`, **no** Razorpay key id or secret.

## 6. Security verification

| Check | Method | Result |
| --- | --- | --- |
| No secret in the client bundle | `npm run check:secrets` | **VERIFIED** — 134 files, 10 server-only values, none found |
| No secret in tracked files, build output, docs, logs | `node scripts/check-secret-config.mjs` | **VERIFIED** — 563 files, **13** values (now includes the Google OAuth client secret), none found |
| No secret anywhere in git history | full-patch search of every commit on every branch | **VERIFIED** — 86 commits, 15 values (service-role keys, DB passwords, Supabase PAT, Razorpay secrets, Resend key, Google secret, Vercel CLI token), none found |
| No Vercel token committed | token read in-process, searched in tracked files + build + test output | **VERIFIED** — 448 files, not found |
| No env file tracked | `git ls-files` | **VERIFIED** — only `.env.example`, `.env.local.example` |
| No live Razorpay key on staging | build log + `vercel env ls preview` | **VERIFIED** — `Razorpay: no key`; Preview holds only a test webhook secret |
| Service-role key only on the server | `server-only` import + call sites | **VERIFIED** — used only by `lib/payments/record.ts` (webhook) and `lib/payments/consultation.ts` (no call site) |
| No staging refs / test ids / credentials in runtime code | grep of `app`, `lib`, `components`, `content`, `messages`, `public` | **VERIFIED** — one staging sentence in a staff form hint, removed in `304130c` |
| No test data seeded into production automatically | seed wiring | **VERIFIED** (§3) |
| No production migration can run by accident | runner guards | **VERIFIED** — Tokyo refused by name; Mumbai production needs an explicit flag |
| Cutover requires explicit confirmation | build guard + runner flags | **VERIFIED** — §5 table, 11 synthetic scenarios all as expected |
| Anonymous users cannot read, list, sign, overwrite or delete applicant documents | live Storage API probe on local | **VERIFIED** — 8/8 (upload allowed; download, list, signed URL, public URL, upsert, delete refused; `job_applications` read → `42501`) |
| Anonymous users cannot read or change applications | SQL suites | **VERIFIED** — column-level INSERT only; no SELECT/UPDATE/DELETE; cannot set status, assignee, branch, contact or case |

**Changed in `304130c`:**

1. `scripts/check-staging-isolation.mjs` — the production guards in §5.
2. `scripts/razorpay-webhook-probe.mjs` — refuses signed or order-driving probes against any
   origin that is not local or staging. Before this, `--base=https://www.gogulf.co --secret=<live>
   --order=<real order>` could have marked a real payment paid without money moving.
3. `scripts/check-secret-config.mjs` — also searches for `GOGULF_GOOGLE_SECRET`.
4. `components/admin/JobForm.tsx` — staging-only sentence removed from a hint staff see.
5. `.env.local.example` — stale EmailJS variables removed.

## 7. Jobs readiness — **VERIFIED — STAGING; BLOCKED in production on the cutover**

| Step you asked about | How it exists | Evidence |
| --- | --- | --- |
| Draft | New jobs start as `draft`; the database refuses anything else from staff (`job_must_start_as_draft`) | `jobs.test.sql` |
| Preview | `/admin/jobs/<id>/preview` renders the public page for any status; the `review` status is the hand-off | e2e + staging QA |
| Open | `review → published`, blocked by `job_publish_problems` until place, category, future closing date (if time-limited), requirements (if professional) and free application access are set | `jobs.test.sql` |
| Featured / unfeatured | `setPromotion` with optional `featured_until`; featured is **read**, never written back when it lapses | `jobs.test.sql` |
| Close | `published → closed`; public page shows "closed", `noindex`, no `JobPosting`, applications refused | e2e `jobs.spec`, `seo.spec` |
| Reopen | `closed → published` | trigger whitelist |
| Archive / restore | `→ archived` from any status; `archived → draft`. No delete privilege or policy exists | `jobs.test.sql` |

| Requirement | Result |
| --- | --- |
| Transitions enforced by the database, not only the UI | **VERIFIED** — `jobs_before_write` whitelists every transition |
| `created_at`, `created_by` preserved | **VERIFIED** — set from the signed-in staff member's JWT; immutable on update |
| `updated_at`, `updated_by` | **VERIFIED** — server-set on every write |
| SUPER_ADMIN sees creator / last editor | **VERIFIED** — job page shows creator and last editor with timestamps. Visible to **every** staff member who can read the job, not only SUPER_ADMIN |
| Job audit events | **VERIFIED** — `jobs_audit` trigger, same transaction, acting staff email and changed fields; History panel requires `audit.view` |
| Public listing / detail | **VERIFIED — STAGING** — deployed staging lists 12 test jobs; draft job 404s; unknown job 404s |
| `JobPosting` only for valid open jobs | **VERIFIED** — returns nothing unless `published`, open today, and summary, country, employment type, employer and publish date are all present; salary only if staff entered one |
| Closed/draft/archived not indexed | **VERIFIED** — drafts/review/archived 404; closed is `noindex`; sitemap lists open jobs only |
| Application links to the correct job | **VERIFIED** — the database checks the job is published and free, and records the job's own title |
| No unsupported claims | **VERIFIED** — no urgency or counts derived from data; hiring organisation is the named employer or Go Gulf |
| Real vacancy in production | **BLOCKED** — needs `0012` on Mumbai production, the cutover, and a staff sign-in (§14) |

## 8. Applications readiness — **VERIFIED — STAGING; BLOCKED in production on the cutover**

Chain preserved: **Application → Contact → Recruitment Case → Job**. No candidates table.

| Requirement | Result |
| --- | --- |
| Creation | **VERIFIED** — browser uploads documents, then inserts the row with the anon key (column-level INSERT); the server route sends Resend emails |
| Duplicate handling | **VERIFIED** — converting twice returns the existing links; `resolve_contact` matches a differently formatted phone to the same contact; an applicant who exists as a contact outside your scope is refused, not duplicated. Two submissions by the same person stay two applications |
| Contact resolution / case creation | **VERIFIED** — `convert_job_application()` creates or links the contact and opens a `GG-REC` case |
| Status | `new`, `screening`, `converted`, `rejected`, `withdrawn` |
| Assignment, branch, reviewer | **VERIFIED** — assignee and branch set through `assignApplication`; there is no separate "reviewer" field — the assignee is the reviewer |
| Job linkage | **VERIFIED** — `job_id`; the database refuses closed or paid-access jobs |
| Document access | **VERIFIED** — staff-only route, re-checked by `record_document_access()` (permission + scope), audited by document kind, 60-second signed link, Storage policy as a third gate |
| Audit trail | **VERIFIED** — triage and conversion audited without PII |
| RLS | **VERIFIED** — RECRUITER sees only assigned applications; MARKETING_MANAGER opens no document; VIEW_ONLY cannot convert; non-staff read nothing |
| Anonymous cannot read, modify, change status, or open documents | **VERIFIED** (§6) |

Caveat: `record_document_access` writes its audit entry **before** the signed link is issued, so a
Storage failure afterwards leaves an "opened" entry for a document that did not open.

## 9. CRM readiness — **VERIFIED — STAGING (read and convert only)**

| Built | Not built |
| --- | --- |
| Contacts list and detail (read) | Editing a contact, merging, tags, notes UI |
| Cases list and detail (read) | Case stage changes, tasks, activities, appointments UI |
| Conversion from an application | Portal for customers (blocked on India DLT registration) |
| Role and scope enforcement through RLS for all of the above | Role / permission management UI, settings UI, audit-log browser beyond per-job and per-application history |

**Roles vs the brief.** The staff roster script assigns `hello@gogulf.co` → SUPER_ADMIN,
`admin@gogulf.co` → SUPER_ADMIN, `careers@gogulf.co` → ADMIN. In the `0008` catalogue (already on
Mumbai production) **ADMIN also holds `audit.view`, `settings.manage` and `users.manage`**, and ADMIN
cannot manage roles or permissions, promote itself, alter a SUPER_ADMIN or insert audit rows
(`rbac-behaviour.test.sql`). Your brief lists audit history as SUPER_ADMIN-only; the current
catalogue gives it to ADMIN too. Changing that needs a new migration and is your decision.

## 10. Billing and payment readiness

| Capability | Status |
| --- | --- |
| `payments` + `payment_events` tables, consultation purpose only | **VERIFIED** (local, Mumbai staging) |
| Webhook updates payment state, idempotently, with audit | **VERIFIED** (§11) |
| `createConsultationOrder()` — refuses live keys outside production, writes the row before calling Razorpay | built, **no call site** |
| Permissions `invoices.view/issue/void`, `payments.view/record/reconcile` | present in the catalogue (ADMIN, FINANCE_MANAGER, ACCOUNTS…) |
| **Invoices table** | **NOT BUILT** |
| **Create / issue invoice UI** | **NOT BUILT** |
| **Payment link generation** | **NOT BUILT** |
| **QR / payment page** | **NOT BUILT** |
| **Checkout** | **NOT BUILT** |
| Staff payments list / reconciliation UI | **NOT BUILT** |
| Billing / payment configuration UI | **NOT BUILT** |

**Remaining implementation for "create invoice → issue → payment link → QR → paid → audit":**

1. **Migration `0015_invoices`** (additive): `invoices` (number series, contact/case, branch, line
   items, amounts in paise, tax fields as the accountant specifies, status `draft → issued → paid
   / void`, `issued_by`, timestamps), RLS on `invoices.*` permissions, audit trigger, and a nullable
   `payments.invoice_id` foreign key. `payments` already carries optional `contact_id`, `case_id`,
   `branch_id`, so the model extends without changing existing columns.
2. **Staff UI**: create and edit a draft, issue (locks it and assigns the number), void.
3. **Payment link**: a server action that calls Razorpay (Orders + a hosted payment page, or the
   Payment Links API) through the existing live-key guard, and stores the provider id on a
   `payments` row **before** returning the link.
4. **QR**: render the payment-link URL as a QR on the invoice page, or use Razorpay QR codes.
5. **Webhook events**: today it handles `payment.authorized`, `order.paid`, `payment.failed`. If
   Payment Links are chosen, confirm in **test mode** which events Razorpay sends for them (for
   example `payment_link.paid`) and handle those before relying on it.
6. **Tests**: SQL suite for invoices; e2e for the staff flow; the webhook probe extended.
7. **Business prerequisites**: GST treatment and invoice-number format; privacy notice covering
   payment records (B4 below).

**Not connected to job applications — VERIFIED:** `payment_purpose` has one value
(`consultation`); `payments` has no job or application column in either direction; the `0012`
CHECK refuses to publish a paid-access job; the intake refuses applications to non-free jobs.

## 11. Razorpay readiness

| Behaviour | Local, `304130c`, real database | Deployed staging, `304130c` |
| --- | --- | --- |
| Signed `payment.authorized` | 200 `processed` → `authorized` | — |
| Signed `order.paid` | 200 `processed` → `paid`, with `paid_at` + provider payment id | — |
| Same event id again | 200 `duplicate`, no second row or transition | — |
| Body altered after signing | 401 | 401 |
| Unsigned | 401 | 401 |
| Signed with another secret | 401 | 401 |
| Signed, no event id | 400 | 401 (unsigned probe) |
| Not JSON / not an event | 400 / 400 | 401 (unsigned probe) |
| Signed `payment.failed` | 200 `processed` → `failed`, `BAD_REQUEST_ERROR` kept | — |
| Database afterwards | 3 event rows (replay deduplicated; 6 rejected requests never reached it), 3 `system` audit entries | — |

Raw-body HMAC-SHA256 with constant-time compare, verified **before** parsing; body-size cap;
503 when no secret is configured; 500 on our own failure so Razorpay retries. The signed probe
against deployed staging was run on 18 Sep with the test secret
(`docs/PRODUCTION-CUTOVER-READINESS.md` §11); webhook code is unchanged since.

**Credentials:** live → Production only; test webhook secret → Preview only. **The live webhook is
not configured** in the Razorpay dashboard, and should not be until a checkout exists
(`docs/PAYMENTS.md` §8). Against production, only the unsigned probe may run.

## 12. Test results — against `304130c`, 18 September 2026

| Suite | Command | Passed | Failed | Skipped | Flaky |
| --- | --- | --- | --- | --- | --- |
| Migration parse | `npm run db:validate` | 14 | 0 | 0 | 0 |
| Unit | `npx vitest run` | **223** (16 files) | 0 | 0 | 0 |
| SQL, local from empty | `supabase db reset --local` + `npm run db:test` | **316** (4 files) | 0 | 0 | 0 |
| SQL, Mumbai staging | `db-remote --target=mumbai-staging test` | **316** | 0 | 0 | 0 |
| Migration re-apply | each file twice, rolled back | 3 | **1 (`0012`, §4)** | 0 | 0 |
| Lint | `npm run lint` | clean | 0 | — | — |
| Typecheck | `npm run typecheck` | clean | 0 | — | — |
| Server build | `npm run build:server` | PASS (59/59 pages) | 0 | — | — |
| E2E + accessibility | `npx playwright test --workers=2` | **189** | **0** | **39** | **0** |
| — of which axe | `a11y.spec.ts` | **64** | 0 | 0 | 0 |
| Guard test alone | `--repeat-each=8 --workers=1` | 8 | 0 | 0 | 0 |
| Build guard scenarios | synthetic tokens, 11 cases | 11 | 0 | 0 | 0 |
| Probe guard | production origin with `--secret` / `--order` / `--failed-order` | 3 refused | 0 | 0 | 0 |
| Anonymous Storage probe | local Storage API | 8 | 0 | 0 | 0 |
| Webhook, signed, local | `razorpay-webhook-probe.mjs` | 10 | 0 | 0 | 0 |
| Secret scans | bundle / repo / history / Vercel token | 4 | 0 | 0 | 0 |
| Deployed staging | `verify-staging-deployment.mjs` | **14** | 0 | 0 | 0 |
| Staging route sweep | 20 sitemap URLs + robots + 5 gated + 1 missing | **27** | 0 | 0 | 0 |
| Staging webhook, unsigned | `razorpay-webhook-probe.mjs --base=https://staging.gogulf.co` | 10 (all 401) | 0 | 0 | 0 |

**The 39 skipped** are all deliberate viewport scoping. 35 are mobile copies of
viewport-independent tests (`guard` 14, `i18n` 8, `seo` 7, `layout` 5, `navigation` 1), and 4
are desktop copies of mobile-only tests (`navigation` 3, `i18n` 1). None depends on missing
infrastructure.

**The previous flake** (`guard.spec` "email + password sessions reach neither area", 60 s timeout
on 18 Sep): not reproduced today — 9 runs of the test itself (the full suite plus 8 repeats alone)
and 4 runs of an instrumented copy. It took 12.6 s in the full suite, 1.7–4.0 s alone
(11.2 s on the first, cold run). A timing-instrumented copy put its own work at 1.5–2.5 s alone
and about 4 s under three workers plus the axe suite. Most of that time is GoTrue password hashing
in `createUser` and `signIn`. The test shares no state: users are uniquely tagged and always
deleted. A 60 s timeout therefore means a stalled request, which fits the memory starvation
recorded for this machine, not a logic race. The test was not changed.

**Log noise, not a failure:** `next start` logs `NoFallbackError` (18 times in the run) for
requests to ungenerated jobs and languages; the responses are the correct 404s (already noted in
`docs/PRODUCTION-READINESS-REPORT.md`).

**Not run for this document:** Lighthouse/INP (performance, not a release gate here); the static
`npm run build` (fails on `/opengraph-image`, `/manifest.webmanifest`, `/robots.txt` — pre-existing
and irrelevant, production builds in server mode); a signed probe against deployed staging.

## 13. Known limitations

1. The release cannot run on Tokyo; **merge and cutover are one event** for production (§14).
2. **Invoices, payment links, QR, checkout and a payments UI are not built** (§10).
3. CRM screens are read-and-convert only (§9).
4. ADMIN holds `audit.view`, `settings.manage`, `users.manage` — broader than the brief (§9).
5. `0012` is not re-runnable (§4).
6. Document-access audit is written before the link is issued (§8).
7. Staff sign-in requires Google OAuth for the `gogulf.co` Workspace; none exists for production.
   `careers@` and `admin@` sign-in is pending on Google's side.
8. Creator / last editor is visible to all staff who can read a job, not only SUPER_ADMIN.
9. `main`'s branch-protection settings could not be read here (no `gh` CLI).
10. Staging's rehearsal documents are random bytes by design; a genuine document check needs a
    freshly submitted application.

## 14. Production cutover prerequisites

The merge to `main` is step 7. Done in any other order, the production build refuses to start
(step 7 can safely come first; it will simply fail until step 6 is done).

| # | Step | Owner |
| --- | --- | --- |
| 1 | Final delta check of Tokyo (`npm run backup:prod -- verify`); fresh backup if anything changed | You, or me with approval |
| 2 | Apply `0012`–`0014` to Mumbai production and run the suites — **only while it holds no live data** (§4) | You, or me with approval |
| 3 | Google OAuth client (Internal) for the `gogulf.co` Workspace; Supabase auth settings for Mumbai production (`docs/GOOGLE-OAUTH.md`) | You |
| 4 | Bootstrap staff on Mumbai production; each person signs in with Google once and is verified | You, or me with approval |
| 5 | Import the Tokyo applications and documents from the **verified archive** (`docs/PRODUCTION-CUTOVER-READINESS.md` §16) | Both |
| 6 | In Vercel Production, switch `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to Mumbai production **in one edit** | You |
| 7 | Merge the release head into `main` (below); Vercel builds production | You |
| 8 | Confirm the build log: `Supabase API: PRODUCTION Mumbai`, guard `PASS`; the live bundle names only `exsnksrmkycloxiajwmx` | Both |
| 9 | Smoke test (`docs/PRODUCTION-CUTOVER-READINESS.md` §17); webhook check is the **unsigned** probe only | Both |
| 10 | Final delta check; then revoke Tokyo's anon INSERT (the one-way door) | You |

**Rollback:** promote `dpl_9RaneE2dUCaRfmGifXYfumUjWDL9` (`519cb85`) and restore the two Tokyo
variables. Promotion does not rebuild, so the new guard does not affect it.

### Merge commands (do not run without explicit approval)

Fast-forward keeps the exact tested commit ids:

```bash
git fetch origin
git switch main
git merge --ff-only origin/main          # local main is stale (b9ff284)
git merge --ff-only origin/staging       # must be the release head recorded in §2
git log --oneline -1                     # confirm the hash before pushing
git push origin main                     # starts the Vercel production build
```

If `main` is protected and needs a pull request: open one from `staging` to `main` on GitHub and
merge with **"Create a merge commit"**. The tree is identical to the tested head; the merge commit
id will differ.

## 15. Manual actions required from the operator

1. **Decide the merge timing.** It belongs inside the cutover window (§14). Merging earlier is
   safe but produces a failed production build and leaves `main` ahead of what production runs.
2. Approve (or run) steps 1–2, 4–5 of §14.
3. Create the Google OAuth client and complete each staff sign-in (step 3–4).
4. Switch the two Supabase variables in Vercel Production, together (step 6).
5. Decide ADMIN's `audit.view` / `settings.manage` / `users.manage` (§9).
6. Decide whether invoices, payment links and QR are the next build (§10), plus GST treatment and
   the invoice number format.
7. Complete the privacy review of converting applications into CRM contacts and cases, and of
   payment records, and update the privacy policy.
8. **Confirmation of what was not touched while preparing this document:** Tokyo production — no
   read, no write. Mumbai production — no connection. Vercel Production environment — names
   listed, no value read or changed. Razorpay — no dashboard change, live webhook not configured.
   DNS, OAuth — unchanged. `main` — not merged, not pushed. Candidate and job-application payments
   — not built, and refused by the schema. The only pushes went to `origin/staging`.

---

**This document makes no recommendation and grants no approval. Production database cutover has
NOT been performed. `main` has NOT been merged.**
