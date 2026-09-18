import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

// server-only throws when imported outside a React Server Component build.
// Stubbing it lets the real modules be tested under Vitest without weakening
// the guard in production code (lib/email/send.test.ts does the same).
vi.mock("server-only", () => ({}));

import { normaliseEvent, ordersAllowed, razorpayMode, verifyWebhookSignature, MAX_WEBHOOK_BYTES } from "./razorpay";
import { handleRazorpayWebhook, type ApplyEvent } from "./webhook";

/**
 * The webhook is the only thing that may say money arrived, so these tests are about
 * what it REFUSES as much as what it accepts: an unsigned body, a body signed with
 * the wrong secret, a body altered after signing, a replayed delivery.
 */

const SECRET = "whsec_test_9f2c1b7a4d0e";
const sign = (body: string, secret = SECRET) => createHmac("sha256", secret).update(body, "utf8").digest("hex");

const paidBody = JSON.stringify({
  event: "order.paid",
  payload: {
    payment: {
      entity: {
        id: "pay_TEST00000001",
        order_id: "order_TEST00000001",
        amount: 500000,
        currency: "INR",
        method: "upi",
        // Present in real payloads; must never be carried through.
        email: "payer@example.com",
        contact: "+919999999999",
        card: { last4: "1111" },
      },
    },
  },
});

describe("verifyWebhookSignature", () => {
  it("accepts a body signed with the webhook secret", () => {
    expect(verifyWebhookSignature(paidBody, sign(paidBody), SECRET)).toBe(true);
  });

  it("refuses a body signed with a different secret", () => {
    expect(verifyWebhookSignature(paidBody, sign(paidBody, "whsec_other"), SECRET)).toBe(false);
  });

  it("refuses a body altered after signing — one character is enough", () => {
    const signature = sign(paidBody);
    const tampered = paidBody.replace("500000", "100000");
    expect(verifyWebhookSignature(tampered, signature, SECRET)).toBe(false);
  });

  it("refuses a missing, empty, non-hex or short signature", () => {
    expect(verifyWebhookSignature(paidBody, null, SECRET)).toBe(false);
    expect(verifyWebhookSignature(paidBody, "", SECRET)).toBe(false);
    expect(verifyWebhookSignature(paidBody, "not-hex-at-all", SECRET)).toBe(false);
    expect(verifyWebhookSignature(paidBody, sign(paidBody).slice(0, 32), SECRET)).toBe(false);
  });

  it("refuses everything when no secret is configured", () => {
    expect(verifyWebhookSignature(paidBody, sign(paidBody), "")).toBe(false);
  });

  it("is insensitive to signature case but not to body bytes", () => {
    expect(verifyWebhookSignature(paidBody, sign(paidBody).toUpperCase(), SECRET)).toBe(true);
    expect(verifyWebhookSignature(` ${paidBody}`, sign(paidBody), SECRET)).toBe(false);
  });
});

describe("normaliseEvent", () => {
  it("keeps the reconciliation fields and drops payer identity", () => {
    const event = normaliseEvent(JSON.parse(paidBody));
    expect(event).toEqual({
      eventType: "order.paid",
      orderId: "order_TEST00000001",
      paymentId: "pay_TEST00000001",
      amountMinor: 500000,
      currency: "INR",
      method: "upi",
      errorCode: null,
      errorDescription: null,
    });
    // Nothing identifying survives normalisation.
    expect(JSON.stringify(event)).not.toMatch(/payer@example\.com|9999999999|1111/);
  });

  it("reads an order-only payload", () => {
    const event = normaliseEvent({ event: "order.paid", payload: { order: { entity: { id: "order_X", amount: 100, currency: "INR" } } } });
    expect(event).toMatchObject({ orderId: "order_X", paymentId: null, amountMinor: 100 });
  });

  it("carries the provider's failure code", () => {
    const event = normaliseEvent({
      event: "payment.failed",
      payload: { payment: { entity: { id: "pay_1", order_id: "order_1", error_code: "BAD_REQUEST_ERROR", error_description: "Payment failed" } } },
    });
    expect(event).toMatchObject({ errorCode: "BAD_REQUEST_ERROR", errorDescription: "Payment failed" });
  });

  it("returns null for anything that is not an event", () => {
    expect(normaliseEvent(null)).toBeNull();
    expect(normaliseEvent("order.paid")).toBeNull();
    expect(normaliseEvent({ payload: {} })).toBeNull();
    expect(normaliseEvent({ event: 42 })).toBeNull();
  });
});

