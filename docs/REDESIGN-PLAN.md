<p class="eyebrow">Phase 2A · Discovery &amp; product architecture</p>

# Go Gulf Redesign Plan

<p class="lede">Make Go Gulf checkable before making it attractive. The people deciding whether to trust this company — a job seeker, the family lending them the fee, a Gulf HR manager — need facts they can verify, a short path on the phone they actually use, and a site that loads on a patchy connection.</p>

<div class="facts"><span>Prepared <b>11 Sep 2026</b></span><span>Status <b>for review — nothing built</b></span><span>Production <b>untouched · 7bb3093</b></span><span>Review builds <b>staging.gogulf.co</b></span></div>

<ol class="route" aria-label="Phase 2 sequence">
<li class="here"><b>2A · now</b><span>Discovery &amp; plan</span></li>
<li><b>2B</b><span>Foundation</span></li>
<li><b>2C</b><span>Pages</span></li>
<li><b>2D</b><span>QA &amp; sign-off</span></li>
<li><b>2E · separate approval</b><span>Production cutover</span></li>
</ol>

## At a glance

**The thesis.** The current site argues for trust with adjectives — *genuine, verified, 100%, thousands, direct approval* — several of which nobody can currently evidence. The redesign replaces adjectives with facts a stranger can check (registered company, CIN, office, the one set of official channels, fees quoted in writing), gives each audience its own door, and rebuilds the front end so a job seeker on a mid-range Android phone gets a fast, legible page instead of 2.3 MB of images and 173 KB of JavaScript to render text.

**Four questions block final copy — not design or engineering.**

| # | Question | Why it blocks |
| --- | --- | --- |
| D1 | Does the company hold an overseas **Recruiting Agent registration** (Emigration Act)? | Decides how recruitment may be described, and whether a registration number must appear on every job advert |
| D2 | Which **travel/tour services** are actually sold? | `/travel` cannot be written without it; nothing will be invented |
| D3 | The **claims register** (§10): placements, 2008 heritage holder, offices, countries, sectors, response times | Home, About, the social-share image and structured data all depend on it |
| D4 | Are the **six job listings** real and current? Three are already past their structured-data expiry | Jobs pages and JobPosting markup cannot ship on unconfirmed listings |

**What can start now:** design tokens, typography, components, accessibility infrastructure, the asset fixes, route architecture, the staff-versus-customer session guard, the content and SEO layers, and the job/apply experience with placeholder-flagged content.

**Recommended changes to earlier decisions** are collected at the end, each with its reason and trade-off. None is applied until this plan is approved.

## 1. Existing-site audit

### 1.1 Two versions of the site exist

| | Live production (`7bb3093`) | Local `main` / staging (`b9ff284`) |
| --- | --- | --- |
| Company name | "Chaudhary Gulf Travels Private Limited" (superseded) | Faizan Chaudhary Gulf Travels Private Limited — MCA record |
| `foundingDate` in JSON-LD | `"2008"` | `2024-02-22` (MCA) |
| Heritage copy | "20+ Years of Trust · Since 2008", "Group Heritage" | "Industry experience since 2008" |
| Process | "14 Step Managed Process" beside a 10-step diagram | 10 steps |
| Forms | EmailJS (browser) | Resend (server), EmailJS still switchable |
| Supabase | production `julbqkeyvzwluayokcdi` | staging `wxolbnhyzktfjdvcnixc` |

The redesign's **content** baseline is local `main`; its **SEO** baseline is the 13 live URLs. Until cutover, the live site keeps publishing the superseded identity and claims — production stays untouched by instruction, so the only fix is the cutover itself (§21).

### 1.2 What is there

| Area | Finding |
| --- | --- |
| Routes | 13 pages + `/sitemap.xml`, `/robots.txt`, `/manifest.webmanifest`, `/llms.txt`, `/icon.png`, `/apple-icon.png`, 3 form API routes. All static. |
| Components | 9: `Header` (whole header is a client component), `Footer`, `JobsBoard`, `ApplyForm`, `ContactForm`, `ServiceInquiryForm`, `LegalPage`, `JsonLd`, plus `lib/` helpers |
| Styling | One 637-line `globals.css`; **72 inline `style={{…}}` overrides across 14 files**; tokens named `--gold`/`--teal` that actually hold greens; beige leftovers from an earlier palette (`#5C5548`, header `rgba(251,248,243,.92)`) |
| Type | Google Fonts `@import` inside CSS (render-blocking): Sora, Public Sans, IBM Plex Mono — 10 font files; Plex Mono used for uppercase 10–11 px labels throughout |
| Brand | Falcon-in-circle logo (raster, 1254 px); green `#1C9D4A`/`#1FB854` on near-black; "boarding pass" form panels; a 10-step "route" timeline |
| Jobs | Six jobs hard-coded in `lib/jobs-data.js`; list page with client-side filters; no detail pages |
| Forms | Contact, Service inquiry (14 services in one select), Job application (CV + passport upload to Supabase, then email) |
| Email | Resend server routes with Zod, honeypot, rate limit (Phase 1.5) — sound |
| Supabase | Browser anon-key upload/insert for applications (legacy, replaced in Phase 5) |
| Route protection | `proxy.ts` gates `/admin` and `/portal` on "a session exists"; login pages exempt (fixed in Phase 1.6) |
| Environments | Static export by default, `PLATFORM_MODE=server` on staging; isolation guard; staging noindex |
| Analytics | None. The privacy policy states there is none and no cookies are set |
| Legal | Five policy pages on a shared `LegalPage` shell with table of contents; all facts from `lib/legal.js` |
| SEO | Per-page metadata helper, canonicals, BreadcrumbList, Organization/WebSite graph, JobPosting, AI-crawler-friendly robots, generated `llms.txt` |

### 1.3 Measured baseline

Measured on the static export of local `main` and against the public production site (read-only).

| Measure | Value |
| --- | --- |
| JavaScript on every page | **561 KB raw / 173 KB gzip**, 7 chunks — even on text-only legal pages |
| `/services` JavaScript | 938 KB raw / **260 KB gzip** (adds Zod + EmailJS to the browser) |
| `/jobs/apply` JavaScript | 806 KB raw / **237 KB gzip** (adds supabase-js + EmailJS) |
| Favicon `/icon.png` | **1,912,296 bytes** (1254 × 1254) — confirmed live |
| Header/footer logo | the same 1.9 MB file, displayed at 46 px; three byte-identical copies in the repo |
| Unused assets | `go-gulf-banner.png` 1.8 MB, `logo-small.png` 31 KB — referenced nowhere |
| Manifest icon 512 | 353 KB |
| Legal page HTML | 116–117 KB raw (28–29 KB gzip) |
| CSS | 22 KB, plus the Google Fonts stylesheet and 10 font files |

A PageSpeed baseline could not be taken — Google's keyless API returned 429. Lighthouse and axe baselines are the first task of 2B.

### 1.4 URL hygiene on production — already clean

| Request | Response |
| --- | --- |
| `/about.html`, `/index.html` | 404 |
| `/about/` | 308 → `/about` |
| `https://gogulf.co/` | 308 → `https://www.gogulf.co/` |
| `http://www.gogulf.co/` | 308 → `https://` |
| unknown path | 404 (default page) |

