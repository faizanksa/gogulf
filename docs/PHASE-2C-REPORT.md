# Phase 2C — redesign and multilingual implementation

Branch `phase-2/redesign`, deployed to staging only. Production is untouched: `origin/main`
is 7bb3093, as before this phase, and no production variable, database, DNS record or email
setting was read or changed.

| | |
| --- | --- |
| Staging commit | 989a010 |
| Staging deployment | `dpl_H77W5exXfZ5J31yCcbAZG8qXGcst` (Ready), aliased to `https://staging.gogulf.co` |
| Previous staging commit | 2a28ae5 (multilingual foundation) |

## 1. What changed

Every public page was rebuilt on the design system; nothing from the pre-redesign stylesheet
remains (`styles/legacy.css` and the `(legacy)` route group are deleted).

| Page | What it is now |
| --- | --- |
| `/` | Built around the two journeys. "Find a job" is the primary action, hiring the secondary, WhatsApp a contextual line. Then the company facts anyone can check, real open jobs (or an honest empty state), where each audience starts, the business's ten-step process, the money rules, the services and a close. |
| `/jobs` | Filters (search, country, industry, type) that sync to the URL and announce the count; an empty state; a general-application band. |
| `/jobs/[slug]` | The facts first (sticky on desktop), requirements and benefits only when the listing has them, how to apply, the fees callout, related jobs, a mobile apply bar. JobPosting only on confirmed, open, English pages. |
| `/jobs/apply` | The same two-phase upload and payload, now in TypeScript on the form kit: 8 MB check, error summary, a receipt with the reference. |
| `/candidates` | The job-seeker hub: the ten steps, documents (to apply / later), fees, staying safe from fraud, common questions that restate published policy only. |
| `/employers` | Business-to-business: services, a six-step route to deployment, plain terms, the company facts, a structured requirement form. |
| `/services` | The existing catalogue, organised by audience; each card opens the enquiry form with that service chosen. |
| `/about` | Who runs Go Gulf (incorporated 22 Feb 2024, Lucknow), what it does for each audience, the business's own mission, vision and values, three rules it keeps. |
| `/contact` | Four routes by purpose — a job, help applying or a service, hiring, anything else — each to an existing submission path; the general message form. |
| `/verify` | Copy moved into the catalogue; the company record as a fact list. |
| Policy pages | Presentation only: contents list beside a 68ch column, numbered sections. No policy wording changed (`git diff` on the five page bodies is empty). |
| `/travel` | No route until decision D2; it is an unknown URL and gets the full 404. |

## 2. Content discipline

Nothing on the new pages is a claim the claims register (`content/company.ts`) has not
cleared. Deliberately left out or removed:

- The 2008 heritage (D3). About states the 2024 incorporation; a staging-only notice marks
  where an attributed history could go.
- Placement numbers, countries and sectors served, offices outside Lucknow, response times,
  employer-verification claims, candidate-pool sizes.
- From the old About: "End-to-End Support" and "Technology-Driven" (unevidenced promises).
- From the old Contact: the WhatsApp channel and YouTube links (ownership unconfirmed).
- Photographs of people and testimonials: none exist that are real and consented.

## 3. Languages

| Catalogue | Status | Coverage of the 595 English keys |
| --- | --- | --- |
| `en` | source, published | 595 |
| `hi`, `ar`, `ml`, `ta`, `bn` | not started | 0 — nothing machine-translated, nothing published |

- Every rebuilt page (nine) is localizable: its words come from the catalogue, and the
  pseudo-locales (`en-XA` lengthened, `ar-XB` right-to-left) render all of them on local and
  staging builds.
- The policy pages stay English-only until a legal review signs off a translation.
- With one language published, no language menu or suggestion renders.

## 4. Forms

Endpoints, payloads and server handling are unchanged. The service and employer forms post to
the existing service-inquiry route with the exact service names it routes on; the employer
form writes its details as an English message for staff.

| Check | Where | Result |
| --- | --- | --- |
| Validation, honeypot, rate limit, forged-recipient and header-injection protection, notification and acknowledgement handling, desk routing | unit tests (`lib/forms`, `lib/email`, `lib/rate-limit`) | pass |
| Error summaries, focus, payload shape, language header — nothing sent | e2e (`forms`, `jobs`, `hubs`) | pass |
| Real synthetic submissions on staging, through the pages' own UI (acknowledgements to careers@gogulf.co) | services enquiry, employer requirement, contact, general job application (generated one-page PDF and 1 px PNG) | all four: HTTP 200, `ok`, acknowledgement sent |