describe("razorpayMode / ordersAllowed", () => {
  it("reads the mode from the key id prefix", () => {
    expect(razorpayMode("rzp_live_ABC")).toBe("live");
    expect(razorpayMode("rzp_test_ABC")).toBe("test");
    expect(razorpayMode("something-else")).toBe("unknown");
    expect(razorpayMode(undefined)).toBe("unknown");
  });

  it("allows live keys only in production, and test keys only outside it", () => {
    expect(ordersAllowed("live", "production")).toBe(true);
    expect(ordersAllowed("live", "staging")).toBe(false);
    expect(ordersAllowed("live", "local")).toBe(false);
    expect(ordersAllowed("test", "staging")).toBe(true);
    expect(ordersAllowed("test", "local")).toBe(true);
    expect(ordersAllowed("test", "production")).toBe(false);
    expect(ordersAllowed("unknown", "production")).toBe(false);
  });
});

describe("handleRazorpayWebhook", () => {
  const applied: unknown[] = [];
  const apply: ApplyEvent = async (event) => {
    applied.push(event);
    return "processed";
  };
  const req = (over: Partial<Parameters<typeof handleRazorpayWebhook>[0]> = {}) => ({
    rawBody: paidBody,
    signature: sign(paidBody),
    eventId: "evt_TEST00000001",
    secret: SECRET,
    ...over,
  });

  it("records a correctly signed event", async () => {
    const result = await handleRazorpayWebhook(req(), apply);
    expect(result).toEqual({ status: 200, body: { status: "ok", outcome: "processed" } });
  });

  it("reports a duplicate delivery as 200, so Razorpay stops retrying", async () => {
    const result = await handleRazorpayWebhook(req(), async () => "duplicate");
    expect(result.status).toBe(200);
    expect(result.body.outcome).toBe("duplicate");
  });

  it("answers 503 when the webhook secret is not configured", async () => {
    const result = await handleRazorpayWebhook(req({ secret: undefined }), apply);
    expect(result).toEqual({ status: 503, body: { status: "not_configured" } });
  });

  it("answers 401 for a bad signature, and does not touch the database", async () => {
    const calls: unknown[] = [];
    const result = await handleRazorpayWebhook(req({ signature: sign(paidBody, "wrong") }), async (e) => {
      calls.push(e);
      return "processed";
    });
    expect(result.status).toBe(401);
    expect(calls).toHaveLength(0);
  });

  it("checks the signature before the event id, so an unsigned probe learns nothing", async () => {
    const result = await handleRazorpayWebhook(req({ signature: null, eventId: null }), apply);
    expect(result.body.status).toBe("invalid_signature");
  });

  it("answers 400 when the event id header is missing", async () => {
    const result = await handleRazorpayWebhook(req({ eventId: null }), apply);
    expect(result).toEqual({ status: 400, body: { status: "missing_event_id" } });
  });

  it("answers 400 for a signed body that is not JSON, and for JSON that is not an event", async () => {
    const notJson = "{oops";
    expect(await handleRazorpayWebhook(req({ rawBody: notJson, signature: sign(notJson) }), apply)).toEqual({
      status: 400,
      body: { status: "invalid_json" },
    });
    const notEvent = JSON.stringify({ hello: "world" });
    expect(await handleRazorpayWebhook(req({ rawBody: notEvent, signature: sign(notEvent) }), apply)).toEqual({
      status: 400,
      body: { status: "invalid_event" },
    });
  });

  it("refuses an oversized body before doing HMAC work on it", async () => {
    const huge = "x".repeat(MAX_WEBHOOK_BYTES + 1);
    const result = await handleRazorpayWebhook(req({ rawBody: huge, signature: sign(huge) }), apply);
    expect(result.status).toBe(413);
  });

  it("answers 500 when recording fails, so Razorpay retries", async () => {
    const result = await handleRazorpayWebhook(req(), async () => {
      throw new Error("database is down");
    });
    expect(result).toEqual({ status: 500, body: { status: "error" } });
  });

  it("never writes a secret, a signature or payer identity to the log", async () => {
    const lines: string[] = [];
    const spies = (["info", "warn", "error"] as const).map((level) =>
      vi.spyOn(console, level === "info" ? "info" : level).mockImplementation((line) => {
        lines.push(String(line));
      }),
    );
    await handleRazorpayWebhook(req(), apply);
    await handleRazorpayWebhook(req({ signature: sign(paidBody, "wrong") }), apply);
    await handleRazorpayWebhook(req(), async () => {
      throw new Error("database is down");
    });
    for (const spy of spies) spy.mockRestore();

    const logged = lines.join("\n");
    expect(logged).not.toContain(SECRET);
    expect(logged).not.toContain(sign(paidBody));
    expect(logged).not.toMatch(/payer@example\.com|9999999999/);
    // …while still carrying what an operator needs.
    expect(logged).toContain("evt_TEST00000001");
    expect(logged).toContain("order_TEST00000001");
  });
});
