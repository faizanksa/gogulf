# Main release readiness — Phase 3 platform onto `main`

Written 18 September 2026; **updated 19 September 2026 with the billing MVP, and again the same
day with the completed admin model, migrations `0016`–`0017` and the first real Razorpay TEST
payments** (§2–§6, §9–§14 changed; jobs and applications sections are as of the 18 Sep record, whose
application code is unchanged). This is a **release-preparation record**, not an approval. Its
conclusion is stated in §14: **`main` was not merged and the cutover was not performed.** Statuses
are factual:

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
> `0002`–`0017`. **Tokyo production has migration `0001`
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
| Code under test | **`e59bf06`** ("fix(billing): only the server may record a payment request … (0017)") — every test in §12 ran against this application code. Previous candidates: `5a5339a` (admin model, `0016`), `15ca649` (billing MVP), `c120367` (code `304130c`) |
| Release head | the commit adding this update (documentation only, on top of `e59bf06`; the exact hash is in the operator report) |
| Commits above `main` | 34 code/test/doc commits plus this update; `main` is an ancestor, so the merge is a fast-forward |
| Staging deployment of `e59bf06` | **`gogulf-69xv9djiy`** (Vercel), READY, aliased to `staging.gogulf.co`; build log shows `Commit: e59bf06`, `Environment: staging`, `Supabase API: project noxireidrbeqcvsirjec`, `Razorpay: test key`, isolation guard `PASS` |
| Staging Supabase | Mumbai staging `noxireidrbeqcvsirjec`, migrations `0001`–`0017` (read back from `schema_migrations` 19 Sep) |

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
| **Billing MVP** | `15ca649` | 41 files, +4,358/−57 | `0015` `invoices`, invoice audit, `payments.invoice_id`, payments→invoice sync trigger, two anon SECURITY DEFINER doors (**the second was closed to anon in `0017`**, below); `/admin/invoices` (list, new, detail); customer page `/pay/[reference]`; QR; shared Razorpay order module; Razorpay named in the privacy policy; `qrcode` dependency |
| **Admin model** | `5a5339a` | 36 files, +2,699/−34 | `0016`: ADMIN loses `users.manage` and `settings.manage`; audit entries about staff, roles and settings need the matching management permission. Operations dashboard (real counts only); `/admin/payments`, `/audit`, `/staff`, `/roles`, `/roles/[key]`, `/settings` (read-only), `/integrations` (presence and mode only); assignee filter and team notes on applications; server actions each check permission before creating a database client |
| **Payment-request hardening** | `e59bf06` | 9 files, +232/−53 | `0017`: `open_invoice_payment_request` is executable by `service_role` only. Found by the first real TEST checkout: with the public anon key, anyone could plant an invented order id on any issued invoice and jam it (§6) |
| Razorpay infrastructure | `8714b78`, `15ca649` | — | `POST /api/razorpay/webhook` (unchanged); `lib/payments/provider-order.ts` is now the one module that calls Razorpay, used by consultation and invoices |
| Email | `625c9c1` | small | Application email template shows the job reference; still Resend, server-side |
| Security | `27ee3f1`, `4c6fcf6`, `8714b78`, `304130c` | — | Narrower anon grants; production build guards; live-key isolation; probe guard |
| Database migrations | `27ee3f1`, `2299f14`, `8714b78`, `15ca649`, `5a5339a`, `e59bf06` | 7 files | `0011`–`0017` |
| Tests | `1b34aaf`, `284418d`, `8a60e82`, `427aaac`, `15ca649`, `5a5339a`, `e59bf06` | SQL 316 → 439; unit 223 → 325; e2e 200 → 208 passed | Jobs, payments, invoices, RBAC behaviour, RLS, the admin model; e2e for DB jobs, apply bridge, admin gate, the payment page and the order-planting attack |
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
| `0016` admin operational model | — | **required** | ✅ (19 Sep) | ✅ |
| `0017` payment request is server-only | — | **required** | ✅ (19 Sep) | ✅ |

