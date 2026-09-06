# Legacy Data Inspection — production Supabase

**Project:** `julbqkeyvzwluayokcdi`
**Inspected:** 5 September 2026
**Method:** read-only. `GET` on PostgREST, storage `list`, auth admin `list`. **No writes, no DDL, no
deletes, no key rotation, no schema or RLS changes.**
**PII handling:** rows were read into memory for aggregation and discarded. No applicant name, email,
phone, filename or document content appears in this document or was emitted to any log.

---

## 1. Headline finding

**The production database holds 4 job applications, all submitted on 4–5 September 2026 — within
the last two days.**

This materially changes the risk picture from the Phase 0 audit, which assumed a historical archive
of candidate documents was at stake. It is not. The dataset is almost certainly the developer's own
end-to-end tests of the apply form, not accumulated business history.

| | Audit assumption | Actual |
| --- | --- | --- |
| Applications at risk | Unknown, potentially years | **4** |
| Date range | Unknown | 4 Sep 2026 – 5 Sep 2026 |
| Documents at risk | Unknown | **10 files, 7.69 MB** |
| Migration complexity | High | **Low** |

**Consequence:** the legacy migration is no longer a delivery risk. It is a half-day task. The
90-day parallel-run safety window in the Decision Pack can be shortened, and the "what if we never
recover access" contingency is now close to irrelevant.

**Confirm with the business** that no earlier application data existed and was deleted — the
inspection can only see what is there now.

---

## 2. Project status

| Property | Value | Source |
| --- | --- | --- |
| PostgREST reachable | Yes, HTTP 200 | Live probe |
| Project paused | No — API responding | Live probe |
| Region | **Not determinable via service-role key** | Needs Dashboard → Settings → Infrastructure |
| Plan tier | **Not determinable via service-role key** | Needs Dashboard → Settings → Billing |
| Postgres version | Not exposed via PostgREST | Needs Dashboard |

The service-role key authenticates against the project's data APIs; it is not a Management API
token, so plan, region and compute cannot be read with it. Three values still needed from the
Dashboard — see §9.

---

## 3. Schema

One table exposed through PostgREST. No views, no functions, no other tables in the `public` schema.

### `public.job_applications` — 13 columns

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. Generated **client-side** by `crypto.randomUUID()` |
| `created_at` | `timestamptz` | Defaults to `now()` |
| `job_title` | `text` | Free text, not a foreign key |
| `job_country` | `text` | Free text, not a foreign key |
| `full_name` | `text` | Not null |
| `email` | `text` | Not null, unnormalised |
| `phone` | `text` | Not null, **unnormalised free text** |
| `experience` | `text` | Free text |
| `message` | `text` | Free text |
| `cv_path` | `text` | Storage key |
| `passport_path` | `text` | Storage key |
| `other_paths` | `text[]` | Storage keys, defaults `{}` |
| `page_source` | `text` | Currently always `"Jobs Page"` |

**Absent, and needed by any workflow:** status, assigned staff, stage history, notes, `updated_at`,
soft delete, verification state, consent, link to a person record, audit trail.

This is a submission log, not an application record. It matches the migration file
`supabase/migrations/0001_job_applications.sql` exactly — no schema drift.

---

## 4. Row counts

| Table | Rows |
| --- | --- |
| `job_applications` | **4** |

No other tables exist in the exposed schema.

---

## 5. Data quality (aggregates only)

| Measure | Value |
| --- | --- |
| Rows | 4 |
| Earliest `created_at` | 2026-09-04T17:58:57Z |
| Latest `created_at` | 2026-09-05T13:57:27Z |
| Distinct normalised emails | 4 |
| Distinct phone digit-strings | 4 |
| Rows missing email / phone / name | 0 / 0 / 0 |
| Repeat applicants (same phone) | 0 |
| Contacts after phone dedup | **4** |
| `page_source` values | `Jobs Page` ×4 |
| Well-formed UUID ids | 4 / 4 |
| `cv_path` correctly prefixed with row id | 4 / 4 |

