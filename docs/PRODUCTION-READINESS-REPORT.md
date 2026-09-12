# Production readiness report — Go Gulf website

Prepared 12 September 2026 on `phase-2/redesign`. **Nothing here has been deployed to
production, pushed to `main` or merged into `main`.** This report proposes a release
candidate and lists what a production cutover would require; the cutover itself waits for
explicit approval.

## 1. Executive summary

The redesigned website is a production release candidate on staging. Since Phase 2C it has
had a final correction and readiness pass:

- **Public address:** the registered office is shown without the "C/o Asha Yadav" line, from
  the one central source; the full MCA record is kept intact.
- **Positioning:** nothing on the site claims or implies that Go Gulf is a registered or
  licensed recruiting agency — the structured data, headings, service names and copy that
  implied it are reworded neutrally, and a unit test scans every public source so the
  wording cannot return.
- **Unapproved statements removed:** the "1–2 business days" response time, "no hidden
  charges", "genuine, screened opportunities", "one point of contact".
- **Performance:** `/jobs/apply` no longer ships the upload library with the page (203.9 →
  142.6 KB of JavaScript), and the worst blocking time fell from 376 to 113 ms. The heading
  font no longer forces a repaint; Lighthouse's simulated LCP did not reflect it, and home
  LCP (4.4 s) remains over budget (section 27).
- **Verification:** typecheck and lint clean; 156 of 156 unit tests; the full e2e suite
  (184 tests; 158 passed, 0 failed, the rest device-specific skips) on the local build and
  again on staging; real submissions of all four forms on staging, each notified and
  acknowledged through Resend; secret scan, isolation guard and migration validation pass;
  Lighthouse accessibility 100 and CLS 0 on all 15 routes.

The code is ready. **Production is not yet ready to switch**, for business and legal reasons
only (section 34): chiefly a legal review of how the services are described in view of the
company not holding a recruiting-agent registration, and real, confirmed job listings.

## 2. Current staging URL

`https://staging.gogulf.co` — private (Vercel Authentication), `noindex`, its own Supabase
project and a staging-only Resend key.

## 3. Release-candidate commit

| | |
| --- | --- |
| Release candidate | the commit on `phase-2/redesign` that adds this report — marked by the local tag **`rc/2026-09-12`** (the tag is not pushed; the exact SHA is given with the hand-over) |
| Application code | identical to **f9ab870** — the commit after it changes documentation only |
| Staging deployment of that code | **`dpl_14MxvLrSK6HLoQBX4P6y5Ag5LUR7`**, Ready, aliased to `staging.gogulf.co` |
| Tag safety | the repository has no CI workflows and Vercel deploys branches, not tags, so a tag cannot trigger a deployment; it is still kept local until approval |

## 4. Git branch status

| Branch | Position |
| --- | --- |
| `phase-2/redesign` (local and `origin`) | the release candidate |
| `staging` (local and `origin`) | the release candidate — Vercel builds it to `staging.gogulf.co` |
| `origin/main` | **7bb3093** — unchanged; an ancestor of the release candidate |
| local `main` | b9ff284 — never pushed; also an ancestor of the release candidate |

Nothing on `main` is missing from the release candidate, so promoting it is a fast-forward
of `main`: no merge commit, no conflict. The working tree is clean; no temporary
screenshots, reports, benchmark files or credentials are tracked.

## 5. Production commit

| | |
| --- | --- |
| Branch | `main` → `origin/main` at **7bb3093**, unchanged by this work |
| Deployment | `dpl_8S7BZQ8xKWaNAw8aKFUF5JqJDcCK`, target production, created 5 Sep 2026, aliases `www.gogulf.co` and `gogulf.co` |
| Build | static export, email through EmailJS |
| Supabase | `gogulf`, ref `julbqkeyvzwluayokcdi` |
| Live page (read-only request) | the pre-redesign site: h1 "Go Gulf. Get Hired." |

## 6. Production safety verification

| Evidence | Before this pass | After this pass |
| --- | --- | --- |
| `origin/main` | 7bb3093 | **7bb3093** |
| Production deployment serving `www.gogulf.co` and `gogulf.co` | `dpl_8S7BZQ8xKWaNAw8aKFUF5JqJDcCK` (5 Sep 2026) | **`dpl_8S7BZQ8xKWaNAw8aKFUF5JqJDcCK`** (5 Sep 2026) |
| Live production page (read-only request) | pre-redesign, h1 "Go Gulf. Get Hired." | **unchanged** — no redesigned content, no staging URL |

- Every push went to `phase-2/redesign` and `staging` only, fast-forward, after checking the
  branch, the status, the log, the staging target and that `main` was not in the push.
- No production environment variable, Supabase project, database, storage, auth setting, DNS
  record, Resend or EmailJS setting was read for writing or changed. The only production
  requests were two read-only page loads and `vercel inspect` on the production domain.
