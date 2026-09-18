# Production cutover runbook — Tokyo → Mumbai, with jobs, admin and billing

Written 19 September 2026 for release candidate **see `docs/MAIN-RELEASE-READINESS.md` §2**.
This is the ordered procedure. The evidence and the reasoning are in
`docs/PRODUCTION-CUTOVER-READINESS.md` (state of every environment) and `docs/PAYMENTS.md` §10
(billing). **Nothing in this file has been run against production.** Every step that changes
production needs your explicit go-ahead at the time; none is pre-approved by this document.

> **The merge to `main` and the database cutover are one event.** The release reads jobs from
> the database (`0012`), writes `job_id` on applications (`0013`) and needs `0014`/`0015` for
> payments and invoices. Tokyo production has migration `0001` only, and since commit `304130c`
> a production build whose `NEXT_PUBLIC_SUPABASE_URL` names Tokyo **fails at prebuild** (the live
> deployment keeps serving). So step 8 (merge) cannot succeed before step 7 (variables).

Two projects, and they must never be confused:

| | Ref | Role |
| --- | --- | --- |
| Tokyo | `julbqkeyvzwluayokcdi` | **Live today.** Never a target of any script here. Never written to. |
| Mumbai production | `exsnksrmkycloxiajwmx` | Empty, at `0001`–`0011`. The target of this runbook. |
| Mumbai staging | `noxireidrbeqcvsirjec` | Rehearsal. `0001`–`0015`, 386/386. |

---

## Phase A — decisions and prerequisites (no production change)

| # | Decision / prerequisite | Owner | Blocks |
| --- | --- | --- | --- |
| A1 | Real vacancy content approved (only confirmed listings; D4) | You | publishing jobs |
| A2 | Privacy review of application → contact/case conversion, and of payment records | You | real applicants; real payments |
| A3 | **GST treatment and invoice numbering** (D8, GST certificate) | You + accountant | **any real invoice** |
| A4 | Privacy-policy wording for Razorpay reviewed; decide whether the effective date changes | You | billing go-live |
| A5 | Whether ADMIN should keep `audit.view` / `settings.manage` / `users.manage` (`PAYMENTS.md` §10.6) | You | nothing (a follow-up migration) |
| A6 | Applications arriving during the switch window: replay policy | You | step 9 |
| A7 | Google Workspace mailboxes for `careers@` and `admin@` can complete a Google sign-in | You | staff access |
| A8 | **Razorpay TEST keys added to Vercel Preview, and one full test-mode payment on staging** (`PAYMENTS.md` §10.9–10.10) | You (keys) + me | billing go-live |

## Phase B — the cutover (each step needs your go-ahead)

Environment for every command: repository root, branch `phase-2/redesign` at the release head
(verify `git rev-parse origin/staging`). Never run these from `.env.local`; the runner reads
only its own pinned env files.

**1. Freeze and record Tokyo**

```bash
npm run backup:prod -- verify         # live vs. archive: rows, documents, SHA-256, delta
```
Expect 14 rows / 34 documents, zero delta. On any delta: take a fresh backup, re-verify, and
migrate from the **archive**, never the live bucket. Keep the output.

**2. Apply the missing migrations to Mumbai production — only while it holds no live data**

```bash
node scripts/db-remote.mjs --target=mumbai-production push --dry-run --yes-i-am-provisioning-production
node scripts/db-remote.mjs --target=mumbai-production push --yes-i-am-provisioning-production
```
Applies exactly `0012_jobs`, `0013_job_applications_bridge`, `0014_payments`, `0015_invoices`.
`db push` reports failure after success on this machine (a pg-delta certificate error): **read
`schema_migrations`, not the exit code.** `0012` is not re-runnable; if a push stops part-way,
inspect the object list before retrying — do not run the file twice.

```bash
node scripts/db-remote.mjs --target=mumbai-production test --yes-i-am-provisioning-production
```
Expect **386/386**. Then read-only: 27 public tables all with RLS, and `audit_logs` at exactly
**370 rows, all `system`** (`supabase/snippets/readiness-inventory.sql`). Anything else: stop.

**3. Google OAuth (Internal consent screen) and Supabase auth settings**
Exact values in `docs/GOOGLE-OAUTH.md` §3. Then verify with a real refused
`POST /auth/v1/signup` from an `@gogulf.co` address — not with `/auth/v1/settings`, which is cached.

**4. Staff**

```bash
npm run bootstrap:admins -- --target=mumbai-production --yes-bootstrap-production-admins
npm run bootstrap:admins -- --target=mumbai-production --report
```
`hello@` and `admin@` → SUPER_ADMIN, `careers@` → ADMIN. Each person then signs in with Google
once and is verified individually (`supabase/snippets/verify-google-signin.sql`).

