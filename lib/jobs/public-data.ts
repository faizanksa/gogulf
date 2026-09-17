/**
 * Reading jobs for the public website.
 *
 * The client carries the public anon key and NO cookies, deliberately:
 *   * every visitor gets the same answer, so pages stay statically generated and
 *     cacheable — a signed-in staff member browsing /jobs does not turn it dynamic;
 *   * what is readable is decided by RLS and column grants for `anon` (0012): published
 *     and closed jobs, public columns only. Drafts cannot leak through this path.
 *
 * Fetches are tagged, so a staff action that changes a job refreshes the pages that list
 * it (revalidateJobPages in lib/jobs/revalidate.ts). Time still moves on its own: a job
 * passes its closing date without any write, so reads also expire every ten minutes.
 *
 * Failure is loud. A query error throws: at build that fails the deploy, and during
 * regeneration Next keeps serving the last good page. An empty list is only ever
 * "there are no jobs", never "the database was unreachable".
 */

import "server-only";

import { createClient } from "@supabase/supabase-js";
import { cache } from "react";
import type { Database } from "@/types/database";
import { todayInIndia } from "./model";
import { jobIsOpen, orderForListing, PUBLIC_JOB_SELECT, toPublicJob, type JobRowForPublic, type PublicJob } from "./public-job";

export const PUBLIC_JOBS_TAG = "public-jobs";
const REVALIDATE_SECONDS = 600;

function publicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // No Supabase configuration (a unit test, a local build without `npm run env:local`):
  // there is nowhere to read jobs from. The production build refuses to run without it
  // (scripts/check-staging-isolation.mjs), so this cannot silently empty the live site.
  if (!url || !key) return null;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: (input, init) => fetch(input, { ...init, next: { revalidate: REVALIDATE_SECONDS, tags: [PUBLIC_JOBS_TAG] } }),
    },
  });
}

function fail(what: string, error: { code?: string; message?: string }): never {
  // The code and a short message only — never a row.
  throw new Error(`Public jobs: ${what} failed (${error.code ?? "unknown"}: ${error.message ?? ""})`);
}

/** Jobs accepting applications now, featured first. */
export const listOpenJobs = cache(async (): Promise<PublicJob[]> => {
  const supabase = publicClient();
  if (!supabase) return [];
  const now = new Date();
  const { data, error } = await supabase
    .from("jobs")
    .select(PUBLIC_JOB_SELECT)
    .eq("status", "published")
    .eq("application_access", "free")
    // Today's date is part of the URL, so the cached answer changes at midnight in India.
    .or(`availability.eq.ongoing,closes_on.gte.${todayInIndia(now)}`)
    .order("published_at", { ascending: false })
    .limit(500);
  if (error) fail("listing open jobs", error);
  const jobs = ((data ?? []) as unknown as JobRowForPublic[]).map(toPublicJob).filter((j) => jobIsOpen(j, now));
  return orderForListing(jobs, now);
});

/** One job's public page: published or closed. Drafts, reviews and archived jobs are null. */
export const getPublicJob = cache(async (slug: string): Promise<PublicJob | null> => {
  const supabase = publicClient();
  if (!supabase || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length > 160) return null;
  const { data, error } = await supabase
    .from("jobs")
    .select(PUBLIC_JOB_SELECT)
    .eq("slug", slug)
    .in("status", ["published", "closed"])
    .maybeSingle();
  if (error) fail("reading a job", error);
  return data ? toPublicJob(data as unknown as JobRowForPublic) : null;
});

/** The job an application link names, by reference — whether or not it is still open. */
export const getPublicJobByReference = cache(async (reference: string): Promise<PublicJob | null> => {
  const supabase = publicClient();
  const ref = reference.trim().toUpperCase();
  if (!supabase || !/^[A-Z0-9]+(-[A-Z0-9]+)*$/.test(ref) || ref.length > 40) return null;
  const { data, error } = await supabase
    .from("jobs")
    .select(PUBLIC_JOB_SELECT)
    .eq("reference", ref)
    .in("status", ["published", "closed"])
    .maybeSingle();
  if (error) fail("reading a job by reference", error);
  return data ? toPublicJob(data as unknown as JobRowForPublic) : null;
});
