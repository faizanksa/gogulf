/**
 * The staff invoice form → a database write.
 *
 * Field rules only. What may change once an invoice has left draft, and every total, is
 * decided by invoices_before_write (0015); this module makes sure what reaches it is
 * well-formed and explains a refusal before it is attempted. It never computes a stored
 * value: subtotal, tax and total are derived by the database from the line items.
 */

import { z } from "zod";
import { MAX_LINE_ITEMS, parseRupeesToMinor, type LineItem } from "./model";

export interface InvoiceWrite {
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  billing_address: Record<string, string>;
  purpose: string;
  line_items: LineItem[];
  discount_minor: number;
  tax_rate_percent: number | null;
  due_date: string | null;
  notes: string | null;
}

export type InvoiceParse =
  | { ok: true; values: InvoiceWrite }
  | { ok: false; fieldErrors: Record<string, string> };

const ADDRESS_FIELDS = ["line1", "line2", "city", "state", "postal_code", "country"] as const;
const trimmed = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const orNull = (v: string) => (v === "" ? null : v);

const EMAIL = z.string().email();
const PHONE = /^\+?[0-9][0-9 ()-]{5,19}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The line items arrive as JSON in one hidden field, written by the form's row editor. */
function parseLineItems(raw: string): { items: LineItem[]; error?: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw || "[]");
  } catch {
    return { items: [], error: "The line items could not be read. Reload the page and try again." };
  }
  if (!Array.isArray(parsed) || parsed.length === 0) return { items: [], error: "Add at least one line item." };
  if (parsed.length > MAX_LINE_ITEMS) return { items: [], error: `An invoice has at most ${MAX_LINE_ITEMS} line items.` };

  const items: LineItem[] = [];
  for (const [index, row] of parsed.entries()) {
    const n = index + 1;
    const item = row as { description?: unknown; quantity?: unknown; unit_amount_minor?: unknown };
    const description = trimmed(item.description);
    const quantity = Number(item.quantity);
    const unit = Number(item.unit_amount_minor);
    if (!description) return { items: [], error: `Line ${n} needs a description.` };
    if (description.length > 200) return { items: [], error: `Line ${n}: keep the description under 200 characters.` };
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 100000) return { items: [], error: `Line ${n}: the quantity must be more than 0.` };
    if (!Number.isInteger(unit) || unit <= 0) return { items: [], error: `Line ${n}: the unit price must be more than ₹0.` };
    items.push({ description, quantity, unit_amount_minor: unit });
  }
  return { items };
}

export function parseInvoiceForm(input: Record<string, string>): InvoiceParse {
  const errors: Record<string, string> = {};

  const customer_name = trimmed(input.customer_name);
  if (customer_name.length < 2 || customer_name.length > 120) errors.customer_name = "Enter the customer's name (2 to 120 characters).";

  const email = trimmed(input.customer_email);
  if (email && !EMAIL.safeParse(email).success) errors.customer_email = "That does not look like an email address.";

  const phone = trimmed(input.customer_phone);
  if (phone && !PHONE.test(phone)) errors.customer_phone = "Enter a phone number with digits only, and a country code if it is not Indian.";

  const purpose = trimmed(input.purpose);
  if (purpose.length < 3 || purpose.length > 200) errors.purpose = "Describe the service being billed (3 to 200 characters).";

  const billing_address: Record<string, string> = {};
  for (const field of ADDRESS_FIELDS) {
    const value = trimmed(input[`address_${field}`]);
    if (value.length > 160) errors[`address_${field}`] = "Keep this under 160 characters.";
    else if (value) billing_address[field] = value;
  }

  const { items, error: itemsError } = parseLineItems(input.line_items ?? "");
  if (itemsError) errors.line_items = itemsError;

  let discount_minor = 0;
  const discount = trimmed(input.discount);
  if (discount) {
    const parsed = parseRupeesToMinor(discount);
    if (parsed === null) errors.discount = "Enter the discount in rupees, for example 500 or 500.50.";
    else discount_minor = parsed;
  }

  // The rate is whatever the business decides for THIS invoice. Empty means no tax line.
  let tax_rate_percent: number | null = null;
  const rate = trimmed(input.tax_rate_percent);
  if (rate) {
    const n = Number(rate);
    if (!/^\d{1,3}(\.\d{1,2})?$/.test(rate) || n > 100) errors.tax_rate_percent = "Enter a percentage between 0 and 100, or leave it empty for no tax line.";
    else tax_rate_percent = n;
  }

  const due = trimmed(input.due_date);
  if (due && !ISO_DATE.test(due)) errors.due_date = "Enter a valid date.";

  const notes = trimmed(input.notes);
  if (notes.length > 2000) errors.notes = "Keep the notes under 2000 characters.";

  if (Object.keys(errors).length > 0) return { ok: false, fieldErrors: errors };

  return {
    ok: true,
    values: {
      customer_name,
      customer_email: orNull(email),
      customer_phone: orNull(phone),
      billing_address,
      purpose,
      line_items: items,
      discount_minor,
      tax_rate_percent,
      due_date: orNull(due),
      notes: orNull(notes),
    },
  };
}