### Roles applied for

| Count | Role |
| --- | --- |
| 1 | General Application (no country) |
| 1 | Housekeeping Staff — United Arab Emirates |
| 1 | Warehouse Assistant — Oman |
| 1 | Site Supervisor — Saudi Arabia |

All four map to entries in `lib/jobs-data.js`, consistent with test submissions walking the job
board.

### Phone normalisation — the one real data-quality issue

| Digit length | Rows | Interpretation |
| --- | --- | --- |
| 10 | 1 | Bare Indian mobile — needs `+91` prefix |
| 11 | 1 | Ambiguous — leading `0`, or a partial number |
| 12 | 1 | Likely `91XXXXXXXXXX` — already country-coded |
| 13 | 1 | **Needs manual review** |

**Four rows, four different formats.** With no client-side or server-side phone validation, the
field accepts anything. Two observations follow:

1. It confirms the Decision Pack rule: any phone that does not resolve to valid E.164 is
   **quarantined for manual review, never guessed**. On this dataset that is at least 2 of 4 rows.
2. It is further evidence these are test entries — a real applicant set would cluster on one or two
   formats.

---

## 6. Storage inventory

| Property | Value |
| --- | --- |
| Buckets | 1 |
| Bucket id | `job-applications` |
| Public | **`false`** — correct |
| File size limit | 10,485,760 bytes (10 MB) |
| Allowed MIME types | Any — **not restricted** |
| Created | 2026-08-06T09:46:23Z |
| Top-level folders | 4 (one per application) |
| Objects | **10** |
| Total size | **7.69 MB** |
| Average object size | 787 KB |

| Breakdown | Value |
| --- | --- |
| Extensions | `pdf` ×7, `jpg` ×3 |
| MIME types | `application/pdf` ×7, `image/jpeg` ×3 |
| Document labels | `cv` ×4, `passport` ×4, `other` ×2 |

Folder-per-application convention (`{application_id}/{label}-{filename}`) holds for all four.

---

## 7. Row ↔ storage reconciliation

| Check | Result |
| --- | --- |
| Document paths referenced by rows | 10 |
| Objects present in storage | 10 |
| Referenced but **missing** in storage | **0** |
| In storage but **unreferenced** | **0** |
| Storage folders with no database row | **0** |

**Perfect referential integrity.** No orphans in either direction. Migration needs no
reconciliation pass.

---

## 8. Auth state and RLS — empirically verified

### Auth

| Check | Result |
| --- | --- |
| `auth.users` total | **0** |

Confirms the Phase 0 finding: no authentication exists, and nobody has created users out of band.

### RLS, tested with the public anon key

The anon key is published in the browser bundle — every site visitor already has it. These probes
show what an attacker can actually reach. **No writes were attempted.**

| Probe as anon | Result | Verdict |
| --- | --- | --- |
| `GET /storage/v1/bucket` | HTTP 200, **0 buckets visible** | Blocked |
| `POST object/list` (bucket root) | HTTP 200, **0 entries** | Blocked |
| `POST object/list` inside a known folder | HTTP 200, **0 entries** | Blocked |
| `GET object/authenticated/…` with an exact key | **HTTP 400** | Blocked |
| `GET object/public/…` with no key at all | **HTTP 400** | Blocked |
| `POST object/sign/…` | **HTTP 400** | Cannot mint signed URLs |
| `GET /rest/v1/job_applications?select=*` | HTTP 200, **0 rows** | Blocked |
| `GET …?select=count` | HTTP 200, `content-range: */0` | Count masked |
| `GET …?select=full_name,email,phone` | HTTP 200, **0 rows** | Blocked |

**The read-side RLS posture is sound and was verified, not assumed.** The HTTP 200s are correct
behaviour — Postgres RLS filters rows to an empty set rather than raising an error. Even holding an
exact object key, the anon role cannot download a document or mint a signed URL.

