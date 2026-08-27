# Go Gulf — Website Handoff for Developer

This package contains the complete source for **www.gogulf.co**.

It is now a **Next.js (App Router) app**. It still builds down to plain static
HTML/CSS/JS — there's no server required in production — but there's a Node.js
build step in front of it now.

## What's in this folder

```
app/                 Routes (App Router) — one folder per page
  layout.js            Shared <html>/<head>/<body>, Header, Footer, site metadata
  page.js               Home
  about/page.js         About
  services/page.js      Services (with Service Inquiry form)
  jobs/page.js           Jobs Available (listings + filters + JobPosting JSON-LD)
  jobs/apply/page.js    Apply form (own page, prefilled from the job clicked)
  candidates/page.js    For Candidates
  employers/page.js     For Employers
  contact/page.js        Contact
  globals.css           Shared stylesheet (was styles.css)
  icon.png               Favicon source (was assets/logo-circle.png)
  apple-icon.png         180×180 Apple touch icon (generated from icon.png)
  robots.js               Generates /robots.txt at build time
  sitemap.js               Generates /sitemap.xml at build time
  manifest.js               Generates /manifest.webmanifest (PWA) at build time
components/          Header, Footer, JsonLd, and the three EmailJS-backed forms
  ApplyForm.js          Form used by app/jobs/apply/page.js — CV/passport
                        upload (Supabase) + email notification (EmailJS)
  JsonLd.js               Renders a <script type="application/ld+json"> tag
lib/
  jobs-data.js          Job listings — edit this file to add/remove jobs
  seo.js                  Site-wide SEO constants (URL, contact, social) +
                          per-page metadata/breadcrumb JSON-LD helpers
  job-schema.js            Turns jobs-data.js into JobPosting JSON-LD
  emailjs.js             EmailJS send helper, reads keys from env vars
  supabase.js             Supabase client + document upload helper, reads
                          keys from env vars
supabase/migrations/  SQL to run once in the Supabase SQL Editor (see
  0001_job_applications.sql   SUPABASE-SETUP.md) — creates the applications
                        table + private storage bucket
public/assets/        Logo files + og-image.jpg (social share image), served
                      as-is at /assets/...
public/icons/          192×192 / 512×512 PWA icons referenced by manifest.js
public/llms.txt         Plain-text site summary for AI assistants/crawlers
EMAILJS-SETUP.md       How the inquiry/apply forms send email (needs API keys)
SUPABASE-SETUP.md      How CV/passport/document uploads are stored (needs API keys)
.env.local.example     Template for your site URL + EmailJS + Supabase keys —
                       copy to .env.local
```

## SEO

The site generates `robots.txt`, `sitemap.xml`, a PWA manifest, per-page Open
Graph/Twitter cards, canonical URLs, and JSON-LD structured data
(Organization, WebSite, BreadcrumbList, and schema.org `JobPosting` for every
listing in `lib/jobs-data.js`) automatically at build time — nothing to
configure. Everything reads from `lib/seo.js`, which defaults to
`https://www.gogulf.co`; if the site is ever deployed to a different domain,
set `NEXT_PUBLIC_SITE_URL` accordingly (see `.env.local.example`) and rebuild.

To add a new page, give it its own `metadata` export via
`pageMetadata({ title, path, description })` from `lib/seo.js` so it gets a
canonical URL and social card consistent with the rest of the site — see any
existing `page.js` for the pattern.

Once live, submit `https://www.gogulf.co/sitemap.xml` to Google Search
Console and Bing Webmaster Tools.

## Local development

Requires [Node.js](https://nodejs.org) 18.18+ (20+ recommended).

```bash
npm install
npm run dev
```

Opens at http://localhost:3000 (or the next free port) with hot reload.

## Building for deployment

```bash
npm run build
```

This produces a static export in the **`out/`** folder — plain `.html`, `.css`
and `.js` files, no Node server needed at runtime.

## Deployment steps

1. Run `npm install && npm run build` (locally or in your host's CI/build step).
2. **Upload the contents of `out/`** (not the whole repo), preserving folder
   structure, to the web server root — e.g. via cPanel File Manager, FTP/SFTP,
   Netlify, Vercel, or GitHub Pages.
   - Netlify/Vercel: point the build command at `npm run build` and the publish
     directory at `out` and they'll do this step for you on every push.
3. **Point the domain** `www.gogulf.co` (and ideally `gogulf.co` → redirect to `www.`)
   at the hosting via DNS (A record / CNAME, depending on the host).
4. `out/index.html` is the site's home document — most hosts detect this automatically.
5. **Enable HTTPS** (Let's Encrypt / host-provided SSL) — required for the WhatsApp
   links and forms to work smoothly on all browsers.

## Before going live — two required setup steps

1. **Email.** The Service Inquiry form (`app/services`), Apply form
   (`app/jobs/apply`) and Contact form (`app/contact`) send email via EmailJS
   and **will not send email until configured**. Copy `.env.local.example` to
   `.env.local` and fill in your three EmailJS keys (see `EMAILJS-SETUP.md`).
2. **Document uploads.** The Apply form's CV/passport/document upload
   **will not work until configured**. Fill in the two `NEXT_PUBLIC_SUPABASE_*`
   keys in the same `.env.local`, and run the one-time SQL migration (see
   `SUPABASE-SETUP.md`).

Then rebuild (`npm run build`) so the static export picks both up. Takes
about 15 minutes total.

If deploying via Netlify/Vercel, set the same five `NEXT_PUBLIC_EMAILJS_*` /
`NEXT_PUBLIC_SUPABASE_*` values as environment variables in the site's
dashboard instead of a local `.env.local` file.

## Notes for the developer

- `npm install` / `npm run build` are required now — this is no longer a
  zero-build hand-written site, though it still deploys as one.
- Fonts (Google Fonts) load from CDN via `app/globals.css` — make sure the
  production server allows outbound requests to `fonts.googleapis.com`
  (standard on all hosts, just flagging in case of a locked-down CSP).
- EmailJS is now the `@emailjs/browser` npm package (bundled into the build)
  instead of a CDN `<script>` tag — same behaviour, one less external request.
- CV/passport/document uploads go straight from the browser to Supabase
  Storage using `@supabase/supabase-js` and the public `anon` key — no
  server needed, same static-export deployment as everything else. Uploaded
  documents are private (not publicly linkable); review them via the
  Supabase Dashboard, not this website. See `SUPABASE-SETUP.md`.
- To add/remove job listings later, only `lib/jobs-data.js` needs editing — no
  page changes.
- All contact numbers/emails (WhatsApp/call +91 99363 09015, careers@gogulf.co,
  business@gogulf.co) live in `lib/seo.js` (`CONTACT`), `components/Header.js`
  and `components/Footer.js` — edit those if these change, instead of
  searching every page.
