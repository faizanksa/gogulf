# Go Gulf — Architecture Audit (Phase 0)

**Date:** 5 September 2026
**Repository:** `faizanksa/gogulf` @ `main` (`a8f234f`)
**Scope:** Discovery only. No functional code was changed to produce this document.
**Status:** Awaiting approval before Phase 1.

---

## 0. Executive summary

The current repository is a **well-built static marketing website**. It is not a platform, and it
cannot become one without changing its deployment model. That is the single decision this
document exists to support.

What is genuinely good here and must be preserved:

- Strong, evidence-disciplined SEO (`lib/seo.js`, JSON-LD, sitemap, robots, `llms.txt`).
- Legal/compliance pages built for Razorpay merchant verification, driven from one source of
  truth (`lib/legal.js`) with explicit provenance comments.
- A clean App Router structure with sensible component boundaries.
- Security-conscious Supabase RLS on the one table that exists (insert-only for `anon`,
  default-deny on read).

What blocks the product vision:

- `output: 'export'` (static export) makes **server-side code impossible**. No cookies, no
  Route Handlers that read the request, no redirects, no proxy/middleware, no webhooks. Every
  single item on the roadmap — OTP auth, customer portal, admin CRM, Razorpay webhooks,
  WhatsApp inbound, IVR callbacks, RLS-scoped reads — requires a server.
- There is **no authentication anywhere** in the codebase. Not partial — none.
- There is **one database table** (`job_applications`) and no user, role, case, payment or
  communication model of any kind.
- **Razorpay does not exist in the code.** Only the compliance *pages* built for its verification
  exist. Payments are a greenfield build, not an integration refactor.

