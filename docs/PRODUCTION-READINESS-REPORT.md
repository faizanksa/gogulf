# Production readiness report — Go Gulf website (final release candidate)

Updated 12 September 2026 after the final pre-cutover corrections. **Nothing has been
deployed to production, pushed to `main` or merged into `main`.** The previous version of
this report (commit aa68d44) holds the full page-by-page and design detail; this version
records the final state and what the cutover needs.

## 1. Final release-candidate commit

| | |
| --- | --- |
| Release candidate | the commit on `phase-2/redesign` that adds this version of the report — marked by the local tag **`rc/2026-09-12-final`** (not pushed; the exact SHA is given with the hand-over). It supersedes aa68d44 (`rc/2026-09-12`) |
| Application code | identical to **e2b01ae**; the release-candidate commit adds only this report, the Lighthouse summary and a code comment in `next.config.mjs` recording the inline-CSS experiment |
| Commits since aa68d44 | 16c04c9 address and policy wording; e2b01ae tests; the report commit |
| Tag safety | no CI workflows exist and Vercel deploys branches, not tags — a tag cannot trigger a deployment; kept local until approval |

## 2. Staging deployment

| | |
| --- | --- |
| URL | `https://staging.gogulf.co` — private (Vercel Authentication), `noindex` |
| Verified deployment | **`dpl_DvD1BWKJPZVZmiKZGGqWELmCBzzi`** (commit e2b01ae, Ready) — every staging result in this report is from it |
| Release-candidate commit | redeploys the same application code; its deployment id is given with the hand-over |
| Content check on the live staging site | 10 of 10: corrected About heading; Verify's registration note; `Organization` JSON-LD, no `EmploymentAgency`; footer address with G No-364 and no care-of line; no Google Fonts processor in the Privacy policy; no "recruitment services provider" in the Terms; no care-of text on Home, Contact or Verify; neutral service names; `llms.txt` registration note; `/travel` 404 |

## 3. Production commit

| | |
| --- | --- |
| `origin/main` | **7bb3093** — unchanged by this work |
| Production deployment | `dpl_8S7BZQ8xKWaNAw8aKFUF5JqJDcCK`, created 5 Sep 2026, aliases `www.gogulf.co` and `gogulf.co` |
| Build | static export; email through EmailJS; Supabase `gogulf` (`julbqkeyvzwluayokcdi`) |
| Live page | the pre-redesign site (h1 "Go Gulf. Get Hired.") |

## 4. Production safety result

**Production is unchanged.**

| Evidence | At the start of this work | Now |
| --- | --- | --- |
| `origin/main` | 7bb3093 | **7bb3093** |
| Deployment serving `www.gogulf.co` and `gogulf.co` | `dpl_8S7BZQ8xKWaNAw8aKFUF5JqJDcCK` (5 Sep 2026) | **`dpl_8S7BZQ8xKWaNAw8aKFUF5JqJDcCK`** (5 Sep 2026) |
| Live page (read-only request) | pre-redesign, h1 "Go Gulf. Get Hired." | **unchanged** — no redesigned content, no staging URL |

- Every push went to `phase-2/redesign` and `staging` only, fast-forward, after checking the
  branch, status, log, staging target and that `main` was not in the push. No tag was pushed.
- No production environment variable, Supabase project, database, storage, auth setting, DNS
  record, Resend or EmailJS setting was changed. The only production contact was read-only:
  page loads of `www.gogulf.co` and `vercel inspect` on the production domain.
- Every test submission and upload went to staging. The production-mode build was served
  locally, never deployed.

## 5. Address correction

The registered office comes from one place, `lib/legal.js`. The MCA record is kept whole
and structured; the public display omits only the care-of line.

| | |
| --- | --- |
| MCA record (unchanged) | C/o Asha Yadav, G No-364, Mishrapur Kursi Road, Jankipuram, Lucknow, Uttar Pradesh, India, 226021 |
| **Public display** | **G No-364, Mishrapur / Kursi Road, Jankipuram / Lucknow, Uttar Pradesh – 226021 / India** |
| Single line (policies, emails, JSON-LD) | G No-364, Mishrapur, Kursi Road, Jankipuram, Lucknow, Uttar Pradesh – 226021, India |