**Required on Mumbai production before the cutover: `0012`, `0013`, `0014`, `0015`, `0016`, `0017`,
in that order.** Nothing is ever applied to Tokyo. **Re-read read-only on 19 Sep:** a dry run against
Mumbai production (`db push --dry-run`, nothing applied) lists exactly `0012`–`0017` as pending,
i.e. it is at `0011`.

| Property | Result |
| --- | --- |
| Ordered, gapless | **VERIFIED** — `0001`–`0017`; `npm run db:validate` 17/17 parse |
| From an empty database | **VERIFIED** — `supabase db reset --local` applied `0001`–`0017`; 439/439 assertions |
| On Mumbai staging | **VERIFIED — STAGING** — 439/439 (fourth attempt; three earlier attempts ended in connection-level errors, none in an assertion — §12); `schema_migrations` reads `0001`…`0017` |
| RLS coverage | **VERIFIED** — `rls.test.sql` asserts every public table has RLS enabled, pins the anon/authenticated privileges on `job_applications`, `payments`, `payment_events`, `jobs`, names the **one** SECURITY DEFINER function anon may execute (`public_invoice_view`), and asserts `open_invoice_payment_request` is executable by `service_role` alone (`0017`) — `invoices` itself has no anon privilege of any kind |
| Additive | **VERIFIED** — `0015` adds one type, one sequence, one table and one nullable column on `payments`; it does not alter `record_payment_event`, `payments` policies, `payment_purpose`, or anything in `0012`/`0013`. `0016` deletes two `role_permissions` rows (audited) and replaces one policy. `0017` only revokes and grants `EXECUTE` on one function |
| Re-runnable (applied a second time on top of itself, rolled back) | `0011` ✅, `0013` ✅, `0014` ✅, `0015` ✅ (its three `create trigger` statements are guarded); `0016` and `0017` are idempotent by construction (`delete … where`, `drop policy if exists`, `revoke`/`grant`) but **were not re-applied as a test**. **`0012` is not**: tables, types and policies are guarded, but its six `create trigger` statements are not, so a second run stops at the first one |

`0012` is already applied on Mumbai staging, and applied migrations are not edited. The CLI
applies and records each file once. **If a push to Mumbai production fails partway, read
`supabase_migrations.schema_migrations` and the object list before retrying.** Do not trust
the exit code: `db push` reports failure on success on this machine.

Command, when the cutover is approved:

