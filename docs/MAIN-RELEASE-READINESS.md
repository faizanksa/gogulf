# Main release readiness — Phase 3 platform onto `main`

Written 18 September 2026; **updated 19 September 2026 with the billing MVP** (sections 2, 3, 4,
6, 10–15 changed; jobs, applications and CRM sections are as of the 18 Sep record, whose
application code is unchanged). This is a **release-preparation record**, not an approval, and it
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
> adds a staff workspace and billing (invoices, a customer payment page) that need
> `0002`–`0015`. **Tokyo production has migration `0001`
> only.** So the release cannot run against Tokyo, and nothing in the live-operations scope
> (real vacancies, applications linked to jobs, the admin workspace, invoices) can operate on Tokyo. From
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
| Code under test | **`15ca649`** ("feat(billing): invoices, a customer payment page and QR, on the existing Razorpay rails") — every test in §12 ran against this application code. Previous candidate: `c120367` (code `304130c`) |
| Release head | the commit adding this update (documentation, the new runbook, and a guard on `0015`'s triggers, on top of `15ca649`; the exact hash is in the operator report) |
| Commits above `main` | 30 code/test/doc commits plus this update; `main` is an ancestor, so the merge is a fast-forward |
| Staging deployment of `15ca649` | **`gogulf-60uyaa03a`** (Vercel), READY, aliased to `staging.gogulf.co`; build log shows `Commit: 15ca649`, `Environment: staging`, `Supabase API: project noxireidrbeqcvsirjec`, `Razorpay: no key`, isolation guard `PASS` |
| Staging Supabase | Mumbai staging `noxireidrbeqcvsirjec`, migrations `0001`–`0015` (read back 19 Sep) |

## 3. Change summary

136 files changed from `519cb85` to `427aaac` (+16,784 / −1,595), plus 5 files in `304130c` and
**41 files in `15ca649`** (+4,358 / −57), which adds billing.

| Area | Commits | Size | What changed |
| --- | --- | --- | --- |
| Public website / redesign | `384f58a` | 10 files, +702/−308 | Home page rebuilt around the company record and a jobs board (`JobRow`, `CopyButton`, `ProcessSteps`); `RouteGraphic` removed |
| Jobs (public) | `625c9c1` | 28 files, +2,539/−693 | Job pages and listings read the database; `content/jobs.ts` deleted; `JobPosting` only on open jobs; sitemap lists open jobs only; apply form carries the job reference |
| Applications | `2299f14`, `27ee3f1` | in migrations | `0011` anon INSERT only; `0013` column-level anon INSERT, `job_id`, status, assignee, branch, contact/case links, conversion function, audited document access |
| Candidate / contact / case | `2299f14`, `0fa1c0d` | — | Application → contact → recruitment case via `convert_job_application()`; **no separate candidates table** |
| CRM / admin | `0fa1c0d` | 40 files, +4,202/−23 | Google staff sign-in (`/auth/callback`); workspace for jobs, categories, applications, contacts, cases; audit history panel |
| RBAC | `59671df`, `74b2d6f`, `284418d` | — | Per-person roles on the staff roster; bootstrap script; claim-shape tests. The role catalogue itself (`0008`) is unchanged and already on Mumbai production |
| Billing / payments | `8714b78` | 6 files, +668 | `0014` `payments` + `payment_events`; consultation purpose only |
| **Billing MVP** | `15ca649` | 41 files, +4,358/−57 | `0015` `invoices`, invoice audit, `payments.invoice_id`, payments→invoice sync trigger, two anon SECURITY DEFINER doors; `/admin/invoices` (list, new, detail); customer page `/pay/[reference]`; QR; shared Razorpay order module; Razorpay named in the privacy policy; `qrcode` dependency |
| Razorpay infrastructure | `8714b78`, `15ca649` | — | `POST /api/razorpay/webhook` (unchanged); `lib/payments/provider-order.ts` is now the one module that calls Razorpay, used by consultation and invoices |
| Email | `625c9c1` | small | Application email template shows the job reference; still Resend, server-side |
| Security | `27ee3f1`, `4c6fcf6`, `8714b78`, `304130c` | — | Narrower anon grants; production build guards; live-key isolation; probe guard |
| Database migrations | `27ee3f1`, `2299f14`, `8714b78`, `15ca649` | 5 files | `0011`–`0015` |
| Tests | `1b34aaf`, `284418d`, `8a60e82`, `427aaac`, `15ca649` | SQL 316 → 386; unit 223 → 277; e2e +11 | Jobs, payments, invoices, RBAC behaviour, RLS; e2e for DB jobs, apply bridge, admin gate, the payment page |
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
| `0015` invoices | — | **required** | ✅ (19 Sep) | ✅ |

**Required on Mumbai production before the cutover: `0012`, `0013`, `0014`, `0015`, in that order.**
Nothing is ever applied to Tokyo. Mumbai production state is from the read-only inventory of 18
Sep (`docs/PRODUCTION-CUTOVER-READINESS.md` §1); it was not re-read for this document.

| Property | Result |
| --- | --- |
| Ordered, gapless | **VERIFIED** — `0001`–`0015`; `npm run db:validate` 15/15 parse |
| From an empty database | **VERIFIED** — `supabase db reset --local` applied `0001`–`0015`; 386/386 assertions |
| On Mumbai staging | **VERIFIED — STAGING** — 386/386; `schema_migrations` reads `0001`…`0015` |
| RLS coverage | **VERIFIED** — `rls.test.sql` asserts every public table has RLS enabled, pins the anon/authenticated privileges on `job_applications`, `payments`, `payment_events`, `jobs`, and names the **two** SECURITY DEFINER functions anon may execute (`public_invoice_view`, `open_invoice_payment_request`) — `invoices` itself has no anon privilege of any kind |
| Additive | **VERIFIED** — `0015` adds one type, one sequence, one table and one nullable column on `payments`; it does not alter `record_payment_event`, `payments` policies, `payment_purpose`, or anything in `0012`/`0013` |
| Re-runnable (applied a second time on top of itself, rolled back) | `0011` ✅, `0013` ✅, `0014` ✅, `0015` ✅ (its three `create trigger` statements are guarded). **`0012` is not**: tables, types and policies are guarded, but its six `create trigger` statements are not, so a second run stops at the first one |

`0012` is already applied on Mumbai staging, and applied migrations are not edited. The CLI
applies and records each file once. **If a push to Mumbai production fails partway, read
`supabase_migrations.schema_migrations` and the object list before retrying.** Do not trust
the exit code: `db push` reports failure on success on this machine.

Command, when the cutover is approved:

```bash
node scripts/db-remote.mjs --target=mumbai-production push --yes-i-am-provisioning-production
node scripts/db-remote.mjs --target=mumbai-production test --yes-i-am-provisioning-production   # expect 386/386, only while it holds no live data
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

**Billing adds no new variable.** It uses the same three Razorpay variables and the same
Supabase variables. What it needs that does not exist yet is a **TEST** `RAZORPAY_KEY_ID` /
`RAZORPAY_KEY_SECRET` in the Vercel **Preview** scope, to exercise checkout on staging. Until then
"Pay" on staging says payment is unavailable, by design (`Razorpay: no key` in its build log).
In Production the live pair is already present and `ordersAllowed` accepts it only there.

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

**Billing security verification (19 Sep, `15ca649`):**

| Check | Method | Result |
| --- | --- | --- |
| Razorpay secret server-only | `boundaries.test.ts`: `RAZORPAY_KEY_SECRET` appears only in `provider-order.ts`; no client component imports a server module; client bundle scan | **VERIFIED** — 135 files scanned, none found; no `rzp_` key in `.next/static` |
| Service-role key never serves a staff or customer request | `boundaries.test.ts` over every billing file | **VERIFIED** — the invoice flow uses only the staff session or the anon key; `createAdminClient` remains solely in the webhook and the (no-call-site) consultation order |
| Payment endpoints protected | admin routes redirect anonymous users (local E2E + deployed staging); `/pay` accepts only a reference, rate limited; the DB re-checks amount and status | **VERIFIED** |
| Customer page reveals no internal data | E2E and the deployed flow: customer name, email, phone, notes, address, internal id, Supabase ref, `rzp_`, `service_role` all absent from HTML and rendered DOM; `public_invoice_view` returns an explicit allow-list | **VERIFIED — STAGING** |
| Webhook signature and idempotency still mandatory | webhook code and `record_payment_event` unchanged; 10/10 signed local probe; 401/401/400 on deployed staging | **VERIFIED** |
| Duplicate deliveries create no duplicate payment | replay → `duplicate`, one payment row (deployed staging); unique `(provider, event_id)` | **VERIFIED — STAGING** |
| Invoice authorization enforced | SQL as SUPER_ADMIN-equivalent ADMIN, FINANCE_MANAGER, ACCOUNTS (branch), HR_MANAGER, VIEW_ONLY, non-staff, anon | **VERIFIED** |
| Anonymous users cannot reach admin billing data | anon has no privilege on `invoices`/`payments` (asserted); admin routes 307 | **VERIFIED** |
| Staff cannot mark an invoice paid or unpaid | DB refuses `status = 'paid'` from a staff session; no transition out of paid or void | **VERIFIED** |
| Candidate payment impossible | no job column on `payments` or `invoices`; enum has one value; structural test over billing code | **VERIFIED** |
| Secrets scanned | bundle, repo+build+docs+logs (13 values), Vercel token, 89 commits of history | **VERIFIED** — none found |
| No live Razorpay key outside Production | Preview holds no key id or secret; `check-staging-isolation.mjs` fails a preview build carrying one | **VERIFIED** |

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

## 10. Billing and payment readiness *(rewritten 19 Sep 2026 — billing MVP added in `15ca649`)*

Full design, states, doors and verification: **`docs/PAYMENTS.md` §10**. Scope is unchanged:
consultation and service invoices only; candidate and job-application payment does not exist.

| Capability | Status |
| --- | --- |
| `payments` + `payment_events`, consultation purpose only | **VERIFIED** (local, Mumbai staging) |
| `invoices` table, `GG-INV` numbering (sequence, collision-safe), line items, discount, optional tax rate, derived totals | **VERIFIED** — 69 SQL assertions on it |
| Draft → edit → issue; issued invoice frozen; void with a reason; no delete, no "mark unpaid" | **VERIFIED** — SQL, and unit tests on the staff transition table |
| `/admin/invoices`: list, search, status filter, creator, created date, amount, payment status | built; **NEEDS A HUMAN** to exercise (§13.2) |
| `/admin/invoices/new` and the draft editor: customer, service, line items, quantity, unit price, tax rate, discount, live total, due date, notes; **Save draft** / **Issue invoice** | built; **NEEDS A HUMAN** |
| Payment link (`/pay/GG-INV-…`), copy, share (WhatsApp, email), open | built; the page itself is **VERIFIED — STAGING** |
| QR code (SVG, generated locally, encodes only the URL), view, download, print | built; **NEEDS A HUMAN** to scan on a phone |
| Customer payment page: Go Gulf, number, service, amount, status, Pay | **VERIFIED — STAGING** (no internal data, noindex, never cached, 404 for draft/unknown/malformed) |
| Razorpay order creation (`createProviderOrder`), mode guard, one order per invoice, amount from the invoice | unit-tested with a stubbed provider; **NOT VERIFIED against Razorpay itself** — no TEST key exists (below) |
| Webhook updates payment **and invoice** atomically; failure → retry; late success | **VERIFIED — STAGING** |
| Audit: created, edited, issued, payment link opened/reopened, paid, failed, voided | **VERIFIED — STAGING** |
| Refunds / reversals, receipts by email, PDF invoice, contact/case picker in the form | **NOT BUILT** |
| **GST treatment / "Tax Invoice" wording** | **NOT DECIDED** (D8). Nothing is assumed: the rate is optional and per invoice, and no page says "Tax Invoice" |

**Not connected to job applications — VERIFIED:** `payment_purpose` has one value
(`consultation`); neither `payments` nor `invoices` has a job or job-application column; the
`0012` CHECK still refuses to publish a paid-access job; the intake still refuses applications to
non-free jobs; and `lib/billing/boundaries.test.ts` fails if billing code ever mentions a job.

**The one thing this cannot yet claim:** a real Razorpay **test-mode** payment has not been made.
No TEST API key exists on this machine or in Vercel Preview (only live credentials, Production-only).
Everything before the Razorpay API call and after Razorpay's signed event is verified; the call and
`checkout.js` opening in a browser are not. Add `RAZORPAY_KEY_ID` (`rzp_test_…`) and
`RAZORPAY_KEY_SECRET` to the Vercel **Preview** scope, then follow `PAYMENTS.md` §10.10.

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

**Re-run against `15ca649` (19 Sep):** the same 10-case signed probe passed against a local
production build with a real database chain (200/200/duplicate/401/401/401/400/400/400/200), and
the deployed staging flow (§12) sent signed `payment.authorized`, `order.paid`, a duplicate, an
altered body, an unsigned body and a malformed body, and a signed `payment.failed` (also for a late
one after `paid`) with the expected result each time — now with an **invoice** moving alongside
the payment, atomically. The webhook route, `record_payment_event`, `normaliseEvent` and
`verifyWebhookSignature` are byte-for-byte unchanged since 18 Sep.

**Credentials:** live → Production only; test webhook secret → Preview only. **No Razorpay API
call has been made by anything in this work** (tests stub the provider; local runs refuse the live
key; staging has no key). **The live webhook is not configured** in the Razorpay dashboard, and
must not be until a checkout has been exercised in test mode and the checklist in
`docs/PAYMENTS.md` §9 is met. Against production, only the unsigned probe may run.

## 12. Test results — application code at `15ca649`, 19 September 2026

(The release head adds documentation and a guard on `0015`'s three `create trigger` statements;
the application code is identical, and the migration change was re-proved from an empty database.)

| Suite | Command | Passed | Failed | Skipped | Flaky |
| --- | --- | --- | --- | --- | --- |
| Migration parse | `npm run db:validate` | 15 | 0 | 0 | 0 |
| Unit | `npx vitest run` | **277** (21 files) | 0 | 0 | 0 |
| SQL, local from empty | `supabase db reset --local` + `npm run db:test` | **386** (5 files) | 0 | 0 | 0 |
| SQL, Mumbai staging | `db-remote --target=mumbai-staging test` | **386** | 0 | 0 | 0 |
| Migration re-apply | each of `0011`, `0013`, `0014`, `0015` twice, rolled back | 4 | **1 (`0012`)** | 0 | 0 |
| Lint | `npm run lint` | clean | 0 | — | — |
| Typecheck | `npm run typecheck` | clean | 0 | — | — |
| Server build | `npm run build:server` | PASS (59/59 pages; adds `/pay/[reference]`, `/admin/invoices`, `/new`, `/[id]`) | 0 | — | — |
| E2E + accessibility | `npx playwright test --workers=2` | **200** | **0** | **50** | **0** |
| — of which axe | `a11y.spec.ts` | **64** | 0 | 0 | 0 |
| — of which the new payment page | `pay.spec.ts` | **8** (incl. axe on phone and desktop) | 0 | 8 (mobile duplicates) | 0 |
| Build guard scenarios | synthetic tokens, 11 cases | 11 | 0 | 0 | 0 |
| Webhook, signed, local, real DB chain | `razorpay-webhook-probe.mjs` | 10 | 0 | 0 | 0 |
| Secret scans | client bundle / repo+build+logs / Vercel token / full git history | 4 | 0 | 0 | 0 |
| Deployed staging | `verify-staging-deployment.mjs` | **14** | 0 | 0 | 0 |
| Staging route sweep | 20 sitemap URLs + robots + 5 gated + 1 missing | **27** | 0 | 0 | 0 |
| Staging, new routes | 3 admin invoice routes (307 to sign-in), 3 bad `/pay` references (404) | **6** | 0 | 0 | 0 |
| Staging webhook, unsigned | `razorpay-webhook-probe.mjs --base=https://staging.gogulf.co` | 10 (all 401) | 0 | 0 | 0 |
| **Staging invoice flow, deployed** | scratch script; synthetic data; signed events | **38** | 0 | 0 | 0 |

**The 50 skipped** are all deliberate viewport scoping: mobile copies of viewport-independent
tests (`guard` 17, `pay` 8, `i18n` 8, `seo` 7, `layout` 5, `navigation` 1) and desktop copies of
mobile-only ones (`navigation` 3, `i18n` 1). None depends on missing infrastructure.

**The staging invoice flow** covers: page content and leak checks (customer name, email, notes,
internal id all absent), noindex and no caching, 404 for a draft and an unknown reference, no
orphan order from a lookup, a payer's order recorded and reused, invoice `payment_pending`,
signed `payment.authorized` / `order.paid` / duplicate / altered / unsigned / malformed, invoice
**paid by the webhook**, page "Payment received", a late `payment.failed` unable to un-pay, a
failure then retry with a new order then paid, the audit trail (system-attributed `invoice.paid`),
and no payer identity in audit entries or stored events. **Its first run reported 6 failures; all
were a defect in the script** (it reused one provider payment id for two payments, which the
`payments` unique constraint correctly refuses). It was corrected and re-run: 38/38. The
synthetic invoices ("STAGING TEST") remain in Mumbai staging — invoices have no DELETE by design.

**The previous flake** (`guard.spec` "email + password sessions…") did not recur in this run
(it passed, alongside the 3 new anonymous-redirect guards); the earlier investigation stands
(§12 of the 18 Sep version: memory starvation on this machine, not a logic race).

**Two problems found and fixed while testing, both worth knowing about:**

1. A trusted-transition flag inside `0015` was left set until the transaction ended, so a later
   staff write in the *same* transaction was judged against the wrong whitelist. Not reachable by
   one webhook or one request today; it is now reset immediately after use, and the SQL suite
   exercises several writes in one transaction.
2. After a decline, an invoice reached `payment_failed` with no way for the customer to retry, and
   a late success for a failed order would have left the invoice unpaid while money arrived. Both
   are fixed and asserted (retry gets a new order; late success ends paid).
3. My deployed-staging test left `evt_STG_INV_*` payment events in Mumbai staging (they cannot be
   deleted), and an existing `payments.test.sql` assertion counted events with a **prefix**
   (`evt_S%`) that they matched, so 0014's suite failed *on staging* while passing locally. The
   suite's scope is now the seven **exact** ids it creates itself; the claim it asserts is
   unchanged and no longer depends on what else has passed through the database. Both suites
   were re-run: 386/386 locally and on Mumbai staging. Also added after review: SQL assertions
   that SUPER_ADMIN sees every invoice and its creator, and that `updated_by` records the person
   who last changed it.

**Not run for this document:** Lighthouse/INP; the static `npm run build` (fails on
`/opengraph-image`, `/manifest.webmanifest`, `/robots.txt` — pre-existing, and production builds in
server mode); any automated browser test of the admin screens (§13.2); any real Razorpay call (§10).

## 13. Known limitations

1. The release cannot run on Tokyo; **merge and cutover are one event** for production (§14).
2. **The admin screens (jobs, applications, invoices) have no automated browser test.** A staff
   session needs a real Google sign-in and the guard checks the sign-in method, so none can be
   minted honestly here. Their rules are asserted in SQL as each role, and their code is
   type-checked, linted and built; the visual behaviour needs manual QA (`PAYMENTS.md` §10.10).
3. **No Razorpay TEST key exists anywhere usable**, so a real test-mode checkout has not been run
   (§10). Nothing may go to live before it has.
4. **GST is undecided (D8).** No real invoice should be issued until the treatment, GSTIN display
   and numbering rules are decided; the system assumes nothing.
5. No refund or reversal flow: a paid invoice can never be corrected inside the system.
6. No receipt email, no PDF invoice, and the invoice form does not yet pick a contact or case.
7. CRM screens are read-and-convert only (§9).
8. ADMIN holds `audit.view`, `settings.manage`, `users.manage` — broader than the brief (§9).
   Creator and last editor are visible to every role that can read a record, not only SUPER_ADMIN.
9. `0012` is not re-runnable (six unguarded `create trigger` statements; it is already applied on
   staging and applied migrations are not edited). `0015` is.
10. Document-access audit is written before the link is issued (§8).
11. Staff sign-in needs a Google OAuth client for the Workspace; none exists for production, and
    `careers@` / `admin@` sign-in is pending on Google's side.
12. There is no Content-Security-Policy site-wide. Razorpay's `checkout.js` is now the first
    third-party script the site can load (only when a payer presses Pay); a CSP is recommended.
13. The privacy policy now names Razorpay; the wording (and whether its effective date moves)
    awaits the business's review.
14. The payment-page rate limiter is per server instance (`lib/rate-limit.ts` says so); the real
    guards are in the database.
15. `main`'s branch-protection settings could not be read (no `gh` CLI).
16. Staging's rehearsal documents are random bytes by design; a genuine document check needs a
    freshly submitted application.

## 14. Production cutover prerequisites

**The ordered procedure, with exact commands, verification, rollback and stop conditions, is
`docs/PRODUCTION-CUTOVER-RUNBOOK.md`** (written 19 Sep 2026). In summary:

| # | Step | Owner |
| --- | --- | --- |
| 1 | Decisions: vacancy content, privacy review, **GST treatment**, Razorpay wording, ADMIN's audit access, switch-window policy | You |
| 2 | Razorpay **TEST** keys in Vercel Preview; one full test-mode payment and one failure on staging | You (keys) + me |
| 3 | Final Tokyo delta check (`npm run backup:prod -- verify`) | You, or me with approval |
| 4 | Apply **`0012`–`0015`** to Mumbai production and run the suites (**386**) — only while it holds no live data | You, or me with approval |
| 5 | Google OAuth client (Internal) and Supabase auth settings for Mumbai production | You |
| 6 | Bootstrap staff; each person signs in with Google once and is verified | You, or me with approval |
| 7 | Import the Tokyo applications and documents from the **verified archive** | Both |
| 8 | Switch `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to Mumbai production **in one edit** | You |
| 9 | Merge the release head into `main` (below) | You |
| 10 | Verify the build log and the live bundle; smoke test; final delta; revoke Tokyo's anonymous INSERT | Both |
| 11 | **Billing go-live, separately approved:** GST decided → live webhook (secret set *before* saving it in the dashboard) → one small supervised real payment → customers | You |

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
2. **Add Razorpay TEST keys to Vercel Preview** (`RAZORPAY_KEY_ID` = `rzp_test_…`,
   `RAZORPAY_KEY_SECRET`) — never the live pair — then do the manual QA in `PAYMENTS.md` §10.10
   as a Google-signed-in ADMIN and SUPER_ADMIN. This is also the only check of the admin invoice
   screens and of the QR code on a real phone.
3. **Decide GST treatment and the invoice number format** (D8) before any real invoice.
4. Review the **privacy policy** wording for Razorpay, and complete the privacy review of
   converting applications into CRM records and of payment records.
5. Decide ADMIN's `audit.view` / `settings.manage` / `users.manage` (§9; `PAYMENTS.md` §10.6).
6. Approve (or run) the database, staff and data steps of the runbook; create the Google OAuth
   client and complete each staff sign-in; switch the two Supabase variables together.
7. **Confirmation of what was not touched while preparing this update:** Tokyo production — no
   read, no write. Mumbai production — no connection (migration `0015` was applied to **Mumbai
   staging only**, and to the local database). Vercel Production environment — names listed
   earlier, no value read or changed; Vercel **Preview** was read (the test webhook secret was
   pulled to a temporary file that the script deleted immediately, and was never printed).
   Razorpay — no dashboard change; live webhook not configured; **no Razorpay API call was made
   by anything.** DNS, OAuth — unchanged. `main` — not merged, not pushed. Candidate and
   job-application payments — not built, and refused by the schema. The only pushes went to
   `origin/staging`.

---

**This document makes no recommendation and grants no approval. Production database cutover has
NOT been performed. `main` has NOT been merged.**
