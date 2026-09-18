import type { Metadata } from "next";
import Link from "next/link";
import { FilterField, FilterForm, NotAllowed, PageTitle, Pagination, Time } from "@/components/admin/ui";
import styles from "@/components/admin/admin.module.css";
import { Input, Select } from "@/components/form/Controls";
import { AlertView } from "@/components/ui/AlertView";
import { Badge } from "@/components/ui/Badge";
import { first, oneOf, pageOf, searchText, type SearchParams } from "@/lib/admin/params";
import { listPayments, PAYMENT_STATUSES } from "@/lib/admin/platform-data";
import { getStaffContext } from "@/lib/auth/staff";
import { formatMinor } from "@/lib/billing/model";

export const metadata: Metadata = { title: "Payments" };

const PATH = "/admin/payments";

const LABELS: Record<string, string> = { created: "Checkout opened", authorized: "Authorized", paid: "Paid", failed: "Failed", refunded: "Refunded" };
const TONES: Record<string, "neutral" | "green" | "blue" | "warning" | "error"> = { created: "warning", authorized: "blue", paid: "green", failed: "error", refunded: "neutral" };

/**
 * Every payment attempt this role may see. Read-only by design: a payment is created when a
 * customer opens checkout and moves only when Razorpay's signed webhook says so — no screen
 * or staff action changes one (0014).
 */
export default async function PaymentsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await getStaffContext();
  if (!staff?.can["payments.view"]) return <NotAllowed what="viewing payments" />;

  const params = await searchParams;
  const filters = { q: searchText(params), status: oneOf(params, "status", PAYMENT_STATUSES), page: pageOf(params) };
  const { rows, total, failed } = await listPayments(filters);
  const current = { q: filters.q, status: filters.status, page: String(filters.page) };
  const active = Boolean(filters.q || filters.status);

  return (
    <>
      <PageTitle title="Payments" description="Payment attempts against invoices, newest first. Only Razorpay's signed confirmation marks one paid; nothing here can change a payment." />

      <FilterForm label="Filter payments" clearHref={PATH} active={active}>
        <FilterField id="f-q" label="Search" search>
          <Input id="f-q" name="q" type="search" defaultValue={first(params, "q")} placeholder="Payment reference, order or payment id" />
        </FilterField>
        <FilterField id="f-status" label="Status">
          <Select id="f-status" name="status" defaultValue={filters.status}>
            <option value="">Any status</option>
            {PAYMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {LABELS[s]}
              </option>
            ))}
          </Select>
        </FilterField>
      </FilterForm>

      {failed ? <AlertView tone="error" toneLabel="Error" title="Payments could not be loaded. Try again." /> : null}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <caption className="visually-hidden">Payments</caption>
          <thead>
            <tr>
              <th scope="col">Payment</th>
              <th scope="col">Invoice</th>
              <th scope="col">Status</th>
              <th scope="col">Method</th>
              <th scope="col" className={styles.num}>
                Amount
              </th>
              <th scope="col">When</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className={styles.emptyCell} data-label="">
                  {active ? "No payments match these filters." : "No payments yet. One appears when a customer presses Pay on an invoice."}
                </td>
              </tr>
            ) : (
              rows.map((p) => (
                <tr key={p.id}>
                  <td data-label="">
                    <div className={styles.cellMain}>
                      <span className={styles.cellTitle}>{p.reference}</span>
                      <span className={styles.mono}>{p.provider_payment_id ?? p.provider_order_id}</span>
                    </div>
                  </td>
                  <td data-label="Invoice">{p.invoice ? <Link href={`/admin/invoices/${p.invoice.id}`}>{p.invoice.reference}</Link> : <span className={styles.muted}>Not linked</span>}</td>
                  <td data-label="Status">
                    <Badge tone={TONES[p.status] ?? "neutral"}>{LABELS[p.status] ?? p.status}</Badge>
                    {p.failure_code ? <span className={styles.muted}> {p.failure_code}</span> : null}
                  </td>
                  <td data-label="Method">{p.method ?? "—"}</td>
                  <td data-label="Amount" className={`${styles.num} ${styles.amount}`}>
                    {formatMinor(p.amount_minor)}
                  </td>
                  <td data-label="When" className={styles.nowrap}>
                    <Time iso={p.paid_at ?? p.failed_at ?? p.created_at} withTime />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination path={PATH} params={current} page={filters.page} total={total} noun={["payment", "payments"]} />
    </>
  );
}
