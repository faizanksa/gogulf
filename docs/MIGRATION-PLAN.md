# Migration Plan

Covers three migrations running in parallel: the **website** (static → server-capable), the
**data** (legacy Supabase → new platform), and the **integrations** (EmailJS → Resend, and the rest).

**The existing website stays live and fully operational throughout. No customer-visible downtime.**

---

## 1. Phase sequence

Revised from the Phase 0 audit with two changes: Resend moves forward to Phase 1.5, and the legacy
data migration is downgraded from a major workstream to a half-day task (see §4).

| Phase | Deliverable | Depends on | Size |
| --- | --- | --- | --- |
| **0** | Audit | — | ✅ done |
| **0.5** | Housekeeping: gitignore, `.env.example`, ESLint (Next 16 removed `next lint`), `turbopack.root`, TypeScript foundation, secret scanner, production inspection | — | ✅ done |
| **1** | **Foundation.** Remove `output: 'export'`. Supabase project in `ap-south-1`. `contacts` + `contact_identities` + E.164 normalisation. `staff_users`/`roles`/`permissions`. `audit_logs`. RLS helpers + JWT hook. Zod layer. Sentry. `proxy.js`. Google Workspace SSO | B1–B4 ✅ | L |
| **1.5** | **Resend.** Server-side email, React Email templates, EmailJS removed everywhere **including the privacy-policy processor list** | 1 | S |
| **2** | **Design system + public site.** All 13 URLs preserved, SEO/JSON-LD ported intact, legal pages restyled, **company identity updated per `LEGAL-DATA-MIGRATION.md`** | 1 | L |
| **3** | **Auth + customer portal.** Phone OTP on a DLT-registered sender, sessions, profile, consent, DPDP request flow. Cross-customer isolation tests | 1, 1.5 | M |
| **4** | **CRM core.** Contacts, sources, campaigns, assignment, tags, notes, tasks, activity timeline, configurable pipelines, **Customer 360** | 1 | L |
| **5** | **Recruitment.** Jobs and employers in the database — ending the deploy-per-vacancy problem. Applications as cases, screening, interviews, documents. `/jobs/apply` cut over. **Legacy data migrated** | 4 | L |
| **6** | **Travel & service cases.** Inquiries, quotes, service cases, travel documents | 4 | M |
| **7** | **Payments.** Orders, installments, Razorpay, verified idempotent webhooks, invoices, portal + admin financial views | 3, 4 | L |
| **8** | *(absorbed into 1.5)* | — | — |
| **9** | **WhatsApp.** Cloud API, templates, inbound webhook, conversation assignment, consent gating | 4, B7 | L |
| **10** | **Telephony / IVR.** Adapter, caller identification, call logs, routing | 4, 9 | M |
| **11** | **Admin dashboard.** Full modules, KPIs, filters, saved views, bulk actions, user and role administration | 4–7 | L |
| **12** | **Automation.** Events, outbox, handlers. Payment-due, document-expiry and interview reminders | 7, 9 | M |
| **13** | **Reporting.** Source ROI, recruitment funnel, collections, staff performance — as SQL views | 11 | M |
| **14** | **Security & QA hardening.** RLS matrix, IDOR sweep, webhook replay tests, upload validation, restore drill | all | M |

### Critical-path items with external lead time

| Item | Lead time | Start |
| --- | --- | --- |
| **India DLT** header + template registration | Weeks | **Now** — blocks Phase 3 |
| WhatsApp number decision (B7) + Meta business verification | Weeks | Before Phase 9 |
| GST certificate for invoicing (§I6) | Unknown | Before Phase 7 |
| Razorpay live-mode readiness under the correct entity | Days | Before Phase 7 |

Phases 9–13 are a second major release. Treating them as "later in the same sprint" is the most
likely way this plan fails.

---

## 2. Website migration — removing static export

Phase 1, as its own commit, so the diff that changes the deployment model is reviewable in
isolation.

`output: 'export'` blocks Route Handlers that read the request, `cookies()`, redirects, headers,
`proxy.js` and ISR — that is, every platform feature. `next.config.mjs` currently documents this
inline.

