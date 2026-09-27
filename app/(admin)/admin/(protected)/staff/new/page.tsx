import type { Metadata } from "next";
import { StaffInviteForm } from "@/components/admin/StaffInviteForm";
import { NotAllowed, PageTitle } from "@/components/admin/ui";
import { AlertView } from "@/components/ui/AlertView";
import { listActiveBranches, listRoles } from "@/lib/admin/platform-data";
import { getStaffContext } from "@/lib/auth/staff";
import { inviteStaff } from "../actions";

export const metadata: Metadata = { title: "Add staff member" };

/**
 * Staff onboarding, steps 1 and 2 of docs/SECURITY-MODEL.md §3: a staff record and a
 * confirmed, passwordless sign-in account. Step 3 is theirs — the first Google sign-in.
 * users.manage to be here; a super administrator role is offered only with roles.manage.
 */
export default async function NewStaffPage() {
  const staff = await getStaffContext();
  if (!staff?.can["users.manage"]) return <NotAllowed what="adding staff" />;

  const [roles, branches] = await Promise.all([listRoles(), listActiveBranches()]);
  const offered = roles.filter((r) => !r.is_super || staff.can["roles.manage"]).map((r) => ({ key: r.key, label: r.label, description: r.description }));

  return (
    <>
      <PageTitle
        eyebrow="Staff"
        title="Add staff member"
        description="They must already have a Go Gulf Google Workspace account (an @gogulf.co address). After you add them here, they sign in once with Google and their access starts with the role you choose. They are never given a password, and nothing is emailed — you tell them to sign in."
      />
      {branches.length === 0 ? (
        <AlertView tone="error" toneLabel="Error" title="No active branch exists, so nobody can be added. Ask a developer to check the branches." />
      ) : (
        <StaffInviteForm action={inviteStaff} roles={offered} branches={branches} />
      )}
    </>
  );
}
