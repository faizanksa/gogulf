/**
 * Employers as the staff workspace reads them (0022) — through the signed-in staff member's
 * session, so RLS applies employers.view at the role's scope (all / branch) to every row.
 * Never the service-role client.
 */

import "server-only";

import { PAGE_SIZE, rangeOf } from "@/lib/admin/params";
import { createServerSupabase } from "@/lib/supabase/server";
import type { EmployerStatus, TableRow } from "@/types/database";

export type EmployerRow = TableRow<"employers">;

export interface StaffEmployer extends EmployerRow {
  branch: { name: string } | null;
}

const EMPLOYER_SELECT = "*, branch:branches(name)";

export async function listEmployers(filters: { q: string; status: EmployerStatus | ""; page: number }) {
  const supabase = await createServerSupabase();
  const { from, to } = rangeOf(filters.page, PAGE_SIZE);
  let query = supabase.from("employers").select(EMPLOYER_SELECT, { count: "exact" });
  if (filters.q) query = query.or(`name.ilike.*${filters.q}*,contact_person.ilike.*${filters.q}*,email.ilike.*${filters.q}*`);
  if (filters.status) query = query.eq("status", filters.status);
  const { data, count, error } = await query.order("name").range(from, to);
  return { employers: (data ?? []) as unknown as StaffEmployer[], total: count ?? 0, failed: Boolean(error) };
}

export async function getEmployer(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createServerSupabase();
  const [employer, jobs, cases] = await Promise.all([
    supabase.from("employers").select(EMPLOYER_SELECT).eq("id", id).maybeSingle(),
    supabase.from("jobs").select("id,reference,title,status").eq("employer_id", id).order("updated_at", { ascending: false }).limit(50),
    supabase
      .from("case_recruitment")
      .select("case_id, case:cases(id,case_number,title,status)")
      .eq("employer_id", id)
      .limit(50),
  ]);
  if (!employer.data) return null;
  return {
    employer: employer.data as unknown as StaffEmployer,
    // Only the jobs and cases this person may see: each list is under its own RLS.
    jobs: (jobs.data ?? []) as { id: string; reference: string; title: string; status: string }[],
    cases: ((cases.data ?? []) as unknown as { case_id: string; case: { id: string; case_number: string; title: string | null; status: string } | null }[])
      .map((r) => r.case)
      .filter((c): c is { id: string; case_number: string; title: string | null; status: string } => c !== null),
  };
}

/** Employers for a picker: the caller's visible employers, inactive ones last. */
export async function listEmployerOptions(): Promise<{ id: string; name: string; country_code: string; status: EmployerStatus }[]> {
  const supabase = await createServerSupabase();
  const { data } = await supabase.from("employers").select("id,name,country_code,status").order("name").limit(1000);
  const rows = (data ?? []) as { id: string; name: string; country_code: string; status: EmployerStatus }[];
  return [...rows.filter((r) => r.status !== "inactive"), ...rows.filter((r) => r.status === "inactive")];
}
