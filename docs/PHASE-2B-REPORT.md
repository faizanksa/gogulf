# Phase 2B — measurements

Baseline versus after-2B, for the foundation, design system, shell and SEO work on
`phase-2/redesign`. Every number below was measured; the raw summaries live in `perf/`.
Nothing here is estimated. A cell reading **pending** has not been measured yet.

## How each number was taken

| Measurement | Tool and method | Where |
| --- | --- | --- |
| Lighthouse | Lighthouse 13.4.1, mobile preset, 3 runs per route, median reported. Run locally against staging through a localhost proxy that adds the Vercel bypass header only on requests to staging, so the secret never reaches a third party. | `perf/*-lighthouse.json` |
| Interaction (INP) | Playwright + Chrome, Pixel 7 emulation, 4× CPU throttle, `web-vitals` `onINP`. A lab proxy for INP, not field data. LCP element read with a `PerformanceObserver` on an unthrottled network. | `perf/*-inp.json` |
| Accessibility | axe-core via Playwright, tags `wcag2a` `wcag2aa` `wcag21a` `wcag21aa` `wcag22aa`, desktop and Pixel 7 projects. | `perf/*-axe.json` |
| JavaScript and CSS size | Script and stylesheet tags in the prerendered HTML under `.next/server/app`, resolved to `/_next/static` files, compressed with gzip -9. Legacy `noModule` polyfills are counted separately: modern browsers do not download them. | `perf/*-bundle.json` |

Staging is served `noindex` on purpose, and Lighthouse's SEO category scores that as a
failure. The SEO score on staging is therefore not comparable with production and is
reported only for completeness.

## Baseline — 11 Sep 2026, the pre-redesign site on staging

### Lighthouse (mobile, median of 3)

| Route | Perf | A11y | Best pr. | LCP | FCP | TBT | CLS | Image bytes | Script bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `/` | 66 | 93 | 100 | 23.7 s | 3.2 s | 119 ms | 0 | 1,912,839 | 144,507 |
| `/about` | 67 | 93 | 100 | 23.3 s | 3.0 s | 59 ms | 0 | 1,912,839 | 144,507 |
| `/services` | 64 | 94 | 100 | 23.8 s | 3.2 s | 177 ms | 0 | 1,912,839 | 238,224 |
| `/jobs` | 64 | 93 | 100 | 23.4 s | 3.3 s | 148 ms | 0 | 1,912,840 | 147,656 |
| `/jobs/apply` | 66 | 93 | 100 | 23.7 s | 3.1 s | 92 ms | 0 | 1,912,840 | 217,228 |
| `/candidates` | 67 | 93 | 100 | 23.4 s | 3.0 s | 30 ms | 0 | 1,912,840 | 147,657 |
| `/employers` | 67 | 93 | 100 | 23.8 s | 3.1 s | 68 ms | 0 | 1,912,840 | 238,225 |
| `/contact` | 65 | 93 | 100 | 23.3 s | 3.1 s | 129 ms | 0 | 1,912,840 | 148,030 |
| `/pricing` | 67 | 93 | 100 | 23.3 s | 3.2 s | 48 ms | 0 | 1,912,840 | 144,509 |
| `/privacy-policy` | 66 | 93 | 100 | 23.3 s | 3.3 s | 35 ms | 0 | 1,912,840 | 144,577 |
| `/terms-and-conditions` | 67 | 93 | 100 | 23.5 s | 3.2 s | 48 ms | 0 | 1,912,840 | 144,509 |
| `/cancellation-and-refunds` | 66 | 93 | 100 | 23.4 s | 3.2 s | 69 ms | 0 | 1,912,840 | 144,509 |
| `/shipping-policy` | 67 | 93 | 100 | 13.5 s | 3.1 s | 52 ms | 0 | 1,912,840 | 144,509 |

