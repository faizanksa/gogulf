import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ApplicationStatusBadge, CASE_STATUS_LABELS, JobStatusBadge, NotAllowed, PageTitle, Panel, Time } from "@/components/admin/ui";
import styles from "@/components/admin/admin.module.css";
import { FactList } from "@/components/ui/FactList";
import { getStaffContext } from "@/lib/auth/staff";
import { getCase } from "@/lib/crm/data";
import type { JobStatus } from "@/types/database";

export const metadata: Metadata = { title: "Case" };

/** One case: who it is for, the job it is about, the applications behind it, its timeline. */
export default async function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await getStaffContext();
  if (!staff?.can["cases.view"]) return <NotAllowed what="viewing cases" />;
  const { id } = await params;
  const result = await getCase(id);
  if (!result) notFound();
  const { kase, recruitment, applications, activities } = result;

  return (
    <>
      <PageTitle
        eyebrow={<span className={styles.mono}>{kase.case_number}</span>}
        title={kase.title ?? kase.case_number}
        description={`${kase.case_type.replace(/_/g, " ")} · ${CASE_STATUS_LABELS[kase.status]} · ${kase.stage?.name ?? "no stage"}`}
      />
      <div className={styles.grid2}>
        <div className={styles.content}>
          <Panel id="case-timeline" title="Timeline">
            {activities.length ? (
              <ol className={styles.timeline}>
                {activities.map((a) => (
                  <li key={a.id} className={styles.timelineItem}>
                    <span className={styles.timelineWhat}>{a.summary}</span>
                    <span className={styles.muted}>
                      <Time iso={a.occurred_at} withTime /> · {a.verb}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className={styles.muted}>Nothing recorded yet.</p>
            )}
          </Panel>
          <Panel id="case-applications" title="Applications">
            {applications.length ? (
              <ul className={styles.timeline}>
                {applications.map((a) => (
                  <li key={a.id} className={styles.timelineItem}>
                    <Link href={`/admin/applications/${a.id}`} className={styles.timelineWhat}>
                      {a.job_title}
                    </Link>
                    <span className={styles.muted}>
                      <ApplicationStatusBadge status={a.status} /> · <Time iso={a.created_at} withTime />
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.muted}>No applications linked.</p>
            )}
          </Panel>
        </div>
        <div className={styles.content}>
          <Panel id="case-record" title="Record">
            <FactList
              items={[
                { key: "contact", label: "Contact", value: kase.contact ? <Link href={`/admin/contacts/${kase.contact.id}`}>{kase.contact.full_name}</Link> : "—" },
                {
                  key: "job",
                  label: "Job",
                  value: recruitment?.job ? (
                    <>
                      <Link href={`/admin/jobs/${recruitment.job.id}`}>{recruitment.job.title}</Link> <JobStatusBadge status={recruitment.job.status as JobStatus} />
                    </>
                  ) : (
                    recruitment?.legacy_job_title ?? "—"
                  ),
                },
                { key: "stage", label: "Stage", value: kase.stage?.name ?? "—" },
                { key: "stage-since", label: "In this stage since", value: <Time iso={kase.stage_entered_at} withTime /> },
                { key: "owner", label: "Owner", value: kase.owner?.full_name ?? "—" },
                { key: "branch", label: "Branch", value: kase.branch?.name ?? "—" },
                { key: "opened", label: "Opened", value: <Time iso={kase.opened_at} withTime /> },
              ]}
            />
            <p className={styles.muted}>Stage changes, tasks and documents on cases arrive in a later phase.</p>
          </Panel>
        </div>
      </div>
    </>
  );
}
