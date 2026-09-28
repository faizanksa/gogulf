import type { Metadata } from "next";
import { EmployerForm } from "@/components/admin/EmployerForm";
import { NotAllowed, PageTitle } from "@/components/admin/ui";
import { listActiveBranches } from "@/lib/admin/platform-data";
import { getStaffContext } from "@/lib/auth/staff";
import { saveEmployer } from "../actions";

export const metadata: Metadata = { title: "New employer" };

/** Create an employer (0022). employers.manage to be here; the database decides the branch. */
export default async function NewEmployerPage() {
  const staff = await getStaffContext();
  if (!staff?.can["employers.manage"]) return <NotAllowed what="creating employers" />;
  const branches = await listActiveBranches();
  const mine = branches.find((b) => b.name === staff.branch) ?? branches[0];

  return (
    <>
      <PageTitle eyebrow="Employers" title="New employer" description="Search the list first: the same name in the same country is one employer." />
      <EmployerForm action={saveEmployer} branches={branches} values={{ status: "active", branch_id: mine?.id }} />
    </>
  );
}