Every page downloaded 1.9 MB of images: the full-size logo used as the favicon and
header mark. Under Lighthouse's simulated slow-4G throttling, that single image
accounts for the 23-second LCP. Each page also loaded 72 KB of fonts and 73 KB from a
third party (Google Fonts, 6 requests). The performance score varied widely between
runs on some routes: `/services` scored between 28 and 66 across its three runs.

### Interaction (lab INP, Pixel 7, 4× CPU)

| Scenario | INP | Samples | LCP element (unthrottled) |
| --- | ---: | --- | --- |
| Open and close the mobile menu (`/`) | 88 ms | 208, 72, 88 | `<p>` hero text, 3,120 ms |
| Search and filter jobs (`/jobs`) | 88 ms | 72, 104, 88 | `<p>` intro text, 756 ms |

### Accessibility (axe)

- **0 critical** violations. **Serious** violations on all 13 routes, in both projects:
  between 10 (`/jobs/apply`) and 41 (`/privacy-policy`, `/terms-and-conditions`) per route.
- `color-contrast` failed on every route and project: 590 nodes.
- `scrollable-region-focusable` failed on `/`: 2 nodes.

### JavaScript and CSS (gzip, modern browsers)

| Route | JS gzip | Libraries shipped to the browser |
| --- | ---: | --- |
| Most routes | 137.2 KB | — |
| `/jobs` | 139.6 KB | — |
| `/contact` | 140.0 KB | EmailJS |
| `/jobs/apply` | 203.6 KB | EmailJS, supabase-js |
| `/services` | 226.7 KB | EmailJS, Zod |

CSS was 5.0 KB gzip on every route. The `noModule` polyfills, 39.5 KB gzip, are not
included in these totals.

## After 2B — commit 43685d3 on staging (`dpl_5iijpWXHK4yAbJ9ZaWrrkRzjtK8m`)

### JavaScript and CSS (gzip, modern browsers)

Measured on the local production build of 43685d3 (`perf/after-2b-local-bundle.json`).
Only the environment variables differ from the staging build. The bundle contents
match: the staging verification found no EmailJS code and no production Supabase
reference in any of the 13 chunks staging serves.

| Route | Baseline | After 2B | Change | Libraries shipped |
| --- | ---: | ---: | ---: | --- |
| Most routes | 137.2 KB | 134.7 KB | −2.5 KB | — |
| `/jobs` | 139.6 KB | 136.5 KB | −3.1 KB | — |
| `/contact` | 140.0 KB | 139.6 KB | −0.4 KB | EmailJS removed |
| `/services` | 226.7 KB | 137.4 KB | **−89.3 KB** | EmailJS and Zod removed |
| `/jobs/apply` | 203.6 KB | 198.1 KB | −5.5 KB | EmailJS removed; supabase-js stays for the upload flow (Phase 5) |
| `/verify`, `/jobs/[slug]` (new) | — | 134.7 KB | — | — |

- Next.js's own runtime is 126.8 KB of the total (measured on `/travel`, which renders
  only the root 404). The marketing shell adds 7.9 KB on top: the menu island (4.3 KB)
  and link prefetching (3.6 KB). It added 12.7 KB before two changes. First, the icons
  and the call to action became server-rendered props. Second, `next/image` came out
  of the header and footer: importing anything from it, even `getImageProps`, ships the
  client Image component with every page.
- The `noModule` polyfills are 38.6 KB gzip (baseline 39.5 KB). They are not included
  above because modern browsers do not download them.
- CSS rose from 5.0 KB to 11.1 KB on the legacy pages. They load the old stylesheet
  (scoped under `:where(.legacy)`) plus the new tokens and components. Pages built only
  on the new system (`/verify`, the job pages) load 7.2 KB. The legacy share goes away
  as Phase 2C replaces those pages.
- Images: the favicon fell from 1.9 MB to 6 KB. The header and footer logo is a 7.4 KB
  PNG (96 px, twice the display size).

### Fonts: heavier than the baseline, and a decision for review

