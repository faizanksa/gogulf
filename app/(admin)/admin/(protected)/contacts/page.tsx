import type { Metadata } from "next";
import Link from "next/link";
import { FilterField, FilterForm, NotAllowed, PageTitle, Pagination, STAGE_LABELS, Time } from "@/components/admin/ui";
import styles from "@/components/admin/admin.module.css";
import { Input, Select } from "@/components/form/Controls";
import { AlertView } from "@/components/ui/AlertView";
import { first, oneOf, pageOf, searchText, type SearchParams } from "@/lib/admin/params";
import { getStaffContext } from "@/lib/auth/staff";
import { LIFECYCLE_STAGES, listContacts } from "@/lib/crm/data";

export const metadata: Metadata = { title: "Contacts" };

const PATH = "/admin/contacts";

/** One row per person. A person is never duplicated to fit a new application or case. */
export default async function ContactsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await getStaffContext();
  if (!staff?.can["contacts.view"]) return <NotAllowed what="viewing contacts" />;
  const params = await searchParams;
  const filters = { q: searchText(params), stage: oneOf(params, "stage", LIFECYCLE_STAGES), page: pageOf(params) };
  const { contacts, total, failed } = await listContacts(filters);
  const current = { q: filters.q, stage: filters.stage, page: String(filters.page) };
  const active = Boolean(filters.q || filters.stage);

  return (
    <>
      <PageTitle title="Contacts" description="People, identified by their phone and email. Converting an application finds the existing contact before creating one." />
      <FilterForm label="Filter contacts" clearHref={PATH} active={active}>
        <FilterField id="f-q" label="Search" search>
          <Input id="f-q" name="q" type="search" defaultValue={first(params, "q")} placeholder="Name, email or phone" />
        </FilterField>
        <FilterField id="f-stage" label="Lifecycle stage">
          <Select id="f-stage" name="stage" defaultValue={filters.stage}>
            <option value="">Any stage</option>
            {LIFECYCLE_STAGES.map((s) => (
              <option key={s} value={s}>
                {STAGE_LABELS[s]}
              </option>
            ))}
          </Select>
        </FilterField>
      </FilterForm>
      {failed ? <AlertView tone="error" toneLabel="Error" title="Contacts could not be loaded. Try again." /> : null}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <caption className="visually-hidden">Contacts</caption>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Phone</th>
              <th scope="col">Email</th>
              <th scope="col">Stage</th>
              <th scope="col">Owner</th>
              <th scope="col">Branch</th>
              <th scope="col">Created</th>
            </tr>
          </thead>
          <tbody>
            {contacts.length === 0 ? (
              <tr>
                <td colSpan={7} className={styles.emptyCell} data-label="">
                  {active ? "No contacts match these filters." : "No contacts yet. Converting an application creates the first."}
                </td>
              </tr>
            ) : (
              contacts.map((c) => (
                <tr key={c.id}>
                  <td data-label="">
                    <Link href={`/admin/contacts/${c.id}`} className={styles.cellTitle}>
                      {c.full_name}
                    </Link>
                  </td>
                  <td data-label="Phone" className={styles.mono}>
                    {c.primary_phone_e164 ?? "—"}
                  </td>
                  <td data-label="Email">{c.primary_email ?? "—"}</td>
                  <td data-label="Stage">{STAGE_LABELS[c.lifecycle_stage] ?? c.lifecycle_stage}</td>
                  <td data-label="Owner">{c.owner?.full_name ?? "—"}</td>
                  <td data-label="Branch">{c.branch?.name ?? "—"}</td>
                  <td data-label="Created" className={styles.nowrap}>
                    <Time iso={c.created_at} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <Pagination path={PATH} params={current} page={filters.page} total={total} noun={["contact", "contacts"]} />
    </>
  );
}