- Every test submission and upload went to staging (`gogulf-staging`, its own Resend key).
- The staging build's isolation guard would have failed the build had it pointed at the
  production database.

## 7. Pages implemented

| Page | Status |
| --- | --- |
| `/` | Rebuilt: find a job (primary), hire from India (secondary), company facts, real jobs or an honest empty state, the two journeys, the ten-step process, fees and safety, services, close |
| `/jobs`, `/jobs/[slug]`, `/jobs/apply` | Rebuilt: filters with URL sync, job pages with facts first, the application form with an on-page receipt |
| `/candidates` | Job-seeker hub: steps, documents, fees, staying safe, common questions |
| `/employers` | Employer page with a structured requirement form |
| `/services` | Catalogue by audience; each service opens the enquiry form preselected |
| `/about`, `/contact`, `/verify` | Trust pages |
| `/privacy-policy`, `/terms-and-conditions`, `/pricing`, `/cancellation-and-refunds`, `/shipping-policy` | Presentation redesigned; wording changed only as recorded in section 17 |
| `/travel` | No route until a travel service is confirmed (decision D2) |
| 404 | Helpful page, server-rendered |
| `/admin`, `/portal` | Sign-in walls only (staff platform, Phase 3+) |

## 8. UX and design summary

Daylight, light-first; Go Gulf green; a strong ink hierarchy. Anek for headings, Mukta for
text, IBM Plex Mono only for data (CIN, GSTIN, references). No stock or AI photography and no
testimonials: the pages are typographic, with one drawing. Trust information is always one
step away — the CIN and "Verify Go Gulf" in the header's top bar, the company record in the
footer, a company-facts band on Home, Employers and About — without crowding the journeys.

Final homepage review (12 Sep): the page answers "what does Go Gulf help me do?" in its
heading and lead, and puts "Find a job" and "Hire from India" first. Corrected in this pass:
the employer promise "one point of contact" (not approved); "see the salary, the place and
the contract" (not every listing carries a salary, and none carries a contract); "a recruiter
looks at…" (now "our team"); the process step "Visa and MOFA" (now "Visa and attestation").

## 9. Jobs system

- Listings live in `content/jobs.ts`, each marked `confirmed` or `unconfirmed`.
- **Every current listing is an unconfirmed sample.** Staging shows them with an
  "Unconfirmed — not shown in production" flag; production builds hide them. At cutover,
  unless real listings are added, `/jobs` and the home page show the honest empty state
  ("No jobs are listed right now", with a general application and WhatsApp).
- Nothing is invented: requirements and benefits appear only when a listing carries them;
  salary only when the employer has shared it.
- `JobPosting` structured data only on a confirmed, open job's English page; never a computed
  expiry date.

## 10. Candidate experience

Home → Find a job → a job page (facts first) → Apply (CV and passport, 8 MB each) → a receipt
with the reference the confirmation email carries. `/candidates` explains the ten steps, the
documents needed now and later, how fees work, and how to spot someone using Go Gulf's name.
Help is always available on WhatsApp, with the job's reference prefilled.

## 11. Employer experience

`/employers` → services → the route from requirement to joining → working terms → the
company facts → a requirement form (company, location, roles, headcount, timeline,
accommodation, transport) that reaches the business desk. Commercial terms are agreed in
writing; requesting a quotation is free (Pricing & fees policy).

## 12. Services

The business's existing catalogue, grouped by audience. Names that implied agency status were
reworded (section 16); descriptions stay the business's. Every service links to the enquiry
form with itself preselected; the server routes each enquiry to the careers or business desk
from the service name, so a tampered request cannot reroute it.

## 13. Verify experience

`/verify` shows what anyone can check independently of Go Gulf: legal name, trade name, CIN,
company type, incorporation date, registrar, registered activity, the public registered
office and the GSTIN, with a link to the Ministry of Corporate Affairs site. It says plainly
that **a CIN shows a company is registered; it is not a licence for any line of business**.
There is no licence section, and none is implied. The page also lists the official contact
channels, the payment rules, and what to do if something does not feel right.

## 14. Legal identity

From `lib/legal.js`, the only source:

| | |
| --- | --- |
| Legal name | FAIZAN CHAUDHARY GULF TRAVELS PRIVATE LIMITED (displayed title-cased) |
| Trade name | Go Gulf |
| CIN | U52291UP2024PTC198095 |
| Incorporated | 22 February 2024 (the only founding date asserted anywhere, including `foundingDate`) |
| Registrar | ROC Uttar Pradesh I |
| Registered activity | Activities of travel agents and tour operators |
| GSTIN | 09AALCC6656L1ZY — on pages, not in structured data until the certificate is supplied (D8) |
| 2008 | Not shown. The heritage constant exists but is unused until the business confirms whose experience it is (D3) |

## 15. Public address format

