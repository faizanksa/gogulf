import { describe, expect, it } from "vitest";
import {
  ACTIVITY_LABELS,
  attentionItems,
  auditHref,
  daysBetween,
  DASHBOARD_ACTIONS,
  mergeActivity,
  summariseBilling,
  summariseJobs,
  type InvoiceRowForDashboard,
  type JobRowForDashboard,
} from "./dashboard-model";

// 19 Sep 2026, 11:30 in India.
const NOW = new Date("2026-09-19T06:00:00Z");

const job = (over: Partial<JobRowForDashboard>): JobRowForDashboard => ({
  id: "j",
  status: "published",
  promotion: "standard",
  featured_until: null,
  availability: "ongoing",
  closes_on: null,
  application_access: "free",
  ...over,
});

describe("summariseJobs", () => {
  it("counts only what is genuinely live, featured, closing soon or overdue — and never archived work", () => {
    const rows = [
      job({}), // ongoing → open
      job({ availability: "time_limited", closes_on: "2026-09-22" }), // open, closing soon
      job({ availability: "time_limited", closes_on: "2026-10-30" }), // open, not soon
      job({ promotion: "featured" }), // open, featured
      job({ promotion: "featured", featured_until: "2026-09-01" }), // open, feature lapsed
      job({ availability: "time_limited", closes_on: "2026-09-10" }), // published but past its date
      job({ status: "draft" }),
      job({ status: "draft" }),
      job({ status: "review" }),
      job({ status: "closed" }),
      job({ status: "archived" }),
    ];
    expect(summariseJobs(rows, NOW)).toEqual({ open: 5, featured: 1, closingSoon: 1, pastClosing: 1, draft: 2, review: 1, closed: 1 });
  });

  it("treats the closing day itself as still open, and a week away as 'soon'", () => {
    const s = summariseJobs([job({ availability: "time_limited", closes_on: "2026-09-19" }), job({ availability: "time_limited", closes_on: "2026-09-26" }), job({ availability: "time_limited", closes_on: "2026-09-27" })], NOW);
    expect(s.open).toBe(3);
    expect(s.closingSoon).toBe(2);
  });

  it("is all zeros for no jobs — an empty state, not a made-up number", () => {
    expect(summariseJobs([], NOW)).toEqual({ open: 0, featured: 0, closingSoon: 0, pastClosing: 0, draft: 0, review: 0, closed: 0 });
  });
});

const inv = (over: Partial<InvoiceRowForDashboard>): InvoiceRowForDashboard => ({ status: "issued", total_minor: 100000, due_date: null, paid_at: null, ...over });

describe("summariseBilling", () => {
  it("separates what is owed from what was received, in real paise", () => {
    const rows = [
      inv({ status: "draft", total_minor: 999999 }), // never counted as owed
      inv({ status: "issued", total_minor: 100000, due_date: "2026-09-01" }), // overdue
      inv({ status: "issued", total_minor: 50000, due_date: "2026-10-01" }),
      inv({ status: "payment_pending", total_minor: 20000, due_date: "2026-09-01" }), // in progress: not "overdue"
      inv({ status: "payment_failed", total_minor: 40000, due_date: "2026-10-05" }),
      inv({ status: "paid", total_minor: 300000, paid_at: "2026-09-14T05:00:00Z" }), // 5 days ago
      inv({ status: "paid", total_minor: 200000, paid_at: "2026-07-20T05:00:00Z" }), // outside 30 days
    ];
    expect(summariseBilling(rows, NOW)).toEqual({
      draft: 1,
      issued: 2,
      paymentPending: 1,
      paid: 2,
      failed: 1,
      overdue: 1,
      outstandingMinor: 210000,
      paidLast30DaysMinor: 300000,
    });
  });

  it("owes nothing for no invoices", () => {
    expect(summariseBilling([], NOW).outstandingMinor).toBe(0);
  });
});

describe("attentionItems", () => {
  const jobs = { open: 3, featured: 1, closingSoon: 2, pastClosing: 1, draft: 4, review: 1, closed: 0 };
  const billing = { draft: 0, issued: 2, paymentPending: 1, paid: 5, failed: 1, overdue: 2, outstandingMinor: 1, paidLast30DaysMinor: 0 };

  it("lists only what has a real count, with links that filter to exactly it", () => {
    const items = attentionItems({ jobs, applications: { new: 3, newUnassigned: 1 }, billing });
    expect(items.map((i) => i.key)).toEqual(["new-apps", "unassigned", "past-closing", "closing-soon", "review", "failed", "overdue", "pending"]);
    expect(items.find((i) => i.key === "new-apps")).toMatchObject({ count: 3, label: "3 new applications to review", href: "/admin/applications?status=new" });
    expect(items.find((i) => i.key === "unassigned")).toMatchObject({ label: "1 new application has nobody assigned", href: "/admin/applications?status=new&assignee=none" });
    expect(items.find((i) => i.key === "failed")).toMatchObject({ label: "1 invoice has a failed payment", tone: "error" });
  });

  it("says nothing when there is nothing — an empty list is a good answer", () => {
    const quiet = { open: 5, featured: 0, closingSoon: 0, pastClosing: 0, draft: 2, review: 0, closed: 3 };
    const paid = { draft: 1, issued: 0, paymentPending: 0, paid: 9, failed: 0, overdue: 0, outstandingMinor: 0, paidLast30DaysMinor: 5 };
    expect(attentionItems({ jobs: quiet, applications: { new: 0, newUnassigned: 0 }, billing: paid })).toEqual([]);
  });

  it("shows nothing for a section the role cannot see", () => {
    expect(attentionItems({ jobs: null, applications: null, billing }).map((i) => i.key)).toEqual(["failed", "overdue", "pending"]);
    expect(attentionItems({ jobs: null, applications: null, billing: null })).toEqual([]);
  });
});

describe("activity", () => {
  it("merges newest first and caps the list", () => {
    const items = Array.from({ length: 30 }, (_, i) => ({ key: String(i), at: new Date(Date.UTC(2026, 8, 1, 0, i)).toISOString(), what: "x", who: "y", href: null }));
    const merged = mergeActivity(items, 12);
    expect(merged).toHaveLength(12);
    expect(merged[0]?.key).toBe("29");
    expect(merged[11]?.key).toBe("18");
  });

  it("labels every action it asks the audit trail for, and asks only for those", () => {
    for (const action of DASHBOARD_ACTIONS) expect(ACTIVITY_LABELS[action]).toBeTruthy();
    expect(DASHBOARD_ACTIONS).toContain("invoice.paid");
    // Platform administration never appears on a dashboard: the audit page is where it lives.
    expect(DASHBOARD_ACTIONS.some((a) => /staff|role|setting|permission/.test(a))).toBe(false);
  });

  it("links an audit entry only to a page that exists for that entity", () => {
    expect(auditHref("job", "abc")).toBe("/admin/jobs/abc");
    expect(auditHref("invoice", "abc")).toBe("/admin/invoices/abc");
    expect(auditHref("job_application", "abc")).toBe("/admin/applications/abc");
    expect(auditHref("staff_users", "abc")).toBeNull();
    expect(auditHref("job", null)).toBeNull();
  });

  it("measures days between two dates", () => {
    expect(daysBetween("2026-09-19", "2026-09-26")).toBe(7);
    expect(daysBetween("2026-09-19", "2026-09-10")).toBe(-9);
  });
});
