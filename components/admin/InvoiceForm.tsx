"use client";

import { startTransition, useActionState, useState, type FormEvent, type ReactElement, type ReactNode } from "react";
import { Input, Textarea } from "@/components/form/Controls";
import { Field, type FieldText } from "@/components/form/Field";
import { Button } from "@/components/ui/Button";
import type { ActionState } from "@/lib/admin/action-state";
import { computeTotals, formatMinor, MAX_LINE_ITEMS, parseRupeesToMinor, type LineItem } from "@/lib/billing/model";
import { ActionMessages } from "./ActionForm";
import styles from "./admin.module.css";

export interface InvoiceFormValues {
  id?: string;
  customer_name?: string;
  customer_email?: string | null;
  customer_phone?: string | null;
  address?: Record<string, string>;
  purpose?: string;
  line_items?: LineItem[];
  discount_minor?: number;
  tax_rate_percent?: number | null;
  due_date?: string | null;
  notes?: string | null;
}

interface Row {
  key: number;
  description: string;
  quantity: string;
  unit: string;
}

const FIELD_TEXT: FieldText = { optional: "(optional)", errorPrefix: "Error:" };
const str = (v: string | number | null | undefined) => (v === null || v === undefined ? "" : String(v));
const rupees = (minor: number) => (minor % 100 === 0 ? String(minor / 100) : (minor / 100).toFixed(2));

/**
 * Create and edit a DRAFT invoice. Nothing here decides a stored total: the rows are sent
 * as line items and the database derives subtotal, tax and total from them. The figures
 * shown are a preview of that arithmetic, and a differing stored value would win.
 *
 * Two actions, deliberately separate: "Save draft" keeps working on it; "Issue invoice"
 * saves and then locks it — after that only the status can change, and the customer
 * payment page and QR code become available.
 */
