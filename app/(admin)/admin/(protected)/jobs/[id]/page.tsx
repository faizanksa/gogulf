import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DuplicateJob, JobLifecycle, JobPromotionControl } from "@/components/admin/JobControls";
import { JobForm } from "@/components/admin/JobForm";
import { JobStatusBadge, NotAllowed, PageTitle, Panel, Time } from "@/components/admin/ui";
import styles from "@/components/admin/admin.module.css";
import { AlertView } from "@/components/ui/AlertView";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FactList } from "@/components/ui/FactList";
import { getStaffContext } from "@/lib/auth/staff";
import { applicationCount, auditTrail, getStaffJob, listCategories, type AuditEntry } from "@/lib/jobs/admin-data";
import {
  ACCESS_LABELS,
  AVAILABILITY_LABELS,
  availableTransitions,
  CLASSIFICATION_LABELS,
  countryNameOf,
  isActivelyFeatured,
  isOpenForApplications,
  METHOD_LABELS,
} from "@/lib/jobs/model";
import { PROBLEM_MESSAGES, publishProblems } from "@/lib/jobs/validation";
import { saveJob, duplicateJob, setPromotion, transitionJob } from "../actions";

export const metadata: Metadata = { title: "Job" };

const ACTION_LABELS: Record<string, string> = {
  "job.created": "Created",
  "job.duplicated": "Created as a copy",
  "job.updated": "Edited",
  "job.submitted_for_review": "Submitted for review",
  "job.returned_to_draft": "Returned to draft",
  "job.published": "Published",
  "job.unpublished": "Unpublished",
  "job.closed": "Closed",
  "job.reopened": "Reopened",
  "job.archived": "Archived",
  "job.restored": "Restored",
  "job.featured": "Featured",
  "job.unfeatured": "Unfeatured",
  "job.featured_until_changed": "Featured date changed",
  "job.application_access_changed": "Application access changed",
};

function describeChange(entry: AuditEntry): string | null {
  if (entry.action === "job.updated" && entry.new_values) {
    const fields = Object.keys(entry.new_values).map((k) => k.replace(/_/g, " "));
    return fields.length ? `Changed: ${fields.join(", ")}` : null;
  }
  if (entry.action === "job.application_access_changed") {
    return `${String(entry.old_values?.application_access)} → ${String(entry.new_values?.application_access)}`;
  }
  if (entry.action === "job.featured" || entry.action === "job.featured_until_changed") {
    const until = entry.new_values?.featured_until;
    return until ? `Until ${String(until)}` : "No end date";
  }
  return null;
}

const SAVED: Record<string, string> = {
  created: "Draft created.",
  duplicated: "Copied into a new draft. Check the closing date and visibility before submitting it for review.",
};