| | |
| --- | --- |
| MCA record (kept whole in `lib/legal.js`) | C/o Asha Yadav, G No-364, Mishrapur Kursi Road, Jankipuram, Lucknow, Uttar Pradesh, India, 226021 |
| **Public display** | **Mishrapur Kursi Road, Jankipuram, Lucknow, Uttar Pradesh – 226021, India** |

The care-of line is structured as its own field (`careOf`), as is the premises number
(`premises`), which belongs to the care-of line and is also not displayed — following the
public format in the brief. Every public place reads the same public lines: header-free
footer company record, Contact, Verify, the five policies, the JSON-LD `PostalAddress`,
`llms.txt` and the email footers. `content/public-claims.test.ts` fails if "Asha", "C/o" or
the premises number reaches any public string or source. If the plot number should be shown,
it is a one-line change to `lines`.

## 16. Recruitment-agency positioning correction

The company is not registered or licensed as a recruiting agency. No page said so outright;
these implied it and were changed:

| Where | Before | After |
| --- | --- | --- |
| Organization JSON-LD | `@type: EmploymentAgency` | `Organization` |
| About heading | "A registered Indian company, recruiting for the Gulf" | "A Lucknow company helping people work in the Gulf" |
| About mission / vision | "recruitment services", "Gulf recruitment brands", "recruitment technology" | "support", "names for Gulf careers", "technology" |
| Services (names and enquiry values) | Overseas Recruitment; Gulf Job Placement; Bulk Manpower Recruitment; Recruitment Process Outsourcing; HR & Recruitment Support; MOFA & Embassy Processing | Gulf job applications; Job matching; Bulk candidate sourcing; Recruitment support; HR support; Attestation & embassy formalities |
| Forms, receipts, FAQ | "our recruitment team", "a recruiter" | "our team" |
| Employer copy | "through to deployment" | "for the candidates you select", "to joining" |
| Verify | staging note about a future recruiting-agent registration | removed; the "registration is not a licence" note added |
| llms.txt | "a recruitment services provider" | what Go Gulf does, and the same registration note |
| Claims register | `recruitingAgentRegistration: unresolved` | `refuted` — a new status for claims confirmed untrue |

Deliberately **not** done: no page says "we are not a recruitment agency". The wording
describes what the company does — job listings, applications, candidate support, employer
hiring enquiries, candidate sourcing and screening, interview coordination, documentation
support — and the brief's allowed phrase "recruitment support" is used once, for employers.

Flagged for legal review rather than changed (section 34): the policies describe "our
recruitment services" and say fees for "overseas recruitment or emigration services" are
subject to legal limits.

## 17. Claims audit

Searched every public source (pages, components, content, catalogues, structured data,
metadata, share image, form copy, email templates, `llms.txt`) and the policies for: 20+
years, thousands of placements, direct approval, MOFA approval or compliance,
registered/licensed recruitment agency, recruiting agent, recruitment licence, RA licence,
government approval, verified employer network, guaranteed jobs/employment/visa/joining,
response-time promises, countries, industries, offices, placement statistics, testimonials.

| Found | Action |
| --- | --- |
| "1–2 business days" (Shipping policy) | Removed; no duration replaces it |
| "There are no hidden charges" (Terms) | Removed; "if a charge has not been stated to you in writing, it is not payable to us" kept |
| "presenting genuine, screened opportunities" (Terms) | Now "describing the opportunities we list accurately" |
| "One point of contact" (Home) | Replaced with what is true: requirements go to the business desk |
| Agency implications | Section 16 |
| Guarantees | None made; every page that touches outcomes says selection, employment, visa and joining are not guaranteed |

The policy effective date moved to 12 September 2026 because the shipping and terms text
changed. `content/public-claims.test.ts` now fails the build's unit tests if any of these
patterns returns to a public source.

## 18. Fees and safety messaging

Kept everywhere it appears: **"Every fee is quoted to you in writing before you pay."** Also:
pay only into an account confirmed in writing; government, embassy, attestation, medical and
travel costs are separate; no guarantee of selection, employment, visa, joining date, salary,
travel or refund outcome. "No hidden charges" is no longer used.

## 19. Multilingual architecture

English is the source (595 typed keys; a missing key fails the typecheck). Each language has a
catalogue in `messages/<code>.json`; a catalogue publishes only when its `$meta` records
status `reviewed`, a reviewer and a date. Every rebuilt page (nine) takes all its words from
the catalogue; the policies stay English-only until a legal review signs off a translation.
Language routes (`/hi/…`, `/ar/…`, `/ml/…`, `/ta/…`, `/bn/…`) are generated only for
published languages, so an unpublished language is a 404, never an empty page. The language
menu and suggestion appear only when a second language is published. Pseudo-locales
(`en-XA`, `ar-XB`) exercise every page on local and staging builds only.

## 20. Hindi readiness

