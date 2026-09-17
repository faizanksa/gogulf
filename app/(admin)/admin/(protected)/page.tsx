import type { Metadata } from "next";
import Link from "next/link";
import { PageTitle, Panel } from "@/components/admin/ui";
import styles from "@/components/admin/admin.module.css";
import { Button } from "@/components/ui/Button";
import { deploymentStage } from "@/lib/deployment";
import { getStaffContext, supabaseProjectRef } from "@/lib/auth/staff";
import { dashboardCounts } from "@/lib/crm/data";

export const metadata: Metadata = { title: "Dashboard" };

function Stat({ value, label, href }: { value: number | null; label: string; href?: string }) {
  const body = (
    <>
      <span className={styles.statValue}>{value === null ? "—" : value.toLocaleString("en-IN")}</span>
      <span className={styles.statLabel}>{label}</span>
    </>
  );
  return <li>{href ? <Link href={href} className={styles.stat}>{body}</Link> : <div className={styles.stat}>{body}</div>}</li>;
}

/** Where the work is: jobs by status, applications waiting, contacts and open cases — all scoped by RLS. */
export default async function AdminHome() {
  const staff = await getStaffContext();
  if (!staff) return null;
  const counts = await dashboardCounts({
    jobs: staff.can["jobs.view"],
    applications: staff.can["applications.screen"],
    contacts: staff.can["contacts.view"],
    cases: staff.can["cases.view"],
  });
  const stage = deploymentStage();
  const ref = supabaseProjectRef();

  return (
    <>
      <PageTitle
        eyebrow={`${staff.roleLabel}${staff.branch ? ` · ${staff.branch}` : ""}`}
        title={`Welcome, ${staff.fullName}`}
        description="Counts show what your role can see."
        actions={
          staff.can["jobs.manage"] ? (
            <Button href="/admin/jobs/new" size="sm" icon="arrow-right" iconPosition="end">
              New job
            </Button>
          ) : null
        }
      />

      {staff.can["jobs.view"] ? (
        <Panel id="dash-jobs" title="Jobs" actions={<Link href="/admin/jobs">All jobs</Link>}>
          <ul className={styles.stats}>
            <Stat value={counts.published} label="Published" href="/admin/jobs?status=published" />
            <Stat value={counts.review} label="In review" href="/admin/jobs?status=review" />
            <Stat value={counts.draft} label="Drafts" href="/admin/jobs?status=draft" />
            <Stat value={counts.closed} label="Closed" href="/admin/jobs?status=closed" />
          </ul>
        </Panel>
      ) : null}

      {staff.can["applications.screen"] || staff.can["contacts.view"] || staff.can["cases.view"] ? (
        <Panel id="dash-crm" title="Applications and CRM">
          <ul className={styles.stats}>
            {staff.can["applications.screen"] ? <Stat value={counts.newApps} label="New applications" href="/admin/applications?status=new" /> : null}
            {staff.can["applications.screen"] ? <Stat value={counts.screening} label="In screening" href="/admin/applications?status=screening" /> : null}
            {staff.can["contacts.view"] ? <Stat value={counts.contacts} label="Contacts" href="/admin/contacts" /> : null}
            {staff.can["cases.view"] ? <Stat value={counts.openCases} label="Open cases" href="/admin/cases?status=open" /> : null}
          </ul>
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