export default async function JobPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; notice?: string }>;
}) {
  const staff = await getStaffContext();
  if (!staff?.can["jobs.view"]) return <NotAllowed what="viewing jobs" />;
  const { id } = await params;
  const { saved, notice } = await searchParams;

  const [job, categories, audit] = await Promise.all([
    getStaffJob(id),
    listCategories(),
    staff.can["audit.view"] ? auditTrail("job", id) : Promise.resolve([]),
  ]);
  if (!job) notFound();

  const canManage = staff.can["jobs.manage"];
  const next = job.status === "draft" ? "review" : job.status === "review" || job.status === "closed" ? "published" : null;
  const check = {
    classification: job.classification,
    categoryActive: job.category?.is_active ?? null,
    country_code: job.country_code,
    employment_type: job.employment_type,
    summary: job.summary,
    employer_disclosure: job.employer_disclosure,
    availability: job.availability,
    closes_on: job.closes_on,
    requirements: job.requirements,
    application_access: job.application_access,
  };
  const problems = next ? publishProblems(check, next) : [];
  const liveProblems = job.status === "published" ? publishProblems(check, "published", { entering: false }) : [];
  const open = isOpenForApplications({
    status: job.status,
    availability: job.availability,
    closesOn: job.closes_on,
    promotion: job.promotion,
    featuredUntil: job.featured_until,
    applicationAccess: job.application_access,
  });
  const featuredNow = isActivelyFeatured({ promotion: job.promotion, featuredUntil: job.featured_until });
  const publicPage = job.status === "published" || job.status === "closed";

  return (
    <>
      <PageTitle
        eyebrow={
          <span className={styles.badges}>
            <span className={styles.mono}>{job.reference}</span>
            <JobStatusBadge status={job.status} />
            {featuredNow ? <Badge tone="green">Featured</Badge> : null}
            {job.application_access === "paid" ? <Badge tone="warning">Paid access — not publishable</Badge> : null}
          </span>
        }
        title={job.title}
        description={`${CLASSIFICATION_LABELS[job.classification]} · ${job.category?.name ?? "No category"} · ${
          [job.city, countryNameOf(job.country_code)].filter(Boolean).join(", ") || "No location yet"
        }`}
        actions={
          <>
            <Button href={`/admin/jobs/${job.id}/preview`} size="sm" variant="secondary">
              Preview
            </Button>
            {publicPage ? (
              <Button href={`/jobs/${job.slug}`} size="sm" variant="secondary" external="(opens the public page in a new tab)">
                Public page
              </Button>
            ) : null}
          </>
        }
      />

      {saved && SAVED[saved] ? <AlertView tone="success" toneLabel="Success" title={SAVED[saved]} /> : null}
      {notice === "normalised" ? (
        <AlertView tone="warning" toneLabel="Warning" title="Some contradictory values were removed when the draft was saved (for example a closing date on an ongoing job)." />
      ) : null}

      <div className={styles.grid2}>
        <div className={styles.content}>
          {canManage ? (
            <JobForm
              action={saveJob}
              categories={categories}
              values={{
                ...job,
                published: job.published_at !== null,
                responsibilities: job.responsibilities,
                requirements: job.requirements,
                benefits: job.benefits,
              }}
            />
          ) : (
            <Panel id="job-readonly" title="Details">
              <p className={styles.muted}>Your role can view jobs but not edit them.</p>
              <FactList
                items={[
                  { key: "summary", label: "Summary", value: job.summary ?? "—" },
                  { key: "availability", label: "Availability", value: AVAILABILITY_LABELS[job.availability] },
                  { key: "access", label: "Application", value: ACCESS_LABELS[job.application_access] },
                ]}
              />
            </Panel>
          )}
        </div>

        <div className={styles.content}>
          <Panel id="job-lifecycle" title="Lifecycle">
            <p className={styles.muted}>
              {job.status === "published"
                ? open
                  ? "Public and accepting applications."
                  : "Public, but not accepting applications — the closing date has passed. Close it, or move the date forward."
                : job.status === "closed"
                  ? "The public page says this job has closed. No new applications."
                  : job.status === "archived"
                    ? "Hidden everywhere. Applications and history are kept."
                    : "Not public."}
            </p>
            {next ? (
              problems.length ? (
                <AlertView tone="warning" toneLabel="Warning" title={`Before this job can be ${next === "review" ? "submitted for review" : "published"}:`}>
                  <ul className={styles.problems}>
                    {problems.map((p) => (
                      <li key={p}>{PROBLEM_MESSAGES[p]}</li>
                    ))}
                  </ul>
                </AlertView>
              ) : (
                <AlertView tone="success" toneLabel="Ready" title={next === "review" ? "Complete enough to submit for review." : "Ready to publish."} />
              )
            ) : null}
            {liveProblems.length ? (
              <AlertView tone="warning" toneLabel="Warning" title="This published job has gaps. Edits must keep it complete:">
                <ul className={styles.problems}>
                  {liveProblems.map((p) => (
                    <li key={p}>{PROBLEM_MESSAGES[p]}</li>
                  ))}
                </ul>
              </AlertView>
            ) : null}
            {canManage ? <JobLifecycle id={job.id} status={job.status} actions={availableTransitions(job.status)} action={transitionJob} /> : null}
          </Panel>

          <Panel id="job-visibility" title="Visibility">
            <p className={styles.muted}>
              {job.promotion === "featured"
                ? featuredNow
                  ? `Featured${job.featured_until ? ` until the end of ${job.featured_until}` : ", with no end date"}.`
                  : `The featured period ended on ${job.featured_until}. The job is shown as standard.`
                : "Standard."}{" "}
              Featuring never changes application access.
            </p>
            {canManage ? (
              <JobPromotionControl id={job.id} promotion={job.promotion} featuredUntil={job.featured_until} action={setPromotion} />
            ) : null}
          </Panel>

          <Panel id="job-record" title="Record">
            <FactList
              items={[
                { key: "reference", label: "Reference", value: job.reference, mono: true },
                { key: "access", label: "Application", value: `${ACCESS_LABELS[job.application_access]} · ${METHOD_LABELS[job.application_method]}` },
                {
                  key: "applications",
                  label: "Applications",
                  value: staff.can["applications.screen"] ? (
                    <Link href={`/admin/applications?job=${job.id}`}>{applicationCount(job).toLocaleString("en-IN")} — view</Link>
                  ) : (
                    "—"
                  ),
                },
                { key: "created", label: "Created", value: <><Time iso={job.created_at} withTime /> · {job.creator?.full_name ?? "System"}</> },
                { key: "updated", label: "Last updated", value: <><Time iso={job.updated_at} withTime /> · {job.updater?.full_name ?? job.creator?.full_name ?? "System"}</> },
                { key: "published", label: "First published", value: <Time iso={job.published_at} withTime /> },
                ...(job.closed_at ? [{ key: "closed", label: "Closed", value: <Time iso={job.closed_at} withTime /> }] : []),
                ...(job.archived_at ? [{ key: "archived", label: "Archived", value: <Time iso={job.archived_at} withTime /> }] : []),
                ...(job.duplicated_from ? [{ key: "copy", label: "Copied from", value: <Link href={`/admin/jobs/${job.duplicated_from}`}>Original job</Link> }] : []),
              ]}
            />
            {canManage ? <DuplicateJob id={job.id} action={duplicateJob} /> : null}
          </Panel>

          {staff.can["audit.view"] ? (
            <Panel id="job-history" title="History">
              {audit.length ? (
                <ol className={styles.timeline}>
                  {audit.map((entry) => (
                    <li key={entry.id} className={styles.timelineItem}>
                      <span className={styles.timelineWhat}>{ACTION_LABELS[entry.action] ?? entry.action}</span>
                      {describeChange(entry) ? <span>{describeChange(entry)}</span> : null}
                      <span className={styles.muted}>
                        <Time iso={entry.occurred_at} withTime /> · {entry.actor_label ?? (entry.actor_type === "system" ? "System" : "Staff")}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className={styles.muted}>No history recorded.</p>
              )}
            </Panel>
          ) : null}
        </div>
      </div>
    </>
  );
}
