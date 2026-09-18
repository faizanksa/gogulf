/**
 * Staff, roles, the audit trail, payments and settings, as the staff workspace reads
 * them — through the signed-in person's own session, so RLS decides what each role can
 * see (0007, 0009, 0014, 0016). Never the service-role client.
 */

import "server-only";

import { PAGE_SIZE, rangeOf } from "@/lib/admin/params";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Grants, Scope } from "./rbac-model";

// ---------------------------------------------------------------------------
// Audit trail
// ---------------------------------------------------------------------------

export interface AuditRow {
  id: string;
  action: string;
  actor_type: string;
  actor_label: string | null;
  entity_type: string;
  entity_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  occurred_at: string;
}

/** Entity types that appear in the trail, with the words staff use for them. */
export const ENTITY_LABELS: Record<string, string> = {
  job: "Jobs",
  job_categories: "Job categories",
  job_application: "Applications",
  contacts: "Contacts",
  cases: "Cases",
  invoice: "Invoices",
  payment: "Payments",
  document: "Documents",
  staff_users: "Staff",
  role_permissions: "Role grants",
  settings: "Settings",
};

/** The three that record platform administration; the database shows them only to the roles that manage it. */
export const PRIVILEGED_ENTITIES: readonly string[] = ["staff_users", "role_permissions", "settings"];

export async function listAudit(filters: { entity: string; q: string; page: number }): Promise<{ rows: AuditRow[]; total: number; failed: boolean }> {
  const supabase = await createServerSupabase();
  const { from, to } = rangeOf(filters.page, PAGE_SIZE);
  let query = supabase
    .from("audit_logs")
    .select("id,action,actor_type,actor_label,entity_type,entity_id,old_values,new_values,occurred_at", { count: "exact" });
  if (filters.entity) query = query.eq("entity_type", filters.entity);
  if (filters.q) query = query.ilike("action", `%${filters.q}%`);
  const { data, count, error } = await query.order("occurred_at", { ascending: false }).range(from, to);
  return { rows: (data ?? []) as unknown as AuditRow[], total: count ?? 0, failed: Boolean(error) };
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

export interface PaymentListRow {
  id: string;
  reference: string;
  status: string;
  provider_order_id: string;
  provider_payment_id: string | null;
  amount_minor: number;
  method: string | null;
  failure_code: string | null;
  created_at: string;
  paid_at: string | null;
  failed_at: string | null;
  invoice: { id: string; reference: string } | null;
}

export const PAYMENT_STATUSES = ["created", "authorized", "paid", "failed", "refunded"] as const;

export async function listPayments(filters: { q: string; status: string; page: number }): Promise<{ rows: PaymentListRow[]; total: number; failed: boolean }> {
  const supabase = await createServerSupabase();
  const { from, to } = rangeOf(filters.page, PAGE_SIZE);
  let query = supabase
    .from("payments")
    .select("id,reference,status,provider_order_id,provider_payment_id,amount_minor,method,failure_code,created_at,paid_at,failed_at,invoice:invoices(id,reference)", { count: "exact" });
  if (filters.status) query = query.eq("status", filters.status as (typeof PAYMENT_STATUSES)[number]);
  if (filters.q) query = query.or(`reference.ilike.*${filters.q}*,provider_order_id.ilike.*${filters.q}*,provider_payment_id.ilike.*${filters.q}*`);
  const { data, count, error } = await query.order("created_at", { ascending: false }).range(from, to);
  return { rows: (data ?? []) as unknown as PaymentListRow[], total: count ?? 0, failed: Boolean(error) };
}

// ---------------------------------------------------------------------------
// Staff and roles
// ---------------------------------------------------------------------------

export interface StaffListRow {
  id: string;
  email: string;
  full_name: string;
  role_key: string;
  is_active: boolean;
  created_at: string;
  branch: { name: string } | null;
}

export async function listStaff(): Promise<{ rows: StaffListRow[]; failed: boolean }> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("staff_users")
    .select("id,email,full_name,role_key,is_active,created_at,branch:branches(name)")
    .order("is_active", { ascending: false })
    .order("full_name");
  return { rows: (data ?? []) as unknown as StaffListRow[], failed: Boolean(error) };
}

export interface RoleRow {
  key: string;
  label: string;
  description: string | null;
  is_super: boolean;
  sort_order: number;
}

export async function listRoles(): Promise<RoleRow[]> {
  const supabase = await createServerSupabase();
  const { data } = await supabase.from("roles").select("key,label,description,is_super,sort_order").order("sort_order");
  return (data ?? []) as RoleRow[];
}

export interface PermissionRow {
  key: string;
  domain: string;
  description: string | null;
}

export async function listPermissions(): Promise<PermissionRow[]> {
  const supabase = await createServerSupabase();
  const { data } = await supabase.from("permissions").select("key,domain,description").order("domain").order("key");
  return (data ?? []) as PermissionRow[];
}

/** role key → permission key → scope, for the whole catalogue. */
export async function allGrants(): Promise<Record<string, Grants>> {
  const supabase = await createServerSupabase();
  const { data } = await supabase.from("role_permissions").select("role_key,scope,permission:permissions(key)").limit(5000);
  const out: Record<string, Grants> = {};
  for (const row of (data ?? []) as unknown as { role_key: string; scope: Scope; permission: { key: string } | null }[]) {
    if (!row.permission) continue;
    (out[row.role_key] ??= {})[row.permission.key] = row.scope;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export interface SettingRow {
  key: string;
  value: unknown;
  description: string | null;
  updated_at: string;
}

export async function listSettings(): Promise<SettingRow[]> {
  const supabase = await createServerSupabase();
  const { data } = await supabase.from("settings").select("key,value,description,updated_at").order("key");
  return (data ?? []) as SettingRow[];
}
