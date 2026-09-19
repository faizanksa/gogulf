import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const state = vi.hoisted(() => ({
  invoice: null as null | { reference: string; status: string; purpose: string; totalMinor: number },
  rpc: vi.fn(),
}));

vi.mock("@/lib/billing/public-data", () => ({
  getPublicInvoice: vi.fn(async () => state.invoice),
  publicBillingClient: () => ({ rpc: vi.fn(() => { throw new Error("the anon client must never record a payment request (0017)"); }) }),
}));

// open_invoice_payment_request is server-only since 0017: it is reached through the privileged client.
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({ rpc: state.rpc })),
}));

import { createAdminClient } from "@/lib/supabase/admin";
import { startInvoicePayment } from "./invoice-payment";

const REF = "GG-INV-2026-00001";
const TEST_ENV = { RAZORPAY_KEY_ID: "rzp_test_abc123", RAZORPAY_KEY_SECRET: "secret_test_value_xyz" };
const invoice = (over: Record<string, unknown> = {}) => ({ reference: REF, status: "issued", purpose: "Visa consultation", totalMinor: 590000, ...over });
const opened = (over: Record<string, unknown> = {}) => ({ amount_minor: 590000, currency: "INR", provider_order_id: "order_LIVEONE", reused: false, ...over });
const orderFetch = () => vi.fn(async () => Response.json({ id: "order_NEWONE", amount: 590000, currency: "INR" }));
const deps = (fetch = orderFetch()) => ({ env: TEST_ENV, stage: "staging" as const, fetch });

beforeEach(() => {
  state.invoice = invoice();
  state.rpc.mockReset();
  vi.mocked(createAdminClient).mockClear();
});

describe("startInvoicePayment", () => {
  it("records the order through the privileged client, never the anon one (0017)", async () => {
    state.rpc.mockResolvedValueOnce({ data: [], error: null }).mockResolvedValueOnce({ data: [opened({ provider_order_id: "order_NEWONE" })], error: null });
    expect(await startInvoicePayment(REF, deps())).toMatchObject({ ok: true });
    expect(createAdminClient).toHaveBeenCalledWith("payment-request");
    // The anon mock throws if anything reaches it, so reaching ok:true proves it never did.
  });

  it("resumes a live order without creating another at Razorpay", async () => {
    state.rpc.mockResolvedValueOnce({ data: [opened()], error: null });
    const d = deps();
    const result = await startInvoicePayment(REF, d);

    expect(result).toMatchObject({ ok: true, checkout: { orderId: "order_LIVEONE", amountMinor: 590000, currency: "INR", reference: REF } });
    expect(d.fetch).not.toHaveBeenCalled();
    expect(state.rpc).toHaveBeenCalledTimes(1);
    expect(state.rpc).toHaveBeenCalledWith("open_invoice_payment_request", { p_reference: REF });
  });

  it("with no live order, creates one for the INVOICE's total, then records it against the invoice", async () => {
    state.rpc.mockResolvedValueOnce({ data: [], error: null }).mockResolvedValueOnce({ data: [opened({ provider_order_id: "order_NEWONE" })], error: null });
    const d = deps();
    const result = await startInvoicePayment(REF, d);

    expect(result).toMatchObject({ ok: true, checkout: { orderId: "order_NEWONE", amountMinor: 590000 } });
    const body = JSON.parse((d.fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body).toMatchObject({ amount: 590000, currency: "INR", receipt: REF, notes: { invoice: REF } });
    expect(state.rpc).toHaveBeenLastCalledWith("open_invoice_payment_request", { p_reference: REF, p_provider_order_id: "order_NEWONE" });
  });

  it("uses the winner's order if a concurrent request recorded one first", async () => {
    state.rpc.mockResolvedValueOnce({ data: [], error: null }).mockResolvedValueOnce({ data: [opened({ reused: true })], error: null });
    const result = await startInvoicePayment(REF, deps());
    expect(result).toMatchObject({ ok: true, checkout: { orderId: "order_LIVEONE" } });
  });

  it("offers a retry after a failed payment", async () => {
    state.invoice = invoice({ status: "payment_failed" });
    state.rpc.mockResolvedValueOnce({ data: [], error: null }).mockResolvedValueOnce({ data: [opened({ provider_order_id: "order_NEWONE" })], error: null });
    expect(await startInvoicePayment(REF, deps())).toMatchObject({ ok: true });
  });

  it("refuses every invoice that is not open for payment, before touching Razorpay or the payments table", async () => {
    for (const status of ["draft", "paid", "void"]) {
      state.invoice = invoice({ status });
      const d = deps();
      expect(await startInvoicePayment(REF, d)).toEqual({ ok: false, reason: "not_payable" });
      expect(d.fetch).not.toHaveBeenCalled();
    }
    expect(state.rpc).not.toHaveBeenCalled();
  });

  it("treats an unknown, draft-only or malformed reference as not found", async () => {
    state.invoice = null;
    expect(await startInvoicePayment(REF, deps())).toEqual({ ok: false, reason: "not_found" });
    expect(await startInvoicePayment("../../etc/passwd", deps())).toEqual({ ok: false, reason: "not_found" });
    expect(await startInvoicePayment("GG-JOB-2026-00001", deps())).toEqual({ ok: false, reason: "not_found" });
    expect(state.rpc).not.toHaveBeenCalled();
  });

  it("refuses a live key outside production without opening anything", async () => {
    const d = { env: { RAZORPAY_KEY_ID: "rzp_live_abc123", RAZORPAY_KEY_SECRET: "secret_live" }, stage: "staging" as const, fetch: orderFetch() };
    expect(await startInvoicePayment(REF, d)).toEqual({ ok: false, reason: "unavailable" });
    expect(d.fetch).not.toHaveBeenCalled();
    expect(state.rpc).not.toHaveBeenCalled();
  });

  it("is unavailable, not a crash, when Razorpay is not configured or the provider is down", async () => {
    expect(await startInvoicePayment(REF, { env: {}, stage: "staging", fetch: orderFetch() })).toEqual({ ok: false, reason: "unavailable" });

    state.rpc.mockResolvedValueOnce({ data: [], error: null });
    const down = vi.fn(async () => new Response("", { status: 502 }));
    expect(await startInvoicePayment(REF, deps(down))).toEqual({ ok: false, reason: "unavailable" });
  });

  it("will not hand over a checkout whose recorded amount differs from the invoice", async () => {
    state.rpc.mockResolvedValueOnce({ data: [opened({ amount_minor: 100 })], error: null });
    expect(await startInvoicePayment(REF, deps())).toEqual({ ok: false, reason: "unavailable" });
  });

  it("returns nothing secret and nothing internal — only what Checkout needs to open", async () => {
    state.rpc.mockResolvedValueOnce({ data: [opened()], error: null });
    const result = await startInvoicePayment(REF, deps());
    expect(Object.keys((result as { checkout: object }).checkout).sort()).toEqual(["amountMinor", "currency", "description", "keyId", "orderId", "reference"]);
    expect(JSON.stringify(result)).not.toContain("secret_test_value_xyz");
  });
});
