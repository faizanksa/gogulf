import type { Metadata } from "next";
import Link from "next/link";
import { PageTitle, Panel, Time } from "@/components/admin/ui";
import styles from "@/components/admin/admin.module.css";
import { AlertView } from "@/components/ui/AlertView";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { attentionItems } from "@/lib/admin/dashboard-model";
import { loadDashboard } from "@/lib/admin/dashboard";
import { getStaffContext, supabaseProjectRef } from "@/lib/auth/staff";
import { formatMinor } from "@/lib/billing/model";
import { deploymentStage } from "@/lib/deployment";

export const metadata: Metadata = { title: "Dashboard" };

function Stat({ value, label, href, sub }: { value: number | string; label: string; href?: string; sub?: string }) {
  const body = (
    <>
      <span className={styles.statValue}>{typeof value === "number" ? value.toLocaleString("en-IN") : value}</span>
      <span className={styles.statLabel}>{label}</span>
      {sub ? <span className={styles.statLabel}>{sub}</span> : null}
    </>
  );
  return <li>{href ? <Link href={href} className={styles.stat}>{body}</Link> : <div className={styles.stat}>{body}</div>}</li>;
}

/**
 * The operations centre: what needs attention today, what is live, what arrived, what is
 * owed, and what the team did. Every number is a real count or sum from the database, read
 * as this person — a section a role cannot see is not shown, and an empty section says so
 * instead of showing a zero as though it were news.
 */