Three findings need a decision from you before Phase 1 can start. They are collected in
[§21 Blocking decisions](#21-blocking-decisions-needed-before-phase-1).

---

## 1. Current architecture

| Aspect | Current state |
| --- | --- |
| Framework | Next.js **16.3.0**, App Router, Turbopack (default in 16) |
| React | 19.2.8 |
| Language | **JavaScript only.** No TypeScript. `jsconfig.json` provides the `@/*` alias |
| Rendering | `output: 'export'` — 100% static prerender at build time |
| Styling | One hand-written stylesheet, `app/globals.css` (625 lines), CSS custom properties, Google Fonts via CDN |
| Server code | **None.** No Route Handlers, no Server Actions, no `proxy.js`/`middleware.js` |
| Database | Supabase Postgres — 1 table, 1 storage bucket |
| Auth | **None** |
| Email | EmailJS, browser-side |
| Payments | **None** |
| Build output | `out/` — plain HTML/CSS/JS, uploaded to any static host |
| CI/CD | **None.** No `vercel.json`, `netlify.toml`, GitHub Actions, or Dockerfile |
| Tests | **None** |
| Linting | **Broken** — see §11 |

**Verified build baseline:** `npm run build` succeeds in ~3s and emits **20 static routes**.
The codebase is healthy; nothing here is a rescue job.

```
next.config.mjs
└── output: 'export'          ← the constraint everything else follows from
```

### Route inventory (all 20, all static)

| Route | Source | Notes |
| --- | --- | --- |
| `/` | `app/page.js` | Home — hero, trust bar, 10-step route, services, industries |
| `/about` | `app/about/page.js` | Mission, vision, values, "why choose us", stats |
| `/services` | `app/services/page.js` | 14 services + `ServiceInquiryForm` |
| `/jobs` | `app/jobs/page.js` | `JobsBoard` + JobPosting JSON-LD |
| `/jobs/apply` | `app/jobs/apply/page.js` | `ApplyForm`, prefilled from `?job=&country=&type=` |
| `/candidates` | `app/candidates/page.js` | Candidate-side marketing |
| `/employers` | `app/employers/page.js` | Employer-side marketing |
| `/contact` | `app/contact/page.js` | Contact details + `ContactForm` |
| `/privacy-policy` | 712 lines | Via shared `LegalPage` shell |
| `/terms-and-conditions` | 664 lines | Via shared `LegalPage` shell |
| `/pricing` | 301 lines | Via shared `LegalPage` shell |
| `/cancellation-and-refunds` | 354 lines | Via shared `LegalPage` shell |
| `/shipping-policy` | 236 lines | Via shared `LegalPage` shell |
| `/robots.txt` `/sitemap.xml` `/manifest.webmanifest` | generated | `dynamic = "force-static"` required by export |
| `/icon.png` `/apple-icon.png` `/404` `/_not-found` | generated | |

**All 13 human-facing URLs above must survive the redesign unchanged.** They are indexed and
cited on the legal pages.

---

## 2. Existing functionality

### 2.1 Job listings

`lib/jobs-data.js` — a hardcoded array of **6 job objects** (`title`, `country`, `industry`,
`type`, `salary`, `posted`, `description`). `components/JobsBoard.js` filters them client-side by
search text / country / industry and links to `/jobs/apply?job=…&country=…&type=…`.

**Consequence:** every new vacancy requires a code edit, a commit and a rebuild. For a recruitment
business posting jobs on WhatsApp daily, this is the most immediately painful limitation in the
product — more than the missing CRM.

### 2.2 Job application flow (the only real "backend" feature)

`components/ApplyForm.js` → `lib/supabase.js#submitJobApplication`:

1. Browser generates `crypto.randomUUID()` as the submission ID.
2. Uploads CV → `job-applications/{id}/cv-{filename}` (Supabase Storage, anon key).
3. Uploads passport → same folder.
4. Uploads N optional documents.
5. Inserts one row into `public.job_applications` with the file paths.
6. **Best-effort** EmailJS notification (failure is swallowed and logged — deliberately, because
   the Supabase row is treated as the source of truth). Files are deliberately excluded from the
   email by keeping the file inputs outside the `<form>` element.

Recruiters review submissions **by logging into the Supabase Dashboard**. There is no admin UI.

### 2.3 Contact & Service inquiry forms

`ContactForm.js` and `ServiceInquiryForm.js` send via EmailJS **only — nothing is persisted**.
`ServiceInquiryForm` routes to `careers@gogulf.co` or `business@gogulf.co` depending on whether
the selected service sits in the "For Candidates" or "For Employers" optgroup.

**Consequence:** every service inquiry and contact message that has ever been submitted exists
only in an inbox. There is no lead record, no source attribution, no follow-up state. This is the
CRM's cold-start problem.

### 2.4 SEO / AEO layer — the strongest asset in the repo

- `pageMetadata()` — title, description, canonical, OG, Twitter, per page.
- `siteJsonLdGraph()` — `EmploymentAgency` + `WebSite` graph with `legalName`, `taxID`/`vatID`
  (GSTIN), registered `PostalAddress`, `areaServed` for all 6 Gulf countries, two `ContactPoint`s.
- `jobPostingJsonLd()` — schema.org `JobPosting` per listing, with a careful salary parser that
  **returns null rather than guessing** on unexpected formats, and a 45-day `validThrough`.
- `breadcrumbJsonLd()` on every sub-page.
- `robots.js` explicitly allows 15 named AI crawlers (GPTBot, ClaudeBot, PerplexityBot…).
- `public/llms.txt` — a structured plain-text site summary for AI answer engines.

This is better than most production sites. **Preserve it wholesale; extend, do not rewrite.**

---

## 3. Existing database / backend

**One migration:** `supabase/migrations/0001_job_applications.sql`.

```sql
public.job_applications (
  id uuid PK default gen_random_uuid(),   -- in practice supplied by the browser
  created_at timestamptz not null default now(),
  job_title text not null,
  job_country text,
  full_name text not null,
  email text not null,
  phone text not null,                    -- free text, NOT normalized
  experience text,
  message text,
  cv_path text not null,
  passport_path text not null,
  other_paths text[] not null default '{}',
  page_source text
)
```

RLS posture (good, for what it is):

- RLS **enabled**.
- One policy: `anon` may `INSERT`, `with check (true)`.
- **No** `SELECT`/`UPDATE`/`DELETE` policy for `anon` or `authenticated` → default deny.
- Storage bucket `job-applications`: `public = false`, 10 MB file cap, `anon` INSERT only.
- Reads happen via the Dashboard as project owner (bypasses RLS).

**What the schema lacks for a workflow:** no status, no assigned recruiter, no notes, no
`updated_at`, no stage history, no link to a person record, no soft delete, no audit trail.
It is a submission log, not an application record.

### Supabase project fragmentation — **critical finding**

| Source | Account / org | Projects visible |
| --- | --- | --- |
| `.env.local` (live site) | — | `julbqkeyvzwluayokcdi` |
| Supabase **MCP** connector | org `bneixzvrrchmgcaoktys` | 9 projects — *none* is Go Gulf |
| Supabase **CLI** (just logged in) | org `taxxuckbpicdovojwepj` | `rising-palm`, `nest-scout` — *neither* is Go Gulf |

**The Supabase project the live site writes to (`julbqkeyvzwluayokcdi`) is not accessible from
either account currently connected on this machine.** No project is linked
(`supabase/config.toml` does not exist, `supabase projects list` reports "Cannot find project
ref").

Live candidate applications — including **passport scans and CVs** — are sitting in a project we
cannot currently enumerate, back up, or migrate. This is both a delivery blocker and a PII
custody issue. See [§21](#21-blocking-decisions-needed-before-phase-1).

---

## 4. Current authentication

**There is none.** Confirmed by grep across `app/`, `components/`, `lib/`: no `signIn`, no
session handling, no cookies, no Supabase Auth import, no protected route, no user table.

The only thing resembling a staff login is a footer link to Google Workspace webmail
(`components/Footer.js`), which is an external link, not authentication.

Everything must be built from zero. Nothing has to be un-built — which is the good news.

---

## 5. Current EmailJS implementation

| Item | Location |
| --- | --- |
| Package | `@emailjs/browser@^4.4.1` in `package.json` |
| Helper | `lib/emailjs.js` — `sendInquiry(formEl)` wrapping `emailjs.sendForm()` |
| Env vars | `NEXT_PUBLIC_EMAILJS_PUBLIC_KEY`, `…_SERVICE_ID`, `…_TEMPLATE_ID` |
| Consumers | `ApplyForm.js`, `ContactForm.js`, `ServiceInquiryForm.js` |
| Docs | `EMAILJS-SETUP.md` (whole file), `DEPLOYMENT.md` (several sections) |
| **Legal disclosure** | `app/privacy-policy/page.js` — EmailJS is named as a third-party processor |

One shared template drives all three forms, using field names as template variables:
`from_name`, `reply_to`, `phone`, `message`, `service_type`, `country`, `experience`,
`page_source`, `to_email`, plus `submission_id` and `documents` injected by `ApplyForm`.

**Migration surface: 3 components, 1 lib, 3 env vars, 1 package, 2 markdown docs, and one
paragraph of a published privacy policy.** The privacy-policy paragraph is the one people forget;
it is a legal statement about who processes user data, not documentation.

---

## 6. Current Supabase implementation

`lib/supabase.js` — a `"use client"` module creating a browser client from the two
`NEXT_PUBLIC_SUPABASE_*` vars, exporting `submitJobApplication()`.

Deliberate design choices by the original author (documented in comments, and correct for a
static site):

- Anon key only; the code comments explicitly warn never to put `service_role` here.
- Filenames sanitised (`[^a-zA-Z0-9.\-_]` → `_`, last 80 chars).
- Client-side size guard at 8 MB, bucket backstop at 10 MB.
- Uploads use `upsert: false`.

**Security limitations inherent to the model** (not the author's error — the export target forced
it):

1. The anon key is public by design. Anyone can `INSERT` arbitrary rows into `job_applications`
   and upload arbitrary ≤10 MB files into the bucket. **No rate limiting, no CAPTCHA, no server
   validation.** This is a live spam / storage-cost / abuse vector today.
2. All validation (required fields, file size, accepted MIME types) is **client-side only** and
   trivially bypassed.
3. The client chooses the row `id`. Unguessable, but client-controlled.
4. No virus/content scanning on uploaded documents.

These are acceptable-ish for a low-traffic brochure site. They are **not** acceptable once the
same bucket holds passports linked to paying customers.

---

## 7. Current Razorpay implementation

**None.** `grep -rin razorpay` across all source returns zero hits outside a commit message.

What exists is the *compliance surface* Razorpay requires for merchant verification, built in
commit `908f1ac`:

- `/pricing` — pricing & fees policy
- `/cancellation-and-refunds` — with `REFUND_BANK_CREDIT_WINDOW = "5–7 working days"`
- `/shipping-policy` — states no physical goods are shipped
- `/terms-and-conditions`, `/privacy-policy`
- Legal entity + GSTIN in the footer on every page and in JSON-LD

`lib/legal.js` carries unusually disciplined comments explaining what is **deliberately absent**
(no invented SLA day-counts, no fee-payer claim, no CIN because it was never evidenced). Respect
this discipline — do not "helpfully" fill these in during the redesign.

**Payments are a greenfield build (Phase 7), not an integration refactor.**

---

## 8. Current recruitment implementation

Everything in §2.1–2.2. Summarised as a gap analysis against the target:

| Capability | Today |
| --- | --- |
| Job listings | 6 hardcoded objects in a JS file |
| Employers | Not modelled |
| Vacancy count / requirements / benefits | Not modelled |
| Application record | 1 flat row, no status |
| Candidate record | Does not exist (applications are anonymous rows) |
| Screening / interviews | Not modelled |
| Recruiter assignment | Not modelled |
| Candidate timeline | Not modelled |
| Documents | 3 file paths on the application row; no type, status or verification |
| Status workflow | Not modelled |
| Candidate-facing status | Does not exist |
| Notifications | One best-effort email at submission |

The `/jobs/apply` flow works and is the one piece of real functionality to protect during
migration. **It must keep working continuously**, including its `?job=&country=&type=`
prefill contract used by every "Apply Now" link.

---

## 9. Static-export limitations (the core blocker)

Verified against the bundled Next.js 16.3 docs
(`node_modules/next/dist/docs/01-app/02-guides/static-exports.md`). With `output: 'export'`,
these are **unsupported**:

- Route Handlers that rely on `Request`
- `cookies()`
- Rewrites, Redirects, Headers
- `proxy` (the Next 16 replacement for `middleware`)
- Incremental Static Regeneration
- Dynamic routes without `generateStaticParams()`
- Image Optimization with the default loader

Mapped onto the roadmap:

| Requirement | Blocked by |
| --- | --- |
| Phone + OTP auth, sessions | `cookies()`, Route Handlers |
| Customer portal (per-user data) | Sessions, server-side authorization |
| Admin dashboard / CRM | Sessions, RLS-scoped server reads |
| Razorpay webhooks | Route Handlers with `Request` (signature verification) |
| WhatsApp inbound webhook | Route Handlers with `Request` |
| IVR callbacks | Route Handlers with `Request` |
| Resend (secret key server-side) | Any server runtime |
| Signed document URLs | Server-side permission check |
| Route protection (`/admin/*`) | `proxy` |
| URL redirects for changed pages | `redirects` |
| Jobs published from a database | ISR or dynamic rendering |
| Rate limiting OTP / forms | Any server runtime |

**There is no partial workaround.** Static export must be dropped. This is the first change of
Phase 1.

---

## 10. Existing reusable components

| Component | Reuse verdict |
| --- | --- |
| `lib/seo.js` | **Keep and extend.** Best code in the repo. Add portal/admin `noIndex` handling |
| `lib/legal.js` | **Keep verbatim.** Single source of truth for the entity. Do not touch the values |
| `lib/job-schema.js` | **Keep**, re-point its input from the hardcoded array to the DB |
| `components/JsonLd.js` | **Keep as-is.** Correct `<` escaping |
| `components/LegalPage.js` | **Keep the pattern.** Restyle only; the section/TOC/numbering model is sound |
| `app/robots.js`, `sitemap.js`, `manifest.js` | **Keep**, make sitemap DB-driven for jobs; drop `force-static` where dynamic |
| `components/JobsBoard.js` | **Rebuild.** Filtering logic is reusable; must move to server-side query with pagination |
| `components/ApplyForm.js` | **Rebuild** against a Server Action; keep the UX, the prefill contract and the two-phase (upload → notify) resilience idea |
| `ContactForm.js`, `ServiceInquiryForm.js` | **Rebuild** as lead-capture into CRM; keep the candidate/employer routing logic |
| `components/Header.js`, `Footer.js` | **Rebuild** in the new design system; port the social SVG set and the legal-entity block exactly |
| `app/globals.css` | **Replace.** 625 lines of page-specific hand-written CSS will not scale to ~40 admin screens. Keep the brand tokens |
| Legal page bodies (5 pages, ~2,270 lines of JSX prose) | **Keep the text.** Re-wrap in the new shell. This is lawyer-reviewed copy — treat edits as legal changes, not design changes |

---

## 11. Technical debt

Ordered by impact.

1. **`npm run lint` is broken.** `package.json` runs `next lint`, which **was removed in
   Next.js 16** ("Use Biome or ESLint directly. `next build` no longer runs linting."). There is
   also **no ESLint config file at all**. Net effect: *the project has zero linting*, and the
   documented QA command fails with `Invalid project directory provided, no such directory: …/lint`.
2. **No TypeScript.** Tolerable for 8 marketing pages. A liability for ~40 tables, RLS policies,
   role/permission logic and money handling. Supabase generates TS types from the schema — that
   safety net is unavailable in JS.
3. **No tests, no CI.** Nothing prevents a regression reaching production, and production deploys
   are a manual folder upload.
4. **No error tracking or server logging.** No Sentry, no structured logs. Acceptable with no
   server; unacceptable with one.
5. **Public-key-only secret model.** Every env var is `NEXT_PUBLIC_*`. There is no established
   pathway for a server-only secret, and `.env.local.example` currently teaches the wrong habit
   for the platform we're building.
6. **Contact details are duplicated, not sourced.** `lib/seo.js` exports `CONTACT`, but
   `Header.js` and `Footer.js` hardcode `wa.me/919936309015`, `tel:+919936309015` and
   `careers@gogulf.co` as literals. `DEPLOYMENT.md` even documents this as "edit those files".
   One number change = a multi-file hunt.
7. **Stray lockfile causes a build warning.** A `package-lock.json` sits at
   `C:\Users\FC Enterprise\Documents\myprojects\` (outside the repo), so Turbopack warns on every
   build and infers the wrong root. Fix by setting `turbopack.root` in `next.config.mjs`.
8. **Content inconsistency.** `app/page.js` hero states **"14 — Step Managed Process"**, while the
   route diagram on the same page shows **10 steps**, and `llms.txt` says "the 10-step recruitment
   process" and separately "14 recruitment services". The hero stat conflates services with steps.
9. **Unverified marketing claims.** "20+ Years of Trust", "Thousands of Placements — Every Year",
   `foundingDate: "2008"` asserted in JSON-LD to search engines — against a legal entity whose
   evidenced GST registration is **9 May 2024**. `lib/legal.js` is scrupulous about not asserting
   unevidenced facts; the marketing copy is not held to the same standard. These need either
   substantiation or rewording before they are re-published in a redesign.
10. **Uncommitted work is at risk.** 11 files are modified in the working tree, restoring the legal
    entity details (`Chaudhary Gulf Travels Private Limited`, GSTIN, registered office) across
    `lib/legal.js`, `lib/seo.js`, `llms.txt`, the footer and all 5 legal pages. **This is not
    committed or pushed.** It should be committed before any refactor begins.
11. **Documentation will go stale on contact.** `DEPLOYMENT.md`, `EMAILJS-SETUP.md` and
    `SUPABASE-SETUP.md` describe a static-export/EmailJS world that Phase 1 removes.

---

## 12. Recommended target architecture

### 12.1 Shape

**One Next.js application, four route groups, one deployment.** Not a monorepo — the team size
and the shared design system/type surface do not justify the coordination cost.

```
app/
├── (marketing)/          → public site. Static/ISR. Anonymous.
│   ├── page.js, about/, services/, jobs/, jobs/[slug]/, jobs/apply/,
│   ├── travel/, visa/, contact/, and the 5 legal pages
├── (portal)/portal/      → customer portal. Phone+OTP session. RLS: own records only.
├── (admin)/admin/        → staff CRM. Email+password (+ optional MFA). RLS: permission+scope.
└── api/
    ├── webhooks/razorpay/     → signature-verified, idempotent
    ├── webhooks/whatsapp/     → Meta Cloud API verify + inbound
    ├── webhooks/telephony/    → IVR/call events
    ├── webhooks/resend/       → delivery/bounce events
    └── cron/                  → reminders, expiry sweeps, outbox drain

proxy.js                  → route protection + security headers (Next 16 name for middleware)
```

> **Next.js 16 note:** `middleware.js` is deprecated in favour of `proxy.js`, which runs on the
> **Node.js runtime only** (the `edge` runtime is not supported in `proxy`). Also relevant to us:
> `params`/`searchParams`/`cookies()`/`headers()` are **async-only** in 16, `revalidateTag` now
> takes a second `cacheLife` argument, and `updateTag`/`refresh` are the new read-your-writes
> APIs for Server Actions.

### 12.2 Stack

| Layer | Recommendation | Why |
| --- | --- | --- |
| Framework | Next.js 16 App Router, **`output: 'export'` removed** | Required (§9) |
| Language | **TypeScript**, migrated incrementally (`allowJs: true`) | Generated Supabase types are the only practical guard on a 40-table RLS schema and money handling |
| Hosting | **Vercel** | First-class Next 16 support (PPR/`cacheComponents`, ISR, `proxy`, cron), preview deploys per PR, no infra to run. Alternative: Node/Docker on any VPS — costs a DevOps burden this team does not have |
| Database | Supabase Postgres + **RLS everywhere** | As specified. Needs **Pro plan** for PITR/daily backups — a production CRM holding passports cannot run on free-tier |
| Auth | Supabase Auth — phone OTP (customers), email+password (staff) | Do not hand-roll. Custom Access Token Hook injects role/permission claims into the JWT |
| Storage | Supabase Storage, **private buckets only**, short-lived signed URLs issued server-side after a permission check | As specified |
| Styling | **Tailwind CSS v4** + a small set of headless primitives (Radix) for admin, on top of the existing brand tokens | ~40 admin screens will not survive hand-written CSS. Marketing pages stay bespoke and premium; admin gets a systematic component kit |
| Email | **Resend** + React Email, server-only | As specified |
| Payments | **Razorpay** — Orders API + **webhooks as the authority** | As specified |
| WhatsApp | **Meta WhatsApp Cloud API** direct, behind a provider adapter | Official API. Adapter keeps AiSensy/360dialog swappable |
| SMS/OTP | Supabase Auth phone provider backed by an India-DLT-compliant gateway (MSG91 or Twilio) | India DLT registration is a lead-time item — start early |
| Telephony/IVR | Adapter interface; Exotel / MyOperator / Knowlarity as candidates | Provider-neutral by design |
| Validation | **Zod** schemas shared by client and server | One schema per form; server always re-validates |
| Background work | Postgres `outbox` + Vercel Cron (or Supabase Edge Function on a schedule) | Avoids a queue service in Phase 1 while staying reliable |
| Errors | Sentry | Non-negotiable once there is a server |
| Rate limiting | Postgres-backed counters initially; Upstash Redis if volume demands | OTP and public forms must be limited from day one |

### 12.3 Non-negotiable security stances

1. `SUPABASE_SERVICE_ROLE_KEY` **never** reaches the browser and is used **only** in webhooks,
   cron jobs and system automation — never to serve a user request.
2. Portal and admin reads go through the **user's own Supabase session**, so RLS applies as
   defence-in-depth even if application-layer authorization has a bug.
3. Every mutation is a Server Action or Route Handler that re-validates input with Zod and
   re-checks permission server-side. Hiding a button is UX, not authorization.
4. The current anon-key `INSERT` policy on `job_applications` is **revoked** once the server API
   exists. Public writes go through rate-limited server endpoints.
5. Money is stored as **integer paise**. Never a float.
6. OTPs, API keys and document contents are never logged.

---

## 13. Proposed database architecture

Two design decisions carry most of the weight. Both directly answer requirements in the brief.

### 13.1 Identity: one person, many identifiers

The brief requires that Facebook → WhatsApp → phone call → application → payment all resolve to
one record, with phone as the primary signal. Putting `phone` on a `contacts` table is not enough
— people have two numbers, change numbers, and share a household landline.

```sql
contacts                        -- the person. One row per human, ever.
  id uuid pk
  full_name, display_name
  primary_phone_e164 text       -- denormalised convenience, always mirrors an identity row
  primary_email citext
  lifecycle_stage               -- subscriber|lead|opportunity|customer|past_customer|disqualified
  source_id → lead_sources
  campaign_id → campaigns
  owner_id → staff_users        -- assigned staff member
  branch_id → branches
  country, nationality, preferred_language
  consent_whatsapp, consent_email, consent_sms, consent_calls  -- + *_at timestamps
  created_at, updated_at, last_activity_at
  merged_into_id uuid → contacts   -- soft-merge pointer, never hard-delete a person

contact_identities              -- ← the deduplication engine
  id uuid pk
  contact_id → contacts
  type      -- phone | email | whatsapp_wa_id | auth_user | ivr_caller | social_handle | job_portal
  value_raw text
  value_normalized text         -- E.164 for phones, lowercased for email
  is_primary bool, verified_at timestamptz
  UNIQUE (type, value_normalized)   -- ← the constraint that makes duplicates impossible
```

**Why this shape:**
- Any channel (webhook, IVR, form, ad click) does one lookup on
  `(type, value_normalized)` → either finds the person or creates them. Deterministic, no fuzzy
  matching in the hot path.
- A Supabase Auth user is *an identity*, not *the* identity. A candidate who applied by phone in
  January and logs in with OTP in March attaches to the same `contact`.
- Phone normalisation to E.164 happens **once, at write time**, in a Postgres function — never
  ad hoc in JavaScript.
- `contact_merges` (append-only) records every merge for audit and reversal.

There are deliberately **no separate `leads` / `customers` / `candidates` tables.** A person is
one row; what they *are* is a function of `lifecycle_stage` plus the cases attached to them. This
is precisely the "don't just create a customers table" requirement, without the far worse failure
mode of three parallel person tables that drift apart.

### 13.2 Work: one case container, typed extensions

Recruitment applications, travel inquiries, visa services and tour bookings all need: a pipeline,
a stage, an owner, a timeline, tasks, documents, payments and notifications. Building those seven
subsystems four times is how CRMs rot.

```sql
cases
  id uuid pk
  case_number text unique        -- human reference, e.g. GG-REC-2026-00184
  contact_id → contacts
  case_type                      -- recruitment | travel | visa | tour_booking | support
  pipeline_id → pipelines
  stage_id → pipeline_stages
  owner_id → staff_users
  branch_id → branches
  status                         -- open | won | lost | cancelled
  value_amount_paise bigint
  opened_at, closed_at, updated_at

-- 1:1 typed extensions, only the fields that type actually needs
case_recruitment (case_id pk, job_id, employer_id, expected_salary_paise, passport_no_masked, …)
case_travel      (case_id pk, destination_id, depart_date, return_date, pax_adults, pax_children, …)
case_visa        (case_id pk, visa_type, country_code, application_ref, …)
```

Everything else attaches to `case_id` **once**:

```sql
pipelines / pipeline_stages          -- admin-configurable; stages are data, not code
activities                           -- the timeline (see §13.4)
tasks                                -- assignee, due_at, priority, status, related case/contact
documents / document_requirements    -- requested → uploaded → under_review → approved|rejected|expired
communications                       -- email | whatsapp | sms | call | note, in/out, provider ids
orders / installments / payments     -- §13.3
notes, appointments, tags, case_tags
```

**Payoff:** one timeline component, one task system, one document module, one payment ledger, one
notification engine — serving recruitment *and* travel *and* visa *and* whatever the business adds
in 2027. Adding "Umrah packages" becomes a new `case_type` + one extension table + pipeline rows,
not a new subsystem.

### 13.3 Money (append-only, webhook-authoritative)

```sql
orders           id, contact_id, case_id, total_amount_paise, currency, status, razorpay_order_id
installments     id, order_id, seq, due_date, amount_paise, status(pending|due|paid|overdue|waived)
payment_attempts id, order_id, installment_id, razorpay_payment_id, status, failure_reason, raw jsonb
payments         id, order_id, installment_id, amount_paise, method, captured_at, razorpay_payment_id
refunds          id, payment_id, amount_paise, reason, status, razorpay_refund_id
invoices         id, order_id, number unique, issued_at, pdf_path, totals…
invoice_lines    id, invoice_id, description, qty, unit_amount_paise, tax_rate
webhook_events   id, provider, provider_event_id UNIQUE, type, payload jsonb, processed_at, error
```

Rules:
- `webhook_events.provider_event_id` carries a **UNIQUE constraint** — that single constraint is
  what makes webhook processing idempotent under Razorpay's at-least-once delivery.
- Signature verified before the body is parsed as trusted input.
- The frontend `handler` response updates the UI **only**; it never marks anything paid.
- Rows are appended, not mutated. Balance is derived, so history is always reconstructable.

### 13.4 Timeline

Write-side denormalisation into `activities` at the moment something happens
(`actor_type`, `actor_id`, `verb`, `entity_type`, `entity_id`, `contact_id`, `case_id`,
`summary`, `metadata jsonb`, `occurred_at`), indexed on `(contact_id, occurred_at desc)`.

The alternative — a UNION view across 8 source tables at read time — is cleaner in theory and
unusably slow in practice on the busiest screen in the product. Accept the redundancy; it is
written once, read constantly.

### 13.5 Access control

```sql
branches, departments
staff_users            -- 1:1 with auth.users for staff
roles                  -- SUPER_ADMIN, ADMIN, HR_MANAGER, RECRUITER, TRAVEL_MANAGER,
                       -- TRAVEL_AGENT, ACCOUNTS, FINANCE_MANAGER, SUPPORT_AGENT,
                       -- MARKETING_MANAGER, OPERATIONS_MANAGER, VIEW_ONLY
permissions            -- 'contacts.view', 'payments.refund', 'documents.verify', …
role_permissions       -- role_id, permission_id, scope: all | branch | own
user_roles             -- staff_user_id, role_id, branch_id (role can be branch-limited)
audit_logs             -- append-only; INSERT-only policy, no UPDATE/DELETE policy for anyone
```

**Scope belongs on the grant, not the permission name.** `RECRUITER` holds
`contacts.view @ own`; `HR_MANAGER` holds `contacts.view @ branch`; `ADMIN` holds
`contacts.view @ all`. One permission string, three behaviours — instead of an unmaintainable
`contacts.view.own` / `contacts.view.branch` / `contacts.view.all` explosion.

**RLS performance:** permissions are injected into the JWT by a Supabase **Custom Access Token
Hook** at login. Policies then read a claim rather than joining `user_roles → role_permissions →
permissions` on every row. Without this, list views degrade badly at scale.

Every business table carries `owner_id` and `branch_id` so one policy template covers the estate:

```sql
create policy "staff read contacts" on contacts for select to authenticated
using (
  has_perm('contacts.view','all')
  or (has_perm('contacts.view','branch') and branch_id = current_branch_id())
  or (has_perm('contacts.view','own')    and owner_id  = current_staff_id())
);
```

Customer-facing policies are separate and much simpler: `contact_id = current_contact_id()`.

### 13.6 Supporting tables

`lead_sources`, `campaigns` (+ `utm_source/medium/campaign/content`, `landing_page`, `referrer` on
the contact's first-touch record), `jobs`, `employers`, `job_countries`, `interviews`, `offers`,
`destinations`, `packages`, `bookings`, `booking_items`, `travelers`, `suppliers`,
`message_templates`, `notifications`, `settings`, `events`/`outbox`.

**Do not build all of this in Phase 1.** Phase 1 builds identity + access control + audit. Modules
land in their own phases.

---

## 14. Proposed role / permission architecture

Covered structurally in §13.5. Operationally:

- `SUPER_ADMIN` bypasses permission checks (checked first in `has_perm()`), and its actions are
  **always** audited.
- Permissions are seeded by migration, not created ad hoc — a permission string that no policy
  references is a security illusion.
- The admin UI hides what the user cannot do (UX), and **every** server action independently
  re-checks (security). We will explicitly test that a `VIEW_ONLY` user calling a mutation
  endpoint directly is rejected at both the application layer and by RLS.
- `ACCOUNTS`/`FINANCE_MANAGER` get `payments.*` but **not** `notes.internal.view` on HR notes —
  the brief calls this out and the scope model supports it natively.

---

## 15. Proposed customer journey

```
Ad / search / WhatsApp / call / walk-in
   ↓  (UTM + source captured, or IVR caller ID, or WhatsApp wa_id)
Identity resolution on contact_identities  →  existing contact, or new contact
   ↓
Lead created (lifecycle_stage = lead), auto-assigned by round-robin/branch rules
   ↓
Phone + OTP  →  Supabase Auth user attached as an identity on the SAME contact
   ↓
Portal: one account, every service
   ├── Applications  → live status + "what's next"
   ├── Travel/visa cases → same
   ├── Documents     → what's requested, what's approved, what expired
   ├── Payments      → schedule, paid, due, receipts, invoices
   ├── Messages      → the conversation they already had on WhatsApp
   └── Profile & consent preferences
```

The portal's job is to answer four questions on one screen: **Where am I? What's pending? What do
I do next? What's due?** Everything else is secondary.

---

## 16. Proposed CRM journey (staff)

Contact detail page as the centre of gravity: identity + consent header, open cases, unified
timeline, next task, payment position, documents, quick actions (WhatsApp / call / email / task /
note). Pipelines are board views over `cases`. Saved views and bulk actions come in Phase 11.

## 17. Proposed recruitment journey

`Job → Application (case_type=recruitment) → Screening → Interview → Selected → Offer →
Documentation → Medical → Visa → Travel → Joined → Closed`, with every stage a **configurable
`pipeline_stages` row** — not a hardcoded enum. `/jobs/apply` writes a contact + a case in one
transaction, so an applicant is a CRM record from the first second.

## 18. Proposed travel journey

`Inquiry → Requirement → Quote → Payment → Confirmed → Documents → Processing → Travel-ready →
Completed`, on the same `cases` spine with `case_travel` for trip specifics and
`bookings`/`booking_items`/`travelers` when Phase 6 expands.

## 19. Proposed payment journey

```
Staff builds quote → order + installment schedule
   ↓
Customer pays in portal → Razorpay Order → Checkout
   ↓
Frontend success  →  updates UI only        (never authoritative)
Razorpay webhook  →  signature verified
                  →  webhook_events insert (UNIQUE event id ⇒ idempotent)
                  →  payment + installment marked paid
                  →  invoice/receipt generated
                  →  emits payment.succeeded
                        ├── Resend receipt
                        ├── WhatsApp confirmation (template, consent-gated)
                        ├── activities entry
                        └── audit_logs entry
```

## 20. Proposed WhatsApp / IVR architecture

```
                    ┌──────────────────────────────┐
   application code │  CommunicationService        │  ← the only thing app code calls
                    │  send(channel, to, template)  │
                    └───────────────┬──────────────┘
       ┌───────────────┬────────────┼────────────┬────────────────┐
   WhatsAppProvider  EmailProvider  SmsProvider  VoiceProvider   (interfaces)
   Meta Cloud API      Resend        MSG91        Exotel         (implementations)
```

Inbound is symmetric: webhook → normalise to a provider-neutral shape → resolve identity via
`contact_identities` → write `communications` + `activities` → route to agent/queue → optionally
open a case. Every provider ID is stored so delivery/read receipts reconcile later. Consent is
checked **before** send, and template usage is enforced outside the 24-hour session window.
No unofficial/browser automation, ever.

---

## 21. Blocking decisions needed before Phase 1

These three cannot be resolved from the repository.

**1. Supabase project ownership and the live data.**
The live site writes to `julbqkeyvzwluayokcdi`, which neither the CLI account
(`taxxuckbpicdovojwepj`) nor the MCP-connected account (`bneixzvrrchmgcaoktys`) can see. Before
Phase 1: who owns that project, can we get access, and how many real applications + passport/CV
files are in it? We need a plan to migrate or archive that data under proper custody. **A new
project should not be created until this is answered** — it would strand live candidate documents.

**2. Hosting.** Vercel is the recommendation (§12.2). If the business must stay on the current
cPanel/static host, the whole platform architecture changes materially and we should discuss
before building. Static export cannot continue either way.

**3. Legal-page truthfulness.** The published privacy policy currently states, as fact:
*"This website does not set cookies of its own"*, *"There is no login and no user account"*, and
of the third-party list, *"There are no others."* Authentication, sessions, Razorpay, Resend,
WhatsApp Business API and a telephony provider each falsify one of those sentences. These pages
back a Razorpay merchant verification. **Legal-page updates must ship in the same release as the
features that make them inaccurate** — not afterwards. Related: the DPDP Act 2023 obligations
(consent records, grievance officer, data-principal request handling) become materially heavier
once we hold accounts, payments and documents; I recommend building consent capture into the
schema from Phase 1, which the proposal above does.

Two smaller items for your confirmation, not blockers:
- The "20+ Years / Since 2008 / Thousands of Placements" claims (§11.9) — substantiate or reword.
- The "14 Step Managed Process" vs 10-step inconsistency (§11.8).

---

## 22. Phase-by-phase implementation plan

Re-cut from the brief into a dependency-ordered sequence. Sizes are engineering effort, not
calendar time.

| Phase | Deliverable | Depends on | Size |
| --- | --- | --- | --- |
| **0** | This document | — | ✅ done |
| **0.5** | **Commit the pending legal-entity work.** Fix `npm run lint` (ESLint CLI + config), set `turbopack.root`, add `.env.example` with PUBLIC/SERVER split | — | XS |
| **1** | **Foundation.** Drop `output: 'export'`; TypeScript scaffolding; Supabase project + linked migrations; `contacts` + `contact_identities` + E.164 normalisation; `staff_users`/`roles`/`permissions`/`user_roles`; `audit_logs`; RLS helpers + JWT claims hook; Zod validation layer; error handling; Sentry; `proxy.js`; secrets hygiene | §21.1, §21.2 | L |
| **2** | **Design system + public site.** Tokens, primitives, nav, footer, home, about, services, jobs, contact; all 13 URLs preserved; SEO/JSON-LD ported intact; legal pages restyled with copy untouched | 1 | L |
| **3** | **Auth + customer portal.** Phone OTP (DLT-registered sender), sessions, portal shell, profile, consent. **Explicit cross-tenant isolation tests.** | 1 | M |
| **4** | **CRM core.** Contacts, lead sources, campaigns/UTM, assignment, tags, notes, tasks, activities timeline, configurable pipelines, contact detail page | 1 | L |
| **5** | **Recruitment.** Jobs/employers in DB (ends the code-deploy-per-vacancy problem), applications as cases, screening, interviews, documents, statuses. `/jobs/apply` migrated **without downtime**; legacy `job_applications` backfilled into contacts+cases | 4 | L |
| **6** | **Travel / service cases.** Inquiries, quotes, service cases, travel documents, tasks | 4 | M |
| **7** | **Payments.** Orders, installments, Razorpay Orders API, verified idempotent webhooks, invoices/receipts, portal + admin financial views | 3, 4 | L |
| **8** | **Resend migration.** Server-side email, React Email templates, remove EmailJS package + 3 env vars + 3 form paths + 2 docs, **update the privacy policy processor list** | 1 | S |
| **9** | **WhatsApp.** Communication abstraction, Cloud API, templates, inbound webhook, conversation assignment, consent gating | 4 | L |
| **10** | **Telephony / IVR.** Adapter, caller identification, call logs, routing, missed-call follow-up | 4, 9 | M |
| **11** | **Full admin dashboard.** All modules, KPIs, filters, saved views, bulk actions, CSV import/export, user/role administration | 4–7 | L |
| **12** | **Automation engine.** `events` + outbox + handlers; reminders (payment due, document expiry, interview), status-change notifications | 7, 9 | M |
| **13** | **Reporting.** Source ROI, recruitment funnel, collections, staff performance — as SQL views/materialised views, never client-side aggregation | 11 | M |
| **14** | **Security & QA hardening.** RLS test matrix per role, IDOR sweep, webhook replay tests, upload validation, secret-exposure scan, load check, backup/PITR verification | all | M |

**Sequencing notes**

- Phase 8 (Resend) is small and unblocks Phases 3/7 notifications — I recommend pulling it
  forward to run alongside Phase 2 rather than waiting.
- Phase 3 must not start before India **DLT sender registration** is underway; it has external
  lead time measured in weeks.
- Phases 1 and 2 can overlap after the design tokens are agreed.
- Phases 9–13 are a second major release. Treating them as "later in the same sprint" is the
  most likely way this plan fails.

**Recommended for now — deliberately deferred**

Lead scoring, AI CRM summaries, AI document classification, calendar integration, SLA tracking,
supplier management, marketing automation, multi-branch *UI*. The schema carries `branch_id` from
Phase 1 so multi-branch is a switch-on later, not a migration.

**Recommended additions not in the original brief**

Consent records + DPDP data-principal request handling (legal requirement, cheap in Phase 1,
expensive to retrofit); document retention & expiry purge (passports should not sit forever);
staging environment via Supabase branching; Sentry; Postgres-backed rate limiting on OTP and
public forms from day one.

---

## Appendix A — files that must not lose their content

| File | Contains |
| --- | --- |
| `lib/legal.js` | Legal entity, GSTIN `09AALCC6656L1ZY`, registered office, jurisdiction, refund window. **Values are transcribed from the GST certificate — do not edit, guess or "tidy".** |
| `lib/seo.js` | `CONTACT` (+919936309015, careers@/business@gogulf.co), `SAME_AS` socials, Gulf country codes, JSON-LD graph |
| The 5 legal page bodies | ~2,270 lines of lawyer-grade prose. Restyle the shell; treat text edits as legal changes |
| `public/llms.txt` | Legal entity + contact block mirrors the above; must stay in sync |
| `components/Footer.js` | Legal-entity disclosure block, social SVG set |

## Appendix B — EmailJS removal checklist (Phase 8)

- [ ] `package.json` → remove `@emailjs/browser`
- [ ] Delete `lib/emailjs.js`
- [ ] `components/ApplyForm.js` — replace `sendInquiry()`
- [ ] `components/ContactForm.js` — replace `sendInquiry()`
- [ ] `components/ServiceInquiryForm.js` — replace `sendInquiry()`
- [ ] `.env.local` / `.env.local.example` — remove the 3 `NEXT_PUBLIC_EMAILJS_*` vars
- [ ] Delete `EMAILJS-SETUP.md`
- [ ] `DEPLOYMENT.md` — rewrite the email + deployment sections
- [ ] **`app/privacy-policy/page.js` — replace the EmailJS `<dt>` with Resend** *(legal disclosure)*
- [ ] Revoke the EmailJS account keys after cutover
- [ ] Verify: contact form, service inquiry, job application, confirmation email
