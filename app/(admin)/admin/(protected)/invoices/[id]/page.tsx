import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InvoiceForm } from "@/components/admin/InvoiceForm";
import { IssueInvoiceButton, VoidInvoiceForm } from "@/components/admin/InvoiceControls";
import { PaymentLinkPanel } from "@/components/admin/PaymentLinkPanel";
import { InvoiceStatusBadge, NotAllowed, PageTitle, Panel, Time } from "@/components/admin/ui";
import styles from "@/components/admin/admin.module.css";
import { AlertView } from "@/components/ui/AlertView";
import { Badge } from "@/components/ui/Badge";
import { FactList } from "@/components/ui/FactList";
import { getStaffContext } from "@/lib/auth/staff";
import { getStaffInvoice } from "@/lib/billing/admin-data";
import { formatMinor, hasPaymentLink, lineAmountMinor, paymentUrl, type LineItem } from "@/lib/billing/model";
import { paymentQrDataUri } from "@/lib/billing/qr";
import { auditTrail, type AuditEntry } from "@/lib/jobs/admin-data";
import { SITE_URL } from "@/lib/seo";
import { issueInvoice, saveInvoice, voidInvoice } from "../actions";

export const metadata: Metadata = { title: "Invoice" };

const ACTION_LABELS: Record<string, string> = {
  "invoice.created": "Created",
  "invoice.updated": "Edited",
  "invoice.issued": "Issued",
  "invoice.payment_link_opened": "Customer started a payment",
  "invoice.payment_link_reopened": "Customer started another payment",
  "invoice.paid": "Paid — confirmed by Razorpay",
  "invoice.payment_failed": "Payment failed",
  "invoice.voided": "Voided",
  "invoice.status_changed": "Status changed",
};

function describeChange(entry: AuditEntry): string | null {
  if (entry.action === "invoice.updated" && entry.new_values) {
    const fields = Object.keys(entry.new_values).map((k) => k.replace(/_/g, " "));
    return fields.length ? `Changed: ${fields.join(", ")}` : null;
  }
  if (entry.action === "invoice.voided" && entry.new_values?.void_reason) return `Reason: ${String(entry.new_values.void_reason)}`;
  return null;
}

const SAVED: Record<string, string> = {
  created: "Draft created.",
  draft: "Draft saved.",
  issued: "Invoice issued. The payment link and QR code are below.",
};

const PAYMENT_LABELS: Record<string, string> = { created: "Checkout opened", authorized: "Authorized", paid: "Paid", failed: "Failed", refunded: "Refunded" };