- The plot number **G No-364 is restored** (the previous candidate had dropped it with the
  care-of line; nothing in the legal source says it should be hidden).
- Every public place reads the same lines: footer company record, Contact, Verify, the five
  policies, the JSON-LD `PostalAddress`, `llms.txt` and the email footers.
- Repository search: "C/o Asha Yadav" and "Asha Yadav" appear only in `lib/legal.js` (the
  record, never rendered), `docs/LEGAL-DATA-MIGRATION.md` (internal) and the guard test.
  "C/o" appears nowhere else. `content/public-claims.test.ts` fails if either reaches a
  public source or string, and asserts the exact public lines; no built HTML, server-component
  payload or JavaScript file contains "Asha Yadav" or "C/o Asha"; the production-mode build's
  footer shows "G No-364, Mishrapur, Kursi Road, Jankipuram, Lucknow…".

## 6. Recruitment-agency positioning audit

The company is not registered or licensed as a recruitment agency or recruiting agent.

- **Structured data:** the company is a plain `Organization`. No `EmploymentAgency`, no
  licence, no licence number anywhere.
- **Pages and copy:** nothing claims or implies registration, licensing, government or MOFA
  approval, or direct recruitment approval. Services are described by what they are — Gulf
  job applications, job matching, interview coordination, visa and documentation help,
  medical coordination, attestation and embassy formalities, immigration paperwork guidance,
  travel arrangements, pre-departure briefing; for employers, hiring support, bulk candidate
  sourcing, recruitment support, candidate screening, HR support.
- **Verify:** shows what a CIN proves (the company is registered) and says it is not a
  licence for a line of business. No licence section.
- **Not over-corrected:** no page says "we are not a recruitment agency".
- **Flagged for legal review, not guessed:** whether these services may be offered without a
  recruiting-agent registration under Indian law (section 19).

## 7. Policy audit

All five policies were reviewed for wording that could imply recruitment-agency status. The
legal substance is unchanged; only the descriptions changed.

| Policy | Before | After |
| --- | --- | --- |
| Terms | "We are a recruitment services provider." | "We provide support services to job seekers and employers." |
| Terms, Privacy, Shipping | "our recruitment services", "the recruitment and related services" | "our services" |
| Terms, Pricing | "Any fee charged in connection with overseas recruitment or emigration services is subject to the limits … imposed by applicable Indian law …" | "Any fee we charge for a service is subject to the limits … imposed by applicable Indian law …" (the legal limit still applies to every fee) |
| Terms, Privacy | "authorised recruitment partners", "recruitment and sourcing partners" | "partners working with us on the requirement", "sourcing partners" |
| Terms | heading "The recruitment process"; "authorised to recruit" (of employers) | "The application and hiring process"; "authorised to hire" |
| Terms | "Overseas recruitment attracts impersonators." | "Offers of overseas jobs attract impersonators." |
| Privacy | "Our business is overseas recruitment"; "Recruitment naturally involves…"; "Recruitment does not work unless…"; "Candidate and recruitment information" | "Our work concerns jobs outside India"; "An overseas job application involves…"; "An application cannot progress unless…"; "Candidate and application information" |
| Shipping | "…is a recruitment services company"; "recruitment and mobilisation work"; employer list "bulk manpower recruitment, recruitment process outsourcing" | "…provides services to job seekers and employers"; "work performed by our team"; "candidate sourcing, including at volume, recruitment support" |
| Pricing | "job placement support"; "bulk manpower recruitment, recruitment process outsourcing (RPO) … HR & recruitment support"; "bulk manpower mobilisation, RPO delivery" | "job-application and job-matching support"; "bulk candidate sourcing, recruitment support … HR support"; "sourcing at volume, recruitment support" |
| Cancellation | "professional recruitment and mobilisation services" | "professional support services" |
| **Privacy — Google Fonts** | listed as a processor that receives visitors' IP addresses | **removed** — fonts are self-hosted (downloaded at build, served from the site's own domain); no font request reaches Google |

