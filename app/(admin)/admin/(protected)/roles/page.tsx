import type { Metadata } from "next";
import { Fragment } from "react";
import Link from "next/link";
import { NotAllowed, PageTitle, Panel } from "@/components/admin/ui";
import styles from "@/components/admin/admin.module.css";
import { allGrants, listPermissions, listRoles } from "@/lib/admin/platform-data";
import { getStaffContext } from "@/lib/auth/staff";

export const metadata: Metadata = { title: "Roles and permissions" };

const LETTER = { own: "own", branch: "branch", all: "all" } as const;

/**
 * Who can do what, in one table. Read here, edited role by role. Only a super
 * administrator (roles.manage) reaches this page, and only they can write a grant — the
 * database refuses everyone else (0007) — so an administrator can never widen their own
 * access. A super administrator is unrestricted and holds no explicit grants.
 */
export default async function RolesPage() {
  const staff = await getStaffContext();
  if (!staff?.can["roles.manage"]) return <NotAllowed what="managing roles and permissions" />;

  const [roles, permissions, grants] = await Promise.all([listRoles(), listPermissions(), allGrants()]);
  const domains = [...new Set(permissions.map((p) => p.domain))];

  return (
    <>
      <PageTitle title="Roles and permissions" description="What each role may do, and how widely: its own records, its own branch, or everything. Open a role to change it." />

      <Panel id="roles-list" title="Roles">
        <ul className={styles.inlineLinks}>
          {roles.map((r) => (
            <li key={r.key}>
              {r.is_super ? (
                <span>
                  {r.label} <span className={styles.muted}>(unrestricted)</span>
                </span>
              ) : (
                <Link href={`/admin/roles/${r.key}`}>{r.label}</Link>
              )}{" "}
              <span className={styles.muted}>{Object.keys(grants[r.key] ?? {}).length ? `${Object.keys(grants[r.key] ?? {}).length} permissions` : ""}</span>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel id="roles-matrix" title="Everything at a glance">
        <div className={styles.tableWrap}>
          <table className={`${styles.table} ${styles.matrix}`}>
            <caption className="visually-hidden">Permissions by role</caption>
            <thead>
              <tr>
                <th scope="col">Permission</th>
                {roles.map((r) => (
                  <th key={r.key} scope="col">
                    {r.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {domains.map((domain) => (
                <Fragment key={`g-${domain}`}>
                  <tr key={`d-${domain}`}>
                    <th scope="rowgroup" colSpan={roles.length + 1} className={styles.muted}>
                      {domain}
                    </th>
                  </tr>
                  {permissions
                    .filter((p) => p.domain === domain)
                    .map((p) => (
                      <tr key={p.key}>
                        <td data-label="" className={styles.mono}>
                          {p.key}
                        </td>
                        {roles.map((r) => {
                          const scope = grants[r.key]?.[p.key];
                          return (
                            <td key={r.key} data-label={r.label}>
                              {r.is_super ? "✓" : scope ? LETTER[scope] : <span className={styles.muted}>—</span>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
