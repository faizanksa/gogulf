/**
 * The operations dashboard's arithmetic, kept pure so it can be tested without a
 * database. Everything here is derived from rows the staff member's own session was
 * allowed to read; nothing is estimated, and nothing is shown that is not a real value.
 */

import { isActivelyFeatured, isOpenForApplications, isPastClosingDate, todayInIndia } from "@/lib/jobs/model";

export interface JobRowForDashboard {
  id: string;
  status: "draft" | "review" | "published" | "closed" | "archived";
  promotion: "standard" | "featured";
  featured_until: string | null;
  availability: "ongoing" | "time_limited";
  closes_on: string | null;
  application_access: "free" | "paid";
}

export interface JobsSummary {
  open: number;
  featured: number;
  /** Published, time-limited, closing within the next 7 days (including today). */
  closingSoon: number;
  /** Still published although the closing date has passed — needs a decision. */
  pastClosing: number;
  draft: number;
  review: number;
  closed: number;
}

/** Days from `today` (a YYYY-MM-DD string) to `date`; negative when it is in the past. */
export function daysBetween(today: string, date: string): number {
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}

export function summariseJobs(rows: readonly JobRowForDashboard[], now: Date = new Date()): JobsSummary {
  const today = todayInIndia(now);
  const summary: JobsSummary = { open: 0, featured: 0, closingSoon: 0, pastClosing: 0, draft: 0, review: 0, closed: 0 };
  for (const job of rows) {
    if (job.status === "draft") summary.draft++;
    else if (job.status === "review") summary.review++;
    else if (job.status === "closed") summary.closed++;
    else if (job.status === "published") {
      const state = {
        status: job.status,
        availability: job.availability,
        closesOn: job.closes_on,
        promotion: job.promotion,
        featuredUntil: job.featured_until,
        applicationAccess: job.application_access,
      } as const;
      if (isOpenForApplications(state, now)) {
        summary.open++;
        if (isActivelyFeatured(state, now)) summary.featured++;
        if (job.availability === "time_limited" && job.closes_on && daysBetween(today, job.closes_on) <= 7) summary.closingSoon++;
      } else if (isPastClosingDate(state, now)) {
        summary.pastClosing++;
      }
    }
  }
  return summary;
}

export interface InvoiceRowForDashboard {
  status: "draft" | "issued" | "payment_pending" | "paid" | "payment_failed" | "void";
  total_minor: number;
  due_date: string | null;
  paid_at: string | null;
}

export interface BillingSummary {
  draft: number;
  issued: number;
  paymentPending: number;
  paid: number;
  failed: number;
  /** Issued (or failed) and past their due date. */
  overdue: number;
  /** Total of everything issued, awaiting or failed — what is still owed, in paise. */
  outstandingMinor: number;
  /** Total paid in the last 30 days, in paise. */
  paidLast30DaysMinor: number;
}

export function summariseBilling(rows: readonly InvoiceRowForDashboard[], now: Date = new Date()): BillingSummary {
  const today = todayInIndia(now);
  const thirtyDaysAgo = now.getTime() - 30 * 86_400_000;
  const s: BillingSummary = { draft: 0, issued: 0, paymentPending: 0, paid: 0, failed: 0, overdue: 0, outstandingMinor: 0, paidLast30DaysMinor: 0 };
  for (const inv of rows) {
    if (inv.status === "draft") s.draft++;
    else if (inv.status === "issued") s.issued++;
    else if (inv.status === "payment_pending") s.paymentPending++;
    else if (inv.status === "payment_failed") s.failed++;
    else if (inv.status === "paid") {
      s.paid++;
      if (inv.paid_at && Date.parse(inv.paid_at) >= thirtyDaysAgo) s.paidLast30DaysMinor += inv.total_minor;
    }
    if (inv.status === "issued" || inv.status === "payment_pending" || inv.status === "payment_failed") {
      s.outstandingMinor += inv.total_minor;
      if (inv.due_date && inv.due_date < today && inv.status !== "payment_pending") s.overdue++;
    }
  }
  return s;
}

export interface AttentionInput {
  jobs: JobsSummary | null;
  applications: { new: number; newUnassigned: number } | null;
  billing: BillingSummary | null;
}

export interface AttentionItem {
  key: string;
  count: number;
  label: string;
  href: string;
  tone: "warning" | "error" | "blue";
}