The original developer's security work holds up under testing. This is worth stating plainly: the
Phase 0 audit flagged the anon-key model as a concern, and on the read side that concern was
unfounded.

### The write side remains open

The migration grants `anon` `INSERT` on both `job_applications` and `storage.objects` with
`with check (true)`. **This was not tested — testing it would be a write.** From the migration
source, it means anyone holding the public anon key can:

- insert unlimited arbitrary rows into `job_applications`
- upload unlimited arbitrary files up to 10 MB into a bucket with **no MIME restriction**

There is no rate limiting, no CAPTCHA, no server-side validation, and no file-type restriction at
the bucket level. This is a live spam, storage-cost and malicious-upload vector. It is the price of
the static-export architecture — with no server, the browser had to write directly.

**It closes in Phase 1**, when writes move behind a rate-limited server route and the anon INSERT
policies are revoked.

---

## 9. Still needed from the Supabase Dashboard

Three values the service-role key cannot reach:

1. **Region** — Settings → Infrastructure. Determines whether the legacy project is already in
   `ap-south-1` or elsewhere.
2. **Plan tier** — Settings → Billing. Determines whether any backup of this data exists at all.
3. **Backup state** — Database → Backups. On the free plan there are no downloadable backups, which
   would mean the only copy of these 10 documents is the live bucket.

Also worth a glance while there: Database → Roles, for any unexpected role, and Logs → API, to
confirm the live site is the only writer.

---

## 10. Dependencies on this project

| Depends on it | How | Breaks if changed |
| --- | --- | --- |
| `lib/supabase.js` | Browser client, anon key | Apply form stops working |
| `components/ApplyForm.js` | `submitJobApplication()` | Apply form stops working |
| Live site at gogulf.co | Compiled anon key + project URL in the deployed bundle | Applications silently fail |
| `/privacy-policy` § third-parties | Names Supabase as a processor of documents | Disclosure becomes inaccurate |

**Nothing may change on this project** — not the anon key, not the RLS policies, not the bucket —
until the new apply pipeline is live. The deployed static bundle has the anon key baked in and
cannot be reconfigured without a rebuild and redeploy.

---

## 11. Data-quality issues, ranked

| # | Issue | Severity | Handling |
| --- | --- | --- | --- |
| 1 | Phone numbers in 4 different formats across 4 rows | **High** for identity resolution | Quarantine on E.164 failure; never guess |
| 2 | `anon` can INSERT rows and upload files unrestricted | **High** security | Revoke in Phase 1 once server routes exist |
| 3 | Bucket accepts any MIME type | Medium | New bucket restricts types server-side |
| 4 | No status, owner, notes or `updated_at` | Medium | Superseded by the `cases` model |
| 5 | `job_title` / `job_country` free text, no FK | Medium | Import as `legacy_job_title`; do not invent job records |
| 6 | Client-generated `id` | Low | Retained as `legacy_id` for traceability |
| 7 | `page_source` always `"Jobs Page"` | Low | No real attribution data exists to migrate |
| 8 | No consent record of any kind | **High** for DPDP | Import email consent only; WhatsApp/SMS/marketing all `false` |

---

## 12. Migration risks — revised down

| Risk | Phase 0 assessment | Now |
| --- | --- | --- |
| Volume | Unknown, potentially large | 4 rows, 10 files, 7.69 MB — trivial |
| Orphaned documents | Expected some | **Zero** |
| Duplicate people | Expected | **Zero** |
| Phone normalisation failures | Expected | 2 of 4 rows need manual review |
| Loss of history | Serious concern | Two days of test data |
| Access loss | Blocking risk | **Resolved** — credentials in hand |

**Remaining risk of substance:** the 10 documents may be real people's real passports, even if
submitted during testing. They are treated as production PII regardless of how they got there.

