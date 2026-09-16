# Staging Environment

**Status (11 Sep 2026): provisioned and validated.** Staging runs server-mode on
the existing Vercel project at **https://staging.gogulf.co**, sends email through
Resend, and stores applications and documents in its own Supabase project,
**`gogulf-staging`**. It cannot reach the production database. Production is
unchanged.

```
main       → Vercel Production → www.gogulf.co     → static build → EmailJS → Supabase gogulf         (unchanged)
staging    → Vercel Preview    → staging.gogulf.co → server build → Resend  → Supabase gogulf-staging
feature/*  → Vercel Preview    → *.vercel.app      → fails closed unless isolated (see §4)
```

---

## 1. What exists

| Item | Value |
| --- | --- |
| Vercel team / project | `faizan-chaudhary` / `gogulf` (`prj_ZkRKvP0dC2WjcGtFfvm09jrdiXfx`) |
| Plan | **Hobby** — no Custom Environments |
| Git | `github.com/faizanksa/gogulf`, production branch `main`, Git deployments on |
| Staging branch | `staging` (tracks `origin/staging`) |
| Staging URL | `https://staging.gogulf.co` (also `gogulf-git-staging-faizan-chaudhary.vercel.app`) |
| Access | **Private.** Vercel Authentication — see §3 |
| Functions region | `bom1` (Mumbai), pinned in `vercel.json` |
| DNS | No record added. `gogulf.co` is on Vercel DNS with a wildcard `*` ALIAS, so attaching the subdomain to the project was enough |
| Supabase (staging) | **`gogulf-staging`**, ref `wxolbnhyzktfjdvcnixc`, in `faizanksa's Org` — the organisation that owns production |
| Supabase (production) | `gogulf`, ref `julbqkeyvzwluayokcdi`, same organisation — **not touched** |

**No second Vercel project was created.** One project means one place for
configuration and nowhere to forget a variable.

---

## 2. Why a branch Preview, not a Custom Environment

Custom Environments are a Pro feature, and the team is on Hobby. The supported
fallback is the `staging` git branch deployed as a Preview, with **branch-scoped**
Preview variables.

That fallback carried a trap. The project's existing Supabase and EmailJS
variables are scoped to **Production and Preview**, so any Preview — staging
included — would inherit the production Supabase URL and key, and a staging job
application would have written a real row and uploaded real files to production.

Vercel gives a branch-scoped variable precedence over a project-wide one for that
branch. So staging overrides the inherited values **without a single Production
or project-wide Preview variable being modified**:

| Variable (Preview, branch `staging`) | Value | Note |
| --- | --- | --- |
| `PLATFORM_MODE` | `server` | Drops static export |
| `APP_ENV` | `staging` | Enables noindex; labels the isolation guard |
| `NEXT_PUBLIC_EMAIL_PROVIDER` | `resend` | No longer read — EmailJS is removed and the forms have one path. Safe to delete |
| `NEXT_PUBLIC_SITE_URL` | `https://staging.gogulf.co` | Canonicals point at staging |
| `RESEND_FROM_EMAIL` | `Go Gulf <no-reply@gogulf.co>` | Verified domain |
| `RESEND_REPLY_TO` | `careers@gogulf.co` | |
| `RESEND_API_KEY` | *sensitive* | A dedicated **sending-only** key, `gogulf_staging`, restricted to `gogulf.co`. Revocable without touching the website key |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://wxolbnhyzktfjdvcnixc.supabase.co` | **Overrides the inherited production value** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | staging anon key | **Overrides the inherited production value** |

`SUPABASE_SERVICE_ROLE_KEY` is deliberately **not** set on Vercel: no code path
uses it yet. Add it, branch-scoped and sensitive, when a feature needs it.

Project-wide variables, unchanged: `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_EMAILJS_PUBLIC_KEY`,
`NEXT_PUBLIC_EMAILJS_SERVICE_ID`, `NEXT_PUBLIC_EMAILJS_TEMPLATE_ID` — all
`Production, Preview`.

---

## 3. Staging is private — correcting an earlier assumption

Commit `d05c8e3` stated that Vercel Hobby could not protect a custom domain, so
staging would be public. **That was wrong.** The project's protection mode,
`all_except_custom_domains`, exempts only *production* custom domains. A preview
custom domain such as `staging.gogulf.co` stays behind Vercel Authentication:
anyone without a Vercel login on the team gets a redirect to the login page.

