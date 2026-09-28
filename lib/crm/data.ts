/**
 * Applications, contacts and cases as the staff workspace reads them — through the
 * signed-in staff member's session, so RLS applies the role's scope (all / branch / own)
 * to every row. Never the service-role client.
 */

import "server-only";

import { PAGE_SIZE, rangeOf } from "@/lib/admin/params";
import { createServerSupabase } from "@/lib/supabase/server";
import type { ApplicationStatus, CaseStatus, EmployerStatus, LifecycleStage, TableRow } from "@/types/database";

// ---------------------------------------------------------------------------
// Applications
// ---------------------------------------------------------------------------

export type ApplicationRow = TableRow<"job_applications">;

export interface StaffApplication extends ApplicationRow {
  job: { id: string; reference: string; title: string; status: string } | null;
  contact: { id: string; full_name: string } | null;
  case: { id: string; case_number: string } | null;
  assignee: { id: string; full_name: string } | null;
  branch: { name: string } | null;
}

const APPLICATION_SELECT =
  "*, job:jobs(id,reference,title,status), contact:contacts(id,full_name), case:cases(id,case_number), assignee:staff_users!job_applications_assignee_id_fkey(id,full_name), branch:branches(name)";

export const APPLICATION_STATUSES: readonly ApplicationStatus[] = ["new", "screening", "converted", "rejected", "withdrawn"];

export interface ApplicationFilters {
  q: string;
  status: ApplicationStatus | "";
  job: string;
  /** "none" = unassigned, "me" = assigned to the signed-in staff member. */
  assignee?: "none" | "me" | "";
  page: number;
}

export async function listApplications(filters: ApplicationFilters, staffId?: string) {
  const supabase = await createServerSupabase();
  const { from, to } = rangeOf(filters.page, PAGE_SIZE);
  let query = supabase.from("job_applications").select(APPLICATION_SELECT, { count: "exact" });
  if (filters.q) query = query.or(`full_name.ilike.*${filters.q}*,email.ilike.*${filters.q}*,phone.ilike.*${filters.q}*,job_title.ilike.*${filters.q}*`);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.job) query = query.eq("job_id", filters.job);
  if (filters.assignee === "none") query = query.is("assignee_id", null);
  if (filters.assignee === "me" && staffId) query = query.eq("assignee_id", staffId);
  const { data, count, error } = await query.order("created_at", { ascending: false }).range(from, to);
  return { applications: (data ?? []) as unknown as StaffApplication[], total: count ?? 0, failed: Boolean(error) };
}

export async function getApplication(id: string): Promise<StaffApplication | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createServerSupabase();
  const { data } = await supabase.from("job_applications").select(APPLICATION_SELECT).eq("id", id).maybeSingle();
  return (data as unknown as StaffApplication | null) ?? null;
}

/** Colleagues an application can be assigned to: active staff this person can see. */
export async function listAssignableStaff() {
  const supabase = await createServerSupabase();
  const { data } = await supabase.from("staff_users").select("id, full_name, role_key").eq("is_active", true).order("full_name");
  return (data ?? []) as { id: string; full_name: string; role_key: string }[];
}

// ---------------------------------------------------------------------------
// Contacts
// ---------------------------------------------------------------------------

export type ContactRow = TableRow<"contacts">;

export interface StaffContact extends ContactRow {
  owner: { full_name: string } | null;
  branch: { name: string } | null;
}

export { LIFECYCLE_STAGES } from "./contact-edit";

export async function listContacts(filters: { q: string; stage: LifecycleStage | ""; page: number }) {
  const supabase = await createServerSupabase();
  const { from, to } = rangeOf(filters.page, PAGE_SIZE);
  let query = supabase.from("contacts").select("*, owner:staff_users!contacts_owner_id_fkey(full_name), branch:branches(name)", { count: "exact" });
  if (filters.q) query = query.or(`full_name.ilike.*${filters.q}*,primary_email.ilike.*${filters.q}*,primary_phone_e164.ilike.*${filters.q}*`);
  if (filters.stage) query = query.eq("lifecycle_stage", filters.stage);
  // A merged contact lives on only as history, reached from the contact it was merged into.
  query = query.is("merged_into_id", null);
  const { data, count, error } = await query.order("created_at", { ascending: false }).range(from, to);
  return { contacts: (data ?? []) as unknown as StaffContact[], total: count ?? 0, failed: Boolean(error) };
}

