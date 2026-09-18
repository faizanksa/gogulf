/**
 * Invoices, as the application reasons about them: statuses, money, line items and the
 * customer payment URL. Pure functions with no I/O, so they are exhaustively unit-tested.
 *
 * The database is the authority for every rule here (0015). This module mirrors the
 * arithmetic only so a form can show a total before it is saved; the value that is
 * stored is always the one the trigger computes.
 *
 * SCOPE: consultation and service invoices. Nothing in billing knows what a job or a job
 * application is (docs/PAYMENTS.md), and nothing here computes or assumes GST — the tax
 * rate is whatever a staff member enters for an invoice, and null means no tax line.
 */

import type { InvoiceStatus } from "@/types/database";

export const INVOICE_STATUSES = ["draft", "issued", "payment_pending", "paid", "payment_failed", "void"] as const satisfies readonly InvoiceStatus[];

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Draft",
  issued: "Issued",
  payment_pending: "Payment pending",
  paid: "Paid",
  payment_failed: "Payment failed",
  void: "Void",
};

/** What the customer page says. Deliberately plainer than the staff labels. */
export const CUSTOMER_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Not available",
  issued: "Awaiting payment",
  payment_pending: "Payment in progress",
  paid: "Paid",
  payment_failed: "Payment unsuccessful — you can try again",
  void: "This invoice has been cancelled",
};

/**
 * The moves a STAFF member may request — mirrors the staff whitelist in
 * invoices_before_write. Getting to paid, payment_pending or payment_failed is never a
 * staff action: only a verified payment event or a payer opening a payment request can.
 */
export const STAFF_TRANSITIONS: Record<InvoiceStatus, readonly InvoiceStatus[]> = {
  draft: ["issued", "void"],
  issued: ["void"],
  payment_pending: [],
  paid: [],
  payment_failed: ["void"],
  void: [],
};

export function canStaffTransition(from: InvoiceStatus, to: InvoiceStatus): boolean {
  return STAFF_TRANSITIONS[from].includes(to);
}

/** A draft is the only status whose content can be edited. */
export const isEditable = (status: InvoiceStatus) => status === "draft";

/** A customer can be sent to the payment page for these. */
export const isPayable = (status: InvoiceStatus) => status === "issued" || status === "payment_pending" || status === "payment_failed";

/** Whether the payment link/QR should be shown to staff at all. */
export const hasPaymentLink = (status: InvoiceStatus) => status !== "draft" && status !== "void";

// ---------------------------------------------------------------------------
// Money. Integer paise, INR only — the same convention as payments (0014).
// ---------------------------------------------------------------------------

const RUPEE = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 });

/** 500000 → "₹5,000.00". Never touches floating point for the value itself. */
export function formatMinor(minor: number): string {
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(Math.trunc(minor));
  return sign + RUPEE.format(Math.floor(abs / 100) + (abs % 100) / 100);
}

/**
 * "5000" or "5,000.50" → 500050 paise, or null when it is not a valid non-negative
 * amount with at most two decimals. A staff member types rupees; the database stores
 * paise, and nothing ever rounds silently.
 */
export function parseRupeesToMinor(input: string): number | null {
  const cleaned = input.trim().replace(/[,\s₹]/g, "");
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, frac = ""] = cleaned.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

export interface LineItem {
  description: string;
  quantity: number;
  unit_amount_minor: number;
}

export const MAX_LINE_ITEMS = 50;

/** quantity × unit price, rounded to the nearest paisa — the same rounding as 0015. */
export function lineAmountMinor(item: Pick<LineItem, "quantity" | "unit_amount_minor">): number {
  return Math.round(item.quantity * item.unit_amount_minor);
}

export interface Totals {
  subtotalMinor: number;
  discountMinor: number;
  taxAmountMinor: number;
  totalMinor: number;
}

/**
 * The total a form may preview. Mirrors invoices_before_write: tax is on the amount after
 * discount, only when a rate is given; a null rate means no tax line, never a default.
 */
export function computeTotals(items: readonly LineItem[], discountMinor: number, taxRatePercent: number | null): Totals {
  const subtotalMinor = items.reduce((sum, item) => sum + lineAmountMinor(item), 0);
  const taxAmountMinor = taxRatePercent === null ? 0 : Math.round(((subtotalMinor - discountMinor) * taxRatePercent) / 100);
  return { subtotalMinor, discountMinor, taxAmountMinor, totalMinor: subtotalMinor - discountMinor + taxAmountMinor };
}

// ---------------------------------------------------------------------------
// The customer payment page
// ---------------------------------------------------------------------------

/** GG-INV-2026-00001. The reference is the only thing a payer's URL carries. */
export const INVOICE_REFERENCE = /^GG-INV-\d{4}-\d{5,}$/;

export function normaliseReference(input: string): string | null {
  const ref = input.trim().toUpperCase();
  return ref.length <= 40 && INVOICE_REFERENCE.test(ref) ? ref : null;
}

/** The path a customer opens. Never contains an internal id, a token or an amount. */
export function paymentPath(reference: string): string {
  return `/pay/${encodeURIComponent(reference)}`;
}

/** The absolute payment URL that the link, the QR code and the copy button all share. */
export function paymentUrl(reference: string, siteUrl: string): string {
  return `${siteUrl.replace(/\/+$/, "")}${paymentPath(reference)}`;
}