The noindex controls added in `d05c8e3` (`X-Robots-Tag` and a disallow-all
`robots.txt`, both opt-in on `APP_ENV=staging` / `VERCEL_ENV=preview`) remain as
defence in depth, in case protection is ever relaxed.

**Reviewing staging:** team members sign in to Vercel. For someone outside the
team, use Vercel's shareable link for the deployment rather than relaxing
protection.

**Automated tests** use Vercel's *Protection Bypass for Automation*: a project
secret sent as `x-vercel-protection-bypass`. It is read from the Vercel API at
test time and never written down. Rotate it in Project → Settings → Deployment
Protection if it is ever exposed. Without it, the wall holds — verified.

---

## 4. Isolation — enforced, and proven on real Vercel

`scripts/check-staging-isolation.mjs` runs as npm's `prebuild` hook, and
`vercel.json` pins `buildCommand: cross-env PLATFORM_MODE=server npm run build`
so Vercel always invokes it — and so server mode is committed to the repository
rather than left to a dashboard variable that can be deleted. It fails any
non-production build whose Supabase URL or keys belong to a production project
(`julbqkeyvzwluayokcdi` and, for the duration of the migration,
`exsnksrmkycloxiajwmx` — both hard-coded so an environment variable cannot defeat
it).

**Vercel Production builds no longer skip the script.** They skip the *isolation*
check, which is meaningless there, but are now checked for the opposite failure:
that `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and
`PLATFORM_MODE=server` are actually present. On 16 Sep production had none of the
Supabase values and was one redeploy away from losing every job application
silently; see the commit message on `4c6fcf6`.

**Proof.** The first `staging` push happened before the overrides existed —
Vercel rejects branch-scoped variables for a branch it has not seen yet. That
build inherited production Supabase and the guard stopped it:

```
Running "npm run build"
> prebuild
> node scripts/check-staging-isolation.mjs
Environment: preview
Supabase API: PRODUCTION (julbqkeyvzwluayokcdi)
FAIL — preview is configured against PRODUCTION:
  NEXT_PUBLIC_SUPABASE_URL points at the PRODUCTION Supabase project.
  NEXT_PUBLIC_SUPABASE_ANON_KEY is a PRODUCTION key.
