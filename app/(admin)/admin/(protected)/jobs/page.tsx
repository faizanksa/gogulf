import type { Metadata } from "next";
import Link from "next/link";
import { FilterField, FilterForm, JobStatusBadge, NotAllowed, PageTitle, Pagination, Time } from "@/components/admin/ui";
import styles from "@/components/admin/admin.module.css";
import { Input, Select } from "@/components/form/Controls";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { AlertView } from "@/components/ui/AlertView";
import { first, oneOf, pageOf, searchText, uuidParam, type SearchParams } from "@/lib/admin/params";
import { getStaffContext } from "@/lib/auth/staff";
import { applicationCount, listCategories, listStaffJobs, PROMOTION_FILTERS, type StaffJob } from "@/lib/jobs/admin-data";
import {
  ACCESS_LABELS,
  AVAILABILITY_LABELS,
  CLASSIFICATION_LABELS,
  CLASSIFICATIONS,
  countryNameOf,
  isActivelyFeatured,
  isPastClosingDate,
  JOB_STATUSES,
  STATUS_LABELS,
} from "@/lib/jobs/model";

export const metadata: Metadata = { title: "Jobs" };

const PATH = "/admin/jobs";

function visibility(job: StaffJob) {
  if (job.promotion !== "featured") return <span className={styles.muted}>Standard</span>;
  return isActivelyFeatured({ promotion: job.promotion, featuredUntil: job.featured_until }) ? (
    <Badge tone="green">Featured{job.featured_until ? ` to ${job.featured_until}` : ""}</Badge>
  ) : (
    <Badge tone="neutral">Featured period ended</Badge>
  );
}

function availability(job: StaffJob) {
  if (job.availability === "ongoing") return AVAILABILITY_LABELS.ongoing;
  if (!job.closes_on) return <span className={styles.muted}>Time-limited, no date yet</span>;
  const past = isPastClosingDate({ availability: job.availability, closesOn: job.closes_on });
  return (
    <>
      Closes <Time iso={job.closes_on} />
      {past ? (
        <>
          {" "}
          <Badge tone="warning">Date passed</Badge>
        </>
      ) : null}
    </>
  );
}