There is no redirect debt: the 13 canonical URLs are the complete set to preserve.

## 2. Problems identified

<span class="chip remove">Critical</span> blocks trust, compliance or access · <span class="chip verify">High</span> costs conversions or rankings · <span class="chip redesign">Medium</span> slows the team or erodes quality

| ID | Severity | Problem | Evidence |
| --- | --- | --- | --- |
| P1 | <span class="chip remove">Critical</span> | Recruitment licence position unknown while the site presents as an overseas recruitment agency for six ECR countries | `lib/legal.js` records no licence; `docs/LEGAL-DATA-MIGRATION.md` §5b |
| P2 | <span class="chip remove">Critical</span> | **The social-share image contradicts the site.** Shown on every link preview (WhatsApp included): "20+ Years of Trust", "Thousands of Placements", "Direct Approval, MOFA Compliant", "100% Guidance", a **Corporate Office in Sharjah** and **Marketing Office in Jeddah**, phone **+91 99353 09015** (the site uses +91 99363 09015), domain **gulftravels.co**, and a typo ("SUBMIT UE RESUM") | `public/assets/og-image.jpg`, referenced by `lib/seo.js` for every page |
| P3 | <span class="chip remove">Critical</span> | Unevidenced claims in page copy and `llms.txt`: "Thousands of Placements — Every Year", "Direct Approval, MOFA Compliant — Genuine &amp; Legal", "every employer verified" | `app/page.js`, `app/about/page.js`, `app/llms.txt/route.js` |
| P4 | <span class="chip remove">Critical</span> | Every primary button fails contrast: white on `#1FB854` is **2.61:1** (AA needs 4.5:1). Footer WhatsApp button 1.98:1 | `.btn-gold`, `.btn-whatsapp` |
| P5 | <span class="chip remove">Critical</span> | JobPosting markup breaks Google's guidelines: six postings on a list page, all with `url: /jobs`; expiry computed as posted + 45 days, so **three jobs are past expiry and one expires today** while still shown as open; whether the jobs are real is unconfirmed | `lib/job-schema.js`, `lib/jobs-data.js`, decision I9 |
| P6 | <span class="chip verify">High</span> | 1.9 MB favicon and 1.9 MB logo on every page view | §1.3 |
| P7 | <span class="chip verify">High</span> | 173 KB gzip JavaScript to render mostly static text; Zod and EmailJS shipped to the browser | §1.3 |
| P8 | <span class="chip verify">High</span> | Render-blocking third-party font import (and a third-party request the privacy policy has to disclose) | `globals.css:11` |
| P9 | <span class="chip verify">High</span> | The job-seeker's primary CTA leaves the site for WhatsApp: no record, no confirmation, no attribution. The on-site application demands CV and passport files at first touch | `Header.js`, `app/page.js`, `ApplyForm.js` |
| P10 | <span class="chip verify">High</span> | Employers are routed to a generic 14-option form shared with candidates; nothing asks for trades, headcount, location or timeline | `/services#inquiry` |
| P11 | <span class="chip verify">High</span> | No job detail pages: nothing to link from a WhatsApp post, nothing for search to rank per role | `/jobs` only |
| P12 | <span class="chip verify">High</span> | No travel presence although "travel agents and tour operators" is the company's registered activity | MCA record; `LEGAL-DATA-MIGRATION.md` §5a |
| P13 | <span class="chip verify">High</span> | Accessibility: menu button has no `aria-expanded`, no Escape, no focus return; no skip link; body links distinguished by colour alone (3.52:1); hints 3.01:1; field errors not tied to inputs; inputs disabled while sending; ~36 px menu target; footer headings skip levels | `Header.js`, `globals.css`, form components |
| P14 | <span class="chip redesign">Medium</span> | Design-system drift: 72 inline overrides, misnamed tokens, one radius (2 px) and one mono label style everywhere | §1.2 |
| P15 | <span class="chip redesign">Medium</span> | SEO hygiene: home title "Go Gulf — Go Gulf. Get Hired."; `keywords` meta; sitemap `lastmod` = build time for every page; one share image for every page; unverified GSTIN and social profiles asserted in JSON-LD; `EmploymentAgency` only | `lib/seo.js`, `app/sitemap.js` |
| P16 | <span class="chip redesign">Medium</span> | The WhatsApp number is hard-coded in about ten places instead of `CONTACT` | `grep wa.me` |
| P17 | <span class="chip redesign">Medium</span> | "Response within 1–2 business days" printed on forms — an unconfirmed service level, against the no-invented-SLA rule in `lib/legal.js` | form side panels |
| P18 | <span class="chip redesign">Medium</span> | `proxy.ts` matches every page, so in server mode each marketing page view invokes a function just to add headers | `proxy.ts` matcher |
| P19 | <span class="chip redesign">Medium</span> | Staff login method is inconsistent across documents: `docs/ARCHITECTURE.md` (approved) says Google Workspace SSO; the older audit — and my Phase 1.6 report — cited email + password | Phase 1.6 report, §19 |

## 3. What should be preserved

- **All 13 URLs**, their canonicals and the clean URL hygiene in §1.4.
- **`lib/legal.js` as the single source of company facts**, including the GSTIN as instructed, and the separation of legal identity from business heritage.
- **The five policy pages' wording** — restyled, not rewritten. Any wording change goes to the legal approver (decision B5).
- **The `LegalPage` pattern**: one shell, a generated table of contents, cross-links.
- **The SEO helpers** (`pageMetadata`, `breadcrumbJsonLd`, `absoluteUrl`), the escaping `JsonLd` component, the generated `llms.txt`, the AI-crawler policy in `robots.js`, staging noindex.
- **The form architecture**: shared Zod schemas, server routes, honeypot, rate limiting, server-side desk routing, Resend. Payload contracts stay compatible so the live apply flow is untouched until Phase 5.
- **The green identity and the falcon mark** — evolve, do not rebrand (decision I15 default).
- **"Go Gulf. Get Hired."** as the brand line.
- **The 10-step process** — real content written by the business; it gets a better presentation.
- **The boarding-pass idea**, narrowed: it becomes the confirmation receipt (reference number, route, status), not the frame of every form.
- **Security posture**: security headers, isolation guard, route guard.

## 4. What should be replaced

| Replace | With | Because |
| --- | --- | --- |
| `globals.css` + inline styles | Tokens file + CSS Modules per component | Scoped, reviewable, no drift, zero runtime |
| Google Fonts `@import` | `next/font` self-hosted, Latin + Devanagari-capable families | No render-blocking third-party request; Hindi-ready |
| Header/Footer | Server-rendered shell with one small client island for the mobile menu | Accessible navigation, less JavaScript |
| Home hero and claim strips | Trust-first hero, verifiable company facts | P2, P3 |
| `/services` as 14 unlinked cards | A catalogue that routes to audience hubs and the right form | P10 |
| JobPosting on the list page | One JobPosting per job detail page, real expiry dates | P5, P11 |
| Social-share image | New per-section share images carrying only verified facts | P2 |
| 1.9 MB raster logos and favicon | Optimised logo exports and a proper icon set; vector if the source exists | P6 |
| Client-side Zod | Native constraint validation in the browser; Zod stays authoritative on the server | P7 |
| Proxy on every page | Proxy only on `/admin` and `/portal`; headers set in config | P18 |