Error: Command "npm run build" exited with 1          → deployment state: Error
```

With the staging values the guard reports `Environment: staging / Supabase API:
project wxolbnhyzktfjdvcnixc / PASS`. The end-to-end test (§7) reads the
Supabase URL and key out of the **deployed** bundle and refuses to continue unless
they are staging's; the staging anon key is rejected by production with 401.

**Consequence for feature branches:** every Preview inherits production Supabase,
so every feature-branch Preview now fails closed at build time. That is correct —
a preview must not touch production. Give a feature branch its own branch-scoped
Supabase overrides when it needs a deployment.

---

## 5. Email has one path: Resend, on the server

EmailJS was removed from the code on 11 Sep 2026 (Phase 2B, at the business's
instruction). Every form posts to `/api/forms/*`, which sends through Resend with a
server-only key read at run time. There is no provider switch any more, so
`NEXT_PUBLIC_EMAIL_PROVIDER` is ignored. The Supabase URL and anon key are still
inlined at build time: changing them needs a redeploy.

---

## 6. Supabase staging

| | |
| --- | --- |
| Project | `gogulf-staging`, ref **`wxolbnhyzktfjdvcnixc`** |
| Organisation | `faizanksa's Org` (`rtnkssqmprwivcyvnvxl`) — Free plan, confirmed by the owner. Staging uses the org's second free active-project slot, so the paused `fc-gulf-travels's Project` cannot be restored without pausing another |
| Region | `ap-northeast-1` (Tokyo) — **the same as production**, so staging reproduces the post-cutover topology: functions in Mumbai, database in Tokyo. See §9 |
| Postgres | 17.6, like production |
| Keys used | legacy `anon` / `service_role` JWTs, as production uses — the isolation guard can read the project ref inside them. Moving to publishable/secret keys is a later, separate change |
| Data | synthetic only. Nothing was copied from production |

Why a separate project and not a branch of production: a branch lives inside
the production project, shares its billing and settings, and is built for
short-lived PR databases. A separate project shares nothing with production but
the organisation.

### Credentials

`.env.staging.local` at the repo root holds `STAGING_SUPABASE_REF`,
`STAGING_DB_HOST`, `STAGING_DB_PASSWORD`, `STAGING_SUPABASE_URL`,
`STAGING_ANON_KEY` and `STAGING_SERVICE_ROLE_KEY`. It is gitignored (`.env*`) and
**Next.js never loads it** — Next reads only the development, production and test
env files — so it cannot leak into a local build. The database password was
generated at creation and has never been displayed. If the file is lost, reset
the password in the dashboard and re-copy the keys.

### Migrations and tests on staging

```bash
npm run db:staging -- push --dry-run   # what staging has not applied yet
npm run db:staging -- push             # apply supabase/migrations to staging
npm run db:staging -- test             # both SQL suites on staging (each rolls back)
```

`scripts/db-staging.mjs` refuses the production ref, and connects as
`postgres.wxolbnhyzktfjdvcnixc` through the session pooler — the pooler routes on
that user name, so it cannot land on any other project. psql is borrowed from the
local Supabase container, so `npx supabase start` must be running.

### Auth settings — applied 11 Sep 2026

`supabase/config.toml` is the source of truth: the base file describes the local
stack, and its `[remotes.staging]` block overrides it for staging. Live on
`gogulf-staging`:

| Setting | Value |
| --- | --- |
| Custom access token hook | **on** — `pg-functions://postgres/public/custom_access_token_hook` |
| Site URL | `https://staging.gogulf.co`; redirects allowed only to `https://staging.gogulf.co/**` |
| Sign-ups | **off** — staff accounts are created by an administrator; Phase 2 builds staff login |
| Email + password | on, email confirmation required |
| MFA (TOTP) | available — staff login is "email + password (+ optional MFA)" |
| Anonymous and phone sign-in | off |
| Email OTP / resend throttle | 8 digits / 60 s — the hosted defaults |

```bash
npx supabase orgs list          # must show faizanksa's Org
npx supabase config push --project-ref wxolbnhyzktfjdvcnixc
```

**`config push` has no preview.** It applies at once — a piped "n" does not stop
it — and it sends every setting in the file, not only the ones that changed. The
first push on 11 Sep therefore also carried three relaxations meant for the local
stack (TOTP off, 6-digit email OTP, 1-second resend throttle). The staging block
now states the hosted defaults explicitly, a second push restored them, and a
third reported every service "up to date": the live project matches the file.
Never run `config push` against production — there is deliberately no block for it.

Verified with real sign-ins by synthetic users, created with the staging service
role and deleted afterwards:

- A public sign-up is refused (422 "Signups not allowed for this instance") and
  creates no account.
- Auth links return to the staging site URL; a redirect outside the allow-list
  falls back to it; an allow-listed staging path is honoured.
- A non-staff user's token carries **no** staff claims; `is_staff()` is false and
  RLS returns no roles and no staff records.
- An active HR_MANAGER's token carries `app_role`, `app_staff_id` and `app_branch`
  and no permission list (permissions resolve live). It reads the 12 roles and
  its own record, and cannot promote itself to SUPER_ADMIN.
- Deactivating the staff row ends access on the **next query**: the old token
  still carries its claims, but `is_staff()` is false and RLS returns nothing.
  Refreshed and newly issued tokens carry no staff claims.

### Route guard

`proxy.ts` sends a signed-out visitor from `/admin…` to `/admin/login?next=…` and
from `/portal…` to `/portal/login?next=…`; forged cookies and self-signed tokens
are rejected by the auth server. A genuine session passes this coarse gate —
which KIND of session may see a page is decided by the pages Phase 2 builds, and
RLS stays the real boundary.

The login pages themselves were inside the gated prefixes, so the proxy
redirected each one to itself: once Phase 2 built them, nobody could have signed
in. The rule now lives in `lib/auth/route-guard.ts`, exempts the two login pages,
and is unit-tested.

### Default privileges differ between hosted and local

A hosted project created on 10 Sep 2026 still receives Supabase's **old** default
privileges: on staging, as on production, `anon`, `authenticated` and
`service_role` hold ALL on `job_applications`, so the apply form's anonymous
insert works. The **local** stack (CLI 2.109) uses the new defaults and grants
only `REFERENCES`, `TRIGGER` and `TRUNCATE`, so on a local database the apply
form's insert is refused. (An earlier revision of this file predicted the
opposite for new hosted projects. Staging disproved it.)

0009 made every platform table's privileges explicit, so the platform behaves the
same everywhere. `job_applications` still depends on the defaults of whichever
project it lands in, and on hosted projects `anon` holds `TRUNCATE` on it — not
reachable through the Data API, but not needed either. An explicit
`anon: INSERT only` grant is the fix; it is **not** applied in Phase 1.6 because it
would change the live production table at cutover and belongs with the Phase 5
move of this form to a server route.

---

## 7. Validation results

| Check | Local | Staging |
| --- | --- | --- |
| `0001`–`0011` apply in order from an empty database | ✅ | ✅ |
| `rls.test.sql` — catalogue, identity, audit, grants, side doors | ✅ 52 | ✅ 52 |
| `rbac-behaviour.test.sql` — queries as each role, with positive controls | ✅ 84 | ✅ 84 |
| **Total** | **136** | **136** |

Re-measured 16 Sep 2026 after `0011` was pushed to staging. The earlier 46/83 split was
counted slightly differently; compare totals rather than columns against older revisions.

`0011` was verified against staging rather than only locally, because the starting state is
what differs: staging began at `anon=arwdDxtm` — the hosted default, SELECT, DELETE and
TRUNCATE included — where the local stack begins at `Dxtm`. After the push, through the live
REST API with the published anon key:

| Probe as anon on staging | Before `0011` | After |
| --- | --- | --- |
| `SELECT id,email,phone,passport_path` | `200` + `[]` | **`401`** `42501` |
| `DELETE` | would have been permitted | **`401`** `42501` |
| `INSERT` — the public applicant path | `201` | `201` |
| `service_role` reads the row back | ✅ | ✅ |

All 7 staging rows intact. The refusal now comes from the privilege layer, before RLS is
consulted.
| 23 public tables, all with RLS; 55 policies; 72 permissions; 12 roles | ✅ | ✅ |
| Private `job-applications` bucket, 10 MB limit, anon insert-only policy | ✅ | ✅ |

**End to end on the deployed site** (synthetic applicant, mail to
`careers@gogulf.co`), using the Supabase URL and anon key read out of the
deployed bundle — exactly what a browser gets:

| Check | Result |
| --- | --- |
| Bundle targets exactly one Supabase project, staging's; no production ref, no production key, no service-role key | ✅ |
| CV (PDF), passport (PNG) and one extra document upload; the application row saves | ✅ |
| `/api/forms/job-application` sends the Resend notification and the applicant acknowledgement | ✅ |
| With the public key: list, download, signed URL, public URL, overwrite, remove, move — all refused | ✅ |
| With the public key: reading applications back, updating or deleting the row — no effect | ✅ |
| 11 MB upload rejected by the 10 MB bucket limit (413); writes to any other bucket refused | ✅ |
| The staging anon key sent to production is rejected (401) | ✅ |
| Service-role check: all three objects stored, bytes match their SHA-256 | ✅ |

One synthetic application is left on staging for inspection in the dashboard.

Semantic validation found eight defects in `0002`–`0008` that parse-only
validation could not. All are fixed in `0009_security_hardening.sql`:

1. A hardened trigger could not resolve `citext`, so **every** insert into
   `contact_identities` failed — identity resolution was broken.
2. The API roles held no data privileges on any platform table, so every RLS
   policy was unreachable — while anon and authenticated **did** hold `TRUNCATE`,
   which bypasses RLS.
3. Every SECURITY DEFINER function was executable by anon, including ones that
   forge audit and timeline entries and one that reveals whether a phone number
   belongs to a customer.
4. Audit partitions had RLS disabled.
5. The notes policy checked the permission but not the row's scope.
6. ADMIN could promote itself to SUPER_ADMIN.
7. Creation policies did not constrain branch/owner; staff could forge timeline
   entries on contacts outside their scope.
8. Own-scope staff could never edit their own records — caught by a positive
   control.

**Staging found a ninth, fixed in `0010_audit_claims_guard.sql`.** The suites run
on staging through the connection pooler. After a transaction that sets
`request.jwt.claims` ends, Postgres leaves the setting as `''` on that server
connection, and the pooler hands the connection to the next client. The audit
trigger cast that `''` to `jsonb` before applying `nullif`, so every audited write
on such a connection failed — the kind of connection server jobs and webhooks
use. A regression assertion reproduces it; it failed before 0010 and passes after,
on both databases. (0010 was committed inside `d7f1352`, whose message describes
only the `db:staging` tooling; a quoting error in the commit command merged the
two commits, and the pushed history is left as it is.)

The suite also caught a flaw in itself: wrapping a `STABLE` function call inside
`count(*)` let the planner skip the call, so a privilege probe passed without
testing anything. Function probes now execute the call directly.

---

## 8. Local runbook

```bash
# Local database (Windows: analytics is disabled in config.toml)
npx supabase start -x logflare,vector,studio,postgres-meta,realtime,edge-runtime,imgproxy
npm run env:local          # point local Next.js at local Supabase (.env.local untouched)
npm run db:test            # both SQL suites, via docker exec — cannot reach a hosted DB
npx supabase migration up --local   # apply new migrations to the local DB
npx supabase db reset      # LOCAL only; the project is deliberately not linked

# App
npm run dev                # predev runs the isolation guard
npm run build              # static — production's path
npm run build:server       # server — staging's path

# Gates
npm run lint && npm run typecheck && npm test
npm run check:secrets && npm run check:isolation && npm run db:validate
```

`npm run dev` and every build refuse to start while local configuration points
at production. `npm run env:local` writes `.env.development.local` and
`.env.production.local`, which Next.js loads ahead of `.env.local`.

`.env.local` no longer holds production Supabase keys. On 11 Sep 2026 they moved
to `.env.prod-supabase.local` — gitignored, and loaded by neither Next.js nor any
npm script — for explicit read-only checks only
(`node --env-file=.env.prod-supabase.local <script>`). A local run without the
`env:local` files now has no Supabase at all, rather than production's; the
isolation guard remains as the backstop.

`npm run check:secrets` loads the environment exactly as `next build` does and
also scans every local `.env*` file, so a secret is caught whichever file holds
it. (It used to read `.env.local` alone, and so checked Supabase values the build
never saw once `.env.production.local` overrode them.)

---

## 9. Promotion and production cutover

```
feature/*  →  PR  →  Preview (fails closed unless given isolated config)
           →  merge to `staging`  →  staging.gogulf.co  →  validate
           →  merge to `main`     →  production          →  deliberate, reviewed
```

**Local `main` is well ahead of `origin/main` and must not be pushed casually.**
Pushing it deploys, among other things, the privacy-policy change naming Resend,
which must ship **together with** the production provider switch.

Production cutover, when approved:

1. Decide the function region. `vercel.json` pins functions to `bom1` (Mumbai);
   the production database is in Tokyo. Staging reproduces exactly that, so its
   form latency is the preview of production's. Either accept it, pin functions
   to `hnd1` (Tokyo), or plan a database move.
2. Apply `0002`–`0011` to production — a separate, approved change with a backup.
   Superseded in part: production is moving Tokyo → Mumbai (`exsnksrmkycloxiajwmx`,
   `ap-south-1`), so the platform tables land in the new project rather than being
   added to the Tokyo one. `0011` is the exception — it hardens `job_applications`,
   which already holds live applicant data, and applies wherever production is.
3. Set Production variables `PLATFORM_MODE=server`, `NEXT_PUBLIC_SITE_URL=https://www.gogulf.co`,
   `RESEND_*` — **values set in the dashboard, never committed**.
4. Merge the redesign into `main` and deploy.
5. Verify all three forms on production; confirm the privacy policy names Resend.
6. Then delete the three `NEXT_PUBLIC_EMAILJS_*` Production variables and revoke the EmailJS
   account keys. The code stopped using them on 11 Sep 2026.

Rollback: Vercel "Promote" the previous production deployment — the EmailJS static build —
which is instant. The new code has no EmailJS path to switch back to, so keep the EmailJS
variables until the cutover has held.