**Order:** remove `output: 'export'` → add `proxy.js` with security headers → verify all 20 routes
still render → verify the SEO surface is byte-identical → deploy to staging → compare against
production with an automated crawl.

The apply form is **not** touched in this phase. It keeps writing to the legacy project until
Phase 5.

---

## 3. Parallel run — the website stays up

```
NOW        gogulf.co (static) ──► legacy Supabase             [untouched]

STAGE 1    gogulf.co (static) ──► legacy Supabase             [still live]
Ph 1–2     staging.gogulf.co ──► new Supabase                 [internal, noindex]

STAGE 2    gogulf.co (NEW, server) ──► new Supabase           [marketing cut over]
Ph 2 end   /jobs/apply STILL writes to legacy                 [unchanged, still working]
           DNS switched · old host kept warm 30 days

STAGE 3    everything ──► new Supabase                        [apply form cut over]
Ph 5       delta migration · legacy anon INSERT revoked

STAGE 4    /portal and /admin behind feature flags            [staff pilot first]
Ph 3–4

STAGE 5    legacy read-only 30 days → archive → delete (with written sign-off)
```

**Why the marketing site moves first.** Public pages are stateless — switching them is low-risk and
reversible by a DNS change. The apply form owns real candidate data, so it moves only once the new
pipeline is proven end to end. Splitting the two means the highest-risk cutover happens alone, with
everything else already stable.

### URL and SEO continuity — non-negotiable

- All 13 existing URLs resolve identically, verified by an automated crawl comparing old and new.
- `sitemap.xml`, `robots.txt`, `llms.txt`, canonicals and every JSON-LD block ported and validated
  with Google's Rich Results Test **before** DNS switches.
- Any URL that must change gets a `301`, listed in the release notes.
- Search Console monitored daily for two weeks post-cutover; coverage and JobPosting validity are
  the two signals that matter.
- Staging carries `noindex` throughout — a duplicate indexed staging site is a real SEO regression.

### Cutover rollback

DNS TTL lowered to 300 seconds 48 hours before switching. The old static host stays fully deployed
for 30 days. Because the apply form still points at the legacy project during Stage 2, **no
application data is at risk during the riskiest window.**

---

## 4. Data migration — smaller than expected

The production inspection (`LEGACY-DATA-INSPECTION.md`) found **4 applications and 10 documents,
all created 4–5 September 2026** — almost certainly the developer's own end-to-end tests, not
accumulated business history.

| | Audit assumption | Actual |
| --- | --- | --- |
| Applications | Unknown, potentially years | **4** |
| Documents | Unknown | **10 files, 7.69 MB** |
| Orphans | Expected some | **0, both directions** |
| Duplicate people | Expected | **0** |
| Effort | Multi-stage tooling | **Half a day, with manual review of 4 phone numbers** |

**Confirm with the business that no earlier data existed and was deleted** — the inspection can only
see what is there now.

### Procedure

1. **Snapshot** — `pg_dump` of `job_applications` plus a full storage mirror with SHA-256 per file.
   Cheap insurance, and it is regulated data either way.
2. **Raw import** into `legacy.job_applications_import` in the new project, verbatim, never edited —
   so the transform can be re-run after a fix without touching production again.
3. **Transform** — idempotent, keyed on `legacy_id`. Mapping in `LEGACY-DATA-INSPECTION.md` §13.
4. **Storage copy** into `gogulf-documents/contacts/{c}/cases/{k}/{doc}.{ext}`, from the verified
   archive rather than the live bucket. SHA-256 re-verified after upload; a mismatch fails the row.
5. **Delta** at cutover for anything created since the snapshot.
6. **Revoke** the legacy anon INSERT policy immediately after cutover.
7. **Retain read-only for 30 days**, then archive, then delete with written sign-off.

### Rules that do not bend