---

## 13. Proposed migration mapping

| Legacy | New | Rule |
| --- | --- | --- |
| `job_applications.id` | `cases.legacy_id` | Retained for traceability |
| `phone` | `contact_identities` type `phone` | E.164, default `+91`. **Failure → quarantine, never guess** |
| `email` | `contact_identities` type `email` | Lowercased, trimmed |
| `full_name` | `contacts.full_name` | Verbatim |
| — | `contacts.lifecycle_stage` | `lead` |
| — | `contacts.consent_email` | `true` (they submitted a form) |
| — | `contacts.consent_whatsapp/sms/marketing` | **`false`** — never manufacture consent |
| `created_at` | `cases.opened_at`, `activities.occurred_at` | Original timestamp preserved |
| `job_title`, `job_country` | `case_recruitment.legacy_job_title/country` | Free text. Do **not** create job records |
| — | `cases.case_type` | `recruitment` |
| — | `cases.stage_id` | **"Legacy — imported, not triaged"** |
| — | `cases.owner_id` | `null` — deliberately unassigned |
| `experience` | `case_recruitment.years_experience` | Parse; null on failure |
| `message` | `notes` (visibility `team`) | Verbatim |
| `cv_path` | `documents` category `employment`, type `cv` | Status **`uploaded`**, never `approved` |
| `passport_path` | `documents` category `identity`, type `passport` | Status **`uploaded`** |
| `other_paths[]` | `documents` category `other` | One row each |
| storage object | `gogulf-documents/contacts/{c}/cases/{k}/{doc}.{ext}` | SHA-256 verified; `legacy_path` retained |
| `page_source` | `contacts.first_touch.landing_page` | Only value present is `"Jobs Page"` |

Expected output: **4 contacts, 4 cases, 10 documents, 4 timeline entries, 0 orphans.**

---

## 14. Recommendation

Given four rows and ten files, the migration is small enough to run as a single verified batch with
manual review of every phone number — rather than the multi-stage tooling the Decision Pack
assumed. I recommend:

1. Take the archive snapshot anyway (§3 of the Decision Pack) — cheap insurance, and it is regulated
   data either way.
2. Confirm with the business that no earlier data existed.
3. Migrate in one batch during Phase 5, with a human eye on all four phone numbers.
4. Shorten the legacy read-only retention window from 90 days to **30 days** — there is very little
   to fall back to.

---

## 15. Re-inspection, 6 September 2026 — the dataset has grown

A second read-only inspection during Phase 1.6 found production had changed:

| | 5 Sep 2026 | 6 Sep 2026 |
| --- | --- | --- |
| `job_applications` rows | 4 | **5** |
| Storage objects | 10 | **13** |
| Storage size | 7.69 MB | **11.17 MB** |
| Document labels | cv 4, passport 4, other 2 | cv 5, passport 5, other 3 |

One new application arrived at `2026-09-06T04:12:17Z` via the Jobs Page, with
three files. Referential integrity still holds.

**This was not written by Phase 1.5 or 1.6 work.** The new `/api/forms/*` routes
never import the Supabase client — verified by grep — and the server-mode
validation crawl issued only GET requests. The row is consistent with a genuine
submission through the live site, which remains fully operational.

Two consequences:

1. **The delta-migration step is necessary in practice, not just in theory.**
   Production accrues applications while the platform is built, so any snapshot
   is stale on arrival. `MIGRATION-PLAN.md` §4 step 5 already covers this; this
   is evidence it earns its place.
2. **Local development currently points at the production database.**
   `.env.local` carries the production Supabase URL and keys. Submitting the
   apply form on `localhost` would write a real row and upload real files to the
   production bucket. Nothing in this phase did so, but the hazard is live.

   `npm run check:isolation` fails against the current local configuration —
   correctly. Point local development at the staging project as soon as it
   exists, and treat the current arrangement as read-only-by-discipline until
   then.
