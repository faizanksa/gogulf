/**
 * Jobs as the staff workspace reads them — through the signed-in staff member's own
 * session (createServerSupabase), so RLS decides what each role sees. Never the
 * service-role client.
 */

import "server-only";

import { PAGE_SIZE, rangeOf } from "@/lib/admin/params";
import { createServerSupabase } from "@/lib/supabase/server";
import type {
  JobApplicationAccess,
  JobAvailability,
  JobClassification,
  JobStatus,
  TableRow,
} from "@/types/database";
import { todayInIndia } from "./model";

export type JobRow = TableRow<"jobs">;

export interface StaffJob extends JobRow {
  category: { id: string; slug: string; name: string; classification: JobClassification; is_active: boolean } | null;
  creator: { full_name: string; email: string } | null;
  updater: { full_name: string; email: string } | null;
  applications: { count: number }[];
}

const STAFF_JOB_SELECT =
  "*, category:job_categories(id,slug,name,classification,is_active), creator:staff_users!jobs_created_by_fkey(full_name,email), updater:staff_users!jobs_updated_by_fkey(full_name,email), applications:job_applications(count)";

export const PROMOTION_FILTERS = ["featured", "lapsed", "standard"] as const;
export type PromotionFilter = (typeof PROMOTION_FILTERS)[number];

export interface JobListFilters {
  q: string;
  status: JobStatus | "";
  classification: JobClassification | "";
  category: string;
  availability: JobAvailability | "";
  promotion: PromotionFilter | "";
  access: JobApplicationAccess | "";
  page: number;
}

export function applicationCount(job: Pick<StaffJob, "applications">): number {
  return job.applications?.[0]?.count ?? 0;
}

export async function listStaffJobs(filters: JobListFilters): Promise<{ jobs: StaffJob[]; total: number; failed: boolean }> {
  const supabase = await createServerSupabase();
  const { from, to } = rangeOf(filters.page, PAGE_SIZE);
  const today = todayInIndia();

  let query = supabase.from("jobs").select(STAFF_JOB_SELECT, { count: "exact" });
  if (filters.q) query = query.or(`title.ilike.*${filters.q}*,reference.ilike.*${filters.q}*,city.ilike.*${filters.q}*`);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.classification) query = query.eq("classification", filters.classification);
  if (filters.category) query = query.eq("category_id", filters.category);
  if (filters.availability) query = query.eq("availability", filters.availability);
  if (filters.access) query = query.eq("application_access", filters.access);
  if (filters.promotion === "standard") query = query.eq("promotion", "standard");
  if (filters.promotion === "featured") query = query.eq("promotion", "featured").or(`featured_until.is.null,featured_until.gte.${today}`);
  if (filters.promotion === "lapsed") query = query.eq("promotion", "featured").lt("featured_until", today);

  const { data, count, error } = await query.order("updated_at", { ascending: false }).range(from, to);
  if (error) return { jobs: [], total: 0, failed: true };
  return { jobs: (data ?? []) as unknown as StaffJob[], total: count ?? 0, failed: false };
}

export async function getStaffJob(id: string): Promise<StaffJob | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createServerSupabase();
  const { data } = await supabase.from("jobs").select(STAFF_JOB_SELECT).eq("id", id).maybeSingle();
  return (data as unknown as StaffJob | null) ?? null;
}

export interface CategoryRow {
  id: string;
  slug: string;
  name: string;
  classification: JobClassification;
  parent_id: string | null;
  sort_order: number;
  is_active: boolean;
}

export async function listCategories(): Promise<CategoryRow[]> {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("job_categories")
    .select("id,slug,name,classification,parent_id,sort_order,is_active")
    .order("classification")
    .order("sort_order")
    .order("name");
  return (data ?? []) as CategoryRow[];
}

export interface AuditEntry {
  id: string;
  action: string;
  actor_type: string;
  actor_label: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  occurred_at: string;
}

/** The audit trail for one record. Empty for a role without audit.view — RLS filters it. */
export async function auditTrail(entityType: string, entityId: string, limit = 40): Promise<AuditEntry[]> {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("audit_logs")
    .select("id,action,actor_type,actor_label,old_values,new_values,occurred_at")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("occurred_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as AuditEntry[];
}