Earlier in this pass: the unapproved "1–2 business days" response time, "There are no hidden
charges" and "genuine, screened opportunities" were removed. The policy effective date is
12 September 2026. **These wording changes need legal sign-off** (section 19).

## 8. Claims audit

Final scan of every public source — pages, components, content, metadata, JSON-LD,
`llms.txt`, sitemap, footer, policies, FAQs, all translation catalogues, accessibility
labels, Open Graph and structured data — plus the built output.

| Checked for | Result |
| --- | --- |
| Placement numbers, candidates placed | none |
| Years of experience, "since <year>", 20+ years | none (job listings' own requirements aside); 2008 is not shown anywhere |
| Numbers of countries, sectors or industries | none |
| Response times | none |
| Employer or partner networks, verified employers | none |
| Guarantees of selection, employment, visa, placement or joining | none — every mention is a "we do not guarantee" |
| Approval, licensing, MOFA approval or compliance, government approval, eMigrate, Protector of Emigrants | none |
| Recruitment agency, recruiting agent, RA or recruitment licence | none |
| Offices outside Lucknow, testimonials | none |

`content/public-claims.test.ts` encodes every pattern above and runs with the unit tests
(it scans pages, components, content, every catalogue, structured data, the share image,
the form copy and the email templates, with line-wrapped phrases read as rendered). The built
output — every HTML page, server-component payload and JavaScript file — contains none of
"Asha Yadav", `EmploymentAgency`, "Recruiting Agent", "recruitment agency", "recruitment
services provider", "licensed recruit", "1–2 business days", "no hidden charges" or
"Google Fonts".

## 9. Jobs status

- Every current listing is an **unconfirmed sample**. Production excludes unconfirmed content
  at build time (`lib/deployment.ts`: a Vercel production build is `production`).
- In production the samples are not listed, have **no page** (`/jobs/<slug>` is a 404: the
  job pages are generated only for visible jobs, with `dynamicParams = false`), are not in the
  sitemap, and produce no `JobPosting`. `/jobs` and the home page show the truthful empty
  state — "No jobs are listed right now" — with a general application and WhatsApp.
- **Proven on a production-mode build** (`npm run build:production-stage`, served locally —
  never the live site), 14 of 14 checks:

  | Check | Result |
  | --- | --- |
  | `/jobs` | 200 — "No jobs are listed right now"; no sample job, no "Unconfirmed" flag |
  | Home page | the same empty state; no sample job |
  | A sample job's URL (`/jobs/site-supervisor-saudi-arabia`) | **404** |
  | Sitemap | no sample job; its only job URLs are `/jobs` and `/jobs/apply` |
  | Structured data | `Organization`; no `JobPosting` on any page |
  | Pseudo-locales `/en-XA`, `/ar-XB/jobs` | 404 |
  | `robots.txt` | allows indexing (production rules) |
- Nothing invented: no employers, salaries, benefits, deadlines, locations or requirements
  beyond what a listing carries. A confirmed listing needs a closing date and an employer
  disclosure (schema-enforced).

## 10. Travel status

Gated. `/travel` has no route (404), Travel is absent from the navigation and sitemap, and
the structured data does not claim `TravelAgency`, until a travel service is confirmed
(decision D2). No packages, destinations, prices, tickets, hotels, visa packages or tours
exist anywhere in the code.

## 11. Multilingual status

| Language | Status |
| --- | --- |
| English | source, published |
| Hindi, Arabic, Malayalam | prepared for native review — catalogues not started (0 of 595 keys); not published |
| Tamil, Bengali | architecture only |

No language page is exposed until its catalogue is reviewed (routes are generated only for
published languages; an unpublished language is a 404, never an empty page); the language
menu appears only when a second language is published; nothing is machine-translated. The
pseudo-locales used for testing exist only outside production — on a production-mode build
`/en-XA` and `/ar-XB/jobs` return 404, and no pseudo-locale appears in the sitemap or in
hreflang. Arabic keeps full right-to-left support (section 12).

## 12. Accessibility

On the final staging deployment and locally:

| Check | Result |
| --- | --- |
| axe-core, WCAG 2.0/2.1/2.2 A and AA — every public page, the sign-in pages, the 404 and the right-to-left and lengthened pseudo-locale pages, phone and desktop | no serious or critical violation |
| Form error states (axe on each form's error summary) | clean — contact, service enquiry, employer requirement, job application |
| Keyboard | skip link; the mobile menu and language menu are disclosures (Enter opens, Escape closes and returns focus); error summaries take focus and link to each field |
| Visible focus | a 2 px focus ring on every interactive element, including on dark bands |
| Touch targets | every navigation target at least 44 px; buttons 48 px |
| Reflow (no sideways scrolling) | **every page at 320, 375, 390, 430 and 640 px**, and the pseudo-locale pages — right-to-left and lengthened — at those widths and 1024 px |
| Semantics | one h1 per page (50 of 50); landmarks; real lists; `aria-invalid` and `aria-describedby` on fields in error; phone numbers, CIN and GSTIN isolated left-to-right in RTL |
| Lighthouse accessibility | see section 14 |

## 13. SEO

Checked by `seo.spec.ts` and `i18n.spec.ts` on the final staging deployment and locally, and
on the production-mode build:

| Check | Result |
| --- | --- |
| Title and description | unique on every page, from the page registry; no `meta keywords` |
| Canonical | self-referencing on every page (production's will be `https://www.gogulf.co/...`) |
| hreflang | published languages only — English; pseudo-locales never appear |
| Sitemap | indexable pages with content dates; no sample job, no `/travel`, no pseudo-locale (production-mode build: job URLs are only `/jobs` and `/jobs/apply`) |
| robots.txt | production-mode build: indexing allowed, `/admin`, `/portal`, `/api/` disallowed, sitemap linked; staging: disallow all |
| H1 | exactly one on every prerendered page (50 of 50) |
| Breadcrumbs | `BreadcrumbList` matches the visible breadcrumbs |
| Organization schema | type `Organization` — **not** `EmploymentAgency`; legal name, CIN, `foundingDate` 2024-02-22, the public address (with G No-364, without the care-of line), confirmed contact points; no GSTIN, no `sameAs`, no licence or agency wording |
| JobPosting | only on a confirmed, open English job page — none exists, so none is emitted in production |
| Open Graph / X | title, description, URL, locale, 1200 × 630 image (123 KB) with alt text; `summary_large_image` |
| Metadata claims | none unsupported (built-output scan and `content/public-claims.test.ts`) |

Lighthouse scores SEO 69 on staging only because staging is `noindex` by design.>

## 14. Performance

**Final measured result** — Lighthouse 13.4.1 on the final staging deployment, mobile preset
(simulated slow 4G, 4× CPU), median of 3 runs, the same 15 routes and method as Phases 2B and
2C (`perf/rc2-lighthouse.json`):

| | Phase 2B | Phase 2C | Release candidate |
| --- | --- | --- | --- |
| Performance | 75–82 | 78–96 | 77–94 |
| LCP | 4.7–5.4 s | 1.8–4.7 s | 2.6–4.9 s (home **2.6 s** in this run) |
| TBT | 66–154 ms | 34–376 ms | 56–172 ms |
| CLS | 0 | 0 | **0** |
| Accessibility | 99–100 | 100 | **100 on all 15 routes** |
| Best practices | 100 | 100 | 100 |
| Transfer | 432–531 KB | 356–468 KB | **354–404 KB** |
| Fonts | 199–210 KB | 112–123 KB | 112–123 KB |

**JavaScript and CSS** (gzip, `perf/rc2-local-bundle.json`): shared 135.9 KB (budget 120 KB —
Next.js's runtime alone is 126.8 KB); form pages 141.0–142.6 KB (budget 150 KB — met,
including `/jobs/apply`, down from 203.9 KB); CSS 12.4 KB; preloaded fonts 70.6 KB (budget
120 KB — met).

**Reading the LCP numbers honestly.** Lighthouse's simulated LCP on this setup is bimodal:
pages land at about 2.1–2.6 s or 4.2–4.9 s from one run to the next. Between the previous
candidate and this one only policy text changed, yet the home page moved from 4.4 s to 2.6 s
and `/pricing` from 2.1 s to 4.7 s. Measured locally (no proxy) the home page's LCP was
3.4–3.8 s, and the LCP element is the hero's lead paragraph, delayed by render-blocking CSS
and by framework JavaScript running before first paint under the 4× CPU throttle.

**The final optimisation pass:** inlining the CSS (`experimental.inlineCss`) removed the
render-blocking requests but moved the local home LCP only ~0.3 s — within noise — while the
HTML grew from ~122 KB to ~299 KB uncompressed (Next.js carries the CSS twice) and every page
lost stylesheet caching. **Not adopted**, to keep the release stable; the experiment is
recorded in `next.config.mjs`. Changes that did stay: the heading font no longer forces a
repaint, and the upload library loads only when needed — the worst TBT fell from 376 ms (2C)
and the heaviest page from 468 KB to 404 KB.

**Against the 2.0 s LCP budget: not met in the lab.** Measure field data (real devices, no
staging proxy) after launch before investing further.

## 15. Forms

Regression only — nothing in the form code changed in this round.

| Layer | Result |
| --- | --- |
| Unit tests (`lib/forms`, `lib/email`, `lib/rate-limit`) | pass — validation, honeypot, rate limit, header-injection and forged-recipient protection, desk routing, notification and acknowledgement handling |
| e2e (local and staging) | pass — error summaries and their order, focus, exact payloads, the language header, the application receipt carrying the server's reference |
| **Real synthetic submissions on the final staging deployment** (`dpl_DvD1BWKJPZVZmiKZGGqWELmCBzzi`, each page's own UI, acknowledgements to careers@gogulf.co) | **Contact, Service enquiry, Employer requirement, Job application: all four HTTP 200, `ok`, internal notification sent, customer acknowledgement sent** |

Your own manual check (submission → admin receipt → customer receipt) stands; the server code
behind it is unchanged. No submission touched production.

## 16. Resend

The email architecture was not rebuilt or migrated. Staging sends every form's internal
notification and customer acknowledgement through Resend with a staging-only sending key
restricted to `gogulf.co`. **Production email is untouched** — it still runs EmailJS from its
static build until the cutover. On the final staging deployment all four forms reported both
emails sent (section 15). At cutover, production needs its own sending-only Resend key and the
`RESEND_*` variables (section 20, step 5).

## 17. Security

| Check | Result |
| --- | --- |
| `npm run check:secrets` — the 7 server-only secret values the build uses, searched for in every client file | **PASS** — 125 files, none found |
| `npm run check:isolation` — can this environment reach the production database? | **PASS**. On Vercel the same guard runs before every non-production build and fails it if it points at production |
| `npm run db:validate` | **PASS** — all 10 migrations parse |
| Build checks | server-mode build and production-mode build both succeed; lint and typecheck clean |
| Production credentials or data in staging | none: staging uses its own Supabase project (`gogulf-staging`, synthetic data only) and its own Resend key; the production Supabase ref appears in code only inside the two isolation guards |
| `NEXT_PUBLIC_*` | only the site URL and the Supabase URL and anon key — public by design, bounded by RLS |
| Service-role key | read only in `lib/supabase/admin.ts`, which imports `server-only` (a browser import is a build error); no code path uses it; not set on Vercel |
| API surface | three form routes and `llms.txt`; no debug, test or admin endpoints |
| Form handling (unit-tested) | server-side validation, honeypot, rate limit, header-injection guard, recipients derived server-side (a forged address cannot reroute mail) |
| Uploads | private bucket, anon insert-only, 10 MB limit |
| Auth guard for `/admin` and `/portal` | **pass on staging against its real Supabase**: anonymous visitors are redirected to sign-in and never indexed; a forged session cookie is treated as anonymous; email + password sessions reach neither area, with or without a staff record. Locally the signed-in test cannot run while the local Supabase stack (Docker) is stopped — an environment limit; the other guard tests pass locally |
| Built output | no care-of line, agency or licence wording, removed claims, or "Google Fonts" |

## 18. Migration status

Staging: `0001`–`0010` applied, both SQL suites passing (129 checks). Production: `0001`
only, per `docs/STAGING.md` — **not re-verified live** (this project has no production
database credentials, by design); confirm with the owner's read-only
`supabase migration list` before cutover.

| # | Purpose | Needed for the website cutover? |
| --- | --- | --- |
| 0001 | `job_applications` table, private `job-applications` bucket (10 MB), anon insert-only | **Yes — already on production** |
| 0002 | Platform foundation: extensions, helpers, org structure, RBAC | No — staff platform |
| 0003 | Unified identity | No |
| 0004 | Cases, activity timeline, tasks | No |
| 0005 | Immutable audit trail | No |
| 0006 | RLS helpers and the JWT claims hook | No |
| 0007 | Row Level Security policies | No |
| 0008 | Seed roles, permissions, grants | No |
| 0009 | Security hardening (touches nothing in `job_applications`) | No |
| 0010 | Audited writes survive empty JWT claims | No |

**The website cutover needs no production migration.** `0002`–`0010` are required before the
staff area (`/admin`, `/portal`) is used — a separate, approved change with a backup, applied
in order, then both SQL suites (`rls.test.sql` 46 checks, `rbac-behaviour.test.sql` 83).

## 19. Remaining business and legal decisions

1. **Legal review of the service model (most important).** Whether the company may offer the
   services the site describes without a recruiting-agent registration under Indian law.
   The site no longer claims or implies registration; a lawyer should confirm the service
   descriptions and the policy wording.
2. **Legal sign-off on the policy wording** changed in this pass (section 7).
3. **Real job listings** with confirmed employers — or an explicit decision to launch with the
   empty jobs state.
4. **Service names and About wording** as reworded — confirm.
5. **D2** travel services; **D3** the 2008 heritage (whose experience, under what name),
   countries and sectors served; **D8** the GST certificate.
6. **Social profiles:** ownership of the WhatsApp channel, YouTube, Facebook, Instagram,
   LinkedIn and TikTok profiles (none is linked until confirmed).
7. **Native reviewers** for Hindi, Arabic and Malayalam.
8. **Function region:** functions in Mumbai, database in Tokyo — accept, move functions to
   Tokyo, or plan a database move.
9. The tagline "Go Gulf. Get Hired." is a brand line, not a promise — keep or change.

## 20. Exact steps required for production cutover

Only after every business/legal item above that you choose to require is settled and
explicit approval is given.

**Before:**

1. Confirm the release-candidate commit is what staging runs and that its final suite passed.
2. Owner, read-only: `supabase migration list` on production (expect `0001`); confirm the
   `job_applications` columns and the `job-applications` bucket (10 MB, private) exist.
3. Back up production Supabase (database dump and storage object list). Record the current
   production deployment id `dpl_8S7BZQ8xKWaNAw8aKFUF5JqJDcCK` for rollback.
4. Resend: create a **production** sending-only key restricted to `gogulf.co`.
5. Vercel, **Production scope only**:
   - set `PLATFORM_MODE=server`, `NEXT_PUBLIC_SITE_URL=https://www.gogulf.co`,
     `RESEND_API_KEY` (the new key, sensitive), `RESEND_FROM_EMAIL=Go Gulf <no-reply@gogulf.co>`,
     `RESEND_REPLY_TO=careers@gogulf.co`;
   - confirm `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are production's;
   - leave `APP_ENV` unset; do not set `SUPABASE_SERVICE_ROLE_KEY`;
   - keep the `NEXT_PUBLIC_EMAILJS_*` variables for now (the rollback deployment uses them).
6. Decide the function region (section 19, item 8).

**Cutover:**

7. Fast-forward `main` to the release-candidate commit (both `main` and `origin/main` are its
   ancestors; no merge commit): `git push origin <rc-sha>:main`. Vercel builds production.
8. Watch the build reach Ready.

**Verify on production:**

9. Read-only: every page renders; `robots.txt` allows indexing; `sitemap.xml` lists `www`
   URLs; canonicals and Open Graph use `https://www.gogulf.co`; no staging URL anywhere;
   `/jobs` shows the empty state and a sample job URL is a 404; `/en-XA` and `/ar-XB` are
   404s; the footer shows the public address.
10. With your approval for production test submissions: one contact, one service enquiry, one
    employer requirement and one job application from an internal test identity; confirm the
    admin receipt, the customer receipt, and the application row and files in production
    Supabase; then delete the test records.

**After 24–48 hours stable:**

11. Delete `NEXT_PUBLIC_EMAILJS_*` and `NEXT_PUBLIC_EMAIL_PROVIDER`; resubmit the sitemap in
    Search Console; review Resend and Vercel logs.

**Rollback:** Vercel Instant Rollback to `dpl_8S7BZQ8xKWaNAw8aKFUF5JqJDcCK` (a complete
static build with its EmailJS values inlined). In git, restore with a revert commit, never a
force-push. The website cutover changes no database schema, so there is nothing to roll back
there; test rows are deleted by id.

---

## TECHNICAL BLOCKERS

**None.** Every automated check passes on the release candidate: lint and typecheck; 157 of 157
unit tests; the full e2e suite on the final staging deployment (164 passed, 0 failed); real
submissions of all four forms through Resend on staging; secret scan, isolation guard and
migration validation; the production-mode build's 14 checks.

Known technical limits — documented, not blocking:

- **Home LCP is above the 2.0 s budget** in Lighthouse's lab simulation (section 14). The
  remaining delay is framework JavaScript executing before first paint under a 4× CPU
  throttle; the one available lever (inline CSS) was measured and did not justify its cost.
  Measure field data after launch.
- **Shared JavaScript is 135.9 KB** against a 120 KB budget; Next.js's runtime alone is
  126.8 KB.
- **One local e2e test** (a signed-in session against the auth service) needs the local
  Supabase stack, which was stopped on the development machine; it passes on staging.
- **`next start` logs `NoFallbackError`** when a request hits a job or language that was not
  generated; the response is the correct 404. Watch Vercel's runtime logs after launch.
- **Uploads still go browser → Supabase Storage** (two-phase, by design; server-side uploads
  are Phase 5).
- **Production's migration state** is documented, not re-verified live (no production database
  credentials here, by design) — the owner confirms it read-only at cutover step 2.>

## BUSINESS / LEGAL DECISIONS (must be settled by the business before cutover)

1. Legal review of the service descriptions against the company holding no recruiting-agent
   registration.
2. Legal sign-off on the policy wording changed in this pass.
3. Real, confirmed job listings — or an explicit decision to launch with the empty state.
4. Explicit production approval.

Recommended but not blocking: confirm the service names and About wording; decisions D2, D3,
D8; social-profile ownership; the function region; native reviewers (translations publish
one language at a time after launch).

## Production cutover checklist

- [ ] Business/content approval
- [ ] Legal/content approval
- [ ] Real job data approved (or the empty state accepted)
- [x] Recruitment-agency wording audit complete (legal review of the service model still open)
- [x] Address audit complete (care-of line removed, plot number shown)
- [ ] Hindi content reviewed (not required for an English launch)
- [ ] Arabic content reviewed (not required for an English launch)
- [ ] Malayalam content reviewed (not required for an English launch)
- [x] Production migrations reviewed (none needed for the website; live state to confirm with the owner)
- [ ] Production Vercel variables reviewed
- [ ] Resend production configuration reviewed
- [ ] Production Supabase configuration reviewed
- [ ] DNS verified (no change needed; confirm at cutover)
- [ ] Final E2E passed
- [ ] Final accessibility passed
- [ ] Final SEO passed
- [ ] Final performance passed
- [ ] Production safety verified
- [ ] Backup/rollback plan verified
- [ ] Explicit production approval received
