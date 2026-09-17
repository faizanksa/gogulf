# Phase 3 — staging release: Admin/CRM and job management

**17 Sep 2026.** Deployed to `https://staging.gogulf.co`, running against **Mumbai staging
`noxireidrbeqcvsirjec`**. Nothing was changed in production. Design and rules:
[`docs/JOBS.md`](JOBS.md). Staging setup and rollback: [`docs/STAGING.md`](STAGING.md) §1a.

## Release report

| # | Item | Result | Evidence |
| --- | --- | --- | --- |
| 1 | Git commits | PASS | `2299f14` db · `625c9c1` public jobs · `0fa1c0d` admin · `8a60e82` tests + seed · `5736d0b` docs · plus this report. Branch `phase-2/redesign`, fast-forwarded to `origin/staging`. `main` untouched |
| 2 | Staging deployment | PASS | `gogulf-5qxo60ec1` (Preview, branch `staging`) → alias `staging.gogulf.co`, Ready |
| 3 | Staging Supabase ref | PASS | `noxireidrbeqcvsirjec`. Build log: `Supabase API: project noxireidrbeqcvsirjec — PASS`. `scripts/verify-staging-deployment.mjs`: 11 client chunks name exactly one project, Mumbai staging; no trace of `wxolbnhyzktfjdvcnixc`, `julbqkeyvzwluayokcdi` or `exsnksrmkycloxiajwmx`; the server renders Mumbai-only test jobs |
| 4 | Migrations applied | PASS WITH NOTES | `0012_jobs.sql`, `0013_job_applications_bridge.sql`. The CLI again printed its pg-delta certificate error after applying; `schema_migrations` reads `0001`–`0013` |
| 5 | Schema verification | PASS | 24 public tables, all RLS; 65 policies (+10); paid-access CHECK present; anon: `jobs.title` readable, `internal_notes` not, no table-wide SELECT; `job_applications`: anon may insert `job_id` but not `status`, cannot read; storage staff read policy present; triggers and functions present; 14 applications and 3 staff unchanged |
| 6 | SQL assertions | PASS | **280/280** on Mumbai staging and on a from-empty local reset (`jobs.test.sql` 130, `rbac-behaviour.test.sql` 84, `rls.test.sql` 66) |
| 7 | Unit tests | PASS | **201/201** (15 files) |
| 8 | E2E | PASS WITH NOTES | Local: 125 passed, 0 failed; axe 64/64, no serious/critical violation. Staging: 125 passed — 3 failed first on network timeouts to Vercel's edge and passed when rerun alone. 39 skips are viewport-scoped by design |
| 9 | Lint / typecheck / build | PASS WITH NOTES | lint clean; typecheck clean; `build:server` and `build:production-stage` pass; `check:secrets` 132 files, none. Static `npm run build` fails on `/opengraph-image` (Phase 2C route, pre-existing) — not a gate on this branch (decision D9) |
| 10 | RLS / security | PASS | Behaviour tests as anon, non-staff, VIEW_ONLY, RECRUITER, MARKETING, HR, ADMIN, SUPER_ADMIN; hosted REST probes: closed-job application 400, anon `status` 401, anon read 401, draft invisible, `internal_notes` 401 |
| 11 | Auth / RBAC | PASS WITH NOTES | Google sign-in (PKCE) + `/auth/callback` built; staging auth read back (site URL, allow-list, sign-ups closed, Google on, hook on). ADMIN manages jobs; cannot manage roles or permissions, promote itself, alter a SUPER_ADMIN or insert audit entries. A real Google sign-in through the new UI awaits your manual QA; careers@ and admin@ remain Google-pending |
| 12 | Jobs module | PASS | Create, edit, preview, review, publish, unpublish, close, reopen, archive, restore, duplicate, feature/unfeature with expiry, categories; readiness shown before publish; ADMIN write cycle proven locally with a real ADMIN-shaped token, audited per action |
| 13 | Public Jobs | PASS | Featured / ongoing & general / professional groups; filters only with real choice; card and detail state only supplied facts; closed jobs explain themselves; drafts/archived 404; JobPosting only on open jobs; sitemap lists open jobs only; apply by reference records `job_id` |
| 14 | Audit | PASS | `job.*` actions with staff email, changed fields only; triage and conversion audited without PII; document opening audited by kind; 12 seed jobs recorded as system |
| 15 | Synthetic staging data | PASS | `STG-JOB-001`…`012` (list below). Not a migration; runner refuses other targets (Mumbai production refusal verified); file refuses to run without the staging marker |
| 16 | Known issues | — | See below |
| 17 | Manual QA checklist | — | See below |
| 18 | Production changes | **NONE** | No Tokyo or Mumbai production command; Vercel Production variables unchanged (timestamps 24h/4d); production deployment still `gogulf-mob4x494m`; `main` not pushed; no DNS or OAuth change |
| 19 | Blockers before production | BLOCKED (by design) | See below |

### Staging test jobs

