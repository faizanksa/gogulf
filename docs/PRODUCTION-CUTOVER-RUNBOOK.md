# Production cutover runbook — Tokyo → Mumbai, with jobs, admin and billing

Written 19 September 2026 for release candidate **see `docs/MAIN-RELEASE-READINESS.md` §2**.
This is the ordered procedure. The evidence and the reasoning are in
`docs/PRODUCTION-CUTOVER-READINESS.md` (state of every environment) and `docs/PAYMENTS.md` §10
(billing). **Progress on 19 Sep 2026, executed on your instruction:** steps 1–5 below are done on
Mumbai production (schema `0012`–`0017`, 439/439, fresh Tokyo backups, staff, the data import), step 7
was found already in place, and **step 8 (the `main` push) is the remaining step** — see
`docs/MAIN-RELEASE-READINESS.md` §14 for the state and the evidence. Every step that changes production
still needs an explicit go-ahead at the time.

> **The merge to `main` and the database cutover are one event.** The release reads jobs from
> the database (`0012`), writes `job_id` on applications (`0013`) and needs `0014`–`0017` for
> payments, invoices, the admin model and the server-only payment request. Tokyo production has migration `0001` only, and since commit `304130c`
> a production build whose `NEXT_PUBLIC_SUPABASE_URL` names Tokyo **fails at prebuild** (the live
> deployment keeps serving). Vercel Production's variables **already name Mumbai production** (set 16
> Sep; the live deployment was built 13 Sep and still serves Tokyo), so the merge is what moves traffic.

Two projects, and they must never be confused:

| | Ref | Role |
| --- | --- | --- |
| Tokyo | `julbqkeyvzwluayokcdi` | **Live today.** Never a target of any script here. Never written to. |
| Mumbai production | `exsnksrmkycloxiajwmx` | The target of this runbook. **Now at `0001`–`0017` with the Tokyo data imported and three staff identities (19 Sep)**; serves no traffic until `main` is merged. |
| Mumbai staging | `noxireidrbeqcvsirjec` | Rehearsal. `0001`–`0017`, 439/439. |

State on 19 Sep 2026: Mumbai production was at `0011` and empty before this was run. **Tokyo keeps
receiving real applications** — 14 on 16 Sep, 15 that morning, 19 that afternoon (50 documents) — so
the 16 Sep archive was stale and a fresh one was taken. There is **no way to freeze Tokyo's intake
without modifying Tokyo** (its anonymous INSERT grant) **or the live site**, which was ruled out, so the
procedure is **delta reconciliation**: import a verified backup, switch, then re-backup and re-import
whatever arrived in between. Tokyo is only ever read.

---

## Phase A — decisions and prerequisites (no production change)

| # | Decision / prerequisite | Owner | Blocks |
| --- | --- | --- | --- |
| A1 | Real vacancy content approved (only confirmed listings; D4) | You | publishing jobs |
| A2 | Privacy review of application → contact/case conversion, and of payment records | You | real applicants; real payments |
| A3 | **GST treatment and invoice numbering** (D8, GST certificate) | You + accountant | **any real invoice** |
| A4 | Privacy-policy wording for Razorpay reviewed; decide whether the effective date changes | You | billing go-live |
| A5 | *(Resolved in `0016`, 19 Sep: ADMIN no longer holds `users.manage` / `settings.manage`, and audit entries about staff, roles and settings need the matching permission. SUPER_ADMIN is the system administrator.)* | — | — |
| A6 | **Intake freeze** for the window, and the replay policy for anything arriving during the switch. Real applications are still arriving on Tokyo (one on 18 Sep) | You | step 1, step 9 |
| A7 | Google Workspace mailboxes for `careers@` and `admin@` can complete a Google sign-in | You | staff access |
| A8 | Razorpay TEST keys in Vercel Preview and real test-mode payments on staging — **done 19 Sep** (`PAYMENTS.md` §10.12). **Still open:** Razorpay's own TEST webhook delivered to staging (`PAYMENTS.md` §10.9) and the manual QA of the admin screens as signed-in staff (`PAYMENTS.md` §10.10) | You (dashboard, QA) + me | billing go-live |

## Phase B — the cutover (each step needs your go-ahead)

Environment for every command: repository root, branch `phase-2/redesign` at the release head
(verify `git rev-parse origin/staging`). Never run these from `.env.local`; the runner reads
only its own pinned env files.

**1. Record Tokyo** *(done 19 Sep; repeat after the switch for the delta)*