Catalogue: not started (0 of 595). Devanagari faces for Anek and Mukta are already configured
(not preloaded). To publish: a native reviewer translates `messages/hi.json` (including
`pages.<id>` titles and descriptions and `services.items.<id>`), job translations are added in
`content/jobs.ts`, `$meta` is marked reviewed, and the i18n tests plus a native read on staging
pass (`docs/I18N.md`).

## 21. Arabic readiness

Catalogue: not started. Right-to-left layout is ready (section 24). To publish: reviewed
`messages/ar.json`, Noto Sans Arabic declared in `app/fonts.ts` with its `:lang(ar)` stack, the
digits decision (Western or Arabic-Indic), then the RTL checks on real Arabic text.

## 22. Malayalam readiness

Catalogue: not started. To publish: reviewed `messages/ml.json` and Anek Malayalam in
`app/fonts.ts`, then the same checks.

## 23. Tamil and Bengali future readiness

Architecture only: catalogues exist (not started), codes and routes are defined, and the fonts
to add are named (Anek Tamil, Anek Bangla). No redesign is needed to add them.

## 24. RTL status

Document-level `dir="rtl"`, logical CSS properties throughout, directional icons mirrored,
phone numbers, CIN, GSTIN, references and job codes isolated left-to-right (`<bdi dir="ltr">`).
Tested with the `ar-XB` (right-to-left) and `en-XA` (about 40% longer text) pseudo-locales on
every localizable page — home, jobs, a job page, apply, candidates, employers, services, about,
contact, verify — at 320, 640 and 1024 px: **no page scrolls sideways, locally and on
staging**, and axe finds no serious or critical issue on the right-to-left routes. The one
overflow found in Phase 2C (a long heading link at 320 px) is fixed in the shared component.
To repeat with real Arabic text before Arabic is published: navigation, forms and errors,
buttons, cards, breadcrumbs, job pages, phone numbers, CIN, GSTIN, currency, dates and job
codes.

## 25. SEO results

Checked by `seo.spec.ts` and `i18n.spec.ts` on the local build and on staging, and by reading
the built output:

| Check | Result |
| --- | --- |
| Titles and descriptions | Unique on every page, from the page registry; no `meta keywords` |
| Canonical | Self-referencing on every page (staging's canonicals point at staging; production's will point at `https://www.gogulf.co`) |
| hreflang | Published languages only — English today; pseudo-locales never appear |
| One h1 | **50 of 50** prerendered pages have exactly one |
| Breadcrumbs | `BreadcrumbList` matches the visible breadcrumbs |
| Organization | Type `Organization` (not `EmploymentAgency`); legal name, CIN identifier, `foundingDate` 2024-02-22, the public address, confirmed contact points; no GSTIN, no `sameAs`, no countries served, no 2008, no licence or agency wording, no care-of line |
| JobPosting | Only on a confirmed, open English job page — never on the list, never for the unconfirmed samples |
| Open Graph / X | Title, description, canonical URL, locale, 1200 × 630 image (123 KB) with alt text; X `summary_large_image` |
| Sitemap | 14 indexable URLs with content dates; nothing unpublished (no `/travel`) |
| robots.txt | Production: allow all, disallow `/admin`, `/portal`, `/api/`, named AI crawlers welcomed, sitemap linked. Staging and previews: disallow all (verified) |
| llms.txt | Generated from the registry and company record; verified facts only; the registration note |
| Metadata claims | No unsupported claim in any title, description, alt text or structured data (built-output scan and `content/public-claims.test.ts`) |

Lighthouse scores SEO 69 on staging only because staging is deliberately `noindex`.

## 26. Accessibility results

| Check | Result |
| --- | --- |
| axe-core, WCAG 2.0/2.1/2.2 A and AA, every public route, the sign-in pages, the 404 and the pseudo-locale routes, phone and desktop | No serious or critical violation — local build and staging |
| Form error states (axe on the error summary) | Clean for contact, service enquiry, employer requirement and job application |
| Lighthouse accessibility, 15 routes, staging | **100 on every route** |
| Keyboard | Mobile menu and language menu are disclosures (Enter opens, Escape closes and returns focus); skip link; error summaries take focus and link to each field |
| Touch targets | Every navigation target at least 44 px; buttons 48 px |
| Reflow | No page scrolls sideways at 320, 640 or 1024 px, left-to-right or right-to-left |
| Semantics | One h1 per page (50 of 50); landmarks; real ordered lists for the process; `aria-invalid` and `aria-describedby` on fields in error |

The only accessibility-visible change in this pass is text; nothing regressed.

## 27. Performance results

Lighthouse 13.4.1 on staging, mobile preset (simulated slow 4G, 4× CPU), median of 3 runs,
the same 15 routes and proxy as Phases 2B and 2C (`perf/rc-lighthouse.json`).

