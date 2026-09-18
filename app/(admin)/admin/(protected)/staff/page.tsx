import type { Metadata } from "next";
import { NotAllowed, PageTitle, Time } from "@/components/admin/ui";
import { ActiveControl, RoleControl } from "@/components/admin/StaffControls";
import styles from "@/components/admin/admin.module.css";
import { AlertView } from "@/components/ui/AlertView";
import { Badge } from "@/components/ui/Badge";
import { listRoles, listStaff } from "@/lib/admin/platform-data";
import { getStaffContext } from "@/lib/auth/staff";
import { setStaffActive, setStaffRole } from "./actions";

export const metadata: Metadata = { title: "Staff" };

/**
 * Who can sign in, and as what. Roles are changed by a super administrator only
 * (roles.manage); activation needs users.manage. Both are re-checked on the server and by
 * the database, and every change is in the audit trail. There is no "add staff" button:
 * an account is created by `npm run bootstrap:admins` (confirmed email, no password), so
 * the only way in is a Google Workspace sign-in.
 */
export default async function StaffPage() {
  const staff = await getStaffContext();
  if (!staff?.can["users.manage"]) return <NotAllowed what="managing staff" />;

  const [{ rows, failed }, roles] = await Promise.all([listStaff(), listRoles()]);
  const canRoles = staff.can["roles.manage"];
  const label = (key: string) => roles.find((r) => r.key === key)?.label ?? key;

  return (
    <>
      <PageTitle title="Staff" description="Everyone with a staff record. They sign in with Google; there are no passwords here." />

      {failed ? <AlertView tone="error" toneLabel="Error" title="Staff could not be loaded. Try again." /> : null}
      {!canRoles ? <AlertView tone="info" toneLabel="Note" title="Changing a role needs the roles permission, which only a super administrator holds." /> : null}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <caption className="visually-hidden">Staff</caption>
          <thead>
            <tr>
              <th scope="col">Person</th>
              <th scope="col">Role</th>
              <th scope="col">Branch</th>
              <th scope="col">Status</th>
              <th scope="col">Added</th>
              <th scope="col">
                <span className="visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((person) => {
              const isSelf = person.id === staff.staffId;
              return (
                <tr key={person.id}>
                  <td data-label="">
                    <div className={styles.cellMain}>
                      <span className={styles.cellTitle}>
                        {person.full_name}
                        {isSelf ? <span className={styles.muted}> (you)</span> : null}
                      </span>
                      <span className={styles.mono}>{person.email}</span>
                    </div>
                  </td>
                  <td data-label="Role">
                    {canRoles && !isSelf ? <RoleControl id={person.id} role={person.role_key} roles={roles} name={person.full_name} action={setStaffRole} /> : label(person.role_key)}
                  </td>
                  <td data-label="Branch">{person.branch?.name ?? "—"}</td>
                  <td data-label="Status">{person.is_active ? <Badge tone="green">Active</Badge> : <Badge tone="neutral">Deactivated</Badge>}</td>
                  <td data-label="Added" className={styles.nowrap}>
                    <Time iso={person.created_at} />
                  </td>
                  <td data-label="">{isSelf ? null : <ActiveControl id={person.id} active={person.is_active} name={person.full_name} action={setStaffActive} />}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
