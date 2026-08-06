# Connecting Document Uploads to Supabase

The Apply page (`/jobs/apply`) now lets candidates upload their **CV, a passport
copy, and other documents** (certificates, experience letters, etc.). Those
files — and the application details — are saved to your Supabase project.
This is separate from EmailJS (see `EMAILJS-SETUP.md`), which still sends the
notification + confirmation emails; Supabase is where the actual files and a
searchable record of every application live.

Your project: **https://julbqkeyvzwluayokcdi.supabase.co**

## Step 1 — Get your API key

In the Supabase Dashboard for this project: **Project Settings → API Keys**.

Copy the **`anon` `public`** key (older projects) or the **`publishable`**
key (`sb_publishable_...`, newer projects) — whichever is shown.

⚠️ **Do not** copy the **`service_role`** / **`secret`** key for this. That key
bypasses all security rules — putting it in this website's `.env.local` would
expose it to every visitor's browser, and anyone could read or delete every
applicant's documents. The `anon`/`publishable` key is safe for this: it's
designed to be public, and the database rules below (Row Level Security)
restrict what it can do to "submit new applications only."

## Step 2 — Add your keys to the website

Copy `.env.local.example` to `.env.local` (same folder as before, alongside
your EmailJS keys) and fill in:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://julbqkeyvzwluayokcdi.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_or_publishable_key
```

If you deploy via Netlify/Vercel instead of uploading `out/` by hand, add
these same two variables in that host's dashboard too, then rebuild.

## Step 3 — Create the table + storage bucket (one-time)

In the Supabase Dashboard: **SQL Editor → New query**, paste in the contents
of [`supabase/migrations/0001_job_applications.sql`](supabase/migrations/0001_job_applications.sql)
from this project, and run it. This creates:

- A `job_applications` table — one row per submission (name, email, phone,
  role applied for, and the storage path of each uploaded file).
- A **private** `job-applications` storage bucket for the actual files.
- Row Level Security rules that allow the website to **insert only** — the
  public key this site uses can create new applications but can never read,
  list, edit, or delete anyone's data or documents back out again. Documents
  aren't publicly downloadable by link.

(I don't currently have this specific Supabase project connected in my tools
— only ones under a different account showed up when I checked — so I
couldn't run this migration for you directly. If you'd rather I do it than
run it yourself, grant this project access in your claude.ai Supabase
connector settings and tell me, and I'll apply it directly next time.)

## Step 4 — Reviewing submitted applications

Since documents are private (not public links), you review them by logging
into the Supabase Dashboard directly — this is intentional, so passport
scans etc. aren't sitting behind a guessable public URL:

- **Table Editor → `job_applications`** — every submission, searchable/filterable,
  with the applicant's details and which role they applied for.
- **Storage → `job-applications`** — one folder per application (folder name
  = the row's `id` in the table above), containing their CV, passport, and
  any other documents.

The recruiter notification email (via EmailJS) includes that same `id` — cross-reference it with the `submission_id` field in the email to jump straight to a folder.

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

Right now, viewing documents means logging into the Supabase Dashboard. If
that becomes inconvenient, the next step is a small admin page or a Supabase
Edge Function that generates a temporary signed download link — that needs a
server-side `service_role` key (never a browser key), so it's a separate,
slightly bigger piece of work than what's set up here. Ask if/when you want
that.
