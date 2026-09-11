# Go Gulf — Deployment

The site at **www.gogulf.co** is a Next.js 16 (App Router) application deployed on
Vercel from the `gogulf` project.

| Branch | Deploys to | Build |
| --- | --- | --- |
| `main` | Production — www.gogulf.co | Static export, until the approved cutover |
| `staging` | https://staging.gogulf.co (private) | Server build (`PLATFORM_MODE=server`) |
| `phase-2/redesign` | Reviewed on staging | Server build only |

Nothing reaches production except through a reviewed merge to `main` at an approved
cutover. The cutover steps and the rollback are in `docs/STAGING.md` §9 and
`docs/MIGRATION-PLAN.md`.

## Email

All three forms (Contact, Service Inquiry, Job Application) post to server routes
under `/api/forms/*`, which validate the submission again, apply a honeypot and a rate
limit, and send through **Resend** on the server. The Resend key is server-only and is
never sent to the browser. Because the routes run on the server, the forms need the
server build.

EmailJS, the earlier browser-side service, has been removed from the code. The live
site still runs its EmailJS build from `main` until the cutover, which also retires
its three `NEXT_PUBLIC_EMAILJS_*` Vercel variables and the EmailJS account keys.

## Documents

Job-application documents are stored in a private Supabase Storage bucket. See
`SUPABASE-SETUP.md`, and `docs/STAGING.md` §6 for the staging project.

## Local development

```bash
npm install
npx supabase start -x logflare,vector,studio,postgres-meta,realtime,edge-runtime,imgproxy
npm run env:local          # point local Next.js at local Supabase
npm run dev
```

The isolation guard stops `dev` and every build if local configuration points at the
production database. The full runbook, gates and test commands are in
`docs/STAGING.md` §8.
