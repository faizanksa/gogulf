import { describe, expect, it } from "vitest";
import {
  canStaffTransition,
  computeTotals,
  CUSTOMER_STATUS_LABELS,
  formatMinor,
  hasPaymentLink,
  INVOICE_STATUSES,
  isEditable,
  isPayable,
  lineAmountMinor,
  normaliseReference,
  parseRupeesToMinor,
  paymentPath,
  paymentUrl,
  STAFF_TRANSITIONS,
} from "./model";

describe("money", () => {
  it("formats paise as rupees without touching floating point for the value", () => {
    expect(formatMinor(500000)).toBe("₹5,000.00");
    expect(formatMinor(1)).toBe("₹0.01");
    expect(formatMinor(123456789)).toBe("₹12,34,567.89");
  });

  it("parses what a person types into whole paise, or refuses", () => {
    expect(parseRupeesToMinor("5000")).toBe(500000);
    expect(parseRupeesToMinor("5,000.50")).toBe(500050);
    expect(parseRupeesToMinor("₹ 12.5")).toBe(1250);
    expect(parseRupeesToMinor("0.07")).toBe(7);
    for (const bad of ["", "abc", "-5", "1.234", "1e3", "12345678901", "5.", ".5"]) expect(parseRupeesToMinor(bad)).toBeNull();
  });
});

describe("totals mirror the database arithmetic (0015)", () => {
  const items = [
    { description: "Consultation fee", quantity: 1, unit_amount_minor: 500000 },
    { description: "Document review", quantity: 2, unit_amount_minor: 50000 },
  ];

  it("derives the subtotal from the line items", () => {
    expect(computeTotals(items, 0, null)).toEqual({ subtotalMinor: 600000, discountMinor: 0, taxAmountMinor: 0, totalMinor: 600000 });
  });

  it("applies tax after discount, only when a rate is given — the same figures the SQL suite asserts", () => {
    const t = computeTotals(items, 50000, 18);
    expect(t.taxAmountMinor).toBe(Math.round((550000 * 18) / 100));
    expect(t.totalMinor).toBe(600000 - 50000 + t.taxAmountMinor);
  });

  it("never assumes a tax rate: null means no tax line, and zero is a real, explicit rate", () => {
    expect(computeTotals(items, 0, null).taxAmountMinor).toBe(0);
    expect(computeTotals(items, 0, 0).taxAmountMinor).toBe(0);
  });

  it("rounds a line to the nearest paisa", () => {
    expect(lineAmountMinor({ quantity: 1.5, unit_amount_minor: 333 })).toBe(500);
    expect(lineAmountMinor({ quantity: 3, unit_amount_minor: 33333 })).toBe(99999);
  });
});

describe("status rules", () => {
  it("lets staff only draft→issued, and void from draft, issued or a failed payment", () => {
    expect(STAFF_TRANSITIONS).toEqual({
      draft: ["issued", "void"],
      issued: ["void"],
      payment_pending: [],
      paid: [],
      payment_failed: ["void"],
      void: [],
    });
  });

  it("gives staff NO way to reach paid, payment_pending or payment_failed, from anywhere", () => {
    for (const from of INVOICE_STATUSES) {
      for (const to of ["paid", "payment_pending", "payment_failed"] as const) {
        expect(canStaffTransition(from, to)).toBe(false);
      }
    }
  });

  it("has no way out of paid, and none out of void — there is no 'mark unpaid'", () => {
    for (const to of INVOICE_STATUSES) {
      expect(canStaffTransition("paid", to)).toBe(false);
      expect(canStaffTransition("void", to)).toBe(false);
    }
  });

  it("cannot void an invoice a customer is paying right now", () => {
    expect(canStaffTransition("payment_pending", "void")).toBe(false);
  });

  it("edits only drafts, and shows a payment link only for live invoices", () => {
    expect(INVOICE_STATUSES.filter(isEditable)).toEqual(["draft"]);
    expect(INVOICE_STATUSES.filter(hasPaymentLink)).toEqual(["issued", "payment_pending", "paid", "payment_failed"]);
  });

  it("lets a customer pay (or retry) only while it is open", () => {
    expect(INVOICE_STATUSES.filter(isPayable)).toEqual(["issued", "payment_pending", "payment_failed"]);
  });

  it("has a customer wording for every status", () => {
    for (const s of INVOICE_STATUSES) expect(CUSTOMER_STATUS_LABELS[s].length).toBeGreaterThan(0);
  });
});

describe("the payment URL", () => {
  it("accepts only a well-formed invoice reference", () => {
    expect(normaliseReference("gg-inv-2026-00001")).toBe("GG-INV-2026-00001");
    expect(normaliseReference("  GG-INV-2026-00001 ")).toBe("GG-INV-2026-00001");
    for (const bad of ["", "GG-JOB-2026-00001", "GG-PAY-2026-00001", "GG-INV-2026-1", "../admin", "GG-INV-2026-00001/../x", "GG-INV-2026-00001?a=1", "1 OR 1=1", "x".repeat(60)]) {
      expect(normaliseReference(bad)).toBeNull();
    }
  });

  it("carries only the reference — no id, amount or token", () => {
    expect(paymentPath("GG-INV-2026-00001")).toBe("/pay/GG-INV-2026-00001");
    expect(paymentUrl("GG-INV-2026-00001", "https://www.gogulf.co/")).toBe("https://www.gogulf.co/pay/GG-INV-2026-00001");
  });
});
