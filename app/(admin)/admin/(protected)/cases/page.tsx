import type { Metadata } from "next";
import Link from "next/link";
import { CASE_STATUS_LABELS, FilterField, FilterForm, NotAllowed, PageTitle, Pagination, Time } from "@/components/admin/ui";
import styles from "@/components/admin/admin.module.css";
import { Input, Select } from "@/components/form/Controls";
import { AlertView } from "@/components/ui/AlertView";
import { first, oneOf, pageOf, searchText, type SearchParams } from "@/lib/admin/params";
import { getStaffContext } from "@/lib/auth/staff";
import { CASE_STATUSES, listCases } from "@/lib/crm/data";

export const metadata: Metadata = { title: "Cases" };

const PATH = "/admin/cases";

export default async function CasesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await getStaffContext();
  if (!staff?.can["cases.view"]) return <NotAllowed what="viewing cases" />;
  const params = await searchParams;
  const filters = { q: searchText(params), status: oneOf(params, "status", CASE_STATUSES), page: pageOf(params) };
  const { cases, total, failed } = await listCases(filters);
  const current = { q: filters.q, status: filters.status, page: String(filters.page) };
  const active = Boolean(filters.q || filters.status);

  return (
    <>
      <PageTitle title="Cases" description="Recruitment and other cases, newest first. A converted application opens a recruitment case at the New stage." />
      <FilterForm label="Filter cases" clearHref={PATH} active={active}>
        <FilterField id="f-q" label="Search" search>
          <Input id="f-q" name="q" type="search" defaultValue={first(params, "q")} placeholder="Case number or title" />
        </FilterField>
        <FilterField id="f-status" label="Status">
          <Select id="f-status" name="status" defaultValue={filters.status}>
            <option value="">Any status</option>
            {CASE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {CASE_STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </FilterField>
      </FilterForm>
      {failed ? <AlertView tone="error" toneLabel="Error" title="Cases could not be loaded. Try again." /> : null}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <caption className="visually-hidden">Cases</caption>
          <thead>
            <tr>
              <th scope="col">Case</th>
              <th scope="col">Contact</th>
              <th scope="col">Type</th>
              <th scope="col">Stage</th>
              <th scope="col">Status</th>
              <th scope="col">Owner</th>
              <th scope="col">Opened</th>
            </tr>
          </thead>
          <tbody>
            {cases.length === 0 ? (
              <tr>
                <td colSpan={7} className={styles.emptyCell} data-label="">
                  {active ? "No cases match these filters." : "No cases yet."}
                </td>
              </tr>
            ) : (
              cases.map((k) => (
                <tr key={k.id}>
                  <td data-label="">
                    <div className={styles.cellMain}>
                      <Link href={`/admin/cases/${k.id}`} className={`${styles.cellTitle} ${styles.mono}`}>
                        {k.case_number}
                      </Link>
                      <span className={styles.muted}>{k.title ?? "—"}</span>
                    </div>
                  </td>
                  <td data-label="Contact">{k.contact ? <Link href={`/admin/contacts/${k.contact.id}`}>{k.contact.full_name}</Link> : "—"}</td>
                  <td data-label="Type">{k.case_type.replace(/_/g, " ")}</td>
                  <td data-label="Stage">{k.stage?.name ?? "—"}</td>
                  <td data-label="Status">{CASE_STATUS_LABELS[k.status]}</td>
                  <td data-label="Owner">{k.owner?.full_name ?? "—"}</td>
                  <td data-label="Opened" className={styles.nowrap}>
                    <Time iso={k.opened_at} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <Pagination path={PATH} params={current} page={filters.page} total={total} noun={["case", "cases"]} />
    </>
  );
}