The baseline loaded 72 KB of fonts from Google's CDN, plus 73 KB of third-party
requests. After 2B, fonts are self-hosted (0 KB to Google) but weigh 199–210 KB per
page in Lighthouse.

What every page preloads:

| File | Size |
| --- | ---: |
| Anek Latin, variable, weight 100–800 plus width 75–125 | 103.6 KB |
| Mukta 400, 600 and 700 | 41.4 KB |
| **Total preloaded** | **145 KB** |

Legacy pages also load IBM Plex Mono (about 20 KB), because the old stylesheet uses
it for small labels. That goes away with those pages in Phase 2C. Devanagari files load
only when Hindi text is on the page.

The width axis is what makes the Anek file large. Headings use it at width 88
(`--display-wdth`). I measured the alternative:

| Anek configuration | Anek file | Preloaded total | Heading look |
| --- | ---: | ---: | --- |
| Width + weight axes (current) | 103.6 KB | 145 KB | Width 88, compact |
| Weight axis only | 44.9 KB | 86.3 KB | Normal width, about 12% wider |

`next/font` 16.3 cannot keep the width axis with a narrower weight range. It accepts
`axes` only with the full `variable` weight range, and rejects weight ranges such as
`'400 700'` despite its docs. So the choice is compact headings or about 59 KB less on
every page. Left unchanged, for the design review. A third route is a self-hosted
instance fixed at width 88 (`next/font/local`). It needs a font-instancing build step,
and a check of the OFL reserved-name terms.

### Lighthouse (mobile, median of 3)

Measured on staging, deployment `dpl_…ckzme1rim` (commit 43685d3), 11 Sep 2026, 17:11 UTC
(`perf/after-2b-lighthouse.json`). Same tool, preset and proxy as the baseline, plus the two
pages 2B added.

| Route | Perf | A11y | Best pr. | LCP | FCP | TBT | CLS | Image bytes | Script bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `/` | 82 | 100 | 100 | 4.8 s | 1.6 s | 72 ms | 0 | 8,231 | 150,464 |
| `/about` | 82 | 100 | 100 | 4.7 s | 1.6 s | 102 ms | 0 | 8,231 | 150,463 |
| `/services` | 81 | 99 | 100 | 4.9 s | 1.6 s | 77 ms | 0 | 8,231 | 154,259 |
| `/jobs` | 80 | 100 | 100 | 4.9 s | 1.6 s | 122 ms | 0 | 8,231 | 150,462 |
| `/jobs/apply` | 75 | 100 | 100 | 5.4 s | 1.6 s | 154 ms | 0 | 8,231 | 219,156 |
| `/candidates` | 81 | 100 | 100 | 4.8 s | 1.6 s | 128 ms | 0 | 8,231 | 150,463 |
| `/employers` | 82 | 100 | 100 | 4.7 s | 1.6 s | 87 ms | 0 | 8,231 | 154,259 |
| `/contact` | 78 | 100 | 100 | 5.2 s | 1.6 s | 66 ms | 0 | 8,231 | 156,608 |
| `/pricing` | 78 | 100 | 100 | 5.2 s | 1.7 s | 73 ms | 0 | 8,231 | 150,463 |
| `/privacy-policy` | 77 | 100 | 100 | 5.4 s | 1.9 s | 86 ms | 0 | 8,231 | 150,463 |
| `/terms-and-conditions` | 77 | 100 | 100 | 5.3 s | 1.7 s | 95 ms | 0 | 8,231 | 150,463 |
| `/cancellation-and-refunds` | 77 | 100 | 100 | 5.3 s | 1.7 s | 71 ms | 0 | 8,231 | 150,463 |
| `/shipping-policy` | 77 | 100 | 100 | 5.3 s | 1.7 s | 98 ms | 0 | 8,231 | 150,463 |
| `/verify` (new) | 81 | 100 | 100 | 4.8 s | 1.6 s | 86 ms | 0 | 8,231 | 150,463 |
| `/jobs/site-supervisor-saudi-arabia` (new) | 81 | 100 | 100 | 4.8 s | 1.6 s | 86 ms | 0 | 8,231 | 219,156 |

