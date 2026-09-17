import type { Metadata } from "next";
import Link from "next/link";
import { ApplicationStatusBadge, APPLICATION_STATUS_LABELS, FilterField, FilterForm, NotAllowed, PageTitle, Pagination, Time } from "@/components/admin/ui";
import styles from "@/components/admin/admin.module.css";
import { Input, Select } from "@/components/form/Controls";
import { AlertView } from "@/components/ui/AlertView";
import { first, oneOf, pageOf, searchText, uuidParam, type SearchParams } from "@/lib/admin/params";
import { getStaffContext } from "@/lib/auth/staff";
import { APPLICATION_STATUSES, listApplications } from "@/lib/crm/data";
import { getStaffJob } from "@/lib/jobs/admin-data";

export const metadata: Metadata = { title: "Applications" };

const PATH = "/admin/applications";

/**
 * Applications this staff member's role may see — all of them for an administrator, the
 * branch's for a manager, their own for a recruiter. RLS applies the scope; the page does
 * not filter by role itself.
 */
export default async function ApplicationsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await getStaffContext();
  if (!staff?.can["applications.screen"]) return <NotAllowed what="screening applications" />;

  const params = await searchParams;
  const filters = {
    q: searchText(params),
    status: oneOf(params, "status", APPLICATION_STATUSES),
    job: uuidParam(params, "job"),
    page: pageOf(params),
  };
  const [{ applications, total, failed }, job] = await Promise.all([
    listApplications(filters),
    filters.job ? getStaffJob(filters.job) : Promise.resolve(null),
  ]);
  const current = { q: filters.q, status: filters.status, job: filters.job, page: String(filters.page) };
  const active = Boolean(filters.q || filters.status || filters.job);

  return (
    <>
      <PageTitle
        title="Applications"
        description={
          job ? (
            <>
              For <Link href={`/admin/jobs/${job.id}`}>{job.title}</Link> ({job.reference}). Closing or archiving a job never removes its applications.
            </>
          ) : (
            "Applications from the public form, newest first. Convert one to open a contact and a recruitment case."
          )
        }
      />

      <FilterForm label="Filter applications" clearHref={PATH} active={active}>
        <FilterField id="f-q" label="Search" search>
          <Input id="f-q" name="q" type="search" defaultValue={first(params, "q")} placeholder="Name, email, phone or job" />
        </FilterField>
        <FilterField id="f-status" label="Status">
          <Select id="f-status" name="status" defaultValue={filters.status}>
            <option value="">Any status</option>
            {APPLICATION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {APPLICATION_STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </FilterField>
        {filters.job ? <input type="hidden" name="job" value={filters.job} /> : null}
      </FilterForm>

      {failed ? <AlertView tone="error" toneLabel="Error" title="Applications could not be loaded. Try again." /> : null}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <caption className="visually-hidden">Applications</caption>
          <thead>
            <tr>
              <th scope="col">Applicant</th>
              <th scope="col">Job</th>
              <th scope="col">Status</th>
              <th scope="col">Contact</th>
              <th scope="col">Case</th>
              <th scope="col">Assigned to</th>
              <th scope="col">Branch</th>
              <th scope="col">Submitted</th>
            </tr>
          </thead>
          <tbody>
            {applications.length === 0 ? (
              <tr>
                <td colSpan={8} className={styles.emptyCell} data-label="">
                  {active ? "No applications match these filters." : "No applications yet."}
                </td>
              </tr>
            ) : (
              applications.map((a) => (
                <tr key={a.id}>
                  <td data-label="">
                    <div className={styles.cellMain}>
                      <Link href={`/admin/applications/${a.id}`} className={styles.cellTitle}>
                        {a.full_name}
                      </Link>
                      <span className={styles.muted}>{a.email}</span>
                    </div>
                  </td>
                  <td data-label="Job">
                    {a.job ? (
                      <div className={styles.cellMain}>
                        <Link href={`/admin/jobs/${a.job.id}`}>{a.job.title}</Link>
                        <span className={styles.mono}>{a.job.reference}</span>
                      </div>
                    ) : (
                      <span>{a.job_title}</span>
                    )}
                  </td>
                  <td data-label="Status">
                    <ApplicationStatusBadge status={a.status} />
                  </td>
                  <td data-label="Contact">{a.contact ? <Link href={`/admin/contacts/${a.contact.id}`}>{a.contact.full_name}</Link> : "—"}</td>
                  <td data-label="Case">
                    {a.case ? (
                      <Link href={`/admin/cases/${a.case.id}`} className={styles.mono}>
                        {a.case.case_number}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td data-label="Assigned to">{a.assignee?.full_name ?? "—"}</td>
                  <td data-label="Branch">{a.branch?.name ?? "—"}</td>
                  <td data-label="Submitted" className={styles.nowrap}>
                    <Time iso={a.created_at} withTime />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination path={PATH} params={current} page={filters.page} total={total} noun={["application", "applications"]} />
    </>
  );
}
