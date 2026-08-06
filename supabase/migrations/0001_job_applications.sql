-- Go Gulf — job applications: documents + application record.
-- Run this once in the Supabase Dashboard -> SQL Editor (see SUPABASE-SETUP.md).
--
-- Design notes:
--   * Applicants never log in, so every write uses the public "anon" key.
--     RLS is locked to INSERT-only for that role on both the table and the
--     storage bucket — nobody holding just the anon key (i.e. anyone who
--     views the site's source) can read, list, update or delete another
--     applicant's data or documents back out again.
--   * The bucket is private (public = false). Recruiters review submissions
--     and download documents by logging into the Supabase Dashboard
--     (Table Editor + Storage), which authenticates as the project owner and
--     bypasses RLS — no extra key or backend needed for that.
--   * `id` is generated on the applicant's device (crypto.randomUUID()) and
--     reused as the storage folder name, so a document's path and its DB row
--     are always easy to correlate from the dashboard.

create table if not exists public.job_applications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  job_title text not null,
  job_country text,
  full_name text not null,
  email text not null,
  phone text not null,
  experience text,
  message text,
  cv_path text not null,
  passport_path text not null,
  other_paths text[] not null default '{}',
  page_source text
);

alter table public.job_applications enable row level security;

drop policy if exists "anon can insert job applications" on public.job_applications;
create policy "anon can insert job applications"
  on public.job_applications
  for insert
  to anon
  with check (true);

-- No select/update/delete policy is defined for anon or authenticated on
-- purpose — default-deny, so submitted applications are only readable via
-- the Dashboard (project owner).

insert into storage.buckets (id, name, public, file_size_limit)
values ('job-applications', 'job-applications', false, 10485760) -- 10 MB per file
on conflict (id) do update set file_size_limit = excluded.file_size_limit;

drop policy if exists "anon can upload job application documents" on storage.objects;
create policy "anon can upload job application documents"
  on storage.objects
  for insert
  to anon
  with check (bucket_id = 'job-applications');