const plural = (n: number, one: string, many: string) => `${n.toLocaleString("en-IN")} ${n === 1 ? one : many}`;

/** What needs a person today: only items with a real, non-zero count. Empty is a good answer. */
export function attentionItems({ jobs, applications, billing }: AttentionInput): AttentionItem[] {
  const items: AttentionItem[] = [];
  if (applications && applications.new > 0) {
    items.push({ key: "new-apps", count: applications.new, label: `${plural(applications.new, "new application", "new applications")} to review`, href: "/admin/applications?status=new", tone: "warning" });
  }
  if (applications && applications.newUnassigned > 0) {
    items.push({ key: "unassigned", count: applications.newUnassigned, label: `${plural(applications.newUnassigned, "new application has", "new applications have")} nobody assigned`, href: "/admin/applications?status=new&assignee=none", tone: "warning" });
  }
  if (jobs && jobs.pastClosing > 0) {
    items.push({ key: "past-closing", count: jobs.pastClosing, label: `${plural(jobs.pastClosing, "job is", "jobs are")} past the closing date but still published`, href: "/admin/jobs?status=published&availability=time_limited", tone: "error" });
  }
  if (jobs && jobs.closingSoon > 0) {
    items.push({ key: "closing-soon", count: jobs.closingSoon, label: `${plural(jobs.closingSoon, "job closes", "jobs close")} in the next 7 days`, href: "/admin/jobs?status=published&availability=time_limited", tone: "blue" });
  }
  if (jobs && jobs.review > 0) {
    items.push({ key: "review", count: jobs.review, label: `${plural(jobs.review, "job is", "jobs are")} waiting in review`, href: "/admin/jobs?status=review", tone: "blue" });
  }
  if (billing && billing.failed > 0) {
    items.push({ key: "failed", count: billing.failed, label: `${plural(billing.failed, "invoice has", "invoices have")} a failed payment`, href: "/admin/invoices?status=payment_failed", tone: "error" });
  }
  if (billing && billing.overdue > 0) {
    items.push({ key: "overdue", count: billing.overdue, label: `${plural(billing.overdue, "invoice is", "invoices are")} past the due date`, href: "/admin/invoices?status=issued", tone: "warning" });
  }
  if (billing && billing.paymentPending > 0) {
    items.push({ key: "pending", count: billing.paymentPending, label: `${plural(billing.paymentPending, "payment is", "payments are")} in progress`, href: "/admin/invoices?status=payment_pending", tone: "blue" });
  }
  return items;
}

export const ACTIVITY_LABELS: Record<string, string> = {
  "job.created": "Job created",
  "job.duplicated": "Job copied",
  "job.published": "Job published",
  "job.unpublished": "Job unpublished",
  "job.closed": "Job closed",
  "job.reopened": "Job reopened",
  "job.archived": "Job archived",
  "job.restored": "Job restored",
  "job.submitted_for_review": "Job sent for review",
  "job.featured": "Job featured",
  "job.unfeatured": "Job unfeatured",
  "job_application.converted": "Application converted to a case",
  "job_application.assigned": "Application assigned",
  "job_application.status_changed": "Application status changed",
  "invoice.created": "Invoice drafted",
  "invoice.issued": "Invoice issued",
  "invoice.voided": "Invoice voided",
  "invoice.paid": "Payment received",
  "invoice.payment_failed": "Payment failed",
  "invoice.payment_link_opened": "Customer opened checkout",
};

/** Only the audit actions worth a line on the dashboard; the rest stay on the audit page. */
export const DASHBOARD_ACTIONS = Object.keys(ACTIVITY_LABELS);

export interface ActivityItem {
  key: string;
  at: string;
  what: string;
  who: string;
  href: string | null;
}

/** Newest first, capped. Applications received and audit entries are merged into one timeline. */
export function mergeActivity(items: readonly ActivityItem[], limit = 12): ActivityItem[] {
  return [...items].sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}

export function auditHref(entityType: string, entityId: string | null): string | null {
  if (!entityId) return null;
  if (entityType === "job") return `/admin/jobs/${entityId}`;
  if (entityType === "invoice") return `/admin/invoices/${entityId}`;
  if (entityType === "job_application") return `/admin/applications/${entityId}`;
  return null;
}
