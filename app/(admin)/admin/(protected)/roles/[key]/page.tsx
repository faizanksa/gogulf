import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NotAllowed, PageTitle } from "@/components/admin/ui";
import { RoleGrantsForm, type GrantGroup } from "@/components/admin/RoleGrantsForm";
import { AlertView } from "@/components/ui/AlertView";
import { allGrants, listPermissions, listRoles } from "@/lib/admin/platform-data";
import { getStaffContext } from "@/lib/auth/staff";
import { saveRoleGrants } from "../actions";

export const metadata: Metadata = { title: "Role" };

export default async function RolePage({ params }: { params: Promise<{ key: string }> }) {
  const staff = await getStaffContext();
  if (!staff?.can["roles.manage"]) return <NotAllowed what="managing roles and permissions" />;

  const { key } = await params;
  const [roles, permissions, grants] = await Promise.all([listRoles(), listPermissions(), allGrants()]);
  const role = roles.find((r) => r.key === key);
  if (!role) notFound();

  const mine = grants[role.key] ?? {};
  const groups: GrantGroup[] = [...new Set(permissions.map((p) => p.domain))].map((domain) => ({
    domain,
    permissions: permissions.filter((p) => p.domain === domain).map((p) => ({ key: p.key, description: p.description, scope: mine[p.key] ?? null })),
  }));

  return (
    <>
      <PageTitle
        eyebrow={<Link href="/admin/roles">Roles and permissions</Link>}
        title={role.label}
        description={role.description ?? undefined}
      />

      {role.is_super ? (
        <AlertView tone="info" toneLabel="Note" title="A super administrator is unrestricted. It holds no explicit grants, so there is nothing to edit here." />
      ) : (
        <>
          <AlertView
            tone="warning"
            toneLabel="Warning"
            title="Changes apply to everyone in this role on their next request and are recorded in the audit trail. roles.manage and permissions.manage cannot be granted from this screen."
          />
          <RoleGrantsForm role={role.key} label={role.label} groups={groups} action={saveRoleGrants} />
        </>
      )}
    </>
  );
}
