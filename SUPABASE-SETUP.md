# Connecting Document Uploads to Supabase

The Apply page (`/jobs/apply`) lets candidates upload their **CV, a passport copy, and
other documents** (certificates, experience letters, etc.). Those files — and the
application details — are saved to Supabase. The notification and confirmation emails
are sent separately, through Resend on the server (`/api/forms/job-application`);
Supabase is where the actual files and a searchable record of every application live.

Production project: **https://julbqkeyvzwluayokcdi.supabase.co**. Staging uses its own
project, `gogulf-staging` — see `docs/STAGING.md` §6. Never point staging or a local
machine at production.

## Step 1 — Get your API key

In the Supabase Dashboard for the project: **Project Settings → API Keys**.

Copy the **`anon` `public`** key (older projects) or the **`publishable`**
key (`sb_publishable_...`, newer projects) — whichever is shown.

⚠️ **Do not** copy the **`service_role`** / **`secret`** key for this. That key
bypasses all security rules — putting it in a `NEXT_PUBLIC_*` variable would
expose it to every visitor's browser, and anyone could read or delete every
applicant's documents. The `anon`/`publishable` key is safe for this: it's
designed to be public, and the database rules below (Row Level Security)
restrict what it can do to "submit new applications only."

## Step 2 — Add the keys to the environment

Set these in the environment's Vercel variables (for local development,
`npm run env:local` writes the local stack's values for you):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_or_publishable_key
```

Both are inlined at build time, so a change needs a redeploy.

## Step 3 — Create the table + storage bucket (one-time)

Apply the migrations in `supabase/migrations/` to the project. The first,
[`0001_job_applications.sql`](supabase/migrations/0001_job_applications.sql), creates:

- A `job_applications` table — one row per submission (name, email, phone,
  role applied for, and the storage path of each uploaded file).
- A **private** `job-applications` storage bucket for the actual files.
- Row Level Security rules that allow the website to **insert only** — the
  public key this site uses can create new applications but can never read,
  list, edit, or delete anyone's data or documents back out again. Documents
  aren't publicly downloadable by link.

For staging, `npm run db:staging -- push` applies them to `gogulf-staging` only.

## Step 4 — Reviewing submitted applications

Since documents are private (not public links), you review them by logging
into the Supabase Dashboard directly — this is intentional, so passport
scans etc. aren't sitting behind a guessable public URL:

- **Table Editor → `job_applications`** — every submission, searchable/filterable,
  with the applicant's details and which role they applied for.
- **Storage → `job-applications`** — one folder per application (folder name
  = the row's `id` in the table above), containing their CV, passport, and
  any other documents.

The recruiter notification email includes that same `id` as the submission reference —
use it to jump straight to the right folder.

## File limits

- CV: PDF or Word (`.pdf`, `.doc`, `.docx`)
- Passport: PDF, JPG or PNG
- Other documents: any of the above, multiple files allowed
- **8MB per file** (enforced in the browser before upload; the bucket itself
  hard-caps at 10MB per file as a backstop)

To change these limits, edit `MAX_FILE_SIZE` and the `accept=` attributes in
`components/ApplyForm.js`, and the `file_size_limit` value in the migration
SQL (re-run just that `insert into storage.buckets ...` statement with a new
value to change it on an already-created bucket).

## Later — giving recruiters a one-click download link instead

Right now, viewing documents means logging into the Supabase Dashboard. The staff
workspace (Phase 4) replaces this with short-lived signed download links issued on the
server after a permission check — never a browser key.
