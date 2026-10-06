# Go Gulf — Project Audit

Audited: 6 Oct 2026, branch `main` at `674c1d2`. Facts come from the code only. Where the
code cannot show something (live data, Vercel/Supabase dashboard settings, what is deployed
right now), it is marked **unknown**. No code was changed for this audit.

---

## 1. Stack and structure

| Area | What the code shows |
|---|---|
| Framework | Next.js `^16.3.0` (App Router), React `^19.2.8`, TypeScript `^6.0.3`, Zod `^4.5.4` |
| Backend | Supabase (`@supabase/supabase-js ^2.112.1`, `@supabase/ssr ^0.12.6`): Postgres, Auth, Storage |
| Email | Resend (`resend ^6.26.0`), server-side only |
| Payments | Razorpay (Checkout in the browser, orders and webhook on the server) |
| Tests | Vitest 5 (unit), Playwright 1.63 + axe (e2e, a11y), SQL tests in `supabase/tests/` (13 files) |
| Hosting | Vercel. [vercel.json](../vercel.json): region `bom1` (Mumbai), build forced to `PLATFORM_MODE=server` |
| Middleware | [proxy.ts](../proxy.ts) (Next 16's middleware), matched only on `/admin/*` and `/portal/*` |

**Routing** (route groups under [app/](../app/)):

- `(marketing)`: home, `/jobs`, `/jobs/[slug]`, `/jobs/apply`, `/candidates`, `/employers`,
  `/services`, `/about`, `/contact`, `/verify`, `/pay/[reference]`, and the `(legal)` pages
  `/terms-and-conditions`, `/privacy-policy`, `/cancellation-and-refunds`, `/pricing`,
  `/shipping-policy`.
- `[locale]`: the same public pages for other languages (ar, bn, hi, ml, ta). All five
  catalogues are `"status": "not-started"`, so only English is published.
- `(admin)/admin`: staff CRM (login plus about 20 protected pages).
- `(portal)/portal`: customer portal (placeholder only, see §2).
- `api/`: `forms/contact`, `forms/service-inquiry`, `forms/job-application`, `razorpay/webhook`.
- Also: `auth/callback`, `sitemap.ts`, `robots.ts`, `manifest.ts`, `llms.txt`, OG and Twitter images.

**Key directories:** [lib/](../lib/) (domain logic: admin, auth, billing, crm, email, forms,
i18n, jobs, payments, providers/otp), [components/](../components/) (site, ui, admin, jobs,
forms), [content/](../content/) (company facts, channels, page registry, FAQs),
[messages/](../messages/) (i18n catalogues), [supabase/](../supabase/) (24 migrations, tests,
seeds), [scripts/](../scripts/) (isolation checks, backups, DB tooling).

**Build modes.** [next.config.mjs](../next.config.mjs) still supports a static export (`output:
"export"`) when `PLATFORM_MODE` is not `server`. Its comment says production is still a static
export, but `vercel.json` always builds in server mode, so that comment is stale. What is live
in production right now: **unknown**.

**Auth.** Staff sign in with Google OAuth only (`STAFF_SIGN_IN` in
[lib/auth/route-guard.ts](../lib/auth/route-guard.ts)). The comments say this is restricted to
gogulf.co, but the enforcement point is **unknown**: it may be the Google Workspace or Supabase
configuration. A custom JWT hook adds `app_staff_id`, `app_role` and `app_branch` claims. Access
is checked at three layers: proxy (verified claims), the area layout (a live `is_staff()` check)
and Postgres RLS. Customers are meant to sign in with phone OTP, which is not built.

**Environment variable names** (from [lib/env.ts](../lib/env.ts), [.env.example](../.env.example)
and the code; no values):

- Public: `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `NEXT_PUBLIC_RAZORPAY_KEY_ID`, `NEXT_PUBLIC_SENTRY_DSN`
- Server: `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`,
  `RESEND_REPLY_TO`, `RESEND_WEBHOOK_SECRET`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`,
  `RAZORPAY_WEBHOOK_SECRET`, `OTP_PROVIDER`, `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`,
  `FIREBASE_PRIVATE_KEY`, `WHATSAPP_PROVIDER`, `WHATSAPP_PHONE_NUMBER_ID`,
  `WHATSAPP_BUSINESS_ACCOUNT_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET`,
  `WHATSAPP_VERIFY_TOKEN`, `TELEPHONY_PROVIDER`, `TELEPHONY_API_KEY`, `TELEPHONY_API_SECRET`,
  `TELEPHONY_WEBHOOK_SECRET`, `CRON_SECRET`, `SENTRY_AUTH_TOKEN`
- Build and runtime: `PLATFORM_MODE`, `APP_ENV`, `VERCEL_ENV`, `VERCEL`, `NODE_ENV`,
  `VERCEL_AUTOMATION_BYPASS_SECRET` (used by tests)

---

## 2. Features

| Feature | Status | Evidence |
|---|---|---|
| Jobs board and job pages | **Implemented** | `jobs` and `job_categories` tables (0012); public reads only live jobs through RLS; staff create, review, publish and close jobs in `/admin/jobs`; JobPosting JSON-LD; listed in the sitemap |
| Job applications | **Implemented** | `/jobs/apply` uploads CV, passport and other files to the private `job-applications` bucket and inserts into `job_applications` directly from the browser (anon key), then emails a notification through `/api/forms/job-application`. Staff triage in `/admin/applications` (status, assign, convert to contact and case through the `convert_job_application` RPC; documents through 60-second signed URLs) |
| Candidate registration | **Partial** | There is no account or sign-up. The general application on `/jobs/apply` is the only way to register. The customer portal is a placeholder: "Online accounts are not available yet" |
| Employer enquiries | **Partial** | `EmployerRequirementForm` on `/employers` and `ServiceInquiryForm` on `/services` post to `/api/forms/service-inquiry` and are **sent by email only, not stored in the database**. The CRM `employers` table (0022) is filled in by staff by hand |
| Contact form | **Partial** | `/api/forms/contact` sends email only and stores nothing |
| Verify page | **Implemented** | `/verify` shows the legal name, brand, CIN, type, incorporation date, ROC, activity, office, GSTIN, official channels and an MCA link. It says plainly that the CIN is not a recruitment licence |
| WhatsApp | **Stubbed** (click-to-chat only) | `wa.me` links from [content/channels.ts](../content/channels.ts), per-job prefilled messages, and `application_method = 'whatsapp'` on jobs. The Cloud API exists only as env var names and a `feature.whatsapp` setting. There are no webhook routes and no sending code |
| Admin / CRM | **Implemented** (main) | Dashboard, applications, contacts (edit, merge), cases (**read-only on main**), employers, jobs, categories, invoices, payments, staff onboarding, roles and permissions, audit log, settings, integrations. RBAC with branch scope (0023, 0024) |
| Payments | **Implemented** | Staff issue invoices, and `/pay/[reference]` opens Razorpay Checkout; the webhook checks the HMAC signature and is idempotent through `payment_events` |
| Customer portal / OTP | **Stubbed** | The Firebase provider is "DECLARED, NOT YET IMPLEMENTED" and throws; only a `mock` provider works |
| Translations | **Stubbed** | The i18n framework is complete, but no non-English catalogue has started |
| Feature flags | **Stubbed** | Six `feature.*` keys are seeded in `settings` (0008), but no application code reads them |

---

## 3. Data model

There are 24 migrations on `main`. Main tables:

- **Identity and RBAC:** `branches`, `roles`, `permissions`, `role_permissions`,
  `staff_users`, `settings`
- **People:** `contacts` (one row per person; `lifecycle_stage` enum, default `lead`),
  `contact_identities`, `contact_merges`
- **Work:** `pipelines`, `pipeline_stages`, `cases` (`case_number` such as `GG-REC-2026-00184`,
  `contact_id`, `case_type` = `recruitment|support`, `pipeline_id`, `stage_id`, `status` =
  `open|won|lost|cancelled`, `owner_id`, `branch_id`, `stage_entered_at`, `value_amount_paise`),
  `case_recruitment` (`job_id`, `employer_id`, `expected_salary_paise`, `years_experience`,
  `passport_number_last4` only), `case_visa`, `case_travel` (the travel case type was retired in
  0019; the table remains), `activities`, `tasks`, `notes`
- **Intake:** `job_applications` (contact details, `cv_path`, `passport_path`, `other_paths`,
  `job_id`, `status` = `new|screening|converted|rejected|withdrawn`, assignment, intake branch)
- **Jobs:** `jobs` (status `draft|review|published|closed|archived`, `application_access
  free|paid`, `application_method online_form|whatsapp`, employer disclosure, salary),
  `job_categories`
- **Employers:** `employers` (`prospect|active|inactive`)
- **Money:** `invoices`, `payments`, `payment_events` (amounts stored as integer paise)
- **Audit:** `audit_logs`, partitioned

**Recruitment pipeline** (seeded in 0008; travel pipeline removed in 0019):

| # | key | Name |
|---|---|---|
| 0 | `legacy_imported` | Legacy — imported, not triaged |
| 1 | `new` | New Lead |
| 2 | `contacted` | Contacted |
| 3 | `documents` | Documents Pending |
| 4 | `screening` | Screening |
| 5 | `interview` | Interview |
| 6 | `selected` | Selected |
| 7 | `processing` | Offer & Processing |
| 8 | `visa` | Visa Processing |
| 9 | `travel` | Travel Preparation |
| 10 | `completed` | Joined (won) |
| 11 | `lost` | Lost |

**How a candidate moves through it on `main`:** an application is triaged (`new` →
`screening` → `converted`/`rejected`/`withdrawn`). Converting it creates or links a contact and
opens a recruitment case at **New Lead**. There is **no UI or server action on `main` to move a
case to the next stage**: `/admin/cases` and `/admin/cases/[id]` only display the stage. A trigger
updates `stage_entered_at` when `stage_id` changes. There is **no "Support" stage**. Support is a
separate `case_type`, and it has no seeded pipeline in the code reviewed. The "10 stages,
Application to Joining and Support" do not map one-to-one to this schema. The `staging` branch
contains `0025_case_lifecycle.sql` (stages, close/reopen, ownership), which is **not on `main`**.

---

## 4. Forms and lead flow

| Form | Where it goes | Stored in the DB? |
|---|---|---|
| Contact (`/contact`) | Resend email to the business inbox, plus an acknowledgement to the sender | No |
| Service inquiry (`/services`) | Resend email; the recipient (jobs or business inbox) is re-derived on the server from the service name | No |
| Employer requirement (`/employers`) | Same endpoint as the service inquiry; the details are sent as a structured message | No |
| Job application (`/jobs/apply`) | Files to Supabase Storage, a row in `job_applications` (browser, anon key), then a Resend notification | Yes |

None of the forms send to WhatsApp.

**Validation:** Zod schemas in [lib/forms/schemas.ts](../lib/forms/schemas.ts) are checked again
on the server, with field length limits, email and phone checks, and a list of allowed services.
Applications only accept PDF, DOC and DOCX for the CV and PDF, JPG and PNG for the passport, with
an 8 MB limit in the browser and 10 MB at the bucket. Inserts are checked by the database (the job
must be open).

**Spam protection:**

- A honeypot field (`website`). Bots get a fake 200 response.
- An **in-memory, per-instance** rate limit of 5 per IP per flow per 10 minutes. Its own comments
  say it is not a real ceiling on Vercel.
- **No CAPTCHA or Turnstile** anywhere.
- The application insert and the file upload go **straight from the browser to Supabase** with the
  anon key, so the honeypot and rate limit do not cover them.

**Consent and privacy:**

- **No form has a consent checkbox or a link to the privacy notice.**
- The Privacy Policy names consent as a lawful basis ("When you submit a form…") and describes
  how to withdraw it.
- The logger records field names only, never submitted values. The full passport number is never
  stored as a field (last four characters only), and documents are reached through signed URLs
  with an audit entry.

---

## 5. SEO and tracking

- **Metadata:** per-page metadata from [lib/seo.ts](../lib/seo.ts) and the page registry
  ([content/pages.ts](../content/pages.ts)), with canonical URLs, hreflang support, OG and Twitter
  images, and a manifest.
- **Sitemap:** [app/sitemap.ts](../app/sitemap.ts) lists indexable pages and open jobs only. It
  revalidates hourly and on job changes.
- **Robots:** [app/robots.ts](../app/robots.ts) disallows `/admin`, `/portal`, `/api/` and
  `/pay/`, and lists AI crawlers as allowed. Staging and previews disallow everything and send
  `X-Robots-Tag: noindex`. There is also `llms.txt`.
- **Structured data:** `Organization` (with the CIN as an identifier and contact points),
  `WebSite`, `BreadcrumbList` and `JobPosting`. The GSTIN is deliberately kept out of structured
  data.
- **Analytics and conversions: none.** There is no GA4, GTM, Meta Pixel or any other tag, and no
  conversion events. The Privacy Policy states this explicitly ("no Google Analytics, no Google
  Tag Manager, no Meta Pixel… we do not need a cookie banner"). A Sentry DSN variable exists, but
  the Sentry SDK is not a dependency.

---

## 6. Compliance in code

- **CIN** (`U52291UP2024PTC198095`, from [lib/legal.js](../lib/legal.js)) appears in the site
  header, the footer, the home page company facts, `CompanyFacts`, `/verify`, `llms.txt`,
  Organization JSON-LD and email footers.
- **GSTIN** (from `lib/legal.js`) appears in the footer, `/contact`, `/verify`, the Terms, Privacy
  and Pricing pages, `LegalPage` and email footers. [content/company.ts](../content/company.ts)
  marks the GST certificate as **unresolved (decision D8)**: the number has not been verified
  against a certificate.
- **Recruiting-agent (RA) registration: not displayed. It does not exist.**
  `content/company.ts` records `recruitingAgentRegistration: "refuted"` ("not registered or
  licensed as a recruiting agent… confirmed by the business, 12 Sep 2026"). The code is careful
  never to claim a licence. Whether the business may lawfully recruit Indian workers for overseas
  employment without one is a legal question, outside what the code can answer.
- **Terms & Conditions** (26 sections): acceptance, contracting entity, eligibility,
  candidate and employer use, job accuracy, the hiring process, document responsibility, no
  guarantee of selection, visa or joining, fees, fraud and impersonation, IP, liability,
  indemnity, termination, governing law.
- **Privacy Policy** (20 sections): data collected (including candidate documents), lawful bases
  (consent and others), sharing, visa and embassy processing, a "complete list" of processors
  (Resend, Supabase, Razorpay, Google Workspace, WhatsApp/Meta), no cookies or analytics,
  international transfers, retention, rights, withdrawing consent, minors, grievance redressal.
  It references the DPDP Act 2023, the DPDP Rules 2025 and the IT Act 2000.
- **Cancellation & Refunds:** refunds for duplicate or incorrect charges, failed transactions,
  cancellation before work starts, or a service Go Gulf cannot deliver. No refunds for work already
  performed, third-party fees already paid on the candidate's behalf, outcomes decided by others
  (employer choice, visa refusal, an "unfit" medical result, emigration refusal), or false
  documents. Legal rights that cannot be excluded are preserved.
- **Pricing:** fees are quoted in writing first, applying and enquiring are free, and fees are
  subject to legal limits. **Inconsistency:** it says "This website takes no payment from anyone:
  there is no checkout on it", but `/pay/[reference]` with Razorpay Checkout exists, and the
  Privacy Policy describes it.
- **Shipping policy:** no physical goods; explains how services are delivered.

---

## 7. Security risks

| Risk | Finding |
|---|---|
| Exposed secrets | **None found in tracked files.** `.env*` files are gitignored; only the `.env.example` files are tracked. Matches in three `*.test.ts` files are fake fixtures. `serverEnv()` throws in the browser, and there is a `check:secrets` script. Several real `.env.*.local` files (production included) sit in the working tree, untracked; they were not opened |
| RLS | **Enabled on every table created in the migrations**, with policies for staff (permission and branch scope) and for customers (own records). Anon has no privilege on `invoices` or `payments`; the public invoice view is a SECURITY DEFINER function with an explicit column allow-list. Whether the remote databases match the migrations: **unknown** |
| Unauthenticated routes | Public by design: `/api/forms/*` (honeypot and in-memory rate limit), `/api/razorpay/webhook` (HMAC-checked), `/pay/[reference]` and its `beginPayment` action (rate-limited per IP and per reference), `/auth/callback`. Admin server actions call `requirePermission`; `/admin` and `/portal` are checked in the proxy, the layout and RLS |
| Invoice enumeration | Invoice references are **sequential** (`GG-INV-YYYY-00001`). Anyone can step through them on `/pay/…` to read status, purpose, amount and due date. There are no names or contact details, but `purpose` is staff-written text. The rate limit is per instance |
| Direct anon writes | The browser can insert into `job_applications` and upload to the bucket with the public key (insert-only, column-limited since 0013). No rate limit or CAPTCHA covers this, so it can be flooded with junk rows and files |
| PII handling | Passport copies and CVs are kept in a private bucket and shared through 60-second signed URLs with audit logs. The application email carries no attachments. Logs never contain values. The retention period is stated in the policy; **no automated deletion job exists in the code** |
| Email header injection | Covered by tests (`header-injection.test.ts`) |

---

## 8. Gaps and prioritised fixes

Effort: **S** is under a day, **M** is 1–3 days, **L** is 1–2 weeks or more. The order is by
business impact.

| # | Gap | Why it matters | Effort |
|---|---|---|---|
| 1 | **No RA (recruiting-agent) registration** (business and legal, not code) | Core regulatory exposure for overseas recruitment from India. Get legal advice; once registered, add the number to the header, footer, `/verify` and schema | Non-code; S to display |
| 2 | **Contact, service and employer enquiries are email-only** | Leads cannot be tracked, assigned or reported on, and are lost if email fails. Write them to `contacts` and `cases`, or to an `enquiries` table, before emailing | M |
| 3 | **No analytics or conversion tracking** | Cannot measure lead sources or run paid acquisition. Add GA4 or GTM and Meta Pixel with conversion events for form success and `wa.me` clicks. This needs a consent banner and rewriting the "no tracking" section of the Privacy Policy first | M |
| 4 | **Cases cannot be moved through stages on `main`** | The pipeline exists but staff cannot run it. Promote `0025_case_lifecycle` from `staging` after QA. Decide how "Support" fits the 10-stage model | M (already built on staging) |
| 5 | **Spam on applications** | Direct anon inserts and uploads bypass all throttling. Move the insert server-side or add Turnstile or hCaptcha, and use a durable (Postgres or Redis) rate limiter | M |
| 6 | **No consent capture on forms** | The Privacy Policy relies on consent under DPDP. Add a required consent checkbox with a link to the notice, and store the consent timestamp and version with each submission | S |
| 7 | **Guessable invoice references** | Information leak via `/pay/…`. Add a random token to payment links, or look invoices up by a non-sequential public ID | S |
| 8 | **Pricing page says there is no checkout** | Contradicts `/pay` and the Privacy Policy, a consumer-law and payment-gateway risk. Correct the text | S |
| 9 | **GSTIN shown but unverified (D8)** | A wrong GSTIN on invoices and pages is a tax-compliance problem. Confirm it against the certificate | S (business) |
| 10 | **WhatsApp is click-to-chat only** | No logging of WhatsApp leads into the CRM. Build the Cloud API webhook and inbox (env and flag are already reserved) | L |
| 11 | **Customer portal and OTP not built** | Candidates cannot check their status themselves, which drives inbound calls. Pick an OTP provider (DLT registration needed) | L |
| 12 | **No regional-language content** | Candidate audiences (hi, ml, ta, bn, ar) are not served. The framework is ready; translations and review are needed | L (content) |
| 13 | **No automated data-retention job** | The policy promises retention limits. Add a scheduled purge or anonymisation job (`CRON_SECRET` is already defined) | M |
| 14 | **Housekeeping** | `feature.*` flags are seeded but unused (wire them up or remove them); the static-export comment in `next.config.mjs` is stale; the Sentry DSN exists without an SDK | S |

**Unknown from code:** production deployment state and commit, which migrations each remote
database is at, Vercel environment variable values and scopes, Supabase Auth dashboard settings
(domain restriction, JWT hook enabled), Resend domain verification, Razorpay live mode, and DNS.