Against the baseline, route for route:

| | Baseline | After 2B |
| --- | --- | --- |
| Performance (median) | 64–67 | 75–82 |
| Accessibility | 93–94 | 99–100 |
| LCP | 23.3–23.8 s (13.5 s on one route) | 4.7–5.4 s |
| FCP | 3.0–3.3 s | 1.6–1.9 s |
| CLS | 0 | 0 |
| Image bytes | 1,912,840 | 8,231 |
| Total bytes | ~4.0 MB | 442–544 KB |
| Font bytes | 72 KB (from Google) | 204–215 KB (self-hosted) |
| Third-party requests | 6 (73 KB, Google Fonts) | 1 (78 bytes) |

Reading these numbers:

- **LCP is now set by the fonts, not the logo.** The LCP element is the hero paragraph
  on every page (confirmed by the INP run below). Under simulated slow 4G the text is
  re-rendered when the preloaded Anek and Mukta files arrive, and 145 KB of preloaded
  fonts is now the largest thing on the page. The width-axis decision above is the
  biggest remaining lever: dropping the axis measured 59 KB less per page.
- **`/jobs/apply` and the job page carry 219 KB of script.** The apply form still ships
  supabase-js for the browser upload, which Phase 5 moves to the server. The job page's
  own bundle is 134.7 KB; Lighthouse also counts the Apply page's code, which Next
  prefetches because the page links to it.
- **The one third-party request is 78 bytes.** The site's own code makes none: its
  browser bundle contains no third-party URL. Its origin should be checked against
  production after the cutover.
- **SEO scores 69 on every staging page by design.** Staging is `noindex`, and
  Lighthouse scores that as a failure.
- **Run-to-run spread was wide on some routes** (`/employers` 64–82, `/services` 78–98),
  as in the baseline. The machine had under 1 GB of free memory during the runs. The
  medians are consistent across routes; treat single-run figures with care.

### Interaction (lab INP, Pixel 7, 4× CPU)

Measured on staging, 43685d3, 17:13 UTC (`perf/after-2b-inp.json`).

| Scenario | Baseline INP | After 2B INP | Samples (after) | LCP element (after) |
| --- | ---: | ---: | --- | --- |
| Open and close the mobile menu (`/`) | 88 ms | **80 ms** | 200, 80, 56 | `<p>` hero text, 3,160 ms |
| Search and filter jobs (`/jobs`) | 88 ms | **88 ms** | 88, 184, 48 | `<p>` intro text, 956 ms |

Both are well under the 200 ms "good" threshold. The menu island's work per tap went down
slightly, since the icons and the call to action became server-rendered props.
The LCP timings here come from a 4× CPU-throttled run on an unthrottled network, so they
are not comparable with Lighthouse's simulated-4G LCP.

### Accessibility (axe)

Measured on staging, 43685d3 (`perf/after-2b-axe.json`). The same tags as the baseline
(WCAG 2.0–2.2, A and AA), on desktop and Pixel 7.

| | Baseline | After 2B |
| --- | --- | --- |
| Routes scanned | 13 × 2 viewports | 18 × 2 viewports (adds `/verify`, a job page, both sign-in pages and the 404) |
| Critical | 0 | 0 |
| Serious | 10–41 per route, on every route | **0** |
| Moderate / minor | 0 | 0 |
| `color-contrast` | 590 nodes | 0 |
| `scrollable-region-focusable` | 2 nodes (`/`) | 0 |

axe finds roughly a third of WCAG problems. The rest of the 2B-4 foundation is
covered by the Playwright specs:
- the skip link, landmarks, and one `h1` per page
- the menu's `aria-expanded` and `aria-controls`, Escape closing it and returning focus
- `aria-current` on the current page
- the error summary taking focus, with each error tied to its field
- 44px targets
- no sideways scrolling at 320px or at 200% zoom
- reduced motion

