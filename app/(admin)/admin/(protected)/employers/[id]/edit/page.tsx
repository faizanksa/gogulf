import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EmployerForm } from "@/components/admin/EmployerForm";
import { NotAllowed, PageTitle } from "@/components/admin/ui";
import { listActiveBranches } from "@/lib/admin/platform-data";
import { getStaffContext } from "@/lib/auth/staff";
import { getEmployer } from "@/lib/crm/employer-data";
import { saveEmployer } from "../../actions";

export const metadata: Metadata = { title: "Edit employer" };

/** Edit an employer (0022). employers.manage to be here; RLS decides which employers. */
export default async function EditEmployerPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await getStaffContext();
  if (!staff?.can["employers.manage"]) return <NotAllowed what="editing employers" />;
  const { id } = await params;
  const [result, branches] = await Promise.all([getEmployer(id), listActiveBranches()]);
  if (!result) notFound();
  const { employer } = result;

  return (
    <>
      <PageTitle eyebrow="Employer" title={`Edit ${employer.name}`} description="Every change is on the audit trail." />
      <EmployerForm
        action={saveEmployer}
        branches={branches}
        values={{
          id: employer.id,
          name: employer.name,
          country_code: employer.country_code,
          registration_number: employer.registration_number,
          website: employer.website,
          contact_person: employer.contact_person,
          email: employer.email,
          phone: employer.phone,
          status: employer.status,
          notes: employer.notes,
          branch_id: employer.branch_id,
        }}
      />
    </>
  );
}