```bash
node scripts/db-remote.mjs --target=mumbai-production push --yes-i-am-provisioning-production
node scripts/db-remote.mjs --target=mumbai-production test --yes-i-am-provisioning-production   # expect 439/439, only while it holds no live data
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
`RAZORPAY_WEBHOOK_SECRET`, `APP_ENV=staging`, and — added by you on 19 Sep — a Razorpay **TEST**
`RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` (both stored as sensitive variables, so `vercel env pull`
returns them empty; the mode is read from the build log's `Razorpay: test key` line, which the
isolation guard prints and which **fails the build if it were live**).

**Billing adds no new variable.** It uses the same three Razorpay variables and the same
Supabase variables. In Production the live pair is already present and `ordersAllowed` accepts it
only there; in Preview only the TEST pair exists and a live key would fail the build. Since `0017`
the payment page's server also needs `SUPABASE_SERVICE_ROLE_KEY` (already present in Production and
Preview) to record an order.

## 6. Security verification

| Check | Method | Result |
| --- | --- | --- |
| No secret in the client bundle | `npm run check:secrets` | **VERIFIED** (19 Sep, `e59bf06` build) — 137 files, 10 server-only values, none found |
| No secret in tracked files, build output, docs, logs | `node scripts/check-secret-config.mjs` | **VERIFIED** (19 Sep) — 686 files, **13** values (includes the Google OAuth client secret), none found. The Razorpay TEST secret is a sensitive Vercel variable and could not be read back, so it is **not** among the searched values; it was never on this machine and was never printed |
| No secret anywhere in git history | full-patch search of every commit on every branch | **VERIFIED** (19 Sep) — 93 commits, 15 values (service-role keys, DB passwords, Supabase PAT, Razorpay secrets, Resend key, Google secret, Vercel CLI token), none found |
| No Vercel token committed | token read in-process, searched in tracked files + build + test output | **VERIFIED** (19 Sep) — 571 files, not found |
| No env file tracked | `git ls-files` | **VERIFIED** — only `.env.example`, `.env.local.example` |
| No live Razorpay key on staging | build log of the deployed commit | **VERIFIED** (19 Sep) — `Razorpay: test key` on `5a5339a` and `e59bf06`; a live key would fail the preview build, and the guard's synthetic "preview: live Razorpay key" case fails as expected |
| Service-role key only on the server | `server-only` import + call sites | **VERIFIED** — used by `lib/payments/record.ts` (webhook), `lib/payments/consultation.ts` (no call site) and, since `0017`, `lib/payments/invoice-payment.ts` for exactly one call (`open_invoice_payment_request`, reason `payment-request`); `boundaries.test.ts` pins it to one place, one rpc, no table reads. Staff screens and server actions never use it (`actions-guard.test.ts`) |
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
| Service-role key never serves a staff request, and serves a customer request only to record an order the server just created | `boundaries.test.ts` over every billing file | **VERIFIED, with one deliberate exception (`0017`)** — staff flows use only the staff session; the customer payment page reads through the anon key and `public_invoice_view`, and records its order with the privileged client under the named reason `payment-request`, because the alternative (letting the anon key record an order id) was exploitable (below) |
| Payment endpoints protected | admin routes redirect anonymous users (local E2E + deployed staging); `/pay` accepts only a reference, rate limited; the DB re-checks amount and status | **VERIFIED** |
| Customer page reveals no internal data | E2E and the deployed flow: customer name, email, phone, notes, address, internal id, Supabase ref, `rzp_`, `service_role` all absent from HTML and rendered DOM; `public_invoice_view` returns an explicit allow-list | **VERIFIED — STAGING** |
| Webhook signature and idempotency still mandatory | webhook code and `record_payment_event` unchanged; 10/10 signed local probe; 401/401/400 on deployed staging | **VERIFIED** |
| Duplicate deliveries create no duplicate payment | replay → `duplicate`, one payment row (deployed staging); unique `(provider, event_id)` | **VERIFIED — STAGING** |
| Invoice authorization enforced | SQL as SUPER_ADMIN-equivalent ADMIN, FINANCE_MANAGER, ACCOUNTS (branch), HR_MANAGER, VIEW_ONLY, non-staff, anon | **VERIFIED** |
| Anonymous users cannot reach admin billing data | anon has no privilege on `invoices`/`payments` (asserted); admin routes 307 | **VERIFIED** |
| Staff cannot mark an invoice paid or unpaid | DB refuses `status = 'paid'` from a staff session; no transition out of paid or void | **VERIFIED** |
| Candidate payment impossible | no job column on `payments` or `invoices`; enum has one value; structural test over billing code | **VERIFIED** |
| Secrets scanned | bundle, repo+build+docs+logs (13 values), Vercel token, 93 commits of history | **VERIFIED** — none found (see the rows above; re-run 19 Sep) |
| No live Razorpay key outside Production | Preview holds only a TEST pair (build log `Razorpay: test key`); `check-staging-isolation.mjs` fails a preview build carrying a live one (synthetic case in the 11-scenario run) | **VERIFIED** |

**A defect in the billing MVP, found and fixed on 19 Sep (`e59bf06`, `0017`).** `open_invoice_payment_request`
was executable by `anon` and stores a caller-supplied provider order id. With the public anon key,
anyone could call it on any issued invoice (references are sequential) with an invented order id;
reproduced on Mumbai staging — the call succeeded and the invoice became `payment_pending` with a
fake order, which Razorpay would refuse when the real payer pressed Pay. No money moves and no data
leaks, but a stranger could stop any invoice being paid. The function is now `service_role`-only and
the payment page's server calls it after creating the order. Re-run against the fixed deployment: the
same anonymous call is refused (`42501`), nothing is written, the invoice stays payable. The tests
were each shown to fail against the old grant. **It shipped in the `15ca649` release candidate and its
suites (386 SQL, 277 unit) passed with it present** — those suites had used the same door as the
payer's browser and never attacked it. Worth remembering when reading any "N/N passed" in this file:
the suites prove what they assert, not that nothing else is wrong. Nothing was on Production or Tokyo.

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
| Contacts list and detail (read) | Editing a contact, merging, tags |
| Cases list and detail (read) | Case stage changes, tasks, activities, appointments UI |
| Conversion from an application; team notes on the converted contact (`5a5339a`, existing `notes.team.*` permissions); assignee filter | Portal for customers (blocked on India DLT registration) |
| Operations dashboard (real counts, attention list, recent activity) | Editing settings from the UI (the settings screen is read-only, honestly: nothing reads those flags yet) |
| `/admin/staff` (change role, activate/deactivate; never yourself, never the last active SUPER_ADMIN), `/admin/roles` and `/roles/[key]` (edit grants; the reserved `roles.manage` / `permissions.manage` are never grantable from a screen), `/admin/audit`, `/admin/payments`, `/admin/integrations` (presence and mode only — never a value) | Inviting or creating staff from the UI (staff are created by the bootstrap script) |
| Role and scope enforcement through RLS for all of the above | |

**Roles, resolved in `0016`.** ADMIN is operational staff; SUPER_ADMIN is the system administrator.
`hello@gogulf.co` → SUPER_ADMIN, `admin@gogulf.co` → SUPER_ADMIN (reserved), `careers@gogulf.co` →
ADMIN in the bootstrap script. ADMIN runs jobs, applications, contacts, cases, billing and
payments and reads the operational audit trail. ADMIN **cannot**: create, change, deactivate or
promote staff; grant itself or anyone a permission; edit a role; change a setting; see audit
entries about staff, roles or settings; forge, edit or delete an audit row; or alter a
SUPER_ADMIN — each attempt is asserted refused in `admin-model.test.sql` beside a positive control,
and the server actions check permission **before** creating a database client
(`actions-guard.test.ts`). The screens hiding controls is a convenience; the database and the
server checks are the enforcement. SUPER_ADMIN reads everything, changes roles, grants and revokes,
and still cannot forge or delete audit rows. Two unchanged guards from `0009` remain as defence in
depth, and `jobs.test.sql` / `rbac-behaviour.test.sql` now prove them by granting `users.manage` to
ADMIN *inside their own rolled-back transactions*.

**Not changed, on purpose:** creator and last editor of a job or invoice are visible to every role
that can read the record (§13), not only SUPER_ADMIN.

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
| Razorpay order creation (`createProviderOrder`), mode guard, one order per invoice, amount from the invoice | **VERIFIED — STAGING against Razorpay's TEST API** (19 Sep): six real orders created by the deployed server (three paid, one declined, two abandoned unpaid while the browser driver was being set up), each for the invoice's exact total; pressing Pay again reused the open order; a retry after a decline created a new one (`docs/PAYMENTS.md` §10.12) |
| Real Razorpay Checkout in a browser, TEST mode: success and decline | **VERIFIED — STAGING** — payments `pay_Tdeic3SjEjzBKh`, `pay_Tdk1CMWdsazMtx`, `pay_Tdk7X8I31ksMun` succeeded and `pay_Tdk4zUsfdAKh4g` was declined, in Razorpay's Test Mode |
| Webhook updates payment **and invoice** atomically; failure → retry; late success | **VERIFIED — STAGING**, by **simulated delivery** (signed by a script with the real order and payment ids). **Razorpay's own webhook was not observed reaching staging** — see below |
| Audit: created, edited, issued, payment link opened/reopened, paid, failed, voided | **VERIFIED — STAGING** |
| Refunds / reversals, receipts by email, PDF invoice, contact/case picker in the form | **NOT BUILT** |
| **GST treatment / "Tax Invoice" wording** | **NOT DECIDED** (D8). Nothing is assumed: the rate is optional and per invoice, and no page says "Tax Invoice" |

**Not connected to job applications — VERIFIED:** `payment_purpose` has one value
(`consultation`); neither `payments` nor `invoices` has a job or job-application column; the
`0012` CHECK still refuses to publish a paid-access job; the intake still refuses applications to
non-free jobs; and `lib/billing/boundaries.test.ts` fails if billing code ever mentions a job.

**What is still not claimed:** that **Razorpay's own webhook** reaches staging. Real TEST payments
were made and accepted by Razorpay, but no event from Razorpay arrived in Mumbai staging (none in
the ten minutes after the first payment; none within a minute of each later one). The cause is not
established: the TEST webhook setting is in Razorpay's dashboard, which nothing used here can read
or set, and Vercel's deployment protection answers requests lacking the bypass token before they
reach the route. So the invoice was moved to paid by **signed deliveries that a script sent** with
the real ids — the receiver, signature check, idempotency, ordering rules and audit are proven; the
delivery itself is not. **Exact steps to close it are in `docs/PAYMENTS.md` §10.9.** Nothing may go
to live before it has been observed working in test mode.

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

**Credentials:** live → Production only; TEST key pair and test webhook secret → Preview only.
**Razorpay's API has been called with the TEST key only, by the deployed staging server** (six
orders, §10). Nothing was called with a live key: local runs refuse it (the local server logged
`wrong_mode` and contacted no third party, asserted by an e2e test), and the isolation guard would
fail any preview build carrying one. **The live webhook is not configured** in the Razorpay
dashboard, and must not be until Razorpay's own test delivery has been observed working (§10) and
the checklist in `docs/PAYMENTS.md` §9 is met. Against production, only the unsigned probe may run.

## 12. Test results — application code at `e59bf06`, 19 September 2026

Every row was run against `e59bf06` unless it says otherwise. The release head adds documentation
only.

| Suite | Command | Passed | Failed | Skipped | Flaky |
| --- | --- | --- | --- | --- | --- |
| Migration parse | `npm run db:validate` | **17** | 0 | 0 | 0 |
| Unit | `npx vitest run` | **325** (25 files) | 0 | 0 | 0 |
| SQL, local from empty | `supabase db reset --local` + `npm run db:test` | **439** (6 files) | 0 | 0 | 0 |
| SQL, Mumbai staging | `db-remote --target=mumbai-staging test` | **439** (**fourth** attempt; the first three ended in connection-level errors — `psql` exit 2 twice, then a statement timeout on `create schema am_test` — and none had an assertion fail; the fourth ran clean with no action taken on the database) | 0 | 0 | 0 |
| Mutation check on `0017` | re-open the anon grant locally, run the suites | the new assertions **failed** as intended (`invoices` and `rls` files), then the grant was restored | — | — | — |
| Lint | `npx eslint .` | clean | 0 | — | — |
| Typecheck | `npm run typecheck` | clean | 0 | — | — |
| Server build | `npm run build:server` (local Supabase) | PASS, 59/59 pages | 0 | — | — |
| E2E + accessibility | `npx playwright test --workers=2` | **208** | **0** | **58** | **0** |
| — of which axe | `a11y.spec.ts`, `pay.spec.ts` | **66** | 0 | 0 | 0 |
| — of which the payment page | `pay.spec.ts` | **9** (incl. the anon-key order-planting attack, axe on phone and desktop) | 0 | mobile duplicates | 0 |
| Build guard scenarios | synthetic tokens, 11 cases | **11** | 0 | 0 | 0 |
| Secret scans | client bundle (137 files) / repo+build+logs (686) / Vercel token (571) / git history (93 commits) | **4** | 0 | 0 | 0 |
| Deployed staging | `verify-staging-deployment.mjs` | **14** | 0 | 0 | 0 |
| Staging route sweep | 20 sitemap URLs + robots + 5 gated + 1 missing | **27** | 0 | 0 | 0 |
| Staging, gated routes | 12 admin routes (`/admin`, `/payments`, `/audit`, `/staff`, `/roles`, `/roles/ADMIN`, `/roles/SUPER_ADMIN`, `/settings`, `/integrations`, `/applications`, `/jobs`, `/invoices`): 307 to sign-in, `noindex` | **12** | 0 | 0 | 0 |
| Staging, invoice routes | 3 admin invoice routes (307), 3 bad `/pay` references (404) | **6** | 0 | 0 | 0 |
| **Staging invoice flow, deployed** | scratch script; synthetic data; signed events; adds anon-refused check | **39** | 0 | 0 | 0 |
| **Real Razorpay TEST payments, deployed** | browser-driven Checkout; `docs/PAYMENTS.md` §10.12 | 3 paid, 1 declined, 1 retry | 0 | 0 | 0 |
| Simulated webhook delivery with the real ids | `sim-webhook.mjs` (scratch) | 13 of 14 on the first paid invoice, 9 of 9 on the retry; the one failure was a wrong entity name in the script, corrected | see §10.12 | 0 | 0 |
| Webhook, signed, local probe; staging unsigned probe; migration re-apply | *(run at `15ca649`, 10 / 10 all-401 / 4 of 5)* | **not re-run at `e59bf06`** — the route, `record_payment_event`, `normaliseEvent` and `verifyWebhookSignature` are byte-for-byte unchanged since `15ca649` (`git diff` empty), and `0016`/`0017` are not migrations that were re-applied as a test | — | — | — |

**The 58 skipped** are all deliberate viewport scoping: mobile copies of viewport-independent
tests (the guard, payment-page, i18n, SEO, layout and navigation specs) and desktop copies of
mobile-only ones. None depends on missing infrastructure. The local server logged one
`invoice.payment.start_failed … wrong_mode` line: that is the fail-closed test running with the
LIVE key from `.env.local` loaded into a local server, which correctly refuses it and contacts no
third party (asserted by the test).

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

**Problems found and fixed while testing, all worth knowing about:**

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

4. **The payment-request door was open to anyone (fixed 19 Sep, `0017`).** Found only because the
   first real checkout was made and its setup used the same anon door a payer's browser would;
   the full account is in §6. The 386-assertion and 277-test suites had passed with the hole present.

**Not run for this document:** Lighthouse/INP; the static `npm run build` (fails on
`/opengraph-image`, `/manifest.webmanifest`, `/robots.txt` — pre-existing, and production builds in
server mode); any automated browser test of the admin screens (§13.2); Razorpay's own webhook
delivery (§10); a second application of `0016`/`0017` on top of themselves.

## 13. Known limitations

1. The release cannot run on Tokyo; **merge and cutover are one event** for production (§14).
2. **The admin screens (dashboard, jobs, applications, invoices, payments, audit, staff, roles,
   settings, integrations) have no automated browser test as a signed-in person.** A staff session
   needs a real Google sign-in and the guard checks the sign-in method, so none can be minted
   honestly here. Anonymous access to every one is proven (12 routes on deployed staging, 19 in the
   guard spec); their rules are asserted in SQL as each role; each server action's permission
   check is asserted on the source; the code is type-checked, linted and built. **Their visual
   behaviour has never been looked at by a person or a test** and needs manual QA
   (`PAYMENTS.md` §10.10).
3. **Razorpay's own webhook delivery to staging has not been observed** (§10, exact steps in
   `docs/PAYMENTS.md` §10.9). Real TEST payments were made; the invoice was moved to paid by signed
   deliveries a script sent. Nothing may go to live before Razorpay's own delivery has been seen
   working in test mode.
4. **GST is undecided (D8).** No real invoice should be issued until the treatment, GSTIN display
   and numbering rules are decided; the system assumes nothing.
5. No refund or reversal flow: a paid invoice can never be corrected inside the system.
6. No receipt email, no PDF invoice, and the invoice form does not yet pick a contact or case.
7. CRM screens are read, convert and add-team-note only (§9); staff are created by the bootstrap
   script, not from the UI; settings are displayed read-only.
8. Creator and last editor are visible to every role that can read a record, not only
   SUPER_ADMIN. (ADMIN's platform-administration rights were removed in `0016`; §9.)
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
17. **Tokyo production has moved since the last backup.** `npm run backup:prod -- verify` on 19 Sep:
    the 16 Sep backup is intact (34/34 document hashes match) but the live project now holds **15
    applications and 39 documents against the backup's 14 and 34** — one new application (18 Sep)
    and five documents, one set attached to an application that was already in the backup. Real
    intake is continuing on Tokyo, so **the cutover must take a fresh backup after intake is frozen**
    and reconcile before the import; the existing archive is not sufficient.
18. **Running the SQL suites on Mumbai production consumes sequence numbers** (`GG-INV`, `GG-PAY`):
    sequences are not rolled back with the transaction, so after the suites the first real invoice
    would not be `GG-INV-2026-00001` (Mumbai staging is at `00089` after its runs). Run them before
    real use only if a gap at the start of the numbering is acceptable, or reset the sequences
    afterwards — a decision for the business, not made here.

## 14. Production cutover prerequisites

**The ordered procedure, with exact commands, verification, rollback and stop conditions, is
`docs/PRODUCTION-CUTOVER-RUNBOOK.md`** (written 19 Sep 2026). In summary:

| # | Step | Owner |
| --- | --- | --- |
| 1 | Decisions: vacancy content, privacy review, **GST treatment**, Razorpay wording, switch-window policy. *(ADMIN's audit and settings access — decided and built, `0016`.)* | You |
| 2 | Razorpay **TEST** keys in Vercel Preview — **done**; real TEST payments, success and decline — **done** (`PAYMENTS.md` §10.12). **Remaining:** add Razorpay's TEST webhook for staging and see one real delivery mark an invoice paid with no script (`PAYMENTS.md` §10.9) | You (dashboard) + me |
| 3 | **Freeze intake**, then a **fresh** Tokyo backup and delta (`npm run backup:prod`, then `-- verify`). Today the live project holds 15 applications / 39 documents against the backup's 14 / 34 (§13.17) | You, or me with approval |
| 4 | Apply **`0012`–`0017`** to Mumbai production and run the suites (**439**) — only while it holds no live data; mind sequence consumption (§13.18). A read-only dry run on 19 Sep confirms exactly these six are pending | You, or me with approval |
| 5 | Google OAuth client (Internal) and Supabase auth settings for Mumbai production | You |
| 6 | Bootstrap staff; each person signs in with Google once and is verified | You, or me with approval |
| 7 | Import the Tokyo applications and documents from the **verified archive** | Both |
| 8 | Switch `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to Mumbai production **in one edit** | You |
| 9 | Merge the release head into `main` (below) | You |
| 10 | Verify the build log and the live bundle; smoke test; final delta; revoke Tokyo's anonymous INSERT | Both |
| 11 | **Billing go-live, separately approved:** GST decided → live webhook (secret set *before* saving it in the dashboard) → one small supervised real payment → customers | You |

