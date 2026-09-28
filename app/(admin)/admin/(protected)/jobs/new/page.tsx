import type { Metadata } from "next";
import { JobForm } from "@/components/admin/JobForm";
import { NotAllowed, PageTitle } from "@/components/admin/ui";
import { getStaffContext } from "@/lib/auth/staff";
import { listEmployerOptions } from "@/lib/crm/employer-data";
import { listCategories } from "@/lib/jobs/admin-data";
import { saveJob } from "../actions";

export const metadata: Metadata = { title: "New job" };

export default async function NewJobPage() {
  const staff = await getStaffContext();
  if (!staff?.can["jobs.manage"]) return <NotAllowed what="creating jobs" />;
  const [categories, employers] = await Promise.all([listCategories(), staff.can["employers.view"] ? listEmployerOptions() : Promise.resolve(null)]);

  return (
    <>
      <PageTitle
        eyebrow="Jobs"
        title="New job"
        description="Saved as a draft. Fill in what the employer has confirmed — leave anything else empty rather than guessing. Publishing checks the minimum a genuine listing needs."
      />
      <JobForm action={saveJob} categories={categories} employers={employers} />
    </>
  );
}