The application form's success view is covered by `apply-receipt.spec.ts`: with the upload,
the row insert and the form route answered by the test, the applicant lands on the receipt,
and its reference is the `submission_id` the server received. One synthetic application is
left on staging for inspection, as in 2B.

## 5. Measurements

Local production build of the staged tree (`perf/after-2c-local-bundle.json`), gzip, modern
browsers, against Phase 2B (`perf/after-2b-local-bundle.json`).

| | After 2B | After 2C | Change |
| --- | ---: | ---: | --- |
| Shared JavaScript (content pages) | 134.7 KB | 135.9 KB | +1.2 KB: the language islands |
| `/jobs` | 136.5 KB | 139.8 KB | +3.3 KB: filters |
| `/services` | 137.4 KB | 141.3 KB | +3.9 KB: enquiry form |
| `/contact` | 139.6 KB | 141.0 KB | +1.4 KB |
| `/employers` | 134.7 KB | 141.7 KB | +7.0 KB: requirement form (new) |
| `/jobs/apply` | 198.1 KB | 203.9 KB | +5.8 KB; supabase-js stays until Phase 5 |
| CSS | 7.2 KB (new pages) / 11.1 KB (legacy) | 12.4 KB on every page | One shared design-system stylesheet; legacy CSS gone |
| Preloaded fonts | 145 KB | 70.6 KB (3 files) | −51%: no width axis, Mukta 400/600 only |
| Share image | 194 KB | 123 KB | Inside the 150 KB budget |
| Third-party requests from the site | 0 | 0 | — |

### Lighthouse — staging, mobile, median of 3

Same routes, preset (simulated slow 4G, 4× CPU), runs and staging proxy as 2B;
Lighthouse 13.4.1 both times (`perf/after-2c-lighthouse.json`).

| Route | Performance | LCP | TBT | CLS | Transfer | Fonts |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `/` | 82 → 78 | 4.79 → 4.72 s | 72 → 200 ms | 0 | 444 → 376 KB | 199 → 112 KB |
| `/about` | 82 → 83 | 4.75 → 4.40 s | 102 → 120 ms | 0 | 432 → 367 KB | 199 → 112 KB |
| `/services` | 81 → 92 | 4.93 → 3.35 s | 77 → 63 ms | 0 | 437 → 365 KB | 199 → 112 KB |
| `/jobs` | 80 → 83 | 4.95 → 4.46 s | 122 → 63 ms | 0 | 439 → 357 KB | 199 → 112 KB |
| `/jobs/apply` | 75 → 83 | 5.44 → 4.45 s | 154 → 112 ms | 0 | 498 → 430 KB | 199 → 112 KB |
| `/candidates` | 81 → 96 | 4.79 → 2.77 s | 128 → 35 ms | 0 | 432 → 359 KB | 199 → 112 KB |
| `/employers` | 82 → 82 | 4.74 → 4.48 s | 87 → 67 ms | 0 | 441 → 374 KB | 199 → 112 KB |
| `/contact` | 78 → 87 | 5.17 → 1.82 s | 66 → 376 ms | 0 | 440 → 468 KB | 199 → 123 KB |
| `/pricing` | 78 → 95 | 5.25 → 2.86 s | 73 → 34 ms | 0 | 448 → 371 KB | 210 → 123 KB |
| `/privacy-policy` | 77 → 93 | 5.36 → 3.16 s | 86 → 52 ms | 0 | 454 → 377 KB | 210 → 123 KB |
| `/terms-and-conditions` | 77 → 95 | 5.33 → 2.90 s | 95 → 38 ms | 0 | 454 → 377 KB | 210 → 123 KB |
| `/cancellation-and-refunds` | 77 → 93 | 5.30 → 3.17 s | 71 → 49 ms | 0 | 448 → 371 KB | 210 → 123 KB |
| `/shipping-policy` | 77 → 93 | 5.29 → 3.10 s | 98 → 42 ms | 0 | 446 → 369 KB | 210 → 123 KB |
| `/verify` | 81 → 95 | 4.84 → 2.81 s | 86 → 133 ms | 0 | 443 → 356 KB | 210 → 112 KB |
| `/jobs/site-supervisor-saudi-arabia` | 81 → 95 | 4.82 → 2.72 s | 86 → 93 ms | 0 | 531 → 438 KB | 210 → 112 KB |