There is no freeze (see the top of this file): intake is reconciled, not stopped.

```bash
npm run backup:prod                   # a fresh, hash-checked archive of rows and documents
npm run backup:prod -- verify         # live vs. that archive: rows, documents, SHA-256, delta
```
Both are GET-only. Expect **zero delta between the archive and the live project at the moment of
verifying**. On any delta: take another, re-verify, and import from the **archive**, never the live
bucket. Keep the output. On 19 Sep: 19 applications, 50 documents (48 referenced by a row; 2 in the
bucket referenced by none — imported too), 50/50 SHA-256.

**2. Apply the missing migrations to Mumbai production — only while it holds no live data** *(done 19 Sep: `0001`–`0017`, 439/439, in that order — migrations, suites, sequences, then staff, then data)*

```bash
node scripts/db-remote.mjs --target=mumbai-production push --dry-run --yes-i-am-provisioning-production
node scripts/db-remote.mjs --target=mumbai-production push --yes-i-am-provisioning-production
```
Applies exactly `0012_jobs`, `0013_job_applications_bridge`, `0014_payments`, `0015_invoices`,
`0016_admin_operational_model`, `0017_invoice_payment_request_server_only`.
`db push` reports failure after success on this machine (a pg-delta certificate error): **read
`schema_migrations`, not the exit code.** `0012` is not re-runnable; if a push stops part-way,
inspect the object list before retrying — do not run the file twice.

```bash
node scripts/db-remote.mjs --target=mumbai-production test --yes-i-am-provisioning-production
```
Expect **439/439**. Then read-only: 27 public tables all with RLS, and `audit_logs` at exactly
**372 rows, all `system`** (370 today, plus the two audited grant deletions in `0016`; `0017` writes
none; `supabase/snippets/readiness-inventory.sql`). Also confirm the payment-request door is shut:
`select has_function_privilege('anon', 'public.open_invoice_payment_request(text,text)', 'EXECUTE')`
must be **false** (and `true` for `service_role`). Anything else: stop.

**The suites consume sequence numbers** (`GG-INV`, `GG-PAY`, `GG-JOB`, and the case number), because a
rolled-back transaction does not restore a sequence. On 19 Sep the suites moved them to 11, 9, 13 and
20; they were put back **under a guard**, not blindly: record the state before, and afterwards restore
only if every table that uses a sequence is empty (`invoices`, `payments`, `payment_events`, `jobs`,
`cases`) **and** each `reference` column has a unique index — otherwise refuse. Result: `GG-INV`,
`GG-PAY` and `GG-JOB` read "never used" (first real numbers `…-00001`), and `case_number_seq` is back
at its prior 12. Uniqueness is enforced by the database, not by the sequence, and a number consumed
inside a rolled-back transaction never existed as a record, so nothing auditable is reused.

**3. Google OAuth (Internal consent screen) and Supabase auth settings** *(configured by you in the Supabase dashboard; verified read-only 19 Sep)*
Exact values in `docs/GOOGLE-OAUTH.md` §3. **Do not `supabase config push` production** from this
repository: `.env.google-oauth.local` holds the *staging* client, and the push would replace the
production client with it. Verified 19 Sep through the Management API (non-secret fields): Google
enabled with a client id different from staging's, site URL `https://www.gogulf.co`, allow-list
`https://www.gogulf.co/**`, `disable_signup` true, JWT hook enabled. Supabase's hand-off to Google and
Google's acceptance of the client and the production callback URI were checked with a non-interactive
GET probe. **Not verifiable without a person:** the client secret and the Internal consent screen —
the first real sign-in is the test. Also verify with a real refused `POST /auth/v1/signup` from an
`@gogulf.co` address — not with `/auth/v1/settings`, which is cached.

**4. Staff** *(done 19 Sep: three distinct identities, roles and hook claims verified)*

```bash
npm run bootstrap:admins -- --target=mumbai-production --yes-bootstrap-production-admins
npm run bootstrap:admins -- --target=mumbai-production --report
```
`hello@` and `admin@` → SUPER_ADMIN, `careers@` → ADMIN. Each person then signs in with Google
once and is verified individually (`supabase/snippets/verify-google-signin.sql`).

**5. Import the Tokyo applications and documents from the verified archive** *(done 19 Sep)*