**5. Import the Tokyo applications and documents from the verified archive**
Procedure in `docs/PRODUCTION-CUTOVER-READINESS.md` §16: re-verify SHA-256 per object, import
documents as `uploaded` (never `approved`), quarantine unparseable phone numbers.

**6. Rehearse on staging first**
There is no non-production way to exercise Mumbai production itself (Preview deployments point
at staging by design), so the first production exercise is step 9. Before this step, run the
whole job lifecycle and `docs/PAYMENTS.md` §10.10 on **staging** as a signed-in SUPER_ADMIN and
ADMIN, and keep the notes.

**7. Switch the two public Supabase variables in Vercel Production — in one edit**

| Variable | New value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://exsnksrmkycloxiajwmx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Mumbai production anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | already Mumbai production's (confirm by first/last six characters in the Supabase dashboard; Vercel keeps it write-only) |

Do **not** set `APP_ENV` in Production (`staging` would add `noindex`). The prebuild guard now
fails a production build whose anon or service-role key belongs to a different project than the
URL, so a half-switch is caught before it deploys.

**8. Merge**

```bash
git fetch origin && git switch main
git merge --ff-only origin/main
git merge --ff-only origin/staging      # confirm the hash equals the release head recorded in MAIN-RELEASE-READINESS §2
git push origin main                    # starts the Vercel production build
```
Watch the build log: `Environment: production`, `Supabase API: PRODUCTION Mumbai`,
`Razorpay: live key`, guard `PASS`. If it fails on the Tokyo/mixed-key guard, step 7 is
incomplete — fix the variables and redeploy; the live site is unaffected meanwhile.

**9. Verify the deployed site** (`docs/PRODUCTION-CUTOVER-READINESS.md` §17, plus)

* The live JavaScript names exactly one Supabase ref: `exsnksrmkycloxiajwmx`.
* `/jobs` is 200 with no `STAGING TEST` content; a draft job 404s; `/admin` → 307 to sign-in.
* Submit one real test application with real files; open its CV and passport from `/admin`; delete it and record that you did.
* `/pay/GG-INV-2099-99999` is 404 and `/api/razorpay/webhook` with **no signature** is 401 or 503 — endpoint live but closed. **Only the unsigned probe is ever run against production** (`razorpay-webhook-probe.mjs` refuses `--secret`/`--order` there):

```bash
node scripts/razorpay-webhook-probe.mjs --base=https://www.gogulf.co
```

**10. Final delta, then the one-way door**
`npm run backup:prod -- verify` must report zero delta before Tokyo's anonymous INSERT is
revoked. After that, rollback needs a reconciliation in both directions.

## Phase C — billing go-live (separate approvals; not part of the cutover itself)

Billing is deployed and inert until these are done, in this order:

1. **A3 and A4 resolved.** No real invoice before GST treatment is decided.
2. **TEST-mode rehearsal on staging passed** (A8), including a failure and a retry.
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
| Variables switched, build deployed | promote `dpl_9RaneE2dUCaRfmGifXYfumUjWDL9` (`519cb85`) and restore the two Tokyo variables; Tokyo still holds every row. Promotion does not rebuild, so the guard does not interfere |
| Live, Tokyo intake still open | same, plus replay the switch-window applications into Tokyo (policy A6) |
| After Tokyo `anon` INSERT is revoked | **one-way door**: restore the grant and reconcile both directions |
| Payments misbehaving after billing go-live | remove the live webhook in the Razorpay dashboard (deliveries then stop and Razorpay retries later) and void unpaid invoices in `/admin`; never edit invoice or payment rows by hand |

## Stop conditions

Stop before switching traffic if: `0012`–`0015` are not all in `schema_migrations`, or the SQL suites are not 386/386 on Mumbai production; Mumbai production shows any data or an audit count other than 370 `system` rows; the delta check finds anything the archive lacks; the bundle names more than one Supabase project or names Tokyo; any server-only secret appears in client output; Google sign-in fails for any administrator or a non-Workspace account gets a role; a draft or archived job is public; a paid-access job can be published; the full E2E suite has not been run against the exact merge commit.

Roll back after switching if: applications fail to submit or documents cannot be retrieved; data reaches the wrong project; any unauthenticated access to `job_applications`, `contacts`, `cases`, `payments`, `invoices` or the bucket succeeds; the customer payment page shows anything beyond number, service, amount and status; staff sign-in or roles are wrong; staging or test content is live, or `noindex` reaches production; unexplained 5xx after the first hour.

**This runbook grants no approval. Production database cutover has NOT been performed.**
