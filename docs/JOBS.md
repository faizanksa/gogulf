# Jobs, applications and the CRM bridge

Phase 3 moves job listings from a file (`content/jobs.ts`, retired) into the database,
managed from the staff workspace, and connects applications to contacts and cases.

- Schema: `supabase/migrations/0012_jobs.sql`, `0013_job_applications_bridge.sql`
- Behaviour tests, as each role: `supabase/tests/jobs.test.sql`
- Domain rules (framework-free, unit-tested): `lib/jobs/model.ts`, `lib/jobs/validation.ts`
- Public reads: `lib/jobs/public-data.ts` · staff reads: `lib/jobs/admin-data.ts`, `lib/crm/data.ts`
- Staff actions: `app/(admin)/admin/(protected)/jobs/actions.ts`, `…/applications/actions.ts`

---

## 1. Five concepts, five columns

| Concept | Column(s) | Values |
| --- | --- | --- |
| Classification | `category_id` → `job_categories.classification` (copied to `jobs.classification`) | general, professional |
| Lifecycle | `status` | draft, review, published, closed, archived |
| Availability | `availability`, `closes_on` | ongoing (no date), time_limited (date required to publish) |
| Promotion | `promotion`, `featured_until` | standard, featured (optionally until a date) |
| Application access | `application_access`, `application_method` | free, paid · online_form, whatsapp |

There is no `is_premium`. Each business combination is a row, not a redesign:
Professional + Featured + Free, General + Ongoing + Free, and — later, once an approved
payment flow exists — Professional + Standard + Paid.

**Categories are data.** Seeded in `0012`, added and deactivated at `/admin/jobs/categories`.
`parent_id` allows a hierarchy later; a child must share its parent's classification.

## 2. Paid application access is not live

A job may be drafted and reviewed with `application_access = 'paid'`, so the model is
ready. It can never be public:

- `jobs_paid_application_not_public` — a CHECK constraint refusing paid + published/closed.
  A constraint, not a settings flag, on purpose: switching paid applications on must be a
  reviewed migration shipped with an approved payment flow, not a toggle.
- `jobs_before_write` names the problem (`paid_application_unavailable`) when publishing.
- `job_applications_intake` refuses an application to any job that is not published and free.
- The staff form says "Paid application access is not currently available." beside the option.

Razorpay is approved for consultation fees only. There is no candidate payment flow, no
price and no "Pay now" anywhere.

## 3. Lifecycle

```
draft ──> review ──> published ──> closed ──> archived
  │  <──────┘  │         │  <─────┘   │          │
  │            │         └──> draft    │          │
  └────────────┴─────────────> archived <┘          │
draft <──────────────────────────────────────────────┘  (restore)
```

| From | Allowed to |
| --- | --- |
| draft | review, archived |
| review | draft, published, archived |
| published | draft (unpublish), closed, archived |
| closed | published (reopen), archived |
| archived | draft (restore) |

Staff create drafts only. A job reaches **review** or **published** only when it states the
minimum a genuine listing needs (`job_publish_problems`):

- a category (active, when entering the status), a country, an employment type, a summary;
- an employer disclosure — named (with the name) or confidential;
- a closing date if time-limited, still ahead when publishing or reopening;
- requirements, if professional (general hiring is not made to invent them);
- free application access, to publish.

Nothing is filled in. Salary, vacancies, benefits, experience, education and the
employer's name are optional and stay absent when not supplied — the public page says
"not stated" or leaves the fact out.

The **reference** (GG-JOB-2026-00001) and the URL **slug** freeze at first publication:
links shared on WhatsApp, search results and applications depend on them.

Contradictions are refused by constraint and normalised by the form with a note: an
ongoing job's closing date, a standard job's featured-until date, a confidential
employer's name (recorded in `internal_notes` instead, which the public cannot read).

## 4. Public visibility

The public site reads through a cookie-less client with the anon key. What anon can read
is set by the database, not by the page:

- **RLS:** `status in ('published', 'closed')`. Drafts, jobs in review and archived jobs
  are unreadable, even by id.
- **Column grants:** public columns only. `internal_notes`, `branch_id`, `created_by`,
  `updated_by` and lifecycle bookkeeping are not granted.

| Status | Jobs page | Job page | Sitemap | JobPosting | Accepts applications |
| --- | --- | --- | --- | --- | --- |
| draft, review, archived | — | 404 | — | — | — |
| published, open | listed | indexable | listed | yes (English) | yes |
| published, past closing date | — | noindex, "closed" notice | — | — | refused |
| closed | — | noindex, "closed" notice | — | — | refused |