**Rollback:** promote `dpl_9RaneE2dUCaRfmGifXYfumUjWDL9` (`519cb85`) and restore the two Tokyo
variables. Promotion does not rebuild, so the new guard does not affect it.

### Where this stands, 19 September 2026 — the decision on `main`

**`main` was not merged and the cutover was not performed.** The release is code-complete and
verified on staging, but the production prerequisites in the table are not satisfied, and merging
`main` before they are would break production (the production build refuses Tokyo, so it would fail
and Vercel would keep serving the current deployment — safe, but a failed release — or, if the
variables were switched first, would run against an empty Mumbai database). Specifically, at the
time of writing:

| Prerequisite | State |
| --- | --- |
| Mumbai production schema | at `0011`; `0012`–`0017` pending (dry run) — **not applied** |
| Tokyo backup | 16 Sep backup intact but **stale** (15 vs 14 applications, 39 vs 34 documents) — **needs a fresh one after an intake freeze** |
| Data import into Mumbai production | **not done**; belongs after the freeze and fresh backup |
| Production Google OAuth client and staff sign-in | **not created / not verified** — needs a person in Google Cloud and Supabase (`docs/GOOGLE-OAUTH.md`); production cannot be declared operational without it |
| Vercel Production variables | Supabase URL and anon key still name Tokyo (not switched — an edit made by you at the window) |
| Razorpay TEST webhook delivery | not observed; **does not gate the cutover**, gates billing go-live |
| Tests, staging, secrets | all green as recorded in §6 and §12 |

