# Company details presentation — staging review

**5 October 2026.** Branch: `staging`. Review URL: <https://staging.gogulf.co>.
This is a presentation change for staging only; it is not production approval.

## Changes

- `components/site/SiteFooter.tsx`: remove the registered-office address from the
  global company card. State that Go Gulf is a brand of Faizan Chaudhary Gulf
  Travels Private Limited once in the card, with CIN `U52291UP2024PTC198095` and
  GSTIN `09AALCC6656L1ZY` below. Link explicitly to company verification details.
- `components/site/SiteFooter.module.css`: group the ownership statement and
  identifiers, retaining the existing responsive grid, tokens and typography.
- `messages/en.json`: simplify the ownership sentence and verification wording;
  remove unused footer labels. Unpublished translation catalogues remain untouched.

The existing `COMPANY` / `lib/legal.js` source of truth is unchanged. No new company
page or duplicate legal constants were needed. The CompanyFacts band and homepage
company cards already limit their visible location to city/state/country.

## Where the address remains

The complete approved public address remains on `/verify`, `/contact`, and the
five policy pages (privacy, terms, pricing, refunds, shipping). Existing email
issuer information, Organization JSON-LD and `llms.txt` also retain it. The existing
omission of the private care-of name is preserved.

This reduces prominence; the address remains public and discoverable. Legal name,
CIN and GSTIN remain visible in the footer. Existing GSTIN exclusion from schema
pending its documentary verification (decision D8) is unchanged.

Razorpay integration, payment/invoice records, billing code, contact channels,
SEO configuration and corporate data are unchanged. No Supabase mutation,
production configuration change, production environment-variable change, credential
change or push to `main` is part of this release.

## Validation before publishing

- Server build and TypeScript: **PASS**, using existing branch-scoped Vercel
  Preview settings. Isolation guard: Mumbai staging `noxireidrbeqcvsirjec`, no
  Razorpay key. The original local build was blocked by network-restricted font
  downloads, then by the stopped local Supabase service; the staging-configured
  build completed all 59 static pages without changing environment files in use.
- Lint: **PASS** across application, component, content, library, test, type and
  root configuration sources. Untracked local tooling/backups were excluded.
- Relevant content, public-claims, i18n, billing and payment tests:
  **125/125 PASS** across 9 files.
- Full unit suite: **471 passed, 1 pre-existing failure**. The unchanged
  `lib/crm/case-lifecycle.test.ts` SQL extractor uses `/\n\s+end\n/`, which fails
  on the unchanged migration's Windows CRLF lines. In-memory LF normalization
  produces the expected reason counts. No CRM change was made for this task.
- Existing navigation/SEO browser checks: **11 passed, 7 viewport-specific skips**.
- Focused browser checks: **13/13 PASS** — desktop (1440 px), mobile (390 px),
  narrow reflow (320 px), both pseudo-locales including RTL, verification navigation,
  About/Contact/legal footer links, canonical URLs, descriptions and Organization
  identity/address. Footer has no street address or postcode; all identifiers match.
- Footer axe checks: no serious/critical violations on desktop or mobile. A
  screenshot-induced sticky-header clipping alert disappeared when testing from
  the normal page position. Screenshots were visually reviewed.

Local QA scripts, screenshots and downloaded staging Preview variables are in
ignored `.vercel/` paths; none belongs in the commit.

## Review before production

**Resolve homepage disclosure before promotion.** Rule 26(1) of the Companies
(Incorporation) Rules states that a company's website must publish its registered
office address and other specified details on the landing/home page. A link to
`/verify` and retained JSON-LD should not be assumed to satisfy that requirement.
Have the company secretary or counsel approve an appropriate homepage disclosure
before promoting this presentation to production. A compact homepage-only legal
disclosure is an option to review without repeating the address in every footer.

Sources checked 5 October 2026:
[ICSI's Rule 26 text](https://e-book.icsi.edu/Actpagedisplay.aspx?PAGENAME=17955),
[MCA amendment notification](https://www.mca.gov.in/Ministry/pdf/CompaniesThridAmendementRules_28072016.pdf).
No recruitment licence, government approval or other new compliance claim was added.