## 5. New information architecture

Two audiences carry the business today, a third is registered but unwritten, and everyone checks the company first.

```
Go Gulf
├── Jobs ─────────────── /jobs → /jobs/[slug] → /jobs/apply           job seekers (volume)
├── Job seekers ──────── /candidates   how it works · documents · fees · safety · FAQ
├── Employers ────────── /employers    capability · process · requirement form        (value)
├── Travel ───────────── /travel       gated on D2 — confirmed services only
├── About ────────────── /about        who we are · company facts · heritage (as confirmed)
├── Verify Go Gulf ───── /verify       NEW: identifiers, official channels, payment rules, report fraud
├── Contact ──────────── /contact      channels by purpose · office · form
├── All services ─────── /services     catalogue → hubs, keeps #inquiry
└── Legal ────────────── /pricing · /privacy-policy · /terms-and-conditions
                         /cancellation-and-refunds · /shipping-policy
Reserved, not built in Phase 2:  /portal (customers) · /admin (staff)
```

**Navigation.** Header: logo · Jobs · Job seekers · Employers · Travel (once live) · About · Contact, with one primary button, **Find a job**. WhatsApp moves out of the header button into the menu, the footer and contextual placements where it carries a prefilled reference. On mobile: logo, *Find a job*, menu.

**Labels change, URLs do not.** `/candidates` is labelled *Job seekers* — "candidate" is recruiter vocabulary. `/services` becomes *All services*.

**Footer.** Job seekers · Employers · Company (About, Contact, Verify Go Gulf) · Legal; an *Official channels* block; the operating-company line that exists today; social links only for profiles confirmed to belong to Go Gulf.

## 6. URL-by-URL decisions

<span class="chip keep">Keep</span> URL and role unchanged · <span class="chip redesign">Redesign</span> same URL, new page · <span class="chip new">New</span> · <span class="chip gate">Gated</span> waits on a decision

| URL | Decision | What changes | SEO note |
| --- | --- | --- | --- |
| `/` | <span class="chip redesign">Redesign</span> | Trust-first hero, two audience doors, latest jobs, process, employer band, verify band, contact | New title with the primary topic; brand stays in the template |
| `/about` | <span class="chip redesign">Redesign</span> | Who we are, company facts (CIN, incorporation, office, licence if held), heritage as confirmed | Claims removed per §10 |
| `/services` | <span class="chip redesign">Redesign</span> | Catalogue grouped by audience → hubs; `#inquiry` becomes a "What do you need?" router to the right form | Anchor preserved; old deep links keep working |
| `/jobs` | <span class="chip redesign">Redesign</span> | Server-rendered list, filters as a small island, closed jobs removed, links to detail pages | BreadcrumbList only; JobPosting moves to detail |
| `/jobs/apply` | <span class="chip redesign">Redesign</span> | Accessible form, clearer uploads, receipt-style confirmation; same data flow until Phase 5 | Stays indexable as the general application page; parameter variants canonicalise to it |
| `/candidates` | <span class="chip redesign">Redesign</span> | Job-seeker hub: how it works, documents, fees, staying safe, FAQ | Label "Job seekers" |
| `/employers` | <span class="chip redesign">Redesign</span> | Employer hub with its own requirement form | Stronger commercial intent |
| `/contact` | <span class="chip redesign">Redesign</span> | Channels by purpose, office, form with purpose routing | — |
| `/pricing` | <span class="chip keep">Keep</span> | Restyle only | Wording via legal approver |
| `/privacy-policy` | <span class="chip keep">Keep</span> | Restyle; font-processor entry changes when fonts are self-hosted (approver) | — |
| `/terms-and-conditions` | <span class="chip keep">Keep</span> | Restyle only | — |
| `/cancellation-and-refunds` | <span class="chip keep">Keep</span> | Restyle only | — |
| `/shipping-policy` | <span class="chip keep">Keep</span> | Restyle only (payment-gateway requirement) | — |
| `/jobs/[slug]` | <span class="chip new">New</span> | One page per job, with JobPosting | The largest SEO gain available |
| `/verify` | <span class="chip new">New</span> | Company identifiers, the official channels, payment rules, how to report impersonation | Answers "is Go Gulf genuine?" searches with facts |
| `/travel` | <span class="chip gate">Gated · D2</span> | Hub for confirmed travel services and an inquiry form | Not published until content is confirmed |
| custom 404 | <span class="chip new">New</span> | Helpful not-found page with jobs and contact | — |

**No redirects are required.** No existing URL is removed or renamed. Should Search Console reveal URLs from an older site, they get 301s listed in the release notes.

## 7. Primary user journeys

Mobile first throughout. The job seeker is designed for a mid-range Android phone on a variable connection, arriving from a WhatsApp link, possibly more comfortable in Hindi than English.

### Job seeker

| Step | Page | What they need | Design response |
| --- | --- | --- | --- |
| Landing | `/jobs/[slug]` from a WhatsApp post, or `/` | "Is this real, and is it for me?" | Job facts first: country, salary, type, closing date; company facts in the footer strip |
| Understand Go Gulf | `/candidates`, `/verify` | Who is this company, what will it cost | The process in plain steps; "every fee is quoted in writing before you pay"; official channels |
| Find opportunities | `/jobs` | Filter by country and trade | Server-rendered list; two filters; no dead ends — empty state offers a general application |
| Job detail | `/jobs/[slug]` | Duties, requirements, documents, next step | Sticky **Apply** bar on mobile; **Ask about this job on WhatsApp** with a prefilled message carrying the job reference |
| Apply | `/jobs/apply?job=…` | Finish on a phone | One page in three short groups; the target job pinned at the top; passport photo straight from the camera; errors summarised and linked |
| Confirmation | same page | Proof it worked | Receipt card: reference number, the job, "what happens next" in true terms, official channels, fraud warning |
| Communication | email now; WhatsApp, portal later | Status | Resend acknowledgement today; portal tracking (Phase 3/5), WhatsApp updates (Phase 9) |

Recommended for Phase 5, not Phase 2: let documents follow later, and make email optional (phone first). Both change the server contract and the live flow.

### Employer

| Step | Page | Design response |
| --- | --- | --- |
| Landing | `/employers` from search, LinkedIn or referral | Capability in one screen: sectors and trades actually recruited (D3), countries, how the process runs |
| Capability | `/employers` | Process from requirement to deployment; what the employer provides; compliance statement per D1 |
| Requirement | `/employers#requirement` | Dedicated form: company, country and city, contact, roles (trade + headcount, repeatable), timeline, accommodation/transport provided, notes |
| Acknowledgement | same page | Reference number, named next step, direct business contact |
| Future CRM | Phase 4/5 | Creates an organisation contact + a recruitment "demand" case |

### Travel customer — gated on D2

| Step | Design response |
| --- | --- |
| Landing | `/travel`: only services the business confirms, each with what is included and how it is priced ("quoted in writing") |
| Explore | One section or sub-page per confirmed service; no invented packages or prices |
| Inquiry | Service, travellers, dates, from/to, contact |
| Future | Travel case (Phase 6), portal |

