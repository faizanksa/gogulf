import type { Metadata } from "next";
import { headers } from "next/headers";
import { NotAllowed, PageTitle, Time } from "@/components/admin/ui";
import { ActiveControl, RoleControl } from "@/components/admin/StaffControls";
import styles from "@/components/admin/admin.module.css";
import { AlertView } from "@/components/ui/AlertView";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { listRoles, listStaff, listStaffSignInStatus } from "@/lib/admin/platform-data";
import { ONBOARDING_LABELS, onboardingState, type OnboardingState } from "@/lib/admin/staff-onboarding";
import { getStaffContext } from "@/lib/auth/staff";
import { setStaffActive, setStaffRole } from "./actions";

export const metadata: Metadata = { title: "Staff" };

const ONBOARDING_TONES: Record<OnboardingState, "neutral" | "green" | "blue" | "warning" | "error"> = {
  "signed-in": "green",
  "awaiting-sign-in": "warning",
  "no-login": "error",
  unconfirmed: "error",
  unknown: "neutral",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Who can sign in, and as what. Roles are changed by a super administrator only
 * (roles.manage); adding and activation need users.manage. All are re-checked on the
 * server and by the database, and every change is in the audit trail. People are added on
 * /admin/staff/new (or by `npm run bootstrap:admins`) with a confirmed email and no
 * password, so the only way in is a Google Workspace sign-in. The Onboarding column shows
 * whether that first sign-in has happened (0018).
 */
export default async function StaffPage({ searchParams }: { searchParams: Promise<{ added?: string }> }) {
  const staff = await getStaffContext();
  if (!staff?.can["users.manage"]) return <NotAllowed what="managing staff" />;

  const [{ rows, failed }, roles, signIn, { added }, host] = await Promise.all([
    listStaff(),
    listRoles(),
    listStaffSignInStatus(),
    searchParams,
    headers().then((h) => h.get("host")),
  ]);
  const canRoles = staff.can["roles.manage"];
  const label = (key: string) => roles.find((r) => r.key === key)?.label ?? key;
  const newcomer = added && UUID.test(added) ? rows.find((r) => r.id === added) : undefined;
  const signInAt = `${host ?? ""}/admin/login`;

  return (
    <>
      <PageTitle
        title="Staff"
        description="Everyone with a staff record. They sign in with Google; there are no passwords here."
        actions={
          <Button href="/admin/staff/new" size="sm" icon="arrow-right" iconPosition="end">
            Add staff member
          </Button>
        }
      />

      {newcomer ? (
        <AlertView tone="success" toneLabel="Success" title={`${newcomer.full_name} was added as ${label(newcomer.role_key)}.`}>
          <p>
            Tell them to open <strong>{signInAt}</strong> and choose “Sign in with Google” using <strong>{newcomer.email}</strong>. Their access starts with that first sign-in. Nothing has been emailed to them.
          </p>
        </AlertView>
      ) : null}
      {failed ? <AlertView tone="error" toneLabel="Error" title="Staff could not be loaded. Try again." /> : null}
      {signIn.failed ? <AlertView tone="warning" toneLabel="Warning" title="Sign-in progress could not be loaded, so the Onboarding column shows Unknown." /> : null}
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
              <th scope="col">Onboarding</th>
              <th scope="col">Added</th>
              <th scope="col">
                <span className="visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !failed ? (
              <tr>
                <td colSpan={7} className={styles.muted}>
                  No staff records.
                </td>
              </tr>
            ) : null}
            {rows.map((person) => {
              const isSelf = person.id === staff.staffId;
              const status = signIn.byStaff.get(person.id);
              const state = onboardingState(status);
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
                  <td data-label="Onboarding">
                    <div className={styles.cellMain}>
                      <Badge tone={ONBOARDING_TONES[state]}>{ONBOARDING_LABELS[state]}</Badge>
                      {state === "signed-in" && status?.google_last_sign_in ? (
                        <span className={styles.muted}>
                          Last <Time iso={status.google_last_sign_in} withTime />
                        </span>
                      ) : null}
                      {state === "awaiting-sign-in" ? <span className={styles.muted}>Ask them to sign in with Google.</span> : null}
                      {state === "no-login" ? <span className={styles.muted}>Setup stopped part-way. Add the same address again to finish.</span> : null}
                      {state === "unconfirmed" ? <span className={styles.muted}>Their sign-in account needs a developer to check it.</span> : null}
                    </div>
                  </td>
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
