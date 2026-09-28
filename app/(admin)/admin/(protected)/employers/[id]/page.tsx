import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CASE_STATUS_LABELS, EmployerStatusBadge, JobStatusBadge, NotAllowed, PageTitle, Panel, Time } from "@/components/admin/ui";
import styles from "@/components/admin/admin.module.css";
import { AlertView } from "@/components/ui/AlertView";
import { Button } from "@/components/ui/Button";
import { FactList } from "@/components/ui/FactList";
import { getStaffContext } from "@/lib/auth/staff";
import { getEmployer } from "@/lib/crm/employer-data";
import { countryNameOf } from "@/lib/jobs/model";
import type { JobStatus } from "@/types/database";

export const metadata: Metadata = { title: "Employer" };

/** One employer: its details, and the jobs and recruitment cases linked to it that you can see. */
export default async function EmployerPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const staff = await getStaffContext();
  if (!staff?.can["employers.view"]) return <NotAllowed what="viewing employers" />;
  const { id } = await params;
  const [result, flags] = await Promise.all([getEmployer(id), searchParams]);
  if (!result) notFound();
  const { employer, jobs, cases } = result;

  return (
    <>
      <PageTitle
        eyebrow="Employer"
        title={employer.name}
        description={
          <>
            {countryNameOf(employer.country_code)} · {employer.branch?.name ?? "no branch"} · <EmployerStatusBadge status={employer.status} />
          </>
        }
        actions={
          staff.can["employers.manage"] ? (
            <Button href={`/admin/employers/${employer.id}/edit`} size="sm" variant="secondary">
              Edit
            </Button>
          ) : undefined
        }
      />
      {flags.saved ? (
        <AlertView tone="success" toneLabel="Success" title={flags.saved === "created" ? "Employer created. It is on the audit trail." : "Employer saved. The change is on the audit trail."} />
      ) : null}
      <div className={styles.grid2}>
        <div className={styles.content}>
          <Panel id="employer-cases" title="Recruitment cases">
            {cases.length ? (
              <ul className={styles.timeline}>
                {cases.map((k) => (
                  <li key={k.id} className={styles.timelineItem}>
                    <Link href={`/admin/cases/${k.id}`} className={styles.timelineWhat}>
                      {k.case_number}
                    </Link>
                    <span>{k.title ?? "—"}</span>
                    <span className={styles.muted}>{CASE_STATUS_LABELS[k.status] ?? k.status}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.muted}>No recruitment cases visible to your role are linked to this employer.</p>
            )}
          </Panel>
          <Panel id="employer-jobs" title="Jobs">
            {jobs.length ? (
              <ul className={styles.timeline}>
                {jobs.map((j) => (
                  <li key={j.id} className={styles.timelineItem}>
                    <Link href={`/admin/jobs/${j.id}`} className={styles.timelineWhat}>
                      {j.title}
                    </Link>
                    <span className={styles.muted}>
                      <span className={styles.mono}>{j.reference}</span> · <JobStatusBadge status={j.status as JobStatus} />
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.muted}>No jobs are linked to this employer.</p>
            )}
            <p className={styles.muted}>
              Linking a job does not change what the public listing says: the listing shows its own employer wording, or none when the employer is confidential.
            </p>
          </Panel>
        </div>
        <div className={styles.content}>
          <Panel id="employer-record" title="Record">
            <FactList
              items={[
                { key: "contact", label: "Contact person", value: employer.contact_person ?? "—" },
                { key: "email", label: "Email", value: employer.email ? <a href={`mailto:${employer.email}`}>{employer.email}</a> : "—" },
                { key: "phone", label: "Phone", value: employer.phone ?? "—", mono: true },
                {
                  key: "website",
                  label: "Website",
                  value: employer.website ? (
                    <a href={employer.website} rel="noopener noreferrer nofollow" target="_blank">
                      {employer.website}
                    </a>
                  ) : (
                    "—"
                  ),
                },
                { key: "registration", label: "Registration number", value: employer.registration_number ?? "—", mono: true },
                { key: "created", label: "Created", value: <Time iso={employer.created_at} withTime /> },
                { key: "updated", label: "Last updated", value: <Time iso={employer.updated_at} withTime /> },
              ]}
            />
          </Panel>
          <Panel id="employer-notes" title="Notes">
            {employer.notes ? <p style={{ whiteSpace: "pre-line" }}>{employer.notes}</p> : <p className={styles.muted}>No notes.</p>}
          </Panel>
        </div>
      </div>
    </>
  );
}