Accessibility 100 and best practices 100 on every route (2B: one route at 99). SEO scores
69 on staging in both phases because staging is `noindex` by design. One third-party
request appears on staging in both phases; the site's HTML references none (it is the
preview deployment's own tooling).

What did not improve, and why:

- **Home LCP (4.7 s).** The largest element is the hero's display heading, which waits for
  the Anek file. The fonts are 44% lighter, but the hero heading still renders late. Next
  levers: `font-display: optional` for the display face, or subsetting Anek to the Latin
  glyphs the hero uses.
- **TBT on `/` and `/contact` (200 and 376 ms)** in the run Lighthouse reports (the median
  performance score). The home page's HTML is larger (20 KB gzip: more content and its
  server-component payload); `/contact` hydrates the form. TBT varies from run to run on
  this machine; INP, the field metric it approximates, was not re-measured in 2C.

### Phase 2A budgets

| Budget | Target | After 2C | Status |
| --- | --- | --- | --- |
| Largest Contentful Paint | ≤ 2.0 s | 1.8–4.7 s | **Not met** — met on `/contact` only; seven routes under 3.2 s; home 4.7 s (see above) |
| Cumulative Layout Shift | ≤ 0.05 | 0 everywhere | Met |
| Interaction to Next Paint | ≤ 200 ms | not re-measured | — (2B lab: 80–88 ms) |
| Shared JavaScript per page | ≤ 120 KB gzip | 135.9 KB | **Not met** — the framework alone is 126.8 KB |
| Page-specific JS on content pages | zero | zero | Met |
| Form page JavaScript | ≤ 150 KB gzip | 141.0–141.7 KB; `/jobs/apply` 203.9 KB | Met on three of four; `/jobs/apply` in Phase 5 |
| Fonts | ≤ 120 KB, self-hosted | 70.6 KB preloaded; 112–123 KB downloaded | Met on 8 routes (112 KB); 123 KB on the policy pages and `/contact` |
| Home page transfer | ≤ 350 KB | 376 KB | **Not met by 26 KB** (2B: 444 KB) |
| Third-party requests | none from the site | none from the site | Met (staging tooling aside) |
| Share image | ≤ 150 KB | 123 KB | Met (2B: 194 KB) |
| Logo, favicon | ≤ 10 KB, ≤ 20 KB | unchanged | Met |

## 6. Tests

| Suite | Result |
| --- | --- |
| Typecheck, lint | clean |
| Unit (Vitest) | 150 / 150 |
| e2e suite | 184 tests in 10 files (92 per device project; tests pinned to one device skip on the other) |
| e2e, local production build | First full run: 146 passed, 10 failed — 9 were selectors made ambiguous by the new pages or a page that became localizable, 1 a real 320 px overflow (fixed in `SectionHeading`); the tenth was a local Supabase timeout that passed alone. Affected specs re-run on the final build: 75 passed, 0 failed. |
| e2e, staging (989a010) | 154 passed, 26 skipped, 2 failed on time-outs under load (axe on `/ar-XB/contact`, one contact-form test); both passed when re-run alone. |
| `db:validate`, `check:isolation`, `check:secrets` | pass |

## 7. Open business decisions

- D1 — overseas Recruiting Agent registration: whether it is held, and its number.
- D2 — which travel services are sold; `/travel` stays unrouted until then.
- D3 — the 2008 heritage (whose, under what name); countries and sectors actually served.
- D8 — the GST certificate (GSTIN stays off structured data).
- Real job listings with confirmed employers; the sample listings are staging-only.
- Approved FAQ answers beyond what the policies already say.
- The shipping policy cites a "1–2 business days" response time that the claims register has
  not cleared. Legal wording, so it was not edited.
- Native reviewers for Hindi, Arabic and Malayalam (then Tamil and Bengali).

## 8. Known technical issues

- Shared JavaScript is above the 120 KB budget: Next.js's runtime alone is 126.8 KB. The
  language islands add 1.2 KB even with one language (a build-time flag would drop them).
- `/jobs/apply` ships supabase-js until uploads move server-side (Phase 5).
- IBM Plex Mono is not preloaded but is fetched on pages that show the CIN.
- Feature-branch Previews fail closed at build time by design (no isolated Supabase config);
  only the `staging` branch deploys.
