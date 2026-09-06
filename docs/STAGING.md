# Staging Environment

**Status:** prepared and locally validated. **Not yet provisioned** — see §1.

Staging exists to prove the server-capable path before production leaves static
export. Production stays exactly as it is until that proof is signed off.

```
main       → Vercel Production → gogulf.co         → static build → EmailJS
staging    → Vercel staging    → staging.gogulf.co → server build → Resend
feature/*  → Vercel Preview    → auto URL          → server build → Resend
```

---

## 1. Blocker: account access

Phase 1.6 could not provision staging, because the accounts reachable from this
machine are not the Go Gulf accounts.

| Service | Named by the business | Reachable here | Match |
| --- | --- | --- | --- |
| Vercel | `vercel.com/faizan-chaudhary` | `Sparq IT Services' projects` (`team_blE74pCK…`, Hobby) — 36 projects, **no Go Gulf project** | **No** |
| Supabase (production) | `julbqkeyvzwluayokcdi` | not visible in any connected account | **No** |
| Supabase (MCP) | — | org `bneixzvrrchmgcaoktys` (`sparqitservices's Org`) | n/a |
| Supabase (CLI) | — | org `taxxuckbpicdovojwepj` — 2 unrelated projects | n/a |

**Nothing was created.** Provisioning Go Gulf staging inside a Sparq account
would repeat exactly the fragmentation that made the production Supabase project
unreachable in the first place (see `ARCHITECTURE-AUDIT.md` §3).

**Required to proceed:** access to the Vercel team that owns `gogulf.co`, and a
decision on which Supabase account owns staging.

---

## 2. Vercel configuration

### If the Go Gulf Vercel plan is Pro or above — Custom Environments

1. Project → Settings → Environments → **Create Environment** named `staging`.
2. Set its **tracked branch** to `staging`.
3. Domains → add `staging.gogulf.co` → assign to the `staging` environment.
4. Scope the variables in §3 to `staging` **only**.

### If the plan is Hobby — branch Preview deployments

Custom Environments are a Pro feature. The fallback:

1. Push the `staging` branch. Vercel builds it as a Preview automatically.
2. Domains → add `staging.gogulf.co` → assign to the **`staging` branch**
   (Vercel's "Git Branch" domain assignment), not to Production.
3. Scope the variables in §3 to **Preview**, and — where Vercel allows
   per-branch values — to the `staging` branch specifically.

**Do not create a second Vercel project.** Two projects means two sets of
environment variables and two places to forget one.

### Production must not be touched

`gogulf.co` stays on `main`, static build, EmailJS. No production environment
variable, domain or DNS record changes in this phase.

---

## 3. Staging environment variables

Names only. Values are set in the Vercel dashboard and never committed.

| Variable | Staging value | Notes |
| --- | --- | --- |
| `PLATFORM_MODE` | `server` | Drops `output: 'export'`; enables routes, proxy, cookies |
| `NEXT_PUBLIC_EMAIL_PROVIDER` | `resend` | **Inlined at build time — see §4** |
| `NEXT_PUBLIC_SITE_URL` | `https://staging.gogulf.co` | Keeps canonicals off production |
| `RESEND_API_KEY` | staging key | Server-only |
| `RESEND_FROM_EMAIL` | `Go Gulf <no-reply@gogulf.co>` | Domain verified in Resend |
| `RESEND_REPLY_TO` | `careers@gogulf.co` | |
| `NEXT_PUBLIC_SUPABASE_URL` | **staging project only** | See §5 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **staging project only** | |
| `SUPABASE_SERVICE_ROLE_KEY` | **staging project only** | Server-only |
| `APP_ENV` | `staging` | Read by `deploymentEnv()` |

**Production keeps its existing EmailJS variables unchanged.** Nothing is
removed from production in this phase.

---

## 4. `NEXT_PUBLIC_EMAIL_PROVIDER` is a BUILD-time switch

Verified by inspecting the compiled bundle: `emailProviderMode()` compiles to

```js
function(){return"resend"}
```

The variable name is eliminated entirely and the value is baked in as a literal.

**Consequences, both of which matter operationally:**

- Changing the provider requires a **redeploy**. Editing the variable and
  restarting does nothing — the old value is already inside the JavaScript.
- Rollback is therefore "change the variable **and redeploy**", roughly a
  two-minute Vercel operation, not an instant toggle.

The server half (`RESEND_API_KEY` and the `/api/forms/*` routes) *is* read at
runtime. Only the client-side provider choice is baked in.

---

## 5. Supabase staging

### Decision: a separate project, not a branch off production

`ENVIRONMENT-MATRIX.md` originally proposed Supabase **branching**. That is now
rejected for staging, and the tradeoff should be explicit:

| | Branch off production | Separate staging project |
| --- | --- | --- |
| Touches the production project | **Yes** — a branch is created on it | No |
| Independent lifetime | No — tied to the parent | Yes |
| Requires Pro plan | Yes | No (free tier is adequate) |
| Schema drift risk | Low | Real — migrations must be applied to both |
| Suits a long-lived staging env | **No** — branches are short-lived by design | Yes |

Phase 1.6's instructions forbid modifying production Supabase, and creating a
branch on it is a modification. A separate project is also the honest answer for
a *long-lived* staging environment: Supabase branches are built for
pull-request-scoped preview databases, not a permanent parallel environment.

Branching stays useful later for per-PR preview databases. It is not staging.

### Guard: staging must never reach production

Before pointing the staging app at any database, verify the project ref:

```bash
# Must NOT be julbqkeyvzwluayokcdi (production).
echo "$NEXT_PUBLIC_SUPABASE_URL"
```

`scripts/check-staging-isolation.mjs` asserts this automatically and exits
non-zero if the staging configuration references the production project.

### Data

**Synthetic only.** No production contact, application, document or storage
object is ever copied into staging. Production holds passport scans; the rule is
absolute and is why staging gets its own project rather than a restored dump.

---

## 6. Migrations

Migrations `0002`–`0008` are **not applied anywhere yet**.

Validation so far: all eight files parse cleanly against the real PostgreSQL
grammar (`libpg_query`). That proves syntax only — it cannot prove that a
policy behaves as intended, that the JWT hook populates claims, or that the
audit table rejects an UPDATE.

**Semantic validation is outstanding** and needs a live Postgres. Two routes:

1. **Local** — start Docker Desktop, then `supabase start` and
   `supabase db reset`. Fastest, costs nothing, and validates before any cloud
   resource exists.
2. **Staging project** — apply with `supabase db push` once §1 is resolved.

Docker Desktop is installed on the build machine but was **not running**, so
route 1 could not be taken during this phase. Per the phase instructions, this
was **not** worked around by applying to production.

### What must be proven before staging is declared ready

- [ ] All eight migrations apply cleanly, in order, from an empty database
- [ ] `normalize_phone_e164` matches `lib/phone.ts` on the shared cases
- [ ] `contact_identities` unique constraint rejects a duplicate identity
- [ ] `custom_access_token_hook` populates `app_staff_id`, `app_role`, `app_branch`
- [ ] `has_perm()` returns the right answer per role and scope
- [ ] Deactivating a staff row revokes access on the **next query**
- [ ] A customer session cannot read another contact's rows
- [ ] `audit_logs` rejects UPDATE and DELETE for every role
- [ ] Seeded roles, permissions and grants match `docs/RBAC-RLS.md`

`supabase/tests/rls.test.sql` holds these as executable assertions.

---

## 7. Local runbook

```bash
# Server mode, exactly as staging runs
npm run build:server
npm start                      # http://localhost:3000

# Gates
npm run lint && npm run typecheck && npm test
npm run build                  # static — must keep passing
npm run build:server
npm run check:secrets
```

---

## 8. Promotion

```
feature/*  →  PR  →  Preview deployment  →  review
           →  merge to `staging`         →  staging.gogulf.co  →  validate
           →  merge to `main`            →  production          →  MANUAL promote
```

Production promotion stays a deliberate human action. Nothing auto-promotes.