| Route | Performance | LCP | TBT | Transfer |
| --- | ---: | ---: | ---: | ---: |
| `/` | 78 → **84** | 4.72 → 4.40 s | 200 → **68 ms** | 376 KB |
| `/about` | 83 → 97 | 4.40 → 2.36 s | 120 → 113 ms | 367 KB |
| `/services` | 92 → 81 | 3.35 → 4.69 s | 63 → 85 ms | 365 KB |
| `/jobs` | 83 → 83 | 4.46 → 4.55 s | 63 → 60 ms | 357 KB |
| `/jobs/apply` | 83 → 84 | 4.45 → 4.37 s | 112 → 75 ms | 430 → **366 KB** |
| `/candidates` | 96 → 84 | 2.77 → 4.42 s | 35 → 72 ms | 359 KB |
| `/employers` | 82 → 82 | 4.48 → 4.54 s | 67 → 92 ms | 374 KB |
| `/contact` | 87 → 83 | 1.82 → 4.49 s | 376 → **69 ms** | 468 → **404 KB** |
| `/pricing` | 95 → 99 | 2.86 → 2.09 s | 34 → 49 ms | 371 KB |
| `/privacy-policy` | 93 → 97 | 3.16 → 2.55 s | 52 → 46 ms | 377 KB |
| `/terms-and-conditions` | 95 → 83 | 2.90 → 4.43 s | 38 → 77 ms | 377 KB |
| `/cancellation-and-refunds` | 93 → 83 | 3.17 → 4.53 s | 49 → 59 ms | 371 KB |
| `/shipping-policy` | 93 → 83 | 3.10 → 4.53 s | 42 → 64 ms | 369 KB |
| `/verify` | 95 → 85 | 2.81 → 4.25 s | 133 → 76 ms | 355 KB |
| `/jobs/site-supervisor-saudi-arabia` | 95 → 98 | 2.72 → 2.24 s | 93 → 58 ms | 438 → 374 KB |

Phase 2C → release candidate. Accessibility 100, best practices 100 and CLS 0 everywhere.

| | Phase 2B | Phase 2C | Release candidate |
| --- | --- | --- | --- |
| Performance | 75–82 | 78–96 | **81–99** |
| LCP | 4.7–5.4 s | 1.8–4.7 s | 2.1–4.7 s |
| TBT | 66–154 ms | 34–376 ms | **46–113 ms** |
| Transfer | 432–531 KB | 356–468 KB | **355–404 KB** |
| Fonts | 199–210 KB | 112–123 KB | 112–123 KB |

Reading these honestly:

- **TBT and transfer improved reliably** — the worst TBT fell from 376 to 113 ms, and the
  heaviest page from 468 to 404 KB, because `/jobs/apply` and `/contact` no longer load the
  upload library up front.
- **LCP did not improve reliably.** Its values fall into two groups (about 2.1–2.6 s and about
  4.2–4.7 s), and unchanged pages move between them from one run to the next — the policy
  pages' code did not change, yet they moved by 1.5 s. On this setup (Lighthouse's simulated
  throttling through the staging proxy) LCP cannot credit or blame a single change. The home
  page's 4.4 s is still over the 2.0 s budget; `font-display: optional` for the heading face
  is the right change and stays, but it did not move the simulation.
- **Next steps for LCP**, better measured on the production domain after the cutover (no
  proxy, real CDN) and with field data: subset the Anek file to the glyphs the headings use,
  and check the home page's HTML and server-component payload (20 KB gzip) for what can move
  below the fold.

## 28. Bundle results

