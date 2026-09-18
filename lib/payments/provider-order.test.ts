import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { assertProviderReady, createProviderOrder, ProviderOrderError } from "./provider-order";

const TEST_ENV = { RAZORPAY_KEY_ID: "rzp_test_abc123", RAZORPAY_KEY_SECRET: "secret_test_value_xyz" };
const LIVE_ENV = { RAZORPAY_KEY_ID: "rzp_live_abc123", RAZORPAY_KEY_SECRET: "secret_live_value_xyz" };

const okFetch = (over: Record<string, unknown> = {}) =>
  vi.fn(async () => Response.json({ id: "order_ABC123", amount: 500000, currency: "INR", ...over }));

const reasonOf = async (promise: Promise<unknown>) => {
  try {
    await promise;
    return null;
  } catch (error) {
    return error instanceof ProviderOrderError ? error.reason : "other";
  }
};

describe("createProviderOrder — guards run before any request", () => {
  it("refuses a live key from staging, preview or local, without calling Razorpay", async () => {
    for (const stage of ["staging", "preview", "local"] as const) {
      const fetch = okFetch();
      expect(await reasonOf(createProviderOrder({ amountMinor: 500000, receipt: "GG-INV-2026-00001" }, { env: LIVE_ENV, stage, fetch }))).toBe("wrong_mode");
      expect(fetch).not.toHaveBeenCalled();
    }
  });

  it("refuses a test key from production — a 'successful' payment that never existed is worse than a failed one", async () => {
    const fetch = okFetch();
    expect(await reasonOf(createProviderOrder({ amountMinor: 500000, receipt: "r" }, { env: TEST_ENV, stage: "production", fetch }))).toBe("wrong_mode");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("refuses when Razorpay is not configured, or the key is not recognisably live or test", async () => {
    const fetch = okFetch();
    expect(await reasonOf(createProviderOrder({ amountMinor: 1, receipt: "r" }, { env: {}, stage: "staging", fetch }))).toBe("not_configured");
    expect(await reasonOf(createProviderOrder({ amountMinor: 1, receipt: "r" }, { env: { RAZORPAY_KEY_ID: "x", RAZORPAY_KEY_SECRET: "y" }, stage: "staging", fetch }))).toBe("wrong_mode");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("refuses an amount that is not a positive whole number of paise", async () => {
    const fetch = okFetch();
    for (const amountMinor of [0, -1, 10.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(await reasonOf(createProviderOrder({ amountMinor, receipt: "r" }, { env: TEST_ENV, stage: "staging", fetch }))).toBe("bad_amount");
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it("refuses a note that could carry a payer's identity", async () => {
    const fetch = okFetch();
    const identities: Record<string, string>[] = [{ email: "a@b.co" }, { note: "a@b.co" }, { note: "+91 (98765) 43210" }, { customer_name: "Asha" }];
    for (const notes of [...identities, { invoice: "<script>" }, { invoice: "x".repeat(200) }, { "bad key": "ok" }] as Record<string, string>[]) {
      expect(await reasonOf(createProviderOrder({ amountMinor: 1, receipt: "r", notes }, { env: TEST_ENV, stage: "staging", fetch }))).toBe("bad_amount");
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it("assertProviderReady lets a caller refuse before it writes a row", () => {
    expect(() => assertProviderReady({ env: LIVE_ENV, stage: "staging" })).toThrow(ProviderOrderError);
    expect(assertProviderReady({ env: TEST_ENV, stage: "staging" }).keyId).toBe("rzp_test_abc123");
    expect(assertProviderReady({ env: LIVE_ENV, stage: "production" }).keyId).toBe("rzp_live_abc123");
  });
});

describe("createProviderOrder — the request and the response", () => {
  it("sends the amount in paise, INR, our receipt and only short notes, with basic auth", async () => {
    const fetch = okFetch();
    await createProviderOrder({ amountMinor: 500000, receipt: "GG-INV-2026-00001", notes: { invoice: "GG-INV-2026-00001" } }, { env: TEST_ENV, stage: "staging", fetch });

    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.razorpay.com/v1/orders");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ amount: 500000, currency: "INR", receipt: "GG-INV-2026-00001", notes: { invoice: "GG-INV-2026-00001" } });
    const auth = (init.headers as Record<string, string>).Authorization ?? "";
    expect(Buffer.from(auth.replace("Basic ", ""), "base64").toString()).toBe("rzp_test_abc123:secret_test_value_xyz");
  });

  it("returns the order id and the PUBLIC key id — never the secret", async () => {
    const order = await createProviderOrder({ amountMinor: 500000, receipt: "r" }, { env: TEST_ENV, stage: "staging", fetch: okFetch() });
    expect(order).toEqual({ orderId: "order_ABC123", keyId: "rzp_test_abc123" });
    expect(JSON.stringify(order)).not.toContain("secret_test_value_xyz");
  });

  it("does not charge on an order that disagrees with the request", async () => {
    const env = { env: TEST_ENV, stage: "staging" as const };
    expect(await reasonOf(createProviderOrder({ amountMinor: 500000, receipt: "r" }, { ...env, fetch: okFetch({ amount: 100 }) }))).toBe("malformed");
    expect(await reasonOf(createProviderOrder({ amountMinor: 500000, receipt: "r" }, { ...env, fetch: okFetch({ currency: "USD" }) }))).toBe("malformed");
    expect(await reasonOf(createProviderOrder({ amountMinor: 500000, receipt: "r" }, { ...env, fetch: okFetch({ id: "pay_NOTANORDER" }) }))).toBe("malformed");
    expect(await reasonOf(createProviderOrder({ amountMinor: 500000, receipt: "r" }, { ...env, fetch: vi.fn(async () => new Response("not json")) }))).toBe("malformed");
  });

  it("reports a provider refusal without echoing its body", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ error: { description: "internal detail" } }), { status: 400 }));
    try {
      await createProviderOrder({ amountMinor: 1, receipt: "r" }, { env: TEST_ENV, stage: "staging", fetch });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ProviderOrderError);
      expect((error as ProviderOrderError).reason).toBe("rejected");
      expect((error as Error).message).not.toContain("internal detail");
    }
  });
});