| Ref | Title | Scenario |
| --- | --- | --- |
| STG-JOB-001 | STAGING TEST — Warehouse Helper | General · ongoing · published · free · salary |
| STG-JOB-002 | STAGING TEST — Mall Cleaner | General · time-limited (+30 days) · named employer · published |
| STG-JOB-003 | STAGING TEST — Accountant | Professional · time-limited · published · full detail |
| STG-JOB-004 | STAGING TEST — Site Supervisor | Professional · **featured** (+14 days) · ongoing · published |
| STG-JOB-005 | STAGING TEST — HVAC Technician | **Draft**, complete enough to submit |
| STG-JOB-006 | STAGING TEST — Sales Executive | **In review** |
| STG-JOB-007 | STAGING TEST — Helper | **Closed** |
| STG-JOB-008 | STAGING TEST — Civil Engineer | **Archived** |
| STG-JOB-009 | STAGING TEST — Labour | **Featured period ended** (2 days ago) · still published and free |
| STG-JOB-010 | STAGING TEST — Operations Manager (incomplete) | **Invalid publish attempt** — missing country, summary, employer, requirements |
| STG-JOB-011 | STAGING TEST — Mechanical Engineer (paid access) | **Paid application blocked** — in review, publish must be refused |
| STG-JOB-012 | STAGING TEST — Cleaner (apply on WhatsApp) | WhatsApp application method |

### Known issues

1. **Rotate the Vercel automation-bypass secret.** A failed staging request made Playwright
   print request headers, so the secret appeared in a local log and in the session output.
   The log was deleted. Project → Settings → Deployment Protection → regenerate.
2. The static `npm run build` fails (`/opengraph-image`, pre-existing); `check:all` still calls it.
   Drop it from `check:all` in the cutover commit, which removes static export anyway.
3. Admin screens were not driven by an automated signed-in browser: staff sessions require a
   real Google sign-in, which cannot be automated. The authorization underneath is proven by
   the SQL suites, the local ADMIN-token query probe and hosted REST probes; the UI needs your QA.
4. The 14 rehearsal applications have synthetic documents (random bytes by design), so opening
   their CV/passport shows an unreadable file. Submit a fresh staging application to test documents.
5. Pseudo-locale job pages (`/en-XA/jobs/…`, `/ar-XB/jobs/…`) exist only for jobs open at build.
   English job pages — what the public uses — are generated on request at once.
6. Not built yet: case stage changes, tasks and documents on cases; staff user management UI;
   job translations; employer records; a paid-application flow.
7. Tokyo staging `wxolbnhyzktfjdvcnixc` stays at `0011` and is no longer used by the web app.
8. `record_document_access` writes its audit entry before the signed link is issued; a Storage
   failure afterwards leaves an "opened" entry for a document that did not open.

### Blockers before production publication

1. Your manual QA and explicit staging sign-off.
2. Approved Tokyo → Mumbai cutover plan, including `0012`/`0013` on Mumbai production
   (`node scripts/db-remote.mjs --target=mumbai-production push --yes-i-am-provisioning-production`)
   and the SQL suites there — only while it still holds no live data, or with an approved backup.
3. Vercel **Production** Supabase variables switched to Mumbai production — at cutover only.
4. Production Google OAuth for `exsnksrmkycloxiajwmx` (redirect URI in `docs/GOOGLE-OAUTH.md`),
   production staff bootstrap, and a verified production sign-in.
5. careers@ / admin@ Google identity verification (Google side; not blocking staging).
6. Privacy review of converting applications into CRM contacts and cases (new processing of
   applicant data) before it is used on real applicants.
7. Real job content: publish only confirmed listings (decision D4), after the applications inbox
   has been exercised end to end on staging.
8. Rotate the bypass secret (known issue 1).

---

## Manual QA checklist

Staging is behind Vercel Authentication: sign in to Vercel first. Every screen that changes data
shows its result next to the button; the job page's **History** panel should gain an entry for
each change (SUPER_ADMIN and ADMIN can see it).

### Auth
- [ ] `https://staging.gogulf.co/admin` while signed out → sign-in page, no workspace content.
- [ ] **Sign in with Google** as `hello@gogulf.co` → lands on the dashboard. Header shows
      `hello@gogulf.co`, **Super Admin · Lucknow**, and **Staging · noxireidrbeqcvsirjec**.
- [ ] Sign out → "You have signed out"; `/admin` redirects to sign-in again.
- [ ] Sign in with a non-Workspace Google account (if the consent screen allows it at all) →
      back on the sign-in page, no workspace.
- [ ] When Google allows it: `careers@gogulf.co` signs in and shows **Admin**.
- [ ] `admin@gogulf.co` — not used; remains reserved SUPER_ADMIN.

### Admin
- [ ] Dashboard counts: Published 6, In review 2, Drafts 2, Closed 1; applications New 14.
- [ ] Navigation: Dashboard, Jobs, Categories, Applications, Contacts, Cases; current page highlighted.
- [ ] Phone width: navigation scrolls as tabs; tables become labelled cards; no sideways scroll.
- [ ] `/admin/jobs?status=published&q=STAGING` → filters and search in the URL survive a reload;
      Clear resets them; pagination text shows the count.