### General visitor — often a family member checking the company

Home → company facts strip → `/verify` (identifiers, official channels, payment rules) → services → the only proof we can stand behind (registration, process, policies; later, consented testimonials) → contact.

## 8. Design-system proposal

**Direction.** Daylight, not night: white and a green-tinted neutral as ground, deep green for action, ink for text. The current near-black-with-bright-green look reads as nightclub or crypto; the audience needs a government-office-level sense of order with a human voice. The falcon and the green stay; the rest becomes quieter and more exact.

### Colour

Every text pair below was computed against WCAG 2.2.

<div class="swatches">
<div class="swatch" style="--sw:#0E1A13"><b>Ink 900</b><code>#0E1A13</code><span>Text, dark bands · 17.86:1 on white</span></div>
<div class="swatch" style="--sw:#3C4A42"><b>Text 700</b><code>#3C4A42</code><span>Secondary text · 9.33:1</span></div>
<div class="swatch" style="--sw:#5E6B63"><b>Muted 500</b><code>#5E6B63</code><span>Hints, meta · 5.59:1 (was 3.01)</span></div>
<div class="swatch" style="--sw:#157A3C"><b>Green 600</b><code>#157A3C</code><span>Primary action, links · 5.41:1 with white (was 2.61)</span></div>
<div class="swatch" style="--sw:#0F5E2E"><b>Green 700</b><code>#0F5E2E</code><span>Hover, pressed · 7.89:1</span></div>
<div class="swatch" style="--sw:#1FB854"><b>Green 400</b><code>#1FB854</code><span>Brand bright — on ink only · 6.84:1</span></div>
<div class="swatch" style="--sw:#1D5FA3"><b>Route blue 600</b><code>#1D5FA3</code><span>Travel line, information · 6.53:1</span></div>
<div class="swatch" style="--sw:#F3F6F4"><b>Surface 50</b><code>#F3F6F4</code><span>Section tint · green 600 on it 4.97:1</span></div>
<div class="swatch" style="--sw:#7D8B83"><b>Border 400</b><code>#7D8B83</code><span>Input borders · 3.56:1 (UI minimum 3:1)</span></div>
<div class="swatch" style="--sw:#B42318"><b>Error 600</b><code>#B42318</code><span>Errors · 6.57:1</span></div>
</div>

- **Two accents with meaning:** green is Go Gulf and recruitment; route blue marks travel and information. Semantic colours (error, warning `#8A5300` on `#FFF4E0` = 5.81:1, success) are separate from both.
- **WhatsApp** buttons use WhatsApp's dark green `#075E54` with white (7.67:1) instead of `#25D366` (1.98:1).
- **Light theme only** for the public site: one brand appearance, half the QA. Windows forced-colours mode is supported. The portal and admin may add dark later.

### Typography

<div class="specimen">
<div><small>Display · Anek Latin</small><span class="s-display">Work in the Gulf, with a company you can check.</span></div>
<div><small>Body · Mukta</small><span class="s-body">We help job seekers from India apply for jobs in Saudi Arabia, the UAE, Qatar, Oman, Kuwait and Bahrain. Every fee is quoted in writing before you pay.</span></div>
<div><small>Data · IBM Plex Mono</small><span class="s-mono">SAR 3,500 – 4,500 / month · Ref GG-J-0012 · Closes 15 Sep 2026</span></div>
</div>

- **Anek Latin** (display) and **Mukta** (body) are both from Ek Type, a Mumbai foundry, and both have **Devanagari** siblings (Anek also Malayalam) — so the Hindi pages decision L5 anticipates need no second type system. Anek's width axis gives compact, confident headings without a condensed-font look.
- **IBM Plex Mono** stays, narrowed to what it is good at: salaries, reference numbers, dates, tabular figures. No more uppercase mono form labels.
- Loaded with `next/font` (self-hosted, subset, `display: swap`); four files, preload two.

| Token | Size | Face · weight | Use |
| --- | --- | --- | --- |
| `display` | clamp(2.25 → 3.5 rem) | Anek 650, width 88 | Home h1 only |
| `h1` | clamp(2 → 2.75 rem) | Anek 650 | Page titles |
| `h2` | clamp(1.5 → 2 rem) | Anek 600 | Sections |
| `h3` | 1.25 rem | Anek 600 | Sub-sections, card titles |
| `body` | 1.0625 rem / 1.6 | Mukta 400 | 17 px — Mukta runs small; legibility matters for this audience |
| `label` | 0.9375 rem | Mukta 600, sentence case | Form labels |
| `small` | 0.875 rem | Mukta 400 | Meta, hints |
| `data` | 0.875 rem | Plex Mono 400, tabular | Money, references, dates |

### Space, layout, breakpoints

- **Spacing** on a 4 px base: 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96.
- **Containers**: page 1200 px with a clamp(16 px, 4vw, 32 px) gutter; prose 68 ch; narrow 720 px for forms.
- **Grid**: 4 columns under 768 px, 8 to 1024 px, 12 above. Sections stack to one column on phones.
- **Breakpoints, mobile first**: 480 · 768 · 1024 · 1280.
- **Radius by role**: 6 px controls, 10 px cards and panels, full pills for badges. No blanket radius.
- **Elevation**: none by default; one shadow for the sticky header and menu sheet, one for dialogs.
- **Touch targets**: 44 × 44 px minimum; buttons 48 px tall.

### Components

| Component | Specification highlights |
| --- | --- |
| Button | Primary (green 600), secondary (outline ink), text; 48 px; visible focus ring (2 px ink, 2 px white offset); loading state keeps the label and adds a spinner and `aria-busy` |
| Link | Underlined in running text, always; external links that open WhatsApp or a new tab say so |
| Form field | Visible sentence-case label; hint under label; error with icon and text, tied by `aria-describedby`; `autocomplete` and `inputmode` set; optional fields marked "optional" rather than required ones starred |
| Phone input | `+91` shown by default, accepts international numbers, normalised server-side as today |
| File input | Accepted types and size stated before choosing; image capture allowed for the passport on phones |
| Error summary | On failed submit: a linked list of problems at the top, focus moved to it |
| Card | Border only; the whole card is not a link unless it has one action; consistent inner padding |
| Badge | Job type, country, "New" (≤ 7 days), "Closes soon" (≤ 5 days) |
| Alert | Info, success, warning, error — icon plus text, never colour alone |
| Navigation | Desktop inline links; mobile full-width sheet with 48 px rows, `aria-expanded`, Escape to close, focus returned |
| Breadcrumbs | Visible on every interior page, generated from the same data as the BreadcrumbList JSON-LD |
| Section patterns | Hero, split, process stepper, facts strip, FAQ (native `details`), CTA band, job list |
| Receipt | The boarding-pass idea, reserved for confirmations: reference, route (Lucknow → country), status |

### Icons, imagery, motion, states

