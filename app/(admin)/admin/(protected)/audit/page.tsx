import type { Metadata } from "next";
import Link from "next/link";
import { FilterField, FilterForm, NotAllowed, PageTitle, Pagination, Time } from "@/components/admin/ui";
import styles from "@/components/admin/admin.module.css";
import { Input, Select } from "@/components/form/Controls";
import { AlertView } from "@/components/ui/AlertView";
import { first, oneOf, pageOf, searchText, type SearchParams } from "@/lib/admin/params";
import { auditHref } from "@/lib/admin/dashboard-model";
import { ENTITY_LABELS, listAudit, PRIVILEGED_ENTITIES } from "@/lib/admin/platform-data";
import { getStaffContext } from "@/lib/auth/staff";

export const metadata: Metadata = { title: "Audit" };

const PATH = "/admin/audit";

/** Field names that changed — never their values, which can be personal data. */
function changed(row: { action: string; old_values: Record<string, unknown> | null; new_values: Record<string, unknown> | null }): string | null {
  const before = row.old_values ?? {};
  const after = row.new_values ?? {};
  if ("status" in after && "status" in before && before.status !== after.status) return `${String(before.status)} → ${String(after.status)}`;
  const keys = Object.keys(after).filter((k) => !["updated_at", "updated_by"].includes(k));
  return keys.length ? `Fields: ${keys.slice(0, 6).map((k) => k.replace(/_/g, " ")).join(", ")}${keys.length > 6 ? "…" : ""}` : null;
}

/**
 * The audit trail, read as this person. The database decides what a role may see: an
 * administrator reads the operational trail (jobs, applications, invoices, payments,
 * documents); the entries about staff, role grants and settings appear only for the roles
 * that manage those things (0016). Nobody can edit or delete an entry — there is no such
 * policy for any role.
 */
export default async function AuditPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await getStaffContext();
  if (!staff?.can["audit.view"]) return <NotAllowed what="reading the audit trail" />;

  const params = await searchParams;
  const visibleEntities = Object.keys(ENTITY_LABELS).filter((e) => {
    if (e === "staff_users") return staff.can["users.manage"];
    if (e === "role_permissions") return staff.can["roles.manage"];
    if (e === "settings") return staff.can["settings.manage"];
    return true;
  });
  const filters = { entity: oneOf(params, "entity", visibleEntities), q: searchText(params), page: pageOf(params) };
  const { rows, total, failed } = await listAudit(filters);
  const current = { entity: filters.entity, q: filters.q, page: String(filters.page) };
  const active = Boolean(filters.entity || filters.q);

  return (
    <>
      <PageTitle
        title="Audit trail"
        description={
          staff.can["users.manage"] || staff.can["roles.manage"]
            ? "Every recorded change, newest first. Entries are written by the database and cannot be edited or deleted."
            : "Changes to the work your role does — jobs, applications, invoices, payments and documents — newest first. Entries about staff, roles and settings are visible to super administrators."
        }
      />

      <FilterForm label="Filter the audit trail" clearHref={PATH} active={active}>
        <FilterField id="f-q" label="Action contains" search>
          <Input id="f-q" name="q" type="search" defaultValue={first(params, "q")} placeholder="For example: published, paid, converted" />
        </FilterField>
        <FilterField id="f-entity" label="About">
          <Select id="f-entity" name="entity" defaultValue={filters.entity}>
            <option value="">Everything I can see</option>
            {visibleEntities.map((e) => (
              <option key={e} value={e}>
                {ENTITY_LABELS[e]}
                {PRIVILEGED_ENTITIES.includes(e) ? " (platform)" : ""}
              </option>
            ))}
          </Select>
        </FilterField>
      </FilterForm>

      {failed ? <AlertView tone="error" toneLabel="Error" title="The audit trail could not be loaded. Try again." /> : null}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <caption className="visually-hidden">Audit trail</caption>
          <thead>
            <tr>
              <th scope="col">When</th>
              <th scope="col">Action</th>
              <th scope="col">About</th>
              <th scope="col">By</th>
              <th scope="col">Change</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className={styles.emptyCell} data-label="">
                  {active ? "No entries match these filters." : "Nothing has been recorded yet."}
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const href = auditHref(row.entity_type, row.entity_id);
                return (
                  <tr key={row.id}>
                    <td data-label="When" className={styles.nowrap}>
                      <Time iso={row.occurred_at} withTime />
                    </td>
                    <td data-label="Action" className={styles.mono}>
                      {row.action}
                    </td>
                    <td data-label="About">
                      {ENTITY_LABELS[row.entity_type] ?? row.entity_type}
                      {href ? (
                        <>
                          {" "}
                          <Link href={href}>Open</Link>
                        </>
                      ) : null}
                    </td>
                    <td data-label="By">{row.actor_label ?? (row.actor_type === "system" ? "System" : row.actor_type)}</td>
                    <td data-label="Change" className={styles.muted}>
                      {changed(row) ?? "—"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Pagination path={PATH} params={current} page={filters.page} total={total} noun={["entry", "entries"]} />
    </>
  );
}
