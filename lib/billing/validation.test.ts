import { describe, expect, it } from "vitest";
import { parseInvoiceForm } from "./validation";

const item = (over: Record<string, unknown> = {}) => ({ description: "Consultation fee", quantity: 1, unit_amount_minor: 500000, ...over });
const form = (over: Record<string, string> = {}, items: unknown[] = [item()]) => ({
  customer_name: "Asha Verma",
  purpose: "Visa consultation",
  line_items: JSON.stringify(items),
  ...over,
});

describe("parseInvoiceForm", () => {
  it("accepts a minimal invoice and adds no tax, no discount and no due date on its own", () => {
    const parsed = parseInvoiceForm(form());
    expect(parsed).toMatchObject({ ok: true, values: { customer_name: "Asha Verma", discount_minor: 0, tax_rate_percent: null, due_date: null, customer_email: null } });
  });

  it("keeps an entered tax rate exactly, and treats empty as no tax — GST is never defaulted", () => {
    expect(parseInvoiceForm(form({ tax_rate_percent: "18" }))).toMatchObject({ ok: true, values: { tax_rate_percent: 18 } });
    expect(parseInvoiceForm(form({ tax_rate_percent: "0" }))).toMatchObject({ ok: true, values: { tax_rate_percent: 0 } });
    expect(parseInvoiceForm(form({ tax_rate_percent: "" }))).toMatchObject({ ok: true, values: { tax_rate_percent: null } });
  });

  it("converts a discount typed in rupees to paise", () => {
    expect(parseInvoiceForm(form({ discount: "500.50" }))).toMatchObject({ ok: true, values: { discount_minor: 50050 } });
  });

  it("collects the billing address into one object and drops empty parts", () => {
    const parsed = parseInvoiceForm(form({ address_line1: " 1 MG Road ", address_city: "Lucknow", address_state: "" }));
    expect(parsed).toMatchObject({ ok: true, values: { billing_address: { line1: "1 MG Road", city: "Lucknow" } } });
  });

  it("explains each refusal against the field it belongs to", () => {
    const parsed = parseInvoiceForm(
      form({ customer_name: "A", customer_email: "nope", customer_phone: "abc", purpose: "x", discount: "-3", tax_rate_percent: "150", due_date: "tomorrow" }),
    );
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(Object.keys(parsed.fieldErrors).sort()).toEqual(["customer_email", "customer_name", "customer_phone", "discount", "due_date", "purpose", "tax_rate_percent"]);
    }
  });

  it("refuses bad line items with a message naming the line", () => {
    const err = (items: unknown[] | string) => {
      const parsed = parseInvoiceForm(typeof items === "string" ? form({ line_items: items }, []) : form({}, items));
      return parsed.ok ? null : parsed.fieldErrors.line_items;
    };
    expect(err([])).toMatch(/at least one/);
    expect(err([item(), item({ description: "  " })])).toMatch(/Line 2 needs a description/);
    expect(err([item({ quantity: 0 })])).toMatch(/Line 1: the quantity/);
    expect(err([item({ unit_amount_minor: 0 })])).toMatch(/unit price/);
    expect(err([item({ unit_amount_minor: 10.5 })])).toMatch(/unit price/);
    expect(err(Array.from({ length: 51 }, () => item()))).toMatch(/at most 50/);
    expect(err("not json")).toMatch(/could not be read/);
  });

  it("never returns a computed total — only the database derives those", () => {
    const parsed = parseInvoiceForm(form({ total_minor: "1", subtotal_minor: "1", status: "paid" }));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(Object.keys(parsed.values)).not.toContain("total_minor");
      expect(Object.keys(parsed.values)).not.toContain("subtotal_minor");
      expect(Object.keys(parsed.values)).not.toContain("status");
    }
  });
});