- **Icons**: one outline set on a 24 px grid, 1.75 px stroke, as inline SVG components (~20 icons, no icon library). Brand icons only in the footer.
- **Imagery**: real photographs only — office, team, and departures with written consent. No stock handshakes or skylines, no AI-generated people, no fabricated testimonials. Until photographs exist, the site is typographic, with one drawn illustration: the India → Gulf route.
- **Motion**: 150–200 ms colour and position transitions on interaction; the menu sheet slides in 200 ms; no scroll-triggered reveals, no parallax, no carousels. `prefers-reduced-motion` removes movement.
- **States**: every interactive component specifies default, hover, focus-visible, active, disabled and loading; every data view specifies empty and error. Error copy says what happened and what to do, and always offers a human channel.

## 9. Component architecture

```
styles/        tokens.css (the only place colours, type, space live) · base.css (reset, typography)
components/
  ui/          Button · TextLink · Icon · Badge · Alert · Card · Container · Section · Stack
               Breadcrumbs · Disclosure · Stepper · VisuallyHidden · Receipt
  form/        Field · Input · PhoneInput · Select · Textarea · Checkbox · FileInput
               ErrorSummary · SubmitButton · FormStatus
  site/        SiteHeader · MobileMenu (client) · SiteFooter · OfficialChannels
               CompanyFacts · CtaBand · TrustStrip
  jobs/        JobCard · JobList · JobFilters (client) · JobFacts · ApplyBar
               RelatedJobs · ClosedNotice
  forms/       JobApplicationForm · EmployerRequirementForm · TravelInquiryForm
               ContactForm · InquiryRouter            (client components)
  seo/         JsonLd
content/       jobs.ts · services.ts · travel.ts · faqs.ts · channels.ts — typed, validated at build
lib/seo.ts     metadata + schema builders (from lib/seo.js)
lib/legal.js   unchanged — single source of truth
```

Each component owns its CSS Module and consumes only tokens. Primitives know nothing about Go Gulf content; `site/`, `jobs/` and `forms/` compose them. The content layer hides where data comes from: Phase 5 swaps `content/jobs.ts` for Supabase behind the same `getJobs()` / `getJob(slug)` functions without touching a page.

## 10. Content strategy

**Voice.** Plain, direct, respectful. Short sentences. Indian English. Job-seeker pages at roughly school-leaving reading level; employer pages professional and specific. No hype words: *genuine, 100%, guaranteed, thousands, best*. A fact beats an adjective every time.

### Claims register

| Claim | Where | Evidence held | Recommendation |
| --- | --- | --- | --- |
| "Thousands of Placements — Every Year" | Home, About, share image | None | <span class="chip remove">Remove</span> until records exist |
| "20+ Years of Trust" | Live site, share image | None; contradicts incorporation | <span class="chip remove">Remove</span> (already gone from `main`) |
| "Industry experience since 2008" | Home, About, `llms.txt` | Pending — whose experience? | <span class="chip verify">Verify</span> Keep only as the confirmed person's or team's experience; never as founding |
| "Direct Approval, MOFA Compliant — Genuine &amp; Legal" | Home, About, share image, `llms.txt` | None; "direct approval" undefined | <span class="chip remove">Remove</span> Describe the real service: "We help arrange MOFA attestation of your documents" |
| Corporate office Sharjah, marketing office Jeddah | Share image | None; site says one office | <span class="chip remove">Remove</span> unless evidenced; then add to `lib/legal`/`lib/seo` consistently |
| Phone +91 99353 09015, domain gulftravels.co | Share image | Conflicts with site | <span class="chip verify">Verify</span> Which number and domain are real |
| "Verified employer network" / "every role verified" | About, Candidates, Jobs, `llms.txt` | No process described | <span class="chip verify">Verify</span> Keep only with a described verification step |
| "06 Gulf countries served" | Home | Not evidenced per country | <span class="chip verify">Verify</span> Otherwise "We recruit for employers in the Gulf" |
| 14 industries | Home, Candidates | Unconfirmed | <span class="chip verify">Verify</span> List only sectors actually placed |
| "No hidden charges / 100% transparent" | Home, About, `llms.txt` | Consistent with `/pricing` | <span class="chip keep">Rephrase</span> State the rule: "Every fee is quoted in writing before you pay" |
| "Within 1–2 business days" | Form panels | No commitment | <span class="chip remove">Remove</span> unless the business commits |
| "Fast processing", "Global reach, local support", "Est. Gulf Region Network" | Home, About, Employers | Vague | <span class="chip remove">Remove</span> |
| GSTIN in structured data | `lib/seo.js` `taxID`/`vatID` | Certificate not supplied (`LEGAL-DATA-MIGRATION.md` §3) | <span class="chip verify">Decide</span> Keep on pages as instructed; drop from JSON-LD until certified (D8) |
| Social profiles (`sameAs`) | Footer, JSON-LD | Unchecked ("double-check each URL") | <span class="chip verify">Verify</span> Publish only confirmed profiles |
| Recruiting Agent registration | Absent | Unknown | <span class="chip gate">D1</span> If held: registration number on every job page and in the footer |

### Rewrite examples (drafts, pending D1–D3)

| | Current | Proposed |
| --- | --- | --- |
| Home h1 | "Go Gulf. Get Hired." | "Work in the Gulf, with a company you can check." — the brand line moves beside the logo |
| Home lead | "A modern recruitment platform connecting talented professionals with genuine, verified employment opportunities…" | "We help job seekers from India apply for jobs in Saudi Arabia, the UAE, Qatar, Oman, Kuwait and Bahrain — and help employers there hire from India. Every fee is quoted in writing before you pay." |
| Trust strip | Experienced Team · Thousands of Placements · No Hidden Charges · Direct Approval, MOFA Compliant · Global Reach | Registered company · CIN U52291UP2024PTC198095 · Office in Lucknow, Uttar Pradesh · Fees quoted in writing · [registration number, if held] |
| Jobs intro | "Every role below is genuine and verified." | "Current openings. Apply online or ask about any job on WhatsApp — we'll explain what it involves before anything is paid." |

### Missing information — needed from the business

1. Recruiting Agent registration: number and validity, or confirmation none is held plus counsel's view (D1).
2. Whether the Memorandum of Association covers recruitment.
3. Travel services actually offered and how they are priced (D2; decision L2).
4. Heritage: whose experience dates to 2008, and under what name.
5. Any evidence for placement numbers.
6. The six jobs: real? employer disclosable or confidential? city, openings, requirements, benefits, closing date (D4).
7. Countries actually recruited for; sectors actually placed.
8. The official channels: which phone and WhatsApp numbers, emails, WhatsApp channel, social profiles; office hours; languages spoken.
9. Sharjah and Jeddah offices — do they exist? Is gulftravels.co the company's?
10. Brand assets: original logo artwork (SVG, AI or PDF); brand colours if specified; photographs with consent.
11. Any response-time commitment.
12. GST certificate (for structured data).
13. Search Console access (baseline and cutover monitoring); any URLs from a pre-2026 site.
14. Legal approver (B5) for the font-processor change and any analytics change to the privacy policy.

## 11. SEO strategy

