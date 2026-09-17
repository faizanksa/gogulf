"use client";

// ===== GO GULF — Supabase helper =====
// SETUP REQUIRED (see SUPABASE-SETUP.md):
//   1. In the Supabase dashboard: Project Settings -> API Keys, copy the
//      Project URL and the "anon" / "publishable" key. NEVER use the
//      service_role / secret key here — this file ships to the browser.
//   2. Copy .env.local.example to .env.local and fill in the two keys below.
//   3. Run supabase/migrations/0001_job_applications.sql once (SQL Editor) to
//      create the job_applications table and the private job-applications
//      storage bucket, with row-level security already locked down.
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

export const APPLICATIONS_BUCKET = "job-applications";
export const APPLICATIONS_TABLE = "job_applications";

// Applicants have no login, so uploaded files and DB rows are addressed by a
// random UUID generated on the applicant's device — unguessable, and the
// anon key has insert-only access (see the migration), so nobody but the
// project owner (Supabase Dashboard) can read applications back.
function sanitizeFileName(name) {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_").slice(-80);
}

async function uploadDocument(submissionId, label, file) {
  const path = `${submissionId}/${label}-${sanitizeFileName(file.name)}`;
  const { error } = await supabase.storage
    .from(APPLICATIONS_BUCKET)
    .upload(path, file, { cacheControl: "3600", upsert: false });
  if (error) {
    throw new Error(`Could not upload ${label} (${file.name}): ${error.message}`);
  }
  return path;
}

// Uploads the CV, passport and any extra documents to Supabase Storage, then
// writes one row describing the application. Returns the identifiers used so
// the caller can reference them in the recruiter notification email.
/**
 * @param {{ jobId?: string | null, jobTitle: string, jobCountry?: string, fullName: string, email: string,
 *   phone: string, experience?: string, message?: string, pageSource: string, cvFile: File,
 *   passportFile: File, otherFiles?: File[] }} application
 * @returns {Promise<{ submissionId: string, cvPath: string, passportPath: string, otherPaths: string[] }>}
 */
export async function submitJobApplication({
  jobId,
  jobTitle,
  jobCountry,
  fullName,
  email,
  phone,
  experience,
  message,
  pageSource,
  cvFile,
  passportFile,
  otherFiles = [],
}) {
  if (!isSupabaseConfigured) {
    throw new Error(
      "Document storage is not connected yet — add your Supabase keys to .env.local (see SUPABASE-SETUP.md)."
    );
  }

  const submissionId = crypto.randomUUID();

  const cvPath = await uploadDocument(submissionId, "cv", cvFile);
  const passportPath = await uploadDocument(submissionId, "passport", passportFile);
  const otherPaths = [];
  for (let i = 0; i < otherFiles.length; i++) {
    otherPaths.push(await uploadDocument(submissionId, `other-${i + 1}`, otherFiles[i]));
  }

  const { error: insertError } = await supabase.from(APPLICATIONS_TABLE).insert({
    id: submissionId,
    // The job this is for, when the applicant came from a job page. The database checks
    // that it is still open and records the job's own title (0013).
    job_id: jobId || null,
    job_title: jobTitle,
    job_country: jobCountry || null,
    full_name: fullName,
    email,
    phone,
    experience: experience || null,
    message: message || null,
    cv_path: cvPath,
    passport_path: passportPath,
    other_paths: otherPaths,
    page_source: pageSource,
  });
  if (insertError) {
    throw new Error(`Your documents uploaded, but saving the application failed: ${insertError.message}`);
  }

  return { submissionId, cvPath, passportPath, otherPaths };
}
