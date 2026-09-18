import type { Metadata } from "next";
import Link from "next/link";
import { FilterField, FilterForm, InvoiceStatusBadge, NotAllowed, PageTitle, Pagination, Time } from "@/components/admin/ui";
import styles from "@/components/admin/admin.module.css";
import { Input, Select } from "@/components/form/Controls";
import { AlertView } from "@/components/ui/AlertView";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { first, oneOf, pageOf, searchText, type SearchParams } from "@/lib/admin/params";
import { getStaffContext } from "@/lib/auth/staff";
import { listStaffInvoices, type StaffInvoice } from "@/lib/billing/admin-data";
import { formatMinor, INVOICE_STATUSES, INVOICE_STATUS_LABELS } from "@/lib/billing/model";

export const metadata: Metadata = { title: "Invoices" };

const PATH = "/admin/invoices";

/** The latest payment attempt, in words. Empty for a role that cannot read payments. */
function paymentSummary(invoice: StaffInvoice) {
  const latest = [...invoice.payments].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  if (!latest) return <span className={styles.muted}>{invoice.status === "draft" ? "—" : "No payment started"}</span>;
  const tone = latest.status === "paid" ? "green" : latest.status === "failed" ? "error" : "warning";
  return <Badge tone={tone}>{latest.status === "created" ? "Checkout opened" : latest.status === "authorized" ? "Authorized" : latest.status.charAt(0).toUpperCase() + latest.status.slice(1)}</Badge>;
}

/** Every invoice this role can see, newest first. Filters live in the URL. */
export default async function InvoicesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await getStaffContext();
  if (!staff?.can["invoices.view"]) return <NotAllowed what="viewing invoices" />;

  const params = await searchParams;
  const filters = { q: searchText(params), status: oneOf(params, "status", INVOICE_STATUSES), page: pageOf(params) };
  const { invoices, total, failed } = await listStaffInvoices(filters);
  const current = Object.fromEntries(Object.entries(filters).map(([k, v]) => [k, String(v)]));
  const active = Boolean(filters.q || filters.status);
  const canIssue = staff.can["invoices.issue"];

  return (
    <>
      <PageTitle
        title="Invoices"
        description="Consultation and service invoices. A customer pays through the link on an issued invoice; only Razorpay's signed confirmation marks it paid."
        actions={
          canIssue ? (
            <Button href="/admin/invoices/new" size="sm" icon="arrow-right" iconPosition="end">
              New invoice
            </Button>
          ) : null
        }
      />

      <FilterForm label="Filter invoices" clearHref={PATH} active={active}>
        <FilterField id="f-q" label="Search" search>
          <Input id="f-q" name="q" type="search" defaultValue={first(params, "q")} placeholder="Number, customer, email or service" />
        </FilterField>
        <FilterField id="f-status" label="Status">
          <Select id="f-status" name="status" defaultValue={filters.status}>
            <option value="">Any status</option>
            {INVOICE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {INVOICE_STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </FilterField>
      </FilterForm>

      {failed ? <AlertView tone="error" toneLabel="Error" title="Invoices could not be loaded. Try again." /> : null}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <caption className="visually-hidden">Invoices</caption>
          <thead>
            <tr>
              <th scope="col">Invoice</th>
              <th scope="col">Customer</th>
              <th scope="col" className={styles.num}>
                Amount
              </th>
              <th scope="col">Status</th>
              <th scope="col">Payment</th>
              <th scope="col">Created by</th>
              <th scope="col">Created</th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={7} className={styles.emptyCell} data-label="">
                  {active ? "No invoices match these filters." : "No invoices yet."}{" "}
                  {canIssue && !active ? <Link href="/admin/invoices/new">Create the first invoice</Link> : null}
                </td>
              </tr>
            ) : (
              invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td data-label="">
                    <div className={styles.cellMain}>
                      <Link href={`/admin/invoices/${invoice.id}`} className={styles.cellTitle}>
                        {invoice.reference}
                      </Link>
                      <span className={styles.muted}>{invoice.purpose}</span>
                    </div>
                  </td>
                  <td data-label="Customer">{invoice.customer_name}</td>
                  <td data-label="Amount" className={`${styles.num} ${styles.amount}`}>
                    {formatMinor(invoice.total_minor)}
                  </td>
                  <td data-label="Status">
                    <InvoiceStatusBadge status={invoice.status} />
                  </td>
                  <td data-label="Payment">{paymentSummary(invoice)}</td>
                  <td data-label="Created by">{invoice.creator?.full_name ?? "System"}</td>
                  <td data-label="Created" className={styles.nowrap}>
                    <Time iso={invoice.created_at} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination path={PATH} params={current} page={filters.page} total={total} noun={["invoice", "invoices"]} />
    </>
  );
}