| Rule | Why |
| --- | --- |
| Phone that fails E.164 → **quarantine for manual review, never guess** | A wrong normalisation silently merges two different people. At least 2 of the 4 rows need this |
| Documents import as **`uploaded`**, never `approved` | Nobody verified them. Recording otherwise fabricates an audit trail |
| Consent: email `true`; **WhatsApp, SMS, marketing all `false`** | They consented to a job application, nothing more. Manufacturing consent is the expensive DPDP mistake |
| Cases land in a **"Legacy — imported, not triaged"** stage, unassigned | So nobody mistakes them for worked leads |
| `opened_at` = original `created_at` | The customer's history starts when they applied, not when we migrated |
| Do **not** create `jobs` rows from `job_title` text | The historical vacancies do not exist and must not be invented |

### PII handling during migration

Encrypted volume on one named machine — not a synced cloud folder, never the repo. `.gitignore` now
covers `export/`, `*.dump`, `legacy-data.sql` and the rest. No row, filename or document content
goes into a ticket, a chat or an AI tool. The working copy is deleted once the migration is
verified, and who ran it, when, and where the archive lives is recorded.

---

## 5. Integration migrations

### EmailJS → Resend (Phase 1.5)

- [ ] Remove `@emailjs/browser` from `package.json`
- [ ] Delete `lib/emailjs.js`
- [ ] `components/ApplyForm.js` — replace `sendInquiry()` with a Server Action
- [ ] `components/ContactForm.js` — same, and persist the lead to CRM
- [ ] `components/ServiceInquiryForm.js` — same, keeping the candidate/employer routing logic
- [ ] Remove the three `NEXT_PUBLIC_EMAILJS_*` variables from every environment
- [ ] Delete `EMAILJS-SETUP.md`
- [ ] Rewrite the email and deployment sections of `DEPLOYMENT.md`
- [ ] **`app/privacy-policy/page.js` — replace the EmailJS entry with Resend** *(legal disclosure —
      the list is prefaced "There are no others")*
- [ ] Add Vercel and Sentry to the same processor list
- [ ] Revoke the EmailJS account keys after cutover
- [ ] Verify: contact form, service inquiry, job application, confirmation email

### Razorpay (Phase 7)

Test mode throughout development. Live keys exist only in production, and only after: the merchant
account is confirmed under the **correct entity name** (`LEGAL-DATA-MIGRATION.md` §11 item 8), the
GST position is resolved, and webhook signature verification plus idempotency are tested with
replayed events.

### WhatsApp (Phase 9)

Blocked on decision B7. **Do not migrate the existing business number** — if it is on the WhatsApp
Business App, moving it to the Cloud API is effectively one-way and the team loses the phone app.
The recommendation is a second number. The provider adapter is built in Phase 9 regardless, so the
number decision can be made late.

### OTP (Phase 3)

Firebase first, behind `lib/providers/otp/`. Auth logic never imports Firebase directly, so
replacing it with MSG91 or Twilio is a provider swap. **DLT registration is the long pole** — start
now.

---

## 6. Backup and disaster recovery

> Supabase: *"Database backups do not include objects you store via the Storage API… Restoring an
> old backup does not restore objects you deleted after that backup."*

**Passports and CVs are not protected by any database backup.** Storage needs its own independent
mirror. This was the most consequential correction to the Phase 0 audit.

| Layer | Mechanism | RPO | RTO |
| --- | --- | --- | --- |
| Postgres | Supabase PITR add-on, 7-day retention | ~2 min | 1–4 h |
| Postgres (secondary) | Weekly `pg_dump` off-platform, encrypted | 7 days | 4–8 h |
| **Storage objects** | **Nightly incremental mirror to a different vendor**, checksum manifest | 24 h | 2–6 h |
| Application code | Git + Vercel immutable deployments | 0 | < 5 min |
| Schema, RLS, roles | Migrations in git, replayable from empty | 0 | < 30 min |
| Secrets | Password manager, not only Vercel | 0 | < 15 min |

PITR requires Pro **plus** a Small compute add-on, and replaces daily backups rather than
supplementing them.

**A backup that has never been restored is a hypothesis.** Quarterly restore drill into a scratch
project, timed, with the result written down.

---

## 7. Retention, deletion and export

Enforced by scheduled jobs and database state, not good intentions. Proposed schedule — needs
sign-off (decision I8):