**Featured** is read, never written back: a job is featured while `promotion = 'featured'`
and `featured_until` has not passed (inclusive, India time). Nothing changes when it lapses.

**JobPosting** appears only on an open job's own English page, with `validThrough` from
its own closing date (absent for ongoing hiring) and optional properties only when stated.

**Freshness.** Pages regenerate every 10 minutes (dates pass without any write), and every
staff change calls `revalidateJobPages()` — `updateTag` on the job reads plus the affected
paths — so a publish is visible on the next request.

**Presentation.** Featured opportunities, then ongoing and general hiring, then professional
opportunities; empty groups are not shown; a filter appears only when the listed jobs give
it two values. Professional jobs use a white card, general hiring the surface tone. No
"closing soon", no counts of places left.

**Languages.** Database jobs are English. They render in the pseudo-locales outside
production for layout testing, and nowhere else, until reviewed translations can be stored
(a `job_translations` table — not built). No listing is machine-translated.

## 5. Applications → contacts → cases

```
JOB ──< APPLICATION ──> CONTACT ──< CASE (recruitment) ──< ACTIVITIES
```

- The public form sends `job_id` with the application when it came from a job's page
  (`/jobs/apply?ref=…`, resolved on the server). `job_applications_intake` checks the job
  is still open and stores the job's own title. anon may insert only the form's columns.
- An application has its own triage status — new, screening, converted, rejected,
  withdrawn — separate from the job's lifecycle and from the case's pipeline stage.
- **Closing or archiving a job never touches its applications** (`job_id` is ON DELETE
  RESTRICT; nothing updates applications when a job changes). Staff still read them.
- **Convert** (`convert_job_application`, SECURITY INVOKER, one transaction): finds the
  contact by normalised phone, then email — the same order as `resolve_contact` — among the
  contacts the staff member can see; otherwise creates one with those identities; opens a
  recruitment case at the New stage linked to the job; links the application; writes the
  timeline entry. A match outside the caller's scope is reported (`contact_outside_scope`),
  never duplicated. No marketing consent is recorded.
- **Documents** open through `/admin/applications/<id>/document`, which calls
  `record_document_access` (audit entry first, by document kind, never the file name) and
  then asks Storage for a 60-second signed link. The storage policy checks again: the path
  must be one the application recorded, the CV needs `documents.view.employment`, the
  passport and other documents `documents.view.identity`.

## 6. Permissions and audit

| Action | Permission (layer 2) | Enforced again by (layer 3) |
| --- | --- | --- |
| View jobs | jobs.view | RLS `staff read jobs` |
| Create, edit, transition, feature, duplicate | jobs.manage | RLS + `jobs_before_write` |
| Manage categories | jobs.manage | RLS on `job_categories` |
| Read, triage applications | applications.screen | RLS, scoped all / branch / own (assignee) |
| Convert an application | applications.screen + contacts.create + cases.create | RLS on every table it writes |
| Open a document | documents.view.employment / .identity | `record_document_access` + storage policy |

ADMIN holds all of these. It still cannot manage roles or permissions, promote itself,
alter a SUPER_ADMIN or write an audit entry — proven in `jobs.test.sql` §6–7.

Audit entries are written by database triggers in the same transaction as the change,
attributed from the JWT (`actor_label` = the staff email):
`job.created`, `job.duplicated`, `job.updated` (changed fields only), `job.submitted_for_review`,
`job.returned_to_draft`, `job.published`, `job.unpublished`, `job.closed`, `job.reopened`,
`job.archived`, `job.restored`, `job.featured`, `job.unfeatured`, `job.featured_until_changed`,
`job.application_access_changed`; `job_application.status_changed`, `.assigned`, `.converted`;
`document.accessed`; category changes through the generic `audit_table_change`.

## 7. Staging test data

`supabase/seeds/staging-jobs.sql` — twelve `STAGING TEST —` jobs, references `STG-JOB-001`
to `STG-JOB-012`, covering every scenario in the QA checklist. Not a migration.

```bash
npm run db:mumbai -- seed-jobs     # Mumbai staging only
npm run db:seed:local              # local stack, for the e2e suite
```

Both runners refuse any other target; the file itself refuses to run unless the runner set
`app.seed_target = 'staging'`; `lib/jobs/seed-safety.test.ts` fails if a migration ever
writes a job row or mentions the test data.

## 8. Not built in this phase

- Case stage changes, tasks and documents on cases (read-only case pages for now).
- Job translations (`job_translations`).
- An approved paid-application flow.
- Employers as records (`employers` table; `case_recruitment.employer_id` has no target yet).
- Staff user management UI (roles are changed by SUPER_ADMIN in the database for now).