export default async function AdminHome() {
  const staff = await getStaffContext();
  if (!staff) return null;

  const can = {
    jobs: staff.can["jobs.view"],
    applications: staff.can["applications.screen"],
    cases: staff.can["cases.view"],
    invoices: staff.can["invoices.view"],
    audit: staff.can["audit.view"],
  };
  const data = await loadDashboard(can);
  const attention = attentionItems({
    jobs: data.jobs,
    applications: data.applications ? { new: data.applications.byStatus.new, newUnassigned: data.applications.newUnassigned } : null,
    billing: data.billing,
  });
  const stage = deploymentStage();
  const ref = supabaseProjectRef();
  const today = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());
  const anything = can.jobs || can.applications || can.cases || can.invoices;

  return (
    <>
      <PageTitle
        eyebrow={`${staff.roleLabel}${staff.branch ? ` · ${staff.branch}` : ""}`}
        title={`Welcome, ${staff.fullName}`}
        description={`${today}. Everything below is live data your role can see.`}
        actions={
          <>
            {staff.can["jobs.manage"] ? (
              <Button href="/admin/jobs/new" size="sm" icon="arrow-right" iconPosition="end">
                New job
              </Button>
            ) : null}
            {staff.can["invoices.issue"] ? (
              <Button href="/admin/invoices/new" size="sm" variant="secondary">
                New invoice
              </Button>
            ) : null}
          </>
        }
      />

      {data.failed ? <AlertView tone="warning" toneLabel="Warning" title="Some figures could not be loaded and are left out. Refresh the page; if it keeps happening, tell an administrator." /> : null}

      {!anything ? (
        <Panel id="dash-nothing" title="Your workspace">
          <p className={styles.muted}>Your role has no operational sections. Ask a super administrator if you need access.</p>
        </Panel>
      ) : null}

      {anything ? (
        <Panel id="dash-attention" title="Needs attention today">
          {attention.length ? (
            <ul className={styles.attention}>
              {attention.map((item) => (
                <li key={item.key}>
                  <Link href={item.href} className={styles.attentionItem}>
                    <Badge tone={item.tone}>{item.count.toLocaleString("en-IN")}</Badge>
                    <span>{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.muted}>Nothing needs attention right now: no unreviewed applications, no jobs past their closing date, no failed or overdue payments.</p>
          )}
        </Panel>
      ) : null}

      {data.jobs ? (
        <Panel id="dash-jobs" title="Jobs" actions={<Link href="/admin/jobs">All jobs</Link>}>
          {data.jobs.open + data.jobs.draft + data.jobs.review + data.jobs.closed + data.jobs.pastClosing === 0 ? (
            <p className={styles.muted}>
              No jobs yet. {staff.can["jobs.manage"] ? <Link href="/admin/jobs/new">Create the first job</Link> : "A colleague with job access can create one."}
            </p>
          ) : (
            <ul className={styles.stats}>
              <Stat value={data.jobs.open} label="Live on the website" href="/admin/jobs?status=published" />
              <Stat value={data.jobs.featured} label="Featured now" href="/admin/jobs?status=published&promotion=featured" />
              <Stat value={data.jobs.closingSoon} label="Closing in the next 7 days" href="/admin/jobs?status=published&availability=time_limited" />
              <Stat value={data.jobs.draft} label="Drafts" href="/admin/jobs?status=draft" />
              <Stat value={data.jobs.review} label="In review" href="/admin/jobs?status=review" />
              <Stat value={data.jobs.closed} label="Closed" href="/admin/jobs?status=closed" />
            </ul>
          )}
        </Panel>
      ) : null}

      {data.applications ? (
        <Panel id="dash-applications" title="Applications" actions={<Link href="/admin/applications">All applications</Link>}>
          {Object.values(data.applications.byStatus).reduce((a, b) => a + b, 0) === 0 ? (
            <p className={styles.muted}>No applications have arrived yet. They appear here as soon as someone applies through a job page.</p>
          ) : (
            <>
              <ul className={styles.stats}>
                <Stat value={data.applications.byStatus.new} label="New" href="/admin/applications?status=new" sub={data.applications.newUnassigned ? `${data.applications.newUnassigned} unassigned` : undefined} />
                <Stat value={data.applications.byStatus.screening} label="In screening" href="/admin/applications?status=screening" />
                <Stat value={data.applications.byStatus.converted} label="Converted to a case" href="/admin/applications?status=converted" />
                <Stat value={data.applications.byStatus.rejected} label="Rejected" href="/admin/applications?status=rejected" />
                <Stat value={data.applications.byStatus.withdrawn} label="Withdrawn" href="/admin/applications?status=withdrawn" />
                <Stat value={data.applications.receivedLast7Days} label="Received, last 7 days" />
              </ul>
              {data.applications.oldestNew ? (
                <p className={styles.muted}>
                  Oldest unreviewed application arrived <Time iso={data.applications.oldestNew} withTime />.
                </p>
              ) : null}
              {data.applications.waiting.length ? (
                <>
                  <h3 className={styles.h3}>Follow up — screening, longest since the last change</h3>
                  <ul className={styles.inlineLinks}>
                    {data.applications.waiting.map((a) => (
                      <li key={a.id}>
                        <Link href={`/admin/applications/${a.id}`}>{a.full_name}</Link> <span className={styles.muted}>for {a.job_title}, changed <Time iso={a.updated_at} /></span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </>
          )}
        </Panel>
      ) : null}

      {data.cases ? (
        <Panel id="dash-cases" title="Cases" actions={<Link href="/admin/cases">All cases</Link>}>
          {Object.values(data.cases.byStatus).reduce((a, b) => a + b, 0) === 0 ? (
            <p className={styles.muted}>No cases yet. A case is created when you convert an application.</p>
          ) : (
            <>
              <ul className={styles.stats}>
                <Stat value={data.cases.byStatus.open} label="Open" href="/admin/cases?status=open" />
                <Stat value={data.cases.byStatus.won} label="Won" href="/admin/cases?status=won" />
                <Stat value={data.cases.byStatus.lost} label="Lost" href="/admin/cases?status=lost" />
                <Stat value={data.cases.byStatus.cancelled} label="Cancelled" href="/admin/cases?status=cancelled" />
              </ul>
              {data.cases.openByStage.length ? (
                <>
                  <h3 className={styles.h3}>Open cases by stage</h3>
                  <ul className={styles.stats}>
                    {data.cases.openByStage.map((s) => (
                      <Stat key={s.name} value={s.count} label={s.name} />
                    ))}
                  </ul>
                </>
              ) : null}
            </>
          )}
        </Panel>
      ) : null}

      {data.billing ? (
        <Panel id="dash-billing" title="Billing" actions={<Link href="/admin/invoices">All invoices</Link>}>
          {data.billing.draft + data.billing.issued + data.billing.paymentPending + data.billing.paid + data.billing.failed === 0 ? (
            <p className={styles.muted}>
              No invoices yet. {staff.can["invoices.issue"] ? <Link href="/admin/invoices/new">Create the first invoice</Link> : null}
            </p>
          ) : (
            <ul className={styles.stats}>
              <Stat value={data.billing.draft} label="Drafts" href="/admin/invoices?status=draft" />
              <Stat value={data.billing.issued} label="Issued, unpaid" href="/admin/invoices?status=issued" />
              <Stat value={data.billing.paymentPending} label="Payment in progress" href="/admin/invoices?status=payment_pending" />
              <Stat value={data.billing.paid} label="Paid" href="/admin/invoices?status=paid" />
              <Stat value={data.billing.failed} label="Payment failed" href="/admin/invoices?status=payment_failed" />
              <Stat value={formatMinor(data.billing.outstandingMinor)} label="Still owed" sub="issued, in progress or failed" />
              <Stat value={formatMinor(data.billing.paidLast30DaysMinor)} label="Received, last 30 days" />
            </ul>
          )}
        </Panel>
      ) : null}

      {anything ? (
        <Panel id="dash-recent" title="Recent activity">
          {data.recent.length ? (
            <ol className={styles.timeline}>
              {data.recent.map((a) => (
                <li key={a.key} className={styles.timelineItem}>
                  <span className={styles.timelineWhat}>{a.href ? <Link href={a.href}>{a.what}</Link> : a.what}</span>
                  <span className={styles.muted}>
                    <Time iso={a.at} withTime /> · {a.who}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className={styles.muted}>
              Nothing yet. Job changes, invoices, payments and new applications appear here
              {can.audit ? "" : " (job, invoice and payment history needs the audit permission your role does not hold)"}.
            </p>
          )}
        </Panel>
      ) : null}

      {stage !== "production" ? (
        <Panel id="dash-env" title="This environment">
          <p className={styles.muted}>
            {stage === "staging" ? "Staging" : stage === "preview" ? "A preview deployment" : "A local build"}, connected to Supabase project{" "}
            <span className={styles.mono}>{ref ?? "unknown"}</span>. Synthetic data only. Nothing here reaches the live website.
          </p>
        </Panel>
      ) : null}
    </>
  );
}