| Data | Retention | Basis |
| --- | --- | --- |
| Unconverted lead (no case) | 24 months from last activity, then anonymise | Legitimate follow-up window |
| Candidate profile, active | While active + 24 months, then flag for review | Matching to future roles — the current policy already says this |
| **Identity documents** (passport, ID) | **12 months** after case closes, unless a placement completed | Minimising the highest-risk data |
| Documents for a completed placement | 7 years | Employer/authority queries, claim defence |
| Financial records, invoices, tax | **8 years, never auto-deleted** | Companies Act 2013 / income-tax |
| Communications | 3 years — body purged, metadata retained | Dispute resolution |
| Call recordings, if enabled | 6 months | Long retention is hard to justify |
| Audit logs | 8 years, **never deleted**, partitioned by year | Immutability is the point |
| `webhook_events` raw payloads | 90 days; the event row is permanent | Payloads are bulky and contain PII |
| Legacy migration archive | Until sign-off + 30 days | §4 |

**Worth naming the tension:** keeping candidate documents indefinitely "for future roles" is
commercially attractive and is exactly what DPDP's storage-limitation expectation pushes against.
The 12-month identity-document rule is the compromise I recommend.

### Mechanics

- **Soft delete first** — `deleted_at` set, excluded by RLS, recoverable for 30 days.
- **Then anonymise or purge.** Anonymise where the record must survive for aggregate reporting
  (name/phone/email replaced by a stable pseudonym, case shape retained). Purge where it must not.
- **Storage purge is real deletion** — objects move to a `quarantine/` prefix for 30 days, then go.
  Since backups do not cover Storage, this is irreversible: it runs from an explicit job with a
  dry-run mode and a reviewed manifest.
- **No `on delete cascade` on anything financial.** Deleting a contact must never silently delete an
  invoice.
- **Legal hold** — `contacts.legal_hold_until` makes every automated deletion skip the record and
  log why.
- Every deletion writes an `audit_logs` row: what, whose, why, on whose authority.

### Data-principal requests (DPDP)

| Request | SLA | Mechanism |
| --- | --- | --- |
| Access / copy | 30 days | Self-service portal export → JSON + PDF summary + documents in a ZIP |
| Correction | 7 days | Portal edit for self-editable fields; staff task for the rest |
| Erasure | 30 days | Portal request → staff review (legal hold + tax retention check) → execution → written confirmation |
| Nomination | On request | Stored against the contact |
| Grievance | Acknowledge 48 h, resolve 30 days | Named Grievance Officer (decision I7), tracked as an SLA case |

The export must be genuinely portable: `profile.json`, `cases.json`, `payments.json`,
`communications.json`, `documents/` with originals, plus a readable `summary.pdf`. Generated
server-side, delivered as a signed URL valid 24 hours, and the generation itself is audited.

---

## 8. Legal and privacy migration

Detailed in `LEGAL-DATA-MIGRATION.md` (company identity) and Decision Pack Part K (disclosures).
The governing rule:

**Legal-page changes ship in the same release as the feature that makes them necessary — never
afterwards.**

| Ships | Becomes false | Fix in the same release |
| --- | --- | --- |
| Phase 1.5 — Resend | "This is the complete list… There are no others" (names EmailJS) | Swap EmailJS → Resend; add Vercel and Sentry |
| Phase 2 — company identity | Company name, address, GSTIN, `foundingDate: 2008` | Per `LEGAL-DATA-MIGRATION.md` |
| Phase 3 — auth | "This website does not set cookies of its own"; "There is no login and no user account" | Session cookies, portal accounts, OTP advice nuance |
| Phase 7 — payments | Payments section is generic | Name Razorpay; concrete retention periods |
| Phase 9 — WhatsApp | WhatsApp entry describes inbound only | Outbound templates, stored conversations |
| Phase 10 — IVR | — | Telephony provider; call-recording disclosure if enabled |

`POLICY_EFFECTIVE_DATE` and `POLICY_EFFECTIVE_ISO` bump in the same commit, and `public/llms.txt`
updates alongside — otherwise the site tells AI crawlers one thing and its own policy pages another.