### Jobs
- [ ] **Create:** New job → title "STAGING TEST — QA Draft", category Cleaner → Create draft →
      lands on the job, status Draft, reference `GG-JOB-2026-…`.
- [ ] **Edit:** add country, employment type, summary, employer Confidential → Save → "Changes saved".
- [ ] **Contradiction:** choose Time-limited, set a date, switch back to Ongoing, save → note that
      the closing date was removed.
- [ ] **Preview:** Preview button shows the public page with a "not public" banner; internal notes absent.
- [ ] **Invalid publish:** STG-JOB-010 → Submit for review → refused, listing country, employment
      type, summary, employer disclosure, closing date and requirements.
- [ ] **Draft → review → publish:** STG-JOB-005 → Submit for review → Publish → appears on `/jobs`.
- [ ] **Paid blocked:** STG-JOB-011 → Publish → refused: "Paid application access is not currently available".
- [ ] **Unpublish:** a published job → Unpublish → gone from `/jobs`, its page 404s.
- [ ] **Close:** STG-JOB-001 → Close → `/jobs` no longer lists it; its page says "This position has
      closed", no Apply button. **Reopen** → listed again.
- [ ] **Archive / Restore:** archive a closed job → hidden; Restore → back as Draft.
- [ ] **Duplicate:** STG-JOB-003 → Duplicate → new draft "(copy)", new reference, standard, no closing date.
- [ ] **Feature:** STG-JOB-002 → Feature with a date → appears in Featured opportunities on `/jobs`.
      **Unfeature** → back in its group. Application access stays Free.
- [ ] **Featured expiry:** STG-JOB-009 shows "Featured period ended"; on `/jobs` it is in general
      hiring with no Featured label.
- [ ] **Reference lock:** on a published job the reference field is disabled.
- [ ] **Categories:** add "QA Welder" (general) → selectable in the job form; Deactivate → no longer offered.

### Job types
- [ ] Ongoing (STG-JOB-001): "Ongoing hiring — no closing date"; card "Ongoing hiring".
- [ ] Time-limited (STG-JOB-002/003): "Applications close" with the date; card "Apply by …".
- [ ] General cards on the tinted surface; professional cards white with a "Professional" label.
- [ ] Free application: card "Free to apply"; job page "Free — there is no fee to apply".
- [ ] Paid: never visible publicly; no price, no Pay button anywhere.

### Public
- [ ] `/jobs`: groups Featured opportunities, Ongoing and general hiring, Professional
      opportunities; no drafts/review/closed/archived; no "closing soon" or "only N left".
- [ ] Filters: Country Qatar → 1 job; URL updates; reload keeps it; Clear filters restores.
- [ ] Job page STG-JOB-003: facts first (salary, location, category, opportunity type, vacancies,
      experience, education, languages, availability, closing date, published, updated, reference).
- [ ] Apply CTA → `/jobs/apply?ref=STG-JOB-003` shows the job and reference.
- [ ] `/jobs/apply?ref=STG-JOB-007` (closed) → "This job is not accepting applications", general form.
- [ ] STG-JOB-012 → "Apply on WhatsApp" opens WhatsApp with the reference.
- [ ] Mobile: `/jobs`, a job page and the apply form at phone width; sticky Apply bar on job pages.
- [ ] SEO: view source of STG-JOB-003 → one JobPosting, `validThrough` = closing date; STG-JOB-007 →
      no JobPosting, `noindex`; `/sitemap.xml` lists open jobs only.

### CRM
- [ ] **Application → job:** submit a real staging application to STG-JOB-002 (your own @gogulf.co
      email, small PDF/PNG) → receipt shows the job reference.
- [ ] `/admin/applications` → the new application, job linked, status New; `/admin/jobs` shows
      Applications 1 for STG-JOB-002, linking to the filtered inbox.
- [ ] Open CV and passport → each opens; History shows "Document opened (cv/passport)".
- [ ] Assign to careers@ (when available) or hello@; set Screening → History entries.
- [ ] **Application → contact → case:** Create contact and case → "Opened case GG-REC-…";
      contact page shows phone and email identities; case page shows the job and stage New.
- [ ] Submit a second application with the **same phone** → converting it joins the same contact
      with a new case (no duplicate person).
- [ ] Close STG-JOB-002 → its applications remain in the inbox and on the contact.

### Security
- [ ] Signed out: `/admin/jobs`, `/admin/applications`, a document link → sign-in page.
- [ ] As ADMIN (careers@, when available): jobs fully manageable; no role or permission
      management exists in the UI; the database refuses role changes (SQL-proven).
- [ ] A draft job's public URL → 404 even when you know the slug.
- [ ] History on a job shows who did what and when; there is no way to edit or delete an entry.