Local server build of the release candidate, gzip, modern browsers
(`perf/rc-local-bundle.json`; method as Phase 2B's `scripts/perf/bundle-report.mjs`).

| Route | Phase 2B | Phase 2C | Release candidate | Budget |
| --- | ---: | ---: | ---: | --- |
| Content pages (shared) | 134.7 KB | 135.9 KB | 135.9 KB | ≤ 120 KB — **not met**: Next.js's runtime alone is 126.8 KB |
| `/jobs` | 136.5 KB | 139.8 KB | 139.8 KB | — |
| `/contact` | 139.6 KB | 141.0 KB | 141.0 KB | ≤ 150 KB (form page) — met |
| `/services` | 137.4 KB | 141.3 KB | 141.3 KB | met |
| `/employers` | 134.7 KB | 141.7 KB | 141.7 KB | met |
| `/jobs/apply` | 198.1 KB | 203.9 KB | **142.6 KB** | **met** — supabase-js now loads when the applicant starts the form |
| CSS | 7.2–11.1 KB | 12.4 KB | 12.4 KB (13.3 KB on `/jobs/apply`) | — |
| Preloaded fonts | 145 KB | 70.6 KB | 70.6 KB (3 files) | ≤ 120 KB — met |
| Share image | 194 KB | 123 KB | 123 KB | ≤ 150 KB — met |

No page ships supabase-js, EmailJS or Zod in its initial JavaScript any more.

## 29. Form results

The email architecture was not rebuilt or migrated again. The only form changes in this pass:
the service names and enquiry values (routing unchanged), and the application form loading
its uploader on demand.

| Layer | What it proves | Result |
| --- | --- | --- |
| Unit (`lib/forms`, `lib/email`, `lib/rate-limit`) | Validation, honeypot, rate limit, header-injection and forged-recipient protection, desk routing (now with the renamed services), notification failure fails the submission, acknowledgement failure does not | pass |
| e2e, local and staging | Error summaries, focus and order; exact payloads (service name, page source, language header); the application form's success receipt carrying the server's reference — every request answered by the test | pass |
| **Real synthetic submissions on staging, release candidate** (`dpl_14MxvLrSK6HLoQBX4P6y5Ag5LUR7`, through each page's own UI, acknowledgements to careers@gogulf.co) | Contact; service enquiry (Medical Coordination); employer requirement; general job application with a generated one-page PDF and 1 px PNG — uploaded through the on-demand uploader | **all four: HTTP 200, `ok`, internal notification sent, acknowledgement sent** |

Your own check (submission → admin receipt → customer receipt) was on the Phase 2C build; the
server code behind it is unchanged in the release candidate. Synthetic records are left on
staging for inspection, as in earlier phases. No submission touched production.

## 30. Resend results

Staging: every form sends the internal notification and the customer acknowledgement through
Resend (section 29). The staging key is a dedicated sending-only key restricted to
`gogulf.co`. **Production email configuration is untouched**: production still sends through
EmailJS from its static build until the cutover.

## 31. Security results

| Check | Result |
| --- | --- |
| `npm run check:secrets` — the 7 server-only secret values the build uses, searched for in every client file (`.next/static`, `out`) | **PASS** — 125 files, none found |
| `npm run check:isolation` — can this environment reach the production database? | **PASS** locally. On Vercel the same guard runs before every non-production build (it stopped the first staging build in Phase 1 when it inherited production values) |
| `NEXT_PUBLIC_*` in code | Only `NEXT_PUBLIC_SITE_URL` and the Supabase URL and anon key — public by design, bounded by RLS. The legacy `NEXT_PUBLIC_EMAILJS_*` values exist only on the production deployment and are read by no code on this branch |
| Service-role key | Read only in `lib/supabase/admin.ts`, which imports `server-only` (a client import is a build error). No code path uses it; it is not set on Vercel |
| Production references | The production Supabase ref appears only in the two isolation guards, hard-coded so that an environment variable cannot defeat them. `SITE_URL` falls back to `https://www.gogulf.co`, which is correct for production and overridden on staging |
| API surface | Three form routes (`/api/forms/contact`, `/service-inquiry`, `/job-application`) and `llms.txt`. No debug, test or admin endpoints |
| Form handling (unit-tested) | Server-side Zod validation; honeypot; per-key rate limit with bounded memory; header-injection guard; recipients derived server-side from the service (a forged address cannot reroute mail); a failed internal notification fails the submission |
| Uploads | Private bucket, anon insert-only, 10 MB limit; the browser cannot list, read, overwrite or remove (verified on staging in Phase 1–2B) |
| Staff and portal areas | Behind the route guard: anonymous visitors are sent to sign-in, a forged session cookie is treated as anonymous, email + password sessions without a staff record reach neither area (e2e) |
| Built output | No "Asha Yadav", "C/o", `EmploymentAgency`, licence or agency wording, "1–2 business days" or "no hidden charges" in any built HTML, RSC payload or JavaScript |
| Credentials in the repository | None: `.env*` is gitignored; staging credentials live in `.env.staging.local`, which Next.js never loads |

## 32. Migration differences

Staging has `0001`–`0010` applied and both SQL suites passing (129 checks). Production has
`0001` only, per `docs/STAGING.md` §9 — **not re-verified live**: this session has no
production database credentials, by design. Confirm with the owner's read-only
`supabase migration list` (or the SQL below) before cutover.

| # | Purpose | Needed by the public website? | Depends on | Validate after applying |
| --- | --- | --- | --- | --- |
| 0001 | `job_applications` table, private `job-applications` bucket (10 MB), anon insert-only policies | **Yes — already on production** | — | Table has the columns `lib/supabase.js` inserts; bucket limit 10 MB; anon can insert, cannot read, list or overwrite |
| 0002 | Platform foundation: extensions, helpers, org structure, RBAC tables | No (staff platform) | 0001 | Objects exist; nothing in `job_applications` changed |
| 0003 | Unified identity (one person, many identifiers) | No | 0002 | Identity insert works (the 0009 fix) |
| 0004 | Cases, activity timeline, tasks | No | 0002, 0003 | — |
| 0005 | Immutable audit trail (partitioned) | No | 0002 | No UPDATE/DELETE path for any role |
| 0006 | RLS helpers and the JWT claims hook | No | 0002 | Auth hook configured in the dashboard and returning claims |
| 0007 | Row Level Security policies | No | 0002–0006 | `rls.test.sql` (46) passes |
| 0008 | Seed roles, permissions and grants (idempotent) | No | 0002, 0007 | 12 roles, 72 permissions |
| 0009 | Security hardening (grants, function execution, audit partitions, scopes). Touches nothing in `job_applications` | No | 0002–0008 | `rbac-behaviour.test.sql` (83) passes; no API role holds TRUNCATE |
| 0010 | Audited writes survive empty JWT claims (connection pooler) | No | 0005, 0006 | Audited write through the pooler succeeds |

**The website cutover needs no production migration.** `0002`–`0010` are required before the
staff area (`/admin`, `/portal`) is used; apply them as a separate, approved change with a
backup, in order, then run both SQL suites.

## 33. Production environment requirements

Nothing below has been changed. **Vercel — Production scope only:**

| Variable | Value | Why |
| --- | --- | --- |
| `PLATFORM_MODE` | `server` | Server build; the form API routes exist only in server mode |
| `NEXT_PUBLIC_SITE_URL` | `https://www.gogulf.co` | Canonicals, sitemap, Open Graph, JSON-LD |
| `RESEND_API_KEY` | a new **production** sending-only key, restricted to `gogulf.co` (sensitive) | Separate from the staging key, so each can be revoked alone |
| `RESEND_FROM_EMAIL` | `Go Gulf <no-reply@gogulf.co>` | Verified sending domain |
| `RESEND_REPLY_TO` | `careers@gogulf.co` | Acknowledgement replies reach a monitored inbox |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | production values — already set (Production, Preview) | Verify they are production's |
| `APP_ENV` | leave unset | `VERCEL_ENV=production` makes the build indexable; `APP_ENV=staging` is branch-scoped to staging |
| `SUPABASE_SERVICE_ROLE_KEY` | do not set | No code path uses it yet |
| `NEXT_PUBLIC_EMAILJS_*` (3), `NEXT_PUBLIC_EMAIL_PROVIDER` | delete **after** the new site is stable | The rollback deployment still uses EmailJS |

**Supabase production:** no schema change for the website (section 32). For staff login later:
the custom access token hook, Site URL `https://www.gogulf.co` with redirects limited to it,
sign-ups off, email + password with confirmation, MFA available — as `supabase/config.toml`
records for staging.

**Region:** functions run in `bom1` (Mumbai), the database in Tokyo; staging reproduces this.
Decide before cutover: accept it, pin functions to `hnd1`, or plan a database move.

**Domain:** `gogulf.co` and `www.gogulf.co` are already on Vercel DNS and aliased to the
production deployment. No DNS change is needed.

**Email:** Resend domain `gogulf.co` is verified (staging sends from it).

## 34. Business decisions still required

1. **Legal review of the service model (most important).** The company is not registered or
   licensed as a recruiting agent. Whether it may offer the services the site describes — help
   with Gulf job applications, candidate sourcing and screening for Gulf employers, interview,
   medical, attestation, visa and travel coordination — without such a registration under
   Indian law is a legal question this project cannot answer. The site no longer claims or
   implies registration, but a lawyer should confirm the service descriptions before launch.
2. **Legal sign-off on policy wording.** Changed in this pass (section 17). Flagged, not
   changed: the policies call the services "our recruitment services" and say fees for
   "overseas recruitment or emigration services" are subject to legal limits; the Privacy
   policy still lists Google Fonts as a processor although fonts are now self-hosted.
3. **Real job listings** with confirmed employers; otherwise production launches with the
   empty jobs state.
4. **Service names and About wording** as reworded (section 16) — confirm.
5. **Public address:** the plot number is omitted with the care-of line, following the
   brief's format — confirm, or it is a one-line change.
6. **D2** travel services; **D3** the 2008 heritage, countries and sectors served;
   **D8** the GST certificate.
7. **Social profiles:** ownership of the WhatsApp channel, YouTube, Facebook, Instagram,
   LinkedIn and TikTok profiles (none is linked until confirmed).
8. **Native reviewers** for Hindi, Arabic and Malayalam.
9. **Function region** (section 33).
10. The tagline "Go Gulf. Get Hired." is a brand line, not a promise; keep or change.

## 35. Remaining technical issues

None blocks the cutover.

- **Shared JavaScript is 135.9 KB** against a 120 KB budget. Next.js's runtime alone is
  126.8 KB; the budget predates the bundle analysis (Phase 2B proposed "framework + ≤ 10 KB").
- **Language-menu code ships with one language** (1.2 KB). A build-time flag could drop it
  until a second language is published.
- **IBM Plex Mono** is fetched, not preloaded, on pages that show the CIN — by design, off
  the critical path.
- **`next start` logs `NoFallbackError`** when a request hits a route parameter that was not
  generated (an unknown job, an untranslated page under a language). The response is the
  correct 404 — every such test passes — so it is log noise; check Vercel's runtime logs for
  it after the cutover.
- **Uploads still go from the browser to Supabase Storage** (two-phase, as designed). Moving
  them server-side is Phase 5 work, alongside the CRM tables.
- **INP was not re-measured** after Phase 2B (80–88 ms lab then). Field data needs traffic.
- **Local e2e runs time out under low memory** on the development machine; the same tests
  pass when re-run alone. An environment limit, not a site defect.

## 36. Production cutover procedure

Only after every box in the checklist below is ticked and explicit approval is given.

1. **Freeze.** Confirm the release-candidate commit is what staging runs and that the final
   suite passed on it.
2. **Back up.** Supabase production: a database backup (the owner's `pg_dump`, or the
   dashboard backup) and a list of storage objects. Record the current production
   deployment id (`dpl_8S7BZQ8xKWaNAw8aKFUF5JqJDcCK`) for rollback.
3. **Resend.** Create the production sending-only key.
4. **Vercel Production variables** (section 33). Do not delete the EmailJS variables yet.
5. **Supabase production check** (read-only): `job_applications` columns and the
   `job-applications` bucket exist as `0001` defines.
6. **Promote.** Fast-forward `main` to the release-candidate commit — `main` and `origin/main`
   are both ancestors of it, so no merge commit is needed. Vercel builds production.
7. **Verify, read-only first:** every page, `robots.txt` (indexable), `sitemap.xml` (www
   URLs), `llms.txt`, canonical and hreflang, security headers, no staging URL anywhere.
8. **Verify forms, with approval for test submissions on production:** one contact, one
   service enquiry, one employer requirement and one job application from an internal test
   identity; confirm the admin receipt, the customer receipt, and the application row and
   files in production Supabase; delete the test records afterwards.
9. **After 24–48 hours stable:** delete the EmailJS variables; resubmit the sitemap in Search
   Console; watch Resend and Vercel logs.

## 37. Rollback considerations

- **Instant:** Vercel "Instant Rollback" to `dpl_8S7BZQ8xKWaNAw8aKFUF5JqJDcCK`. It is a
  complete static build with its EmailJS values inlined, which is why those variables stay
  until the new site is stable.
- **Git:** do not force-push. Restore `main` with a revert commit to 7bb3093's tree if the
  code must go back.
- **Database:** the website cutover changes no schema, so nothing to roll back. Any test rows
  created in step 8 are deleted by id.
- **Policies:** the new policies name Resend; the old deployment's policies name EmailJS —
  each deployment is internally consistent.
- **Search:** a rollback within a day has negligible SEO effect; canonicals point at the same
  URLs in both versions.

## 38. Final recommendation

**Technically ready; hold the cutover for the business and legal gates.**

The release candidate is clean, stable and verified: every automated check passes on it,
locally and on staging; all four forms send through Resend end to end; nothing public claims
or implies recruiting-agent registration, the care-of line is gone from every public place,
and guard tests stop either from returning. Production has not been touched.

Promote it to `main` only when these are done, in this order:

1. **Legal review of the service descriptions** against the company holding no
   recruiting-agent registration (section 34, item 1), and legal sign-off on the policy
   wording (item 2). If the review asks for different wording, it is a content change on this
   branch, re-verified on staging before promotion.
2. **Real, confirmed job listings** — or an explicit decision to launch with the empty jobs
   state.
3. **The production environment steps** in section 33, the backup in section 36, and the
   remaining checklist items below.
4. **Explicit approval**, then the cutover procedure (section 36).

Translations are not a gate: the site launches in English, and Hindi, Arabic and Malayalam
publish one at a time as each native review completes.

## Production cutover checklist

- [ ] Business/content approval
- [ ] Legal/content approval
- [ ] Real job data approved
- [x] Recruitment-agency wording audit complete (legal review of the service model still open — item above)
- [x] Address audit complete (plot-number choice to confirm)
- [ ] Hindi content reviewed
- [ ] Arabic content reviewed
- [ ] Malayalam content reviewed
- [x] Production migrations reviewed (no migration needed for the website; live state to confirm with the owner)
- [ ] Production Vercel variables reviewed
- [ ] Resend production configuration reviewed
- [ ] Production Supabase configuration reviewed
- [ ] DNS verified
- [x] Final E2E passed (on the release candidate: 158 passed, 0 failed, locally and on staging — repeat on production at cutover step 7–8)
- [x] Final accessibility passed (on the release candidate: axe clean, Lighthouse 100 on all 15 routes)
- [x] Final SEO passed (on the release candidate; re-check canonicals and robots on production at cutover step 7)
- [ ] Final performance passed — not against the budgets: home LCP 4.4 s (budget 2.0 s), home transfer 376 KB (budget 350 KB); TBT, CLS and form-page JavaScript meet theirs. Accept for launch or schedule the LCP work (section 27)
- [ ] Production safety verified
- [ ] Backup/rollback plan verified
- [ ] Explicit production approval received