export function InvoiceForm({
  action,
  values = {},
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  values?: InvoiceFormValues;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const errors = state?.fieldErrors ?? {};
  const isNew = !values.id;

  const [rows, setRows] = useState<Row[]>(
    values.line_items?.length
      ? values.line_items.map((item, i) => ({ key: i, description: item.description, quantity: String(item.quantity), unit: rupees(item.unit_amount_minor) }))
      : [{ key: 0, description: "", quantity: "1", unit: "" }],
  );
  const [nextKey, setNextKey] = useState(rows.length);
  const [discount, setDiscount] = useState(values.discount_minor ? rupees(values.discount_minor) : "");
  const [taxRate, setTaxRate] = useState(str(values.tax_rate_percent));

  const items: LineItem[] = rows.map((r) => ({
    description: r.description.trim(),
    quantity: Number(r.quantity),
    unit_amount_minor: parseRupeesToMinor(r.unit) ?? 0,
  }));
  const validItems = items.filter((i) => Number.isFinite(i.quantity) && i.quantity > 0 && i.unit_amount_minor > 0);
  const rate = taxRate.trim() === "" || Number.isNaN(Number(taxRate)) ? null : Number(taxRate);
  const totals = computeTotals(validItems, Math.min(parseRupeesToMinor(discount) ?? 0, computeTotals(validItems, 0, null).subtotalMinor), rate);

  function update(key: number, patch: Partial<Row>) {
    setRows((current) => current.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  // Dispatched by hand so a refused save keeps what was typed (React resets uncontrolled
  // fields after a form action). The submitter carries which button was pressed.
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const data = new FormData(event.currentTarget, submitter);
    startTransition(() => formAction(data));
  }

  const f = (name: string, label: string, control: ReactNode, opts: { hint?: ReactNode; optional?: boolean } = {}) => (
    <Field id={`inv-${name}`} label={label} hint={opts.hint} optional={opts.optional} text={FIELD_TEXT} error={errors[name]}>
      {control as ReactElement<Record<string, unknown>>}
    </Field>
  );

  const address = values.address ?? {};

  return (
    <form action={formAction} onSubmit={onSubmit} className={styles.form} noValidate aria-busy={pending || undefined}>
      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}
      <input type="hidden" name="line_items" value={JSON.stringify(items)} />

      <fieldset className={styles.section}>
        <legend>Customer</legend>
        <p className={styles.sectionHint}>Who is being billed. This is recorded on the invoice as it is now; it does not follow later changes to a contact record.</p>
        {f("customer_name", "Customer name", <Input name="customer_name" defaultValue={values.customer_name} maxLength={120} required autoComplete="off" />)}
        <div className={styles.fields2}>
          {f("customer_email", "Email", <Input name="customer_email" type="email" defaultValue={str(values.customer_email)} maxLength={254} autoComplete="off" />, { optional: true })}
          {f("customer_phone", "Phone", <Input name="customer_phone" type="tel" defaultValue={str(values.customer_phone)} maxLength={20} autoComplete="off" />, { optional: true })}
        </div>
        <div className={styles.fields2}>
          {f("address_line1", "Billing address, line 1", <Input name="address_line1" defaultValue={address.line1} maxLength={160} />, { optional: true })}
          {f("address_line2", "Line 2", <Input name="address_line2" defaultValue={address.line2} maxLength={160} />, { optional: true })}
          {f("address_city", "City", <Input name="address_city" defaultValue={address.city} maxLength={160} />, { optional: true })}
          {f("address_state", "State", <Input name="address_state" defaultValue={address.state} maxLength={160} />, { optional: true })}
          {f("address_postal_code", "Postal code", <Input name="address_postal_code" defaultValue={address.postal_code} maxLength={160} />, { optional: true })}
          {f("address_country", "Country", <Input name="address_country" defaultValue={address.country} maxLength={160} />, { optional: true })}
        </div>
      </fieldset>

      <fieldset className={styles.section}>
        <legend>Service</legend>
        <p className={styles.sectionHint}>Consultation and service invoices only. Invoices are never linked to a job or a job application.</p>
        {f("purpose", "Service being billed", <Input name="purpose" defaultValue={values.purpose} maxLength={200} required />, {
          hint: "What the customer sees on their payment page.",
        })}
      </fieldset>

      <fieldset className={styles.section}>
        <legend>Line items</legend>
        {errors.line_items ? (
          <p className={styles.fieldError} role="alert">
            Error: {errors.line_items}
          </p>
        ) : null}
        <ul className={styles.lineItems}>
          {rows.map((row, index) => (
            <li key={row.key} className={styles.lineRow}>
              <Field id={`inv-item-${row.key}-d`} label={`Item ${index + 1}`} text={FIELD_TEXT}>
                <Input value={row.description} onChange={(e) => update(row.key, { description: e.target.value })} maxLength={200} placeholder="Description" />
              </Field>
              <Field id={`inv-item-${row.key}-q`} label="Quantity" text={FIELD_TEXT}>
                <Input value={row.quantity} onChange={(e) => update(row.key, { quantity: e.target.value })} inputMode="decimal" />
              </Field>
              <Field id={`inv-item-${row.key}-u`} label="Unit price (₹)" text={FIELD_TEXT}>
                <Input value={row.unit} onChange={(e) => update(row.key, { unit: e.target.value })} inputMode="decimal" placeholder="0.00" />
              </Field>
              <p className={styles.lineTotal} aria-label={`Item ${index + 1} amount`}>
                {formatMinor(Math.round((Number(row.quantity) || 0) * (parseRupeesToMinor(row.unit) ?? 0)))}
              </p>
              <button type="button" className={styles.textButton} disabled={rows.length === 1} onClick={() => setRows((c) => c.filter((r) => r.key !== row.key))}>
                Remove<span className="visually-hidden"> item {index + 1}</span>
              </button>
            </li>
          ))}
        </ul>
        <div>
          <button
            type="button"
            className={styles.pageLink}
            disabled={rows.length >= MAX_LINE_ITEMS}
            onClick={() => {
              setRows((c) => [...c, { key: nextKey, description: "", quantity: "1", unit: "" }]);
              setNextKey((k) => k + 1);
            }}
          >
            Add a line item
          </button>
        </div>

        <div className={styles.fields2}>
          {f("discount", "Discount (₹)", <Input name="discount" value={discount} onChange={(e) => setDiscount(e.target.value)} inputMode="decimal" placeholder="0.00" />, {
            optional: true,
            hint: "A flat amount taken off the subtotal.",
          })}
          {f("tax_rate_percent", "Tax rate (%)", <Input name="tax_rate_percent" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} inputMode="decimal" />, {
            optional: true,
            hint: "Leave empty for no tax line. The rate that applies is a business decision — nothing is assumed.",
          })}
        </div>

        <dl className={styles.totals} aria-live="polite">
          <div>
            <dt>Subtotal</dt>
            <dd>{formatMinor(totals.subtotalMinor)}</dd>
          </div>
          {totals.discountMinor > 0 ? (
            <div>
              <dt>Discount</dt>
              <dd>−{formatMinor(totals.discountMinor)}</dd>
            </div>
          ) : null}
          {rate !== null ? (
            <div>
              <dt>Tax ({rate}%)</dt>
              <dd>{formatMinor(totals.taxAmountMinor)}</dd>
            </div>
          ) : null}
          <div className={styles.grandTotal}>
            <dt>Total</dt>
            <dd>{formatMinor(totals.totalMinor)}</dd>
          </div>
        </dl>
        <p className={styles.sectionHint}>The stored total is worked out by the database from the line items when you save.</p>
      </fieldset>

      <fieldset className={styles.section}>
        <legend>Terms</legend>
        <div className={styles.fields2}>{f("due_date", "Due date", <Input name="due_date" type="date" defaultValue={str(values.due_date)} />, { optional: true })}</div>
        {f("notes", "Internal notes", <Textarea name="notes" defaultValue={str(values.notes)} rows={3} maxLength={2000} />, {
          optional: true,
          hint: "Staff-only. Never shown to the customer.",
        })}
      </fieldset>

      <div className={styles.stickyBar}>
        <Button type="submit" name="intent" value="save" loading={pending} variant="secondary">
          {pending ? "Saving…" : "Save draft"}
        </Button>
        <Button type="submit" name="intent" value="issue" loading={pending}>
          Issue invoice
        </Button>
        <span className={styles.muted}>Issuing locks the amounts and customer details, and opens the payment page.</span>
      </div>
      <ActionMessages state={state} />
    </form>
  );
}