A screen-reader pass with TalkBack on a real Android phone was **not** done: no device
was available. It is still outstanding.

## Against the Phase 2A budgets (`docs/REDESIGN-PLAN.md` §13)

The plan enforces these budgets in 2D, on a real mid-range Android phone. Measured here
on staging with Lighthouse's simulated slow 4G, which is harsher than a typical 4G link,
so this is a lab reading, not the 2D verdict.

| Budget | Target | After 2B | Status |
| --- | --- | --- | --- |
| Largest Contentful Paint | ≤ 2.0 s | 4.7–5.4 s | **Not met.** Fonts now decide it (see above). The width-axis decision is the first lever; `font-display: optional` for the display face is the second. Decide in the design review. |
| Cumulative Layout Shift | ≤ 0.05 | 0 on every route | Met |
| Interaction to Next Paint | ≤ 200 ms | 80–88 ms (lab) | Met (lab proxy; field data needs traffic) |
| Shared JavaScript per page | ≤ 120 KB gzip | 134.7 KB | **Not met — the budget predates the bundle analysis.** Next.js's own runtime is 126.8 KB, above the target on its own; the site adds 7.9 KB. Proposed revision: framework plus ≤ 10 KB of shell. |
| Page-specific JavaScript on content pages | zero | zero | Met — content pages ship only the shared shell |
| Form page JavaScript | ≤ 150 KB gzip | `/services` 137.4, `/contact` 139.6, `/jobs/apply` 198.1 | Met on two of three. `/jobs/apply` meets it when supabase-js leaves the browser in Phase 5, as planned. |
| Fonts | ≤ 120 KB, self-hosted, 2 preloaded | self-hosted; 145 KB preloaded (Anek + Mukta) | **Self-hosting met; size not met by 25 KB.** The width axis again: without it, 86 KB. |
| Home page transfer | ≤ 350 KB | 454 KB (Lighthouse total) | **Not met.** Fonts are 204 KB of it. |
| Third-party requests on first load | none | 1 request, 78 bytes | **Not met on staging.** The site's code makes none; identify the request on production after the cutover. |
| Logo | ≤ 10 KB | 7.4 KB (96 px PNG) | Met |
| Favicon | ≤ 20 KB | 6 KB `favicon.ico` (plus a 21 KB 180 px Apple touch icon, fetched only by iOS home screens) | Met |
| Share image | ≤ 150 KB | 194 KB (1200 × 630 PNG, generated at build) | **Not met.** Downloaded only by link-preview crawlers, never by visitors, and within WhatsApp's ~300 KB preview limit. The embedded logo's gradients dominate; render it smaller or on a flat ground in 2C. |

## Verification record

Gates on the final tree (43685d3):

| Gate | Result |
| --- | --- |
| `npm run lint` | pass, 0 problems |
| `npm run typecheck` | pass |
| `npm test` (Vitest) | 123 / 123 pass (10 files) |
| `npm run build:server` | pass, 36 / 36 routes |
| `npm run check:secrets` | pass: 125 client files scanned, no server secret |
| `npm run check:isolation` | pass: the local environment cannot reach production |
| `npm run db:validate` | pass: 10 migration files parse |
| Commit scan | 187 files: no `.env` file, no key or token patterns |

End-to-end runs (Playwright, desktop plus Pixel 7). These are reported as they
happened, failures included:

| Run | Build | Result | Notes |
| --- | --- | --- | --- |
| Local 1 | pre-fix | 64 pass, 12 fail | Real defects: `.stamp` contrast; `og:image` missing on every page (a page's `openGraph` replaced the file-convention image). Test defects: a minified-value comparison and the 404 robots check. Infrastructure: a retryable local-Supabase timeout and two axe timeouts. All fixed. |
| Local 2 | fixes | 76 pass, 0 fail | |
| Local 3 | footer `getImageProps` | 76 pass, 0 fail | |
| Local 4 | final | 75 pass, 1 fail | Mobile menu: the tap closed the menu, but navigation had not completed within 10 s under parallel load. It did not reproduce: 25 / 25 in isolation. |
| Local 5 | final | 72 pass, 4 fail | Invalid as evidence: the run took 45.6 min instead of about 4, with under 1 GB of RAM free. All 4 failures were timeouts; 14 / 14 passed in isolation afterwards. |
| Staging | 43685d3 | 74 pass, 2 fail | Both failures were in the guard tests' handling of the staging access cookie, not in the guard. The forged-cookie test replaced the whole Cookie header, and the signed-in test cleared every cookie between steps. Both dropped Vercel's bypass cookie, so Vercel Authentication answered with its own 302 before the app ran. The anonymous-redirect tests got the correct 307 on the same deployment. Fixed: the forged cookie is added to the context, and only `sb-*` cookies are cleared. |
| Staging, guard re-run | 43685d3 + test fix | 7 / 7 pass | |

20 tests are skipped in every run by design: markup and routing checks run on one
viewport only.

Staging verification (`https://staging.gogulf.co`, 43685d3):

- Without the bypass, staging is private (HTTP 302 to Vercel Authentication).
- All 15 pages return 200 with a title, canonical, JSON-LD, the header/footer
  landmarks, the skip link, the legal entity, the GSTIN and the contact details, plus
  an `X-Robots-Tag: noindex` header.
- `robots.txt` disallows everything, and canonicals point at staging.
- All five security headers are present. `/admin` and `/portal` return 307 to their
  sign-in pages, and an unknown route returns 404.
- The browser bundle has no EmailJS code and no production Supabase reference. The
  forms post to `/api/forms/*`.
- The form flows were sent through Resend to the company inbox, using synthetic
  identities only:
  - contact, both service desks and job application sent (200, acknowledgement sent)
  - invalid, malformed, forged-recipient and honeypot cases were handled correctly
  - the rate limit returned 429 on the second attempt from one address

Production untouched, checked read-only after the push:

- `www.gogulf.co` still points to `dpl_8S7BZQ8xKWaNAw8aKFUF5JqJDcCK` (commit 7bb3093,
  5 Sep 2026). `main` is still 7bb3093.
- The five production environment variables are unchanged since 11 Aug 2026. Every
  change was to a staging-scoped variable.
- DNS for `gogulf.co`: the same 12 records.
- Production data:
  - job applications 9 (8 at the previous check), storage objects 22 (20), 24.81 MB (24.12 MB)
  - auth users 0
  - newest application at 11:37 UTC on 11 Sep 2026
  Nothing in this phase can write to production: local builds use local Supabase,
  staging uses its own project, and no test submits the apply form. So this is a real
  application through the live site, not test data.

Closing checks, 11 Sep 2026, after the Lighthouse and INP runs (17:15 UTC):

- **No EmailJS anywhere.** Not in `package.json` or the lockfile, not in `node_modules`,
  no runtime reference in `app/`, `components/`, `lib/` or `content/`, and no client
  chunk of the build that references it. Every form posts to `/api/forms/*` and sends
  through Resend. The three `NEXT_PUBLIC_EMAILJS_*` variables still exist on Vercel for
  production, which runs its EmailJS build from `main` until the cutover.
- **Staging** serves 43685d3 (`gogulf-ckzme1rim`, Ready, `bom1`).
- **Production, re-checked read-only:**
  - `www.gogulf.co` → `dpl_8S7BZQ8xKWaNAw8aKFUF5JqJDcCK` (7bb3093); origin `main` = 7bb3093
  - the five production variables unchanged since 11 Aug 2026
  - DNS: the same 12 records
  - data: 9 applications, 22 objects, 24.81 MB, 0 auth users — identical to the check
    above, so nothing was written in between
  - production auth settings: unchanged Supabase defaults

Not done in 2B, and carried to 2D: a TalkBack pass on a real Android phone, and the
budgets on a real mid-range device.