```bash
node scripts/import-to-production.mjs <backup-dir>                                        # dry run: the plan
node scripts/import-to-production.mjs <backup-dir> --execute --yes-import-real-applicants-to-mumbai-production
```
`scripts/import-to-production.mjs` is the tool `restore-backup.mjs` refuses to be. Pinned to Mumbai
production (the credential URL *and* the key's own `ref` claim must name it); re-hashes the whole backup
locally before sending anything; **never overwrites** (an existing object or row must be identical or the
run aborts); dry-run by default; reads everything back afterwards and compares every row column by column
and every document by SHA-256. It is idempotent, so the same command with a **newer** backup is the delta
import. It writes no audit rows and creates no contacts, cases or jobs. Applications arrive as `new`,
unassigned, with no job. Phone numbers are stored as submitted (free text; they are normalised only when
an application is converted to a contact), and there is no per-document status column to set.
Result 19 Sep: 19/19 rows equal, 50/50 documents equal, every reference resolves; a second dry run
against a newer backup found nothing to add.

**6. Rehearse on staging first**
There is no non-production way to exercise Mumbai production itself (Preview deployments point
at staging by design), so the first production exercise is step 9. Before this step, run the
whole job lifecycle and `docs/PAYMENTS.md` §10.10 on **staging** as a signed-in SUPER_ADMIN and
ADMIN, and keep the notes.

**7. The public Supabase variables in Vercel Production** *(found already correct 19 Sep — verify, do not "switch")*

Read with `vercel env pull --environment=production` to a scratch file that is deleted at once,
printing only each value's project ref and mode (never a value):

| Variable | State read 19 Sep |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://exsnksrmkycloxiajwmx.supabase.co` (Mumbai production), set 16 Sep |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | claims `ref=exsnksrmkycloxiajwmx role=anon` |
| `SUPABASE_SERVICE_ROLE_KEY` | a **sensitive** variable: reads back empty, so unverifiable by pull. The build guard cross-checks its embedded project ref against the URL and fails the build on a mismatch. **Since `0017` the customer payment page also needs it** to record an order, so a wrong key breaks payment, not only the webhook |
| `RAZORPAY_KEY_ID` | **live** (`rzp_live_` prefix); `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET` present |
| `NEXT_PUBLIC_SITE_URL` `PLATFORM_MODE` `APP_ENV` | `https://www.gogulf.co`, `server`, **unset** (`staging` would add `noindex`) |

The variables affect **new builds only**: the live deployment (built 13 Sep) still serves Tokyo until
step 8 produces a new one. If the build fails on the service-role check, set
`SUPABASE_SERVICE_ROLE_KEY` again from `.env.prod-supabase.local` (its JWT claims are
`ref=exsnksrmkycloxiajwmx role=service_role`) and redeploy; the live site is unaffected meanwhile.

**8. Merge — the remaining step**

```bash
git fetch origin
git rev-parse origin/staging            # must equal the release head recorded in MAIN-RELEASE-READINESS §2
git merge-base --is-ancestor origin/main origin/staging && echo fast-forward
git push origin origin/staging:refs/heads/main     # starts the Vercel production build
```
Pushing the remote ref directly avoids a checkout, so uncommitted work in the tree is untouched.
Watch the build log: `Environment: production`, `Supabase API: PRODUCTION Mumbai`,
`Razorpay: live key`, guard `PASS`. If it fails on the Tokyo/mixed-key guard, step 7 is
incomplete — fix the variables and redeploy; the live site is unaffected meanwhile.

**9. Verify the deployed site**

```bash
node scripts/verify-production-deployment.mjs        # GET-only + one unsigned webhook probe
```
It checks: the bundle names exactly one Supabase ref (`exsnksrmkycloxiajwmx`) and none of Tokyo or
staging; no service-role JWT in any public script; no `STAGING TEST` content; production is indexable;
robots keeps `/admin` and `/pay/` out; the sitemap is clean and every URL answers 200; legal pages
exist; every admin screen redirects; sign-in offers Google and has no password field; `/pay/…` 404s for
anything not a real invoice; the webhook without a signature is refused (401/503, never 2xx). Run
against the old Tokyo build on 19 Sep it **fails exactly six checks** (bundle names Tokyo, no Google
sign-in, robots, callback, webhook 404) — those are the ones that must flip. Then, by a person:

* Each of `admin@`, `hello@`, `careers@` signs in with Google once. Verify afterwards with
  `supabase/snippets/verify-google-signin.sql` (a Google identity linked, `app_role` correct).
* ADMIN cannot open `/admin/staff`, `/roles`, `/settings`, `/integrations`; SUPER_ADMIN can.
* Submit one real test application with real files; open its CV and passport from `/admin`; delete it and record that you did.
* **Only the unsigned webhook probe is ever run against production** (`razorpay-webhook-probe.mjs` refuses `--secret`/`--order` there). **No live payment is made** to verify configuration.

**10. Final delta, then the one-way door**
After the switch, repeat step 1 (`backup:prod`, `-- verify`) and `scripts/import-to-production.mjs`
with the newer backup for whatever was submitted between the first backup and the switch — and again
some hours later, for visitors whose browser still held the old page and posted to Tokyo. Tokyo's
anonymous INSERT is **not revoked by this work** (that modifies Tokyo); revoking it is a separate
decision, taken only after a delta of zero. After that, rollback needs a reconciliation in both directions.

## Phase C — billing go-live (separate approvals; not part of the cutover itself)

Billing is deployed and inert until these are done, in this order:

1. **A3 and A4 resolved.** No real invoice before GST treatment is decided.
2. **TEST-mode rehearsal on staging passed** (A8), including a failure and a retry — real TEST
   payments and a decline/retry were done on 19 Sep (`PAYMENTS.md` §10.12). **Also required before
   this step: Razorpay's own TEST webhook has been seen marking a staging invoice paid**
   (`PAYMENTS.md` §10.9), because the live webhook is the same mechanism with a different secret.
3. **Live webhook.** In Vercel **Production** confirm `RAZORPAY_WEBHOOK_SECRET` exists *before*
   saving the webhook in the Razorpay dashboard, so the first delivery is never refused:
   URL `https://www.gogulf.co/api/razorpay/webhook`, events `order.paid`, `payment.authorized`,
   `payment.failed`. The live secret is generated in the dashboard; it is not derived from the API keys.
4. **First real payment, small and supervised.** Create a small real invoice, pay it yourself,
   confirm invoice paid, one payment row, the audit history, and the Razorpay dashboard. There is
   **no refund flow**: any refund of that test payment is made in Razorpay's dashboard by hand.
5. Only then share links with customers.

## Rollback

| Stage | Action |
| --- | --- |
| Mumbai migrated only | nothing to undo — it serves no traffic |
| New build live | promote `dpl_9RaneE2dUCaRfmGifXYfumUjWDL9` (`519cb85`; verified Ready and aliased to `www.gogulf.co` and `gogulf.co` on 19 Sep). It keeps the Tokyo configuration it was built with, so **no Production variable needs restoring for the rollback** (the variables already name Mumbai and only affect new builds; Tokyo's public anon key is not stored on this machine and is only needed if you later want the *variables* back on Tokyo — read it from the Vercel dashboard first). Tokyo still holds every row taken before the switch. Promotion does not rebuild, so the guard does not interfere. Anything submitted to Mumbai after the switch must be reconciled back |
| Live, Tokyo intake still open | same, plus replay the switch-window applications into Tokyo (policy A6) |
| After Tokyo `anon` INSERT is revoked | **one-way door**: restore the grant and reconcile both directions |
| Payments misbehaving after billing go-live | remove the live webhook in the Razorpay dashboard (deliveries then stop and Razorpay retries later) and void unpaid invoices in `/admin`; never edit invoice or payment rows by hand |

## Stop conditions

Stop before switching traffic if: `0012`–`0017` are not all in `schema_migrations`, or the SQL suites are not 439/439 on Mumbai production, or `anon` can execute `open_invoice_payment_request`; the Tokyo backup imported is not the fresh, verified one (or has not been re-verified against live immediately before the push); Mumbai production, **before the import**, shows any application, contact, case, job, invoice or payment, or an audit count other than 372 `system` rows after `0016` (370 before it; 375 once the three staff identities exist); the delta check finds anything the archive lacks; the bundle names more than one Supabase project or names Tokyo; any server-only secret appears in client output; Google sign-in fails for any administrator or a non-Workspace account gets a role; a draft or archived job is public; a paid-access job can be published; the full E2E suite has not been run against the exact merge commit.

Roll back after switching if: applications fail to submit or documents cannot be retrieved; data reaches the wrong project; any unauthenticated access to `job_applications`, `contacts`, `cases`, `payments`, `invoices` or the bucket succeeds; the customer payment page shows anything beyond number, service, amount and status; staff sign-in or roles are wrong; staging or test content is live, or `noindex` reaches production; unexplained 5xx after the first hour.

**This runbook grants no approval. Mumbai production is prepared; traffic has NOT been switched and `main` has NOT been merged.**
