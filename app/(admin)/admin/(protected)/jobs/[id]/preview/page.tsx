import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JobDetail } from "@/components/jobs/JobDetail";
import { NotAllowed } from "@/components/admin/ui";
import styles from "@/components/admin/admin.module.css";
import { AlertView } from "@/components/ui/AlertView";
import { Button } from "@/components/ui/Button";
import { createTranslator } from "@/lib/i18n/translator";
import { getStaffContext } from "@/lib/auth/staff";
import { getStaffJob } from "@/lib/jobs/admin-data";
import { STATUS_LABELS } from "@/lib/jobs/model";
import { toPublicJob, type JobRowForPublic } from "@/lib/jobs/public-job";

export const metadata: Metadata = { title: "Job preview" };

/**
 * The job exactly as the public page renders it (components/jobs/JobDetail), in any
 * status — read through the staff session, so a draft can be checked before it is
 * published. Internal notes are not part of the public shape and do not appear. No
 * structured data is emitted here.
 */
export default async function JobPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await getStaffContext();
  if (!staff?.can["jobs.view"]) return <NotAllowed what="viewing jobs" />;
  const { id } = await params;
  const row = await getStaffJob(id);
  if (!row) notFound();

  const job = toPublicJob({ ...row, category: row.category ? { slug: row.category.slug, name: row.category.name } : null } as JobRowForPublic);
  const isPublic = row.status === "published" || row.status === "closed";

  return (
    <>
      <div className={styles.previewBanner}>
        <AlertView
          tone={isPublic ? "info" : "warning"}
          toneLabel="Preview"
          title={`Preview — ${STATUS_LABELS[row.status]}. ${isPublic ? "This is how the public page looks." : "This job is not public."}`}
        >
          <p>
            <Button href={`/admin/jobs/${row.id}`} size="sm" variant="secondary">
              Back to the job
            </Button>
          </p>
        </AlertView>
      </div>
      <div lang="en">
        <JobDetail job={job} locale="en" t={createTranslator("en")} />
      </div>
    </>
  );
}