export async function getContact(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createServerSupabase();
  const [contact, identities, cases, applications, activities] = await Promise.all([
    supabase.from("contacts").select("*, owner:staff_users!contacts_owner_id_fkey(full_name), branch:branches(name)").eq("id", id).maybeSingle(),
    supabase.from("contact_identities").select("id,type,value_normalized,is_primary,verified_at,source,created_at").eq("contact_id", id).order("created_at"),
    supabase.from("cases").select("id,case_number,title,status,opened_at,stage:pipeline_stages(name)").eq("contact_id", id).order("opened_at", { ascending: false }),
    supabase.from("job_applications").select("id,job_title,status,created_at").eq("contact_id", id).order("created_at", { ascending: false }),
    supabase.from("activities").select("id,verb,summary,actor_type,occurred_at").eq("contact_id", id).order("occurred_at", { ascending: false }).limit(50),
  ]);
  if (!contact.data) return null;
  return {
    contact: contact.data as unknown as StaffContact,
    identities: (identities.data ?? []) as { id: string; type: string; value_normalized: string; is_primary: boolean; verified_at: string | null; source: string | null; created_at: string }[],
    cases: (cases.data ?? []) as unknown as { id: string; case_number: string; title: string | null; status: CaseStatus; opened_at: string; stage: { name: string } | null }[],
    applications: (applications.data ?? []) as { id: string; job_title: string; status: ApplicationStatus; created_at: string }[],
    activities: (activities.data ?? []) as { id: string; verb: string; summary: string; actor_type: string; occurred_at: string }[],
  };
}

// ---------------------------------------------------------------------------
// Merging (0021)
// ---------------------------------------------------------------------------

export interface ContactMergeContext {
  /** Set when this contact was merged away: the contact it lives on in. */
  mergedInto: { id: string; full_name: string } | null;
  /** Contacts merged into this one. */
  mergedFrom: { id: string; full_name: string }[];
  /**
   * Invoices and payments of this contact AND of the contacts merged into it. A merge
   * never changes an issued invoice or a payment (0021), so those stay linked to the
   * merged contact and are shown here through the merge.
   */
  invoices: { id: string; reference: string; status: string; total_minor: number; contact_id: string | null }[];
  payments: { id: string; reference: string; status: string; amount_minor: number; contact_id: string | null }[];
}

export async function getContactMergeContext(id: string, mergedIntoId: string | null): Promise<ContactMergeContext> {
  const supabase = await createServerSupabase();
  const [into, from] = await Promise.all([
    mergedIntoId ? supabase.from("contacts").select("id,full_name").eq("id", mergedIntoId).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("contacts").select("id,full_name").eq("merged_into_id", id).order("full_name"),
  ]);
  const mergedFrom = (from.data ?? []) as { id: string; full_name: string }[];
  const ids = [id, ...mergedFrom.map((c) => c.id)];
  const [invoices, payments] = await Promise.all([
    supabase.from("invoices").select("id,reference,status,total_minor,contact_id").in("contact_id", ids).order("created_at", { ascending: false }),
    supabase.from("payments").select("id,reference,status,amount_minor,contact_id").in("contact_id", ids).order("created_at", { ascending: false }),
  ]);
  return {
    mergedInto: (into.data as { id: string; full_name: string } | null) ?? null,
    mergedFrom,
    invoices: (invoices.data ?? []) as ContactMergeContext["invoices"],
    payments: (payments.data ?? []) as ContactMergeContext["payments"],
  };
}

/** Contacts that could be merged into `survivorId`: visible to the caller, not merged, not itself. */
export async function searchMergeCandidates(survivorId: string, q: string) {
  const term = q.replace(/[%*,()]/g, " ").trim();
  if (term.length < 2) return [];
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("contacts")
    .select("id,full_name,primary_email,primary_phone_e164,created_at, branch:branches(name)")
    .is("merged_into_id", null)
    .neq("id", survivorId)
    .or(`full_name.ilike.*${term}*,primary_email.ilike.*${term}*,primary_phone_e164.ilike.*${term}*`)
    .order("created_at", { ascending: false })
    .limit(20);
  return (data ?? []) as unknown as { id: string; full_name: string; primary_email: string | null; primary_phone_e164: string | null; created_at: string; branch: { name: string } | null }[];
}

/** What a merge would move, counted as the caller can see it — shown before they confirm. */
export async function mergePreview(mergedId: string) {
  const supabase = await createServerSupabase();
  const count = async (table: "contact_identities" | "job_applications" | "cases" | "notes" | "tasks" | "activities") =>
    (await supabase.from(table).select("id", { count: "exact", head: true }).eq("contact_id", mergedId)).count ?? 0;
  const [identities, applications, cases, notes, tasks, activities, draftInvoices, otherInvoices, payments] = await Promise.all([
    count("contact_identities"),
    count("job_applications"),
    count("cases"),
    count("notes"),
    count("tasks"),
    count("activities"),
    supabase.from("invoices").select("id", { count: "exact", head: true }).eq("contact_id", mergedId).eq("status", "draft").then((r) => r.count ?? 0),
    supabase.from("invoices").select("id", { count: "exact", head: true }).eq("contact_id", mergedId).neq("status", "draft").then((r) => r.count ?? 0),
    supabase.from("payments").select("id", { count: "exact", head: true }).eq("contact_id", mergedId).then((r) => r.count ?? 0),
  ]);
  return { identities, applications, cases, notes, tasks, activities, draftInvoices, otherInvoices, payments };
}