| Area | Plan |
| --- | --- |
| Titles | `{Page topic} — Go Gulf`, under 60 characters, topic first. Home: "Gulf Jobs from India &amp; Manpower Recruitment — Go Gulf" (wording subject to D1). Job: "{Title} in {City/Country} — Go Gulf" |
| Descriptions | Unique per page, 140–160 characters, drawn from visible copy |
| Canonicals | Absolute via `metadataBase`; parameters stripped; `/jobs/apply?job=…` → `/jobs/apply` |
| Robots | Unchanged for public pages; `/admin`, `/portal`, `/api` disallowed and served `noindex`; staging stays noindex |
| Sitemap | Built from the content layer: every page with its own content date, every open job with its updated date; closed jobs excluded |
| Open Graph / X | Per-section share images (home, jobs, job seekers, employers, travel, verify), each carrying only verified facts; job pages get a generated image (title, country, salary) |
| Headings | One h1 per page naming its topic; h2/h3 in order; footer headings become visually small h2s |
| Internal links | Hubs ↔ jobs by trade and country; job pages → related jobs; breadcrumbs everywhere; footer links to hubs |
| Location pages | `/jobs/in/[country]` only when a country has enough live jobs and country-specific guidance to avoid thin pages — a 2C option, not a default |
| Images | Meaningful alt text; decorative images `alt=""`; dimensions set to prevent layout shift |
| Crawlability | All content server-rendered; filters enhance a complete list |
| Removed | `keywords` meta; build-time `lastmod` |
| Cutover | Automated crawl diff of the 13 URLs (status, title, canonical, JSON-LD) against production; Rich Results Test for JobPosting; Search Console watched daily for two weeks |
| Later | Hindi pages with `hreflang` when translated (L5) |

## 12. JSON-LD strategy

Rule: **every structured-data claim must match visible content and a verified fact.** No schema added for volume.

| Page | Nodes | Notes |
| --- | --- | --- |
| Every page | `Organization` + `WebSite` (one `@graph`) | Types `EmploymentAgency`, plus `TravelAgency` only once travel services are published (D2). `legalName`, CIN `identifier`, `foundingDate` 2024-02-22, registered address, logo, contact points — all from `lib/legal.js` / `lib/seo`. `sameAs`: confirmed profiles only. `taxID`/`vatID`: dropped until the GST certificate (D8) |
| Interior pages | `BreadcrumbList` | Generated from the visible breadcrumb data |
| `/jobs/[slug]` | `JobPosting` | One per page; `datePosted` and an explicit `validThrough` (required field, never computed); `hiringOrganization` = the actual employer where it may be disclosed, otherwise Go Gulf, stated in the visible text too — confirm against Google's current guidelines at build; `jobLocation` with city where known; `baseSalary` only when stated; `directApply` because the application is completed on site. Closed jobs lose the markup, show "This position has closed", and are `noindex` |
| `/jobs` | none beyond breadcrumbs | JobPosting markup on list pages is against Google's guidelines |
| `/verify`, `/about`, `/contact` | none extra | The Organization node already carries the facts |
| FAQ sections | none | Google limits FAQ rich results to government and health sites; the questions stay as content |
| Services and travel | none | `Service` markup earns nothing and would be volume for its own sake |

`llms.txt` is regenerated from the same sources, with the unverifiable sentences removed ("All recruitment is direct-approval and MOFA compliant", "genuine, screened openings").

## 13. Performance strategy

| Budget (mobile, mid-range Android, 4G) | Now | Target |
| --- | --- | --- |
| Largest Contentful Paint | not measured (§1.3) | ≤ 2.0 s lab, p75 |
| Cumulative Layout Shift | not measured | ≤ 0.05 |
| Interaction to Next Paint | not measured | ≤ 200 ms |
| Shared JavaScript per page | 173 KB gzip | ≤ 120 KB gzip; zero page-specific JavaScript on content pages |
| Form page JavaScript | 237–260 KB gzip | ≤ 150 KB gzip; supabase-js leaves the browser in Phase 5 |
| Fonts | 10 files, third-party, render-blocking | 4 files self-hosted, ≤ 120 KB, 2 preloaded |
| Home page transfer | ~2.3 MB (favicon + logo dominate) | ≤ 350 KB |
| Third-party requests on first load | Google Fonts | none |

Actions, each measured before and after:

1. **Assets first** — favicon set, logo exports, delete the unused banner, compress manifest icons (§16). Largest single win.
2. **Self-host fonts** with `next/font`; drop Sora/Public Sans; subset.
3. **Server components by default**; client islands only for the mobile menu, job filters and forms.
4. **Keep Zod on the server**: service lists move to a Zod-free module; the browser uses native constraint validation and shows the server's field errors.
5. **Remove EmailJS** at the production email switch (Phase 8 in the original plan), dropping its code from every form.
6. **Narrow the proxy** to `/admin` and `/portal`; set security headers in config so marketing pages are pure CDN hits.
7. **Images** via `next/image` (AVIF/WebP, responsive `sizes`) in server mode; explicit dimensions everywhere.
8. **Bundle analysis** in 2B to find out what the 173 KB shared baseline actually contains, before promising a lower number.
9. **Caching**: static pages at the edge; job pages on ISR (hourly) so closed jobs drop out without a deploy.

## 14. Accessibility strategy

Target: **WCAG 2.2 AA**, tested on the devices the audience uses.

| Area | Commitment |
| --- | --- |
| Contrast | All text tokens ≥ 4.5:1, UI boundaries ≥ 3:1 (§8) |
| Keyboard | Skip link; logical focus order; visible focus on every control; no keyboard traps |
| Navigation | Mobile menu with `aria-expanded`/`aria-controls`, Escape, focus return; current page marked `aria-current` |
| Semantics | Landmarks; one h1; ordered headings; lists as lists; `address` for addresses |
| Links | Underlined in text; purpose clear out of context; new-tab and WhatsApp links announced |
| Forms | Visible labels; `autocomplete`; errors in text and tied to fields; error summary with focus; inputs stay enabled while sending (`aria-busy` on the form, only the button disabled); status announced with `role="status"` |
| Touch | 44 px targets; spacing between adjacent targets |
| Reflow and zoom | Works at 320 px wide and 200 % zoom without horizontal scrolling; the 10-step process becomes a vertical stepper on phones |
| Motion | `prefers-reduced-motion` honoured |
| Media | Alt text rules; no text baked into images (the current share image fails this) |
| Language | `lang="en"`; Hindi passages marked `lang="hi"` when they arrive |
| Testing | axe in CI (Playwright, dev-only dependencies — justified below); manual keyboard pass; **TalkBack on Android** for the three primary journeys; NVDA on the forms |

## 15. Analytics &amp; conversion strategy

**Conversion hierarchy**

1. **Job application submitted** — the volume action. Primary on jobs, job pages, the job-seeker hub and the home hero.
2. **Employer requirement submitted** — the value action. Primary on the employer hub; secondary on home.
3. **Travel inquiry submitted** — primary on `/travel` once it exists; a quiet link elsewhere.
4. **Contact** — message, WhatsApp, call. Always available, never the loudest thing on a page.

No page has more than one primary action. WhatsApp stays prominent, because it is how this audience talks, but as the *assisted* path, with a prefilled message carrying the page or job reference so staff know where the person came from.

**Measurement without breaking the privacy promise.** The privacy policy says there is no analytics and no cookies. The plan keeps that true until an approved policy change ships in the same release:

| Layer | Recommendation |
| --- | --- |
| Conversions | Counted server-side: each form route records the form, page and campaign source (UTM parameters read from the landing URL and submitted with the form). No cookies. Stored in the CRM from Phase 4; until then included in the internal email |
| WhatsApp intent | A first-party `/go/whatsapp?ref=…` redirect that counts clicks by page — no personal data, no cookie (server mode) |
| Traffic | Vercel Web Analytics (cookieless) — only with the privacy-policy update approved (D7). Custom events are a paid-plan feature; conversions are already counted server-side |
| Not recommended | GA4, Meta Pixel, session replay: consent obligations, third-party data sharing, heavy scripts, little value at this volume |

KPIs: job page → apply start → submit rate; employer hub → requirement rate; WhatsApp clicks per job; share of applications from WhatsApp links versus search.

## 16. Image &amp; asset strategy

| Asset | Now | Plan |
| --- | --- | --- |
| Favicon | `app/icon.png` 1.9 MB | `favicon.ico` (16/32/48) + `icon.svg` if a vector exists + `apple-icon.png` 180 px; favicon uses a simplified falcon mark, since the full logo is illegible at 32 px |
| Header/footer logo | 1.9 MB PNG at 46 px | SVG from the original artwork (requested); interim: 2× WebP/PNG exports at display size (single-digit KB) generated from the master with `sharp` — never redrawn by hand |
| JSON-LD logo | the 1.9 MB PNG | 512 px optimised PNG |
| Manifest icons | 192 px 50 KB, 512 px 353 KB | Recompressed; maskable variant |
| Share image | One JPG with unverified claims (P2) | New set per section, facts only, no phone numbers (they change) |
| `go-gulf-banner.png` | 1.8 MB, unused, same claims | Remove from `public/`; keep in a brand archive if wanted |
| `logo-small.png` | 31 KB, unused | Remove |
| Duplicates | three copies of one file | One master in a `brand/` source folder outside `public/` |
| Photography | none | Commission or collect real photos with consent; until then, none |

Budgets: logo ≤ 10 KB, favicon set ≤ 20 KB, each share image ≤ 150 KB, content photos ≤ 120 KB at 1200 px (AVIF/WebP).

## 17. Technical architecture

- **Framework unchanged**: Next.js 16.3 App Router, TypeScript (strict) for all new code, marketing JavaScript migrated as pages are rebuilt.
- **Route groups**: `app/(marketing)` gets its own layout (header, footer, organisation graph); the policy pages sit in a nested `(legal)` group; `app/(portal)/portal` and `app/(admin)/admin` become stub layouts that enforce the session kind (§19) and return `notFound()` until their phases. URLs are unchanged by groups.
- **Styling**: `styles/tokens.css` as CSS custom properties + CSS Modules. **No Tailwind now.** When admin and portal adopt Tailwind v4 (as planned), its `@theme` reads the same custom properties, so there is one token source for all three surfaces.
- **Content layer**: typed modules in `content/`, validated at build (unique slugs, required `validThrough`, required fields per job); the build fails on invalid content instead of publishing it.
- **Forms**: keep the three existing routes and their payloads. Add `employer-requirement` (and later `travel-inquiry`) routes on the same handler — Zod schema, honeypot, rate limit, server-side desk routing, Resend templates. The contact form gains a purpose field that routes server-side.
- **Build mode**: on the redesign branch, build in server mode only (D9). Production keeps deploying the static site from `main` untouched; static export is removed in the cutover commit. This buys `next/image`, generated share images, ISR and config-level headers.
- **Branching**: `phase-2/redesign` from `main`; merged into `staging` for every review checkpoint; **never into `main` before cutover approval**, because `main` deploys production.
- **Dependencies**: none new at runtime. Dev-only: Playwright + `@axe-core/playwright` for accessibility and journey tests (justified: the only way to hold the WCAG and journey commitments as pages multiply). `sharp` (already present through Next) for asset exports.

## 18. Server / client boundaries

| Piece | Server | Client | Why |
| --- | --- | --- | --- |
| Pages, hubs, policy pages | ✓ | — | Static content; no JavaScript needed |
| Site header | ✓ | `MobileMenu` (~2 KB) | Disclosure state, focus handling |
| Current-page link state | ✓ (per-page prop) | — | No `usePathname` just to underline a link |
| Job list | ✓ renders every card | `JobFilters` | Crawlable list; filtering without a round trip |
| Job page, sticky apply bar | ✓ | — | The bar is CSS |
| Forms | ✓ page shell | form component | Input, validation, submission |
| Validation | Zod, authoritative | native constraints + server field errors | Zod stays out of the bundle |
| Email | ✓ only | — | Secrets never reach the browser |
| Supabase | Phase 5: server routes | Until Phase 5: the apply upload (legacy anon flow) | Unchanged live flow |
| Session checks | ✓ proxy + layouts | — | Never trust the browser |
| Secrets | Server env only; `check:secrets` scans every build | — | Existing guard |

## 19. Future CRM / portal integration points

### Staff session versus customer session — not "a session exists"

The Phase 1 foundation already gives the two kinds different identities: a **staff** user is an auth user linked to an active `staff_users` row, and the JWT hook adds `app_staff_id`, `app_role` and `app_branch`. A **customer** is an auth user linked to a contact through `contact_identities` (type `auth_user`). The redesign builds the guard on that, in three layers:

| Layer | `/admin/**` | `/portal/**` |
| --- | --- | --- |
| 1 · Proxy (fast, coarse) | Verified session **with** `app_staff_id` **and** a staff sign-in method (Google Workspace per `docs/ARCHITECTURE.md`); otherwise → `/admin/login` | Verified session **without** `app_staff_id`; a staff session → sent to `/admin`; none → `/portal/login` |
| 2 · Layout (authoritative) | `is_staff()` — live, so a deactivated person is stopped within the token's lifetime | `current_contact_id()` — no linked contact → identity-linking step, not the portal |
| 3 · Database | RLS: permission + scope | RLS: own records only |

In Phase 2: a pure `sessionKind(claims)` function with unit tests, the proxy using it, and the two stub layouts. The login pages stay exempt (Phase 1.6 fix). One browser holds one Supabase session, so staff testing the portal use a separate browser profile — documented, not engineered around.

**Correction to record:** `docs/ARCHITECTURE.md` specifies Google Workspace SSO for staff. Staging currently has email + password enabled (with sign-ups off), and my Phase 1.6 report described staff login as email + password. Phase 4 should enable the Google provider restricted to `gogulf.co` and decide whether email + password stays as a break-glass path (D10).

### Other integration points

| Public surface now | Future platform |
| --- | --- |
| Form payloads carry source page, UTM and consent notice version | Phase 4: `resolve_contact` + lead case per submission |
| Job content behind `getJobs()` / `getJob(slug)` | Phase 5: jobs table, same interface |
| Application reference on the receipt | Phase 3/5: "Track this application" in the portal (OTP) |
| WhatsApp links with a reference | Phase 9: inbound matching to the contact and case |
| Travel inquiry route | Phase 6: `case_travel` |
| Footer staff link (webmail today) | Phase 4: `/admin/login` |
| "Log in" in the header — deliberately absent | Added with the portal (Phase 3) |
| Consent checkbox for WhatsApp updates (with approved wording) | Phase 4: consent records (DPDP) |