Nothing was written to Tokyo or to Mumbai production in this work.

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
2. **Configure Razorpay's TEST webhook for staging** (exact URL and secret rule in `PAYMENTS.md`
   §10.9) and pay one synthetic invoice to see a real delivery. Then do the manual QA in
   `PAYMENTS.md` §10.10 as a Google-signed-in ADMIN and SUPER_ADMIN. That is also the only check of
   every admin screen as a signed-in person, and of the QR code on a real phone. *(The TEST key
   pair is already in Vercel Preview.)*
3. **Decide GST treatment and the invoice number format** (D8) before any real invoice.
4. Review the **privacy policy** wording for Razorpay, and complete the privacy review of
   converting applications into CRM records and of payment records.
5. *(ADMIN's audit and settings access — resolved in `0016`; nothing to decide unless you want it
   different.)*
6. Freeze intake for the cutover window; approve (or run) the database, staff and data steps of the
   runbook; create the Google OAuth client and complete each staff sign-in; switch the two
   Supabase variables together.
7. **Confirmation of what was and was not touched (19 Sep update):**
   * **Tokyo production** — one **read-only** check (`backup:prod -- verify`: GET requests only, by
     construction). No write. Counts and timestamps only were recorded here; no applicant name or
     document name.
   * **Mumbai production** — one read-only connection: `db push --dry-run`, which lists pending
     migrations and applies nothing. No write.
   * **Mumbai staging** — `0016` and `0017` applied; synthetic invoices, payments and audit rows
     ("STAGING TEST") created and left (invoices have no DELETE by design).
   * **Vercel** — Production: variable **names** listed, no value read or changed. Preview: the
     staging webhook secret was pulled to a temporary file that a script deleted, never printed; the
     TEST Razorpay pair reads back empty (sensitive) and was never seen. Deployments were made only
     by pushing to `origin/staging`; no redeploy, promotion or environment edit was made.
   * **Razorpay** — no dashboard change; **live webhook not configured**; the API was called with
     the TEST key only, by the deployed staging server.
   * DNS, OAuth, `main` — unchanged; `main` not merged or pushed. Candidate and job-application
     payments — not built, and refused by the schema.

---

**This document grants no approval. Production database cutover has NOT been performed. `main`
has NOT been merged.**
