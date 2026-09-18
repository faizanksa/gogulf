/**
 * The operations dashboard, read through the signed-in staff member's own session — so
 * RLS decides what each role can count, and a role that cannot see a thing gets no block
 * for it rather than a zero. Never the service-role client.
 *
 * Every figure is a real count or a real sum of rows this person may read. There are no
 * estimates, no targets and no comparisons against invented baselines.
 */

import "server-only";

import { createServerSupabase } from "@/lib/supabase/server";
import { todayInIndia } from "@/lib/jobs/model";
import {
  ACTIVITY_LABELS,
  auditHref,
  DASHBOARD_ACTIONS,
  mergeActivity,
  summariseBilling,
  summariseJobs,
  type ActivityItem,
  type BillingSummary,
  type InvoiceRowForDashboard,
  type JobRowForDashboard,
  type JobsSummary,
} from "./dashboard-model";

export interface ApplicationsSummary {
  byStatus: Record<"new" | "screening" | "converted" | "rejected" | "withdrawn", number>;
  newUnassigned: number;
  /** created_at of the oldest application still marked new, or null. */
  oldestNew: string | null;
  receivedLast7Days: number;
  /** Screening applications, longest since their last change first. */
  waiting: { id: string; full_name: string; job_title: string; updated_at: string }[];
}

export interface CasesSummary {
  byStatus: Record<"open" | "won" | "lost" | "cancelled", number>;
  /** Open cases by pipeline stage, in pipeline order. */
  openByStage: { name: string; count: number }[];
}

export interface DashboardData {
  jobs: JobsSummary | null;
  applications: ApplicationsSummary | null;
  cases: CasesSummary | null;
  billing: BillingSummary | null;
  recent: ActivityItem[];
  /** True when something a section needs could not be read (as opposed to being empty). */
  failed: boolean;
}

export interface DashboardAccess {
  jobs: boolean;
  applications: boolean;
  cases: boolean;
  invoices: boolean;
  audit: boolean;
}

export async function loadDashboard(can: DashboardAccess): Promise<DashboardData> {
  const supabase = await createServerSupabase();
  let failed = false;
  const ok = <T>(result: { data: T | null; error: unknown }): T | null => {
    if (result.error) failed = true;
    return result.data;
  };
  const count = async (q: PromiseLike<{ count: number | null; error: unknown }>): Promise<number> => {
    const { count: n, error } = await q;
    if (error) failed = true;
    return n ?? 0;
  };
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const app = () => supabase.from("job_applications").select("id", { count: "exact", head: true });

  // ---- jobs
  const jobs = can.jobs
    ? summariseJobs(
        (ok(
          await supabase
            .from("jobs")
            .select("id,status,promotion,featured_until,availability,closes_on,application_access")
            .in("status", ["draft", "review", "published", "closed"])
            .limit(2000),
        ) ?? []) as unknown as JobRowForDashboard[],
      )
    : null;

  // ---- applications
  let applications: ApplicationsSummary | null = null;
  if (can.applications) {
    const [isNew, screening, converted, rejected, withdrawn, newUnassigned, received, oldest, waiting] = await Promise.all([
      count(app().eq("status", "new")),
      count(app().eq("status", "screening")),
      count(app().eq("status", "converted")),
      count(app().eq("status", "rejected")),
      count(app().eq("status", "withdrawn")),
      count(app().eq("status", "new").is("assignee_id", null)),
      count(app().gte("created_at", sevenDaysAgo)),
      supabase.from("job_applications").select("created_at").eq("status", "new").order("created_at", { ascending: true }).limit(1),
      supabase.from("job_applications").select("id,full_name,job_title,updated_at").eq("status", "screening").order("updated_at", { ascending: true }).limit(5),
    ]);
    applications = {
      byStatus: { new: isNew, screening, converted, rejected, withdrawn },
      newUnassigned,
      oldestNew: (ok(oldest)?.[0] as { created_at: string } | undefined)?.created_at ?? null,
      receivedLast7Days: received,
      waiting: (ok(waiting) ?? []) as ApplicationsSummary["waiting"],
    };
  }

  // ---- cases
  let cases: CasesSummary | null = null;
  if (can.cases) {
    const c = () => supabase.from("cases").select("id", { count: "exact", head: true }).is("deleted_at", null);
    const [open, won, lost, cancelled, openRows] = await Promise.all([
      count(c().eq("status", "open")),
      count(c().eq("status", "won")),
      count(c().eq("status", "lost")),
      count(c().eq("status", "cancelled")),
      supabase.from("cases").select("stage:pipeline_stages(name,position)").eq("status", "open").is("deleted_at", null).limit(2000),
    ]);
    const stages = new Map<string, { count: number; position: number }>();
    for (const row of (ok(openRows) ?? []) as unknown as { stage: { name: string; position: number } | null }[]) {
      if (!row.stage) continue;
      const entry = stages.get(row.stage.name) ?? { count: 0, position: row.stage.position };
      entry.count++;
      stages.set(row.stage.name, entry);
    }
    cases = {
      byStatus: { open, won, lost, cancelled },
      openByStage: [...stages.entries()].sort((a, b) => a[1].position - b[1].position).map(([name, v]) => ({ name, count: v.count })),
    };
  }

  // ---- billing
  const billing = can.invoices
    ? summariseBilling(
        (ok(await supabase.from("invoices").select("status,total_minor,due_date,paid_at").neq("status", "void").limit(5000)) ?? []) as unknown as InvoiceRowForDashboard[],
      )
    : null;

  // ---- recent activity: what the team did, from the audit trail this role may read, plus
  // applications received (which are not audited, being written by the applicant).
  const items: ActivityItem[] = [];
  if (can.audit) {
    const { data, error } = await supabase
      .from("audit_logs")
      .select("id,action,actor_type,actor_label,entity_type,entity_id,occurred_at")
      .in("action", DASHBOARD_ACTIONS)
      .order("occurred_at", { ascending: false })
      .limit(20);
    if (error) failed = true;
    for (const a of data ?? []) {
      items.push({
        key: `a-${a.id}`,
        at: a.occurred_at,
        what: ACTIVITY_LABELS[a.action] ?? a.action,
        who: a.actor_label ?? (a.actor_type === "system" ? "System" : "Staff"),
        href: auditHref(a.entity_type, a.entity_id),
      });
    }
  }
  if (can.applications) {
    const { data } = await supabase.from("job_applications").select("id,full_name,job_title,created_at").order("created_at", { ascending: false }).limit(8);
    for (const a of data ?? []) {
      items.push({ key: `r-${a.id}`, at: a.created_at, what: `Application received for ${a.job_title}`, who: a.full_name, href: `/admin/applications/${a.id}` });
    }
  }

  return { jobs, applications, cases, billing, recent: mergeActivity(items), failed };
}

/** Today's date in India, for headings. */
export const dashboardToday = () => todayInIndia();
