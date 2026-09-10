# Staging Environment

**Status (10 Sep 2026): provisioned and validated.** Staging runs server-mode on
the existing Vercel project at **https://staging.gogulf.co**, sends email through
Resend, and cannot reach the production database. Staging Supabase is **not yet
provisioned** — see §6. Production is unchanged.

```
main       → Vercel Production → www.gogulf.co     → static build → EmailJS     (unchanged)
staging    → Vercel Preview    → staging.gogulf.co → server build → Resend      (branch-scoped config)
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
| Functions region | `bom1` (Mumbai), pinned in `vercel.json`. The project default stays `iad1` |
| DNS | No record added. `gogulf.co` is on Vercel DNS with a wildcard `*` ALIAS, so attaching the subdomain to the project was enough |

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
| `NEXT_PUBLIC_EMAIL_PROVIDER` | `resend` | **Build-time** — see §5 |
| `NEXT_PUBLIC_SITE_URL` | `https://staging.gogulf.co` | Canonicals point at staging |
| `RESEND_FROM_EMAIL` | `Go Gulf <no-reply@gogulf.co>` | Verified domain |
| `RESEND_REPLY_TO` | `careers@gogulf.co` | |
| `RESEND_API_KEY` | *sensitive* | A dedicated **sending-only** key, `gogulf_staging`, restricted to `gogulf.co`. Revocable without touching the website key |
| `NEXT_PUBLIC_SUPABASE_URL` | *empty* | **Overrides the inherited production value** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | *empty* | **Overrides the inherited production value** |

Project-wide variables, unchanged: `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_EMAILJS_PUBLIC_KEY`,
`NEXT_PUBLIC_EMAILJS_SERVICE_ID`, `NEXT_PUBLIC_EMAILJS_TEMPLATE_ID` — all
`Production, Preview`.

With Supabase empty, document upload on staging's apply form reports that storage
is not connected. That is the intended, fail-closed behaviour until §6 is done.

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
`vercel.json` pins `buildCommand: npm run build` so Vercel always invokes it. It
fails any non-production build whose Supabase URL or keys belong to the
production project (`julbqkeyvzwluayokcdi`, hard-coded so an environment variable
cannot defeat it). Vercel Production builds skip it.

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

After the overrides were applied the redeploy succeeded, and the deployed client
bundle contains no reference to the production project.

**Consequence for feature branches:** every Preview inherits production Supabase,
so every feature-branch Preview now fails closed at build time. That is correct —
a preview must not touch production. Give a feature branch its own branch-scoped
Supabase overrides when it needs a deployment.

---

## 5. `NEXT_PUBLIC_EMAIL_PROVIDER` is a build-time switch

The compiled bundle contains `emailProviderMode … function(){return"resend"}` —
the value is inlined and the variable name eliminated. Changing the provider
requires a **redeploy**; editing the variable and restarting does nothing. The
server half (`RESEND_API_KEY`, `/api/forms/*`) is read at runtime.

---

## 6. Supabase staging — blocked on account access

A separate staging project remains the right design (branching would modify the
production project, and branches are built for short-lived PR databases, not a
long-lived environment).

**It could not be created.** The Supabase CLI on this machine is signed in to
`nestscout's Org` (`taxxuckbpicdovojwepj`), which does not contain the
production project and is not a Go Gulf organisation. Creating Go Gulf staging
there would repeat the account fragmentation found in Phase 0.

**To finish:**

1. Sign the CLI in to the organisation that owns `julbqkeyvzwluayokcdi`
   (`npx supabase login`), or have its owner create the staging project.
2. Create `gogulf-staging` in **ap-south-1** in that organisation.
3. Enable the custom access token hook (Dashboard → Auth → Hooks →
   `public.custom_access_token_hook`).
4. Apply `supabase/migrations/0001`–`0009` to staging **only**. Never to
   production in this phase.
5. Set three branch-scoped variables on `staging`:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY` — and redeploy. The guard confirms the ref is not
   production.
6. Synthetic data only.

**Known interaction:** on any new Supabase project, API roles no longer receive
table privileges automatically. `0001` predates that, so the legacy apply form's
direct anonymous insert into `job_applications` will not work on a fresh
project — it works in production only because production's table was created
under the old defaults. Phase 5 replaces that flow with a server route, so this is
recorded rather than patched.

---

## 7. Database validation — done locally

Local Supabase (Docker) is the validation environment. Nothing was applied to any
hosted database.

| Check | Result |
| --- | --- |
| `0001`–`0009` apply in order from an empty database | ✅ `supabase db reset` |
| `rls.test.sql` (catalogue, identity, audit, grants, side doors) | ✅ 45 assertions |
| `rbac-behaviour.test.sql` (queries executed as each role, with positive controls) | ✅ 83 assertions |
| **Total** | **128 assertions, all passing** |

Semantic validation found eight defects that parse-only validation could not.
All are fixed in `0009_security_hardening.sql`:

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

1. Staging Supabase provisioned and validated (§6).
2. Set Production variables `PLATFORM_MODE=server`, `NEXT_PUBLIC_EMAIL_PROVIDER=resend`,
   `NEXT_PUBLIC_SITE_URL=https://www.gogulf.co`, `RESEND_*` — **values set in the
   dashboard, never committed**.
3. Push `main` and **redeploy** — the provider is build-time.
4. Verify all three forms on production; confirm the privacy policy names Resend.
5. Only then remove EmailJS (package, variables, code, docs).

Rollback: set `NEXT_PUBLIC_EMAIL_PROVIDER=emailjs`, unset `PLATFORM_MODE`, redeploy
— or Vercel "Promote" the previous production deployment, which is instant.