export default async function InvoicePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const staff = await getStaffContext();
  if (!staff?.can["invoices.view"]) return <NotAllowed what="viewing invoices" />;
  const { id } = await params;
  const { saved } = await searchParams;

  const [invoice, audit] = await Promise.all([getStaffInvoice(id), staff.can["audit.view"] ? auditTrail("invoice", id) : Promise.resolve([])]);
  if (!invoice) notFound();

  const canIssue = staff.can["invoices.issue"];
  const canVoid = staff.can["invoices.void"];
  const items = invoice.line_items as unknown as LineItem[];
  const link = hasPaymentLink(invoice.status) ? paymentUrl(invoice.reference, SITE_URL) : null;
  const qr = link ? await paymentQrDataUri(link) : null;
  // A payment in flight, or received, can only be resolved by the provider's confirmation.
  const voidable = ["draft", "issued", "payment_failed"].includes(invoice.status);
  const address = Object.values((invoice.billing_address ?? {}) as Record<string, string>).filter(Boolean).join(", ");

  return (
    <>
      <PageTitle
        eyebrow={
          <span className={styles.badges}>
            <span className={styles.mono}>{invoice.reference}</span>
            <InvoiceStatusBadge status={invoice.status} />
          </span>
        }
        title={invoice.customer_name}
        description={`${invoice.purpose} · ${formatMinor(invoice.total_minor)}`}
      />

      {saved && SAVED[saved] ? <AlertView tone="success" toneLabel="Success" title={SAVED[saved]} /> : null}
      {invoice.status === "paid" ? <AlertView tone="success" toneLabel="Paid" title="Payment received and confirmed by Razorpay." /> : null}
      {invoice.status === "payment_failed" ? (
        <AlertView tone="error" toneLabel="Payment failed" title="The last payment attempt failed. The customer can try again from the same link, or you can void this invoice." />
      ) : null}
      {invoice.status === "payment_pending" ? <AlertView tone="info" toneLabel="In progress" title="The customer has opened checkout. Only Razorpay's confirmation will mark this paid." /> : null}

      <div className={styles.grid2}>
        <div className={styles.content}>
          {invoice.status === "draft" && canIssue ? (
            <Panel id="invoice-edit" title="Edit draft">
              <InvoiceForm
                action={saveInvoice}
                values={{
                  id: invoice.id,
                  customer_name: invoice.customer_name,
                  customer_email: invoice.customer_email,
                  customer_phone: invoice.customer_phone,
                  address: invoice.billing_address as Record<string, string>,
                  purpose: invoice.purpose,
                  line_items: items,
                  discount_minor: invoice.discount_minor,
                  tax_rate_percent: invoice.tax_rate_percent,
                  due_date: invoice.due_date,
                  notes: invoice.notes,
                }}
              />
            </Panel>
          ) : (
            <Panel id="invoice-lines" title="Line items">
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <caption className="visually-hidden">Line items</caption>
                  <thead>
                    <tr>
                      <th scope="col">Description</th>
                      <th scope="col" className={styles.num}>
                        Qty
                      </th>
                      <th scope="col" className={styles.num}>
                        Unit price
                      </th>
                      <th scope="col" className={styles.num}>
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, i) => (
                      <tr key={i}>
                        <td data-label="Description">{item.description}</td>
                        <td data-label="Qty" className={styles.num}>
                          {item.quantity}
                        </td>
                        <td data-label="Unit price" className={`${styles.num} ${styles.amount}`}>
                          {formatMinor(item.unit_amount_minor)}
                        </td>
                        <td data-label="Amount" className={`${styles.num} ${styles.amount}`}>
                          {formatMinor(lineAmountMinor(item))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <dl className={styles.totals}>
                <div>
                  <dt>Subtotal</dt>
                  <dd>{formatMinor(invoice.subtotal_minor)}</dd>
                </div>
                {invoice.discount_minor > 0 ? (
                  <div>
                    <dt>Discount</dt>
                    <dd>−{formatMinor(invoice.discount_minor)}</dd>
                  </div>
                ) : null}
                {invoice.tax_rate_percent !== null ? (
                  <div>
                    <dt>Tax ({invoice.tax_rate_percent}%)</dt>
                    <dd>{formatMinor(invoice.tax_amount_minor)}</dd>
                  </div>
                ) : null}
                <div className={styles.grandTotal}>
                  <dt>Total</dt>
                  <dd>{formatMinor(invoice.total_minor)}</dd>
                </div>
              </dl>
            </Panel>
          )}

          {link && qr ? (
            <Panel id="invoice-payment-link" title="Customer payment link">
              {invoice.status === "void" ? null : <p className={styles.muted}>Send this link, or show the QR code, to the customer. It opens a Go Gulf page that shows only the invoice number, the service, the amount and its status.</p>}
              <PaymentLinkPanel url={link} qrDataUri={qr} reference={invoice.reference} />
            </Panel>
          ) : null}

          {staff.can["payments.view"] && invoice.payments.length > 0 ? (
            <Panel id="invoice-payments" title="Payments">
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <caption className="visually-hidden">Payment attempts</caption>
                  <thead>
                    <tr>
                      <th scope="col">Reference</th>
                      <th scope="col">Status</th>
                      <th scope="col">Method</th>
                      <th scope="col" className={styles.num}>
                        Amount
                      </th>
                      <th scope="col">When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...invoice.payments]
                      .sort((a, b) => b.created_at.localeCompare(a.created_at))
                      .map((p) => (
                        <tr key={p.id}>
                          <td data-label="Reference" className={styles.mono}>
                            {p.reference}
                          </td>
                          <td data-label="Status">
                            <Badge tone={p.status === "paid" ? "green" : p.status === "failed" ? "error" : "warning"}>{PAYMENT_LABELS[p.status] ?? p.status}</Badge>
                            {p.failure_code ? <span className={styles.muted}> {p.failure_code}</span> : null}
                          </td>
                          <td data-label="Method">{p.method ?? "—"}</td>
                          <td data-label="Amount" className={`${styles.num} ${styles.amount}`}>
                            {formatMinor(p.amount_minor)}
                          </td>
                          <td data-label="When">
                            <Time iso={p.paid_at ?? p.failed_at ?? p.created_at} withTime />
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          ) : null}

          {staff.can["audit.view"] ? (
            <Panel id="invoice-history" title="History">
              {audit.length ? (
                <ol className={styles.timeline}>
                  {audit.map((entry) => (
                    <li key={entry.id} className={styles.timelineItem}>
                      <span className={styles.timelineWhat}>{ACTION_LABELS[entry.action] ?? entry.action}</span>
                      {describeChange(entry) ? <span>{describeChange(entry)}</span> : null}
                      <span className={styles.muted}>
                        <Time iso={entry.occurred_at} withTime /> · {entry.actor_label ?? (entry.actor_type === "system" ? (entry.actor_label ?? "System") : "Staff")}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className={styles.muted}>No history recorded.</p>
              )}
            </Panel>
          ) : null}
        </div>

        <aside aria-label="Invoice details and actions">
          <Panel id="invoice-record" title="Record">
            <FactList
              items={[
                { key: "reference", label: "Number", value: invoice.reference, mono: true },
                { key: "customer", label: "Customer", value: invoice.customer_name },
                ...(invoice.customer_email ? [{ key: "email", label: "Email", value: invoice.customer_email }] : []),
                ...(invoice.customer_phone ? [{ key: "phone", label: "Phone", value: invoice.customer_phone }] : []),
                ...(address ? [{ key: "address", label: "Billing address", value: address }] : []),
                { key: "issue", label: "Issue date", value: <Time iso={invoice.issue_date} /> },
                { key: "due", label: "Due date", value: <Time iso={invoice.due_date} /> },
                { key: "created", label: "Created", value: <><Time iso={invoice.created_at} withTime /> · {invoice.creator?.full_name ?? "System"}</> },
                { key: "updated", label: "Last updated", value: <><Time iso={invoice.updated_at} withTime /> · {invoice.updater?.full_name ?? invoice.creator?.full_name ?? "System"}</> },
                ...(invoice.issued_at ? [{ key: "issued", label: "Issued", value: <Time iso={invoice.issued_at} withTime /> }] : []),
                ...(invoice.paid_at ? [{ key: "paid", label: "Paid", value: <Time iso={invoice.paid_at} withTime /> }] : []),
                ...(invoice.voided_at ? [{ key: "voided", label: "Voided", value: <><Time iso={invoice.voided_at} withTime /> · {invoice.void_reason}</> }] : []),
                ...(invoice.status !== "draft" && invoice.notes ? [{ key: "notes", label: "Internal notes", value: invoice.notes }] : []),
              ]}
            />
          </Panel>

          {(invoice.status === "draft" && canIssue) || (voidable && canVoid) ? (
            <Panel id="invoice-actions" title="Actions">
              {invoice.status === "draft" && canIssue ? <IssueInvoiceButton id={invoice.id} action={issueInvoice} /> : null}
              {voidable && canVoid ? <VoidInvoiceForm id={invoice.id} action={voidInvoice} /> : null}
            </Panel>
          ) : null}
        </aside>
      </div>
    </>
  );
}
