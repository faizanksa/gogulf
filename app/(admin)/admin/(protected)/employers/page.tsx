import type { Metadata } from "next";
import Link from "next/link";
import { EmployerStatusBadge, FilterField, FilterForm, NotAllowed, PageTitle, Pagination } from "@/components/admin/ui";
import styles from "@/components/admin/admin.module.css";
import { Input, Select } from "@/components/form/Controls";
import { AlertView } from "@/components/ui/AlertView";
import { Button } from "@/components/ui/Button";
import { first, oneOf, pageOf, searchText, type SearchParams } from "@/lib/admin/params";
import { getStaffContext } from "@/lib/auth/staff";
import { listEmployers } from "@/lib/crm/employer-data";
import { EMPLOYER_STATUSES, EMPLOYER_STATUS_LABELS } from "@/lib/crm/employers";
import { countryNameOf } from "@/lib/jobs/model";

export const metadata: Metadata = { title: "Employers" };

const PATH = "/admin/employers";

/** The organisations candidates are recruited for. Each belongs to a branch; RLS shows your scope. */
export default async function EmployersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await getStaffContext();
  if (!staff?.can["employers.view"]) return <NotAllowed what="viewing employers" />;
  const params = await searchParams;
  const filters = { q: searchText(params), status: oneOf(params, "status", EMPLOYER_STATUSES), page: pageOf(params) };
  const { employers, total, failed } = await listEmployers(filters);
  const current = { q: filters.q, status: filters.status, page: String(filters.page) };
  const active = Boolean(filters.q || filters.status);

  return (
    <>
      <PageTitle
        title="Employers"
        description="The organisations candidates are recruited for. Link them to jobs and recruitment cases."
        actions={
          staff.can["employers.manage"] ? (
            <Button href="/admin/employers/new" size="sm">
              New employer
            </Button>
          ) : undefined
        }
      />
      <FilterForm label="Filter employers" clearHref={PATH} active={active}>
        <FilterField id="f-q" label="Search" search>
          <Input id="f-q" name="q" type="search" defaultValue={first(params, "q")} placeholder="Name, contact person or email" />
        </FilterField>
        <FilterField id="f-status" label="Status">
          <Select id="f-status" name="status" defaultValue={filters.status}>
            <option value="">Any status</option>
            {EMPLOYER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {EMPLOYER_STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </FilterField>
      </FilterForm>
      {failed ? <AlertView tone="error" toneLabel="Error" title="Employers could not be loaded. Try again." /> : null}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <caption className="visually-hidden">Employers</caption>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Country</th>
              <th scope="col">Contact person</th>
              <th scope="col">Status</th>
              <th scope="col">Branch</th>
            </tr>
          </thead>
          <tbody>
            {employers.length === 0 ? (
              <tr>
                <td colSpan={5} className={styles.emptyCell} data-label="">
                  {active ? "No employers match these filters." : "No employers yet."}
                </td>
              </tr>
            ) : (
              employers.map((e) => (
                <tr key={e.id}>
                  <td data-label="">
                    <Link href={`/admin/employers/${e.id}`} className={styles.cellTitle}>
                      {e.name}
                    </Link>
                  </td>
                  <td data-label="Country">{countryNameOf(e.country_code)}</td>
                  <td data-label="Contact person">{e.contact_person ?? "—"}</td>
                  <td data-label="Status">
                    <EmployerStatusBadge status={e.status} />
                  </td>
                  <td data-label="Branch">{e.branch?.name ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <Pagination path={PATH} params={current} page={filters.page} total={total} noun={["employer", "employers"]} />
    </>
  );
}