// ---------------------------------------------------------------------------
// Cases
// ---------------------------------------------------------------------------

export interface StaffCase {
  id: string;
  case_number: string;
  title: string | null;
  case_type: string;
  status: CaseStatus;
  opened_at: string;
  stage_entered_at: string;
  updated_at: string;
  contact: { id: string; full_name: string } | null;
  stage: { name: string; key: string } | null;
  owner: { full_name: string } | null;
  branch: { name: string } | null;
}

const CASE_SELECT =
  "id,case_number,title,case_type,status,opened_at,stage_entered_at,updated_at, contact:contacts(id,full_name), stage:pipeline_stages(name,key), owner:staff_users!cases_owner_id_fkey(full_name), branch:branches(name)";

export const CASE_STATUSES: readonly CaseStatus[] = ["open", "won", "lost", "cancelled"];

export async function listCases(filters: { q: string; status: CaseStatus | ""; page: number }) {
  const supabase = await createServerSupabase();
  const { from, to } = rangeOf(filters.page, PAGE_SIZE);
  let query = supabase.from("cases").select(CASE_SELECT, { count: "exact" });
  if (filters.q) query = query.or(`case_number.ilike.*${filters.q}*,title.ilike.*${filters.q}*`);
  if (filters.status) query = query.eq("status", filters.status);
  const { data, count, error } = await query.order("opened_at", { ascending: false }).range(from, to);
  return { cases: (data ?? []) as unknown as StaffCase[], total: count ?? 0, failed: Boolean(error) };
}

export async function getCase(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createServerSupabase();
  const [kase, recruitment, applications, activities] = await Promise.all([
    supabase.from("cases").select(CASE_SELECT).eq("id", id).maybeSingle(),
    supabase
      .from("case_recruitment")
      .select("job_id, employer_id, legacy_job_title, legacy_job_country, job:jobs(id,reference,title,status), employer:employers(id,name,status)")
      .eq("case_id", id)
      .maybeSingle(),
    supabase.from("job_applications").select("id,job_title,status,created_at").eq("case_id", id).order("created_at", { ascending: false }),
    supabase.from("activities").select("id,verb,summary,actor_type,occurred_at").eq("case_id", id).order("occurred_at", { ascending: false }).limit(50),
  ]);
  if (!kase.data) return null;
  return {
    kase: kase.data as unknown as StaffCase,
    recruitment: recruitment.data as unknown as {
      job_id: string | null;
      employer_id: string | null;
      legacy_job_title: string | null;
      legacy_job_country: string | null;
      job: { id: string; reference: string; title: string; status: string } | null;
      /** Null when there is no link, or when the linked employer is outside your employers scope. */
      employer: { id: string; name: string; status: EmployerStatus } | null;
    } | null,
    applications: (applications.data ?? []) as { id: string; job_title: string; status: ApplicationStatus; created_at: string }[],
    activities: (activities.data ?? []) as { id: string; verb: string; summary: string; actor_type: string; occurred_at: string }[],
  };
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

async function countOf(table: "jobs" | "job_applications" | "contacts" | "cases", apply?: (q: any) => any): Promise<number | null> {
  const supabase = await createServerSupabase();
  let query = supabase.from(table).select("id", { count: "exact", head: true });
  if (apply) query = apply(query);
  const { count, error } = await query;
  return error ? null : (count ?? 0);
}

export async function dashboardCounts(can: { jobs: boolean; applications: boolean; contacts: boolean; cases: boolean }) {
  const skip = Promise.resolve(null);
  const [draft, review, published, closed, newApps, screening, contacts, openCases] = await Promise.all([
    can.jobs ? countOf("jobs", (q) => q.eq("status", "draft")) : skip,
    can.jobs ? countOf("jobs", (q) => q.eq("status", "review")) : skip,
    can.jobs ? countOf("jobs", (q) => q.eq("status", "published")) : skip,
    can.jobs ? countOf("jobs", (q) => q.eq("status", "closed")) : skip,
    can.applications ? countOf("job_applications", (q) => q.eq("status", "new")) : skip,
    can.applications ? countOf("job_applications", (q) => q.eq("status", "screening")) : skip,
    can.contacts ? countOf("contacts") : skip,
    can.cases ? countOf("cases", (q) => q.eq("status", "open")) : skip,
  ]);
  return { draft, review, published, closed, newApps, screening, contacts, openCases };
}