/** Every job staff can see, newest change first. Filters live in the URL. */
export default async function JobsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await getStaffContext();
  if (!staff?.can["jobs.view"]) return <NotAllowed what="viewing jobs" />;

  const params = await searchParams;
  const filters = {
    q: searchText(params),
    status: oneOf(params, "status", JOB_STATUSES),
    classification: oneOf(params, "classification", CLASSIFICATIONS),
    category: uuidParam(params, "category"),
    availability: oneOf(params, "availability", ["ongoing", "time_limited"] as const),
    promotion: oneOf(params, "promotion", PROMOTION_FILTERS),
    access: oneOf(params, "access", ["free", "paid"] as const),
    page: pageOf(params),
  };
  const [{ jobs, total, failed }, categories] = await Promise.all([listStaffJobs(filters), listCategories()]);
  const current = Object.fromEntries(Object.entries({ ...filters, page: String(filters.page) }).map(([k, v]) => [k, String(v)]));
  const active = Boolean(filters.q || filters.status || filters.classification || filters.category || filters.availability || filters.promotion || filters.access);
  const canManage = staff.can["jobs.manage"];

  return (
    <>
      <PageTitle
        title="Jobs"
        description="Every listing, in every status. Only published jobs accepting applications appear on the public site."
        actions={
          canManage ? (
            <>
              <Button href="/admin/jobs/new" size="sm" icon="arrow-right" iconPosition="end">
                New job
              </Button>
              <Button href="/admin/jobs/categories" size="sm" variant="secondary">
                Categories
              </Button>
            </>
          ) : null
        }
      />

      <FilterForm label="Filter jobs" clearHref={PATH} active={active}>
        <FilterField id="f-q" label="Search" search>
          <Input id="f-q" name="q" type="search" defaultValue={first(params, "q")} placeholder="Title, reference or city" />
        </FilterField>
        <FilterField id="f-status" label="Status">
          <Select id="f-status" name="status" defaultValue={filters.status}>
            <option value="">Any status</option>
            {JOB_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField id="f-classification" label="Type">
          <Select id="f-classification" name="classification" defaultValue={filters.classification}>
            <option value="">General and professional</option>
            {CLASSIFICATIONS.map((c) => (
              <option key={c} value={c}>
                {CLASSIFICATION_LABELS[c]}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField id="f-category" label="Category">
          <Select id="f-category" name="category" defaultValue={filters.category}>
            <option value="">Any category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.is_active ? "" : " (inactive)"}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField id="f-availability" label="Availability">
          <Select id="f-availability" name="availability" defaultValue={filters.availability}>
            <option value="">Any</option>
            <option value="ongoing">Ongoing</option>
            <option value="time_limited">Time-limited</option>
          </Select>
        </FilterField>
        <FilterField id="f-promotion" label="Visibility">
          <Select id="f-promotion" name="promotion" defaultValue={filters.promotion}>
            <option value="">Any</option>
            <option value="featured">Featured now</option>
            <option value="lapsed">Featured period ended</option>
            <option value="standard">Standard</option>
          </Select>
        </FilterField>
        <FilterField id="f-access" label="Application access">
          <Select id="f-access" name="access" defaultValue={filters.access}>
            <option value="">Any</option>
            <option value="free">Free</option>
            <option value="paid">Paid (not publishable)</option>
          </Select>
        </FilterField>
      </FilterForm>

      {failed ? <AlertView tone="error" toneLabel="Error" title="Jobs could not be loaded. Try again." /> : null}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <caption className="visually-hidden">Jobs</caption>
          <thead>
            <tr>
              <th scope="col">Job</th>
              <th scope="col">Category</th>
              <th scope="col">Type</th>
              <th scope="col">Location</th>
              <th scope="col">Status</th>
              <th scope="col">Availability</th>
              <th scope="col">Visibility</th>
              <th scope="col">Application</th>
              <th scope="col" className={styles.num}>
                Applications
              </th>
              <th scope="col">Updated</th>
              <th scope="col">
                <span className="visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {jobs.length === 0 ? (
              <tr>
                <td colSpan={11} className={styles.emptyCell} data-label="">
                  {active ? "No jobs match these filters." : "No jobs yet."}{" "}
                  {canManage && !active ? <Link href="/admin/jobs/new">Create the first job</Link> : null}
                </td>
              </tr>
            ) : (
              jobs.map((job) => (
                <tr key={job.id}>
                  <td data-label="">
                    <div className={styles.cellMain}>
                      <Link href={`/admin/jobs/${job.id}`} className={styles.cellTitle}>
                        {job.title}
                      </Link>
                      <span className={styles.mono}>{job.reference}</span>
                    </div>
                  </td>
                  <td data-label="Category">{job.category?.name ?? "—"}</td>
                  <td data-label="Type">{CLASSIFICATION_LABELS[job.classification]}</td>
                  <td data-label="Location">{[job.city, countryNameOf(job.country_code)].filter(Boolean).join(", ") || "—"}</td>
                  <td data-label="Status">
                    <JobStatusBadge status={job.status} />
                  </td>
                  <td data-label="Availability">{availability(job)}</td>
                  <td data-label="Visibility">{visibility(job)}</td>
                  <td data-label="Application">
                    {job.application_access === "paid" ? <Badge tone="warning">{ACCESS_LABELS.paid}</Badge> : ACCESS_LABELS.free}
                  </td>
                  <td data-label="Applications" className={styles.num}>
                    {staff.can["applications.screen"] ? (
                      <Link href={`/admin/applications?job=${job.id}`}>{applicationCount(job).toLocaleString("en-IN")}</Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td data-label="Updated" className={styles.nowrap}>
                    <Time iso={job.updated_at} />
                  </td>
                  <td data-label="">
                    <ul className={styles.inlineLinks}>
                      <li>
                        <Link href={`/admin/jobs/${job.id}`}>{canManage ? "Edit" : "View"}</Link>
                      </li>
                      <li>
                        <Link href={`/admin/jobs/${job.id}/preview`}>Preview</Link>
                      </li>
                    </ul>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination path={PATH} params={current} page={filters.page} total={total} noun={["job", "jobs"]} />
    </>
  );
}