## 20. Risks &amp; trade-offs

| Risk / trade-off | Consequence | Mitigation |
| --- | --- | --- |
| Recruitment licence unresolved (D1) | A redesign that amplifies recruitment amplifies any exposure | Design proceeds; recruitment copy is finalised only after D1 |
| Live site keeps superseded claims until cutover | Search engines and share previews carry them meanwhile | Prioritise cutover readiness; the share image is the first asset replaced |
| New typefaces | Brand feels different | Same green and falcon; specimen reviewed before build (D6) |
| Server-only redesign branch (D9) | No piecemeal releases to production before cutover | Production is frozen anyway; one reviewed cutover |
| Travel gated (D2) | IA has a visible gap | Travel added when content exists; nothing invented |
| Jobs unconfirmed (D4) | JobPosting on fake or expired jobs risks Google penalties | Build with fixtures clearly marked; publish only confirmed jobs |
| Privacy-policy edits (fonts, analytics) | Need the legal approver | Batched into the cutover release (B5) |
| Region: functions Mumbai, database Tokyo | Latency on server form routes | Decide at cutover (already recorded) |
| Staff auth mismatch (P19) | Wrong login built in Phase 4 | Settle D10 before Phase 4 |
| Low-end devices | Heavy pages fail the core audience | Budgets enforced in 2D; tested on a real mid-range Android |
| Scope creep | Delays | Sequence in §21 with review checkpoints; admin and portal stay out |

## 21. Proposed implementation sequence

Every checkpoint deploys to `staging.gogulf.co` for review. Production is untouched until 2E, which needs its own approval.

| Step | Work | Checkpoint |
| --- | --- | --- |
| **2B-1** Baseline | Branch; Lighthouse and axe baselines of today's staging; bundle analysis | Numbers recorded |
| **2B-2** Assets | Favicon set, logo exports, manifest icons, remove unused files | Before/after bytes |
| **2B-3** System | Tokens, fonts, base typography, primitives, form kit, focus and skip link; an internal specimen page (staging only, `noindex`) | Design system review |
| **2B-4** Shell | Route groups, header, footer, breadcrumbs, 404; narrowed proxy and config headers; `sessionKind` guard + stub layouts + tests | Navigation and a11y review |
| **2B-5** Content &amp; SEO layer | Typed content, validation, metadata and schema builders, sitemap dates, `llms.txt` | Crawl of staging |
| **2C-1** Jobs | List, detail, apply, receipt; JobPosting moved | Journey review (job seeker) |
| **2C-2** Home + hubs | Home, Job seekers, Employers + requirement form and route | Journey review (employer) |
| **2C-3** Company | About, Contact, Services router, Verify | Content review against the claims register |
| **2C-4** Policies | Pricing and four policies restyled; wording untouched | Legal approver |
| **2C-5** Travel | Only after D2 | Content review |
| **2D** QA | axe + manual keyboard, TalkBack, NVDA; budgets on a real device; crawl diff vs production; Rich Results; cross-browser; forms end to end with Resend | Go/no-go for cutover |
| **2E** Cutover | Separate approval: production variables, static export removed, `main` pushed, policy updates shipped together, Search Console watch | — |

## 22. Definition of done

- [ ] All 13 URLs return 200 on staging with the new design; no URL removed or renamed; crawl diff against production reviewed.
- [ ] Every page has a unique title, description and canonical, one h1, and breadcrumbs matching its BreadcrumbList.
- [ ] Structured data validates; JobPosting passes the Rich Results Test on every open job; no structured-data claim without a visible, verified counterpart.
- [ ] Claims register resolved: every row verified, rephrased or removed; the new share images carry no unverified claim.
- [ ] WCAG 2.2 AA: axe reports no serious or critical issues; keyboard pass; TalkBack pass on the three primary journeys.
- [ ] Budgets met on staging (§13), including one real mid-range Android device.
- [ ] Contact, service inquiry, job application and employer requirement flows pass end to end on staging with Resend; validation, honeypot and rate-limit tests green.
- [ ] Session guard: unit tests for staff, customer, anonymous and deactivated cases; `/admin` and `/portal` stubs `noindex` and gated.
- [ ] Gates green: lint, typecheck, unit tests, `build:server`, `check:secrets`, isolation guard, database suites.
- [ ] Privacy-policy changes (fonts; analytics if adopted) approved and staged with the cutover.
- [ ] Production untouched until the cutover is approved.

## Decisions needed

| ID | Decision | Recommendation | Blocks |
| --- | --- | --- | --- |
| D1 | Recruiting Agent registration held? | If yes, publish the number on job pages and footer; if no, counsel reviews positioning | Recruitment copy |
| D2 | Travel services offered and pricing model | List only what is sold today | `/travel` |
| D3 | Claims register (§10) | Remove what cannot be evidenced | Home, About, share images |
| D4 | The six jobs: real, current, details | Confirm or replace before JobPosting ships | Jobs pages |
| D5 | Logo source artwork and photographs | Supply originals; commission photos later | Asset quality |
| D6 | Typeface change (Anek Latin + Mukta) | Approve after seeing the specimen in 2B-3 | Design system |
| D7 | Analytics | Server-side conversions now; Vercel Web Analytics with an approved policy update at cutover | Measurement |
| D8 | GSTIN in structured data | Remove from JSON-LD until the certificate is supplied; keep on pages | Organization schema |
| D9 | Redesign branch builds in server mode only | Yes | Engineering approach |
| D10 | Staff sign-in | Google Workspace SSO per `docs/ARCHITECTURE.md`; decide whether email + password stays as break-glass | Phase 4 |
| D11 | Legal approver (B5) | Name one person | Policy edits at cutover |
| D12 | Email optional and documents later on applications | Yes, in Phase 5 | Phase 5 scope |

## Changes to earlier decisions

| Earlier decision | Proposed change | Reason | Trade-off |
| --- | --- | --- | --- |
| Marketing styling "bespoke", Tailwind later for admin | Same, but **one token source** (CSS custom properties) that Tailwind's `@theme` reads later | Two systems would drift | None meaningful |
| Sora + Public Sans + Plex Mono | **Anek Latin + Mukta**, Plex Mono for data only | Devanagari-ready for Hindi; better legibility; self-hosted | Visual change; needs D6 |
| JobPosting on `/jobs` with computed expiry | JobPosting on detail pages, explicit expiry | Google guidelines; expired jobs shown as open | New pages to maintain |
| Proxy matches every route | Proxy on `/admin`, `/portal` only; headers via config | Marketing pages served without a function call | Headers live in two places until cutover |
| Static export kept buildable during Phase 2 | Server mode only on the redesign branch | Unlocks image optimisation, ISR, generated share images | No partial production release before cutover |
| Staff login "email + password" (Phase 0 audit; my Phase 1.6 report) | Google Workspace SSO, as `docs/ARCHITECTURE.md` already says | Correcting my own citation of a superseded document | Phase 4 enables the Google provider |
| WhatsApp as the primary job-seeker CTA | On-site application primary; WhatsApp assisted, with references | Records, confirmation, attribution | Some users prefer WhatsApp — it stays one tap away |
