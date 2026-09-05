import { describe, it, expect } from "vitest";
import { redact } from "./logger";

/**
 * Redaction is a security control, not a convenience. Every case below is
 * something that must never reach a log file, a Sentry event or a support
 * ticket — the class of mistake that ends up in a breach notification.
 */
describe("redact", () => {
  it("redacts OTP codes", () => {
    expect(redact({ otp: "482913", phone: "+919936309015" })).toEqual({
      otp: "[REDACTED]",
      phone: "+919936309015",
    });
  });

  it("redacts passwords and tokens", () => {
    const out = redact({
      password: "hunter2",
      access_token: "eyJhbGci",
      refresh_token: "abc",
      session: "sess_123",
    }) as Record<string, unknown>;
    expect(out.password).toBe("[REDACTED]");
    expect(out.access_token).toBe("[REDACTED]");
    expect(out.refresh_token).toBe("[REDACTED]");
    expect(out.session).toBe("[REDACTED]");
  });

  it("redacts the service role key under any of its names", () => {
    const out = redact({
      service_role_key: "eyJ",
      SUPABASE_SERVICE_ROLE_KEY: "eyJ",
      api_key: "re_abc",
    }) as Record<string, unknown>;
    expect(out.service_role_key).toBe("[REDACTED]");
    expect(out.SUPABASE_SERVICE_ROLE_KEY).toBe("[REDACTED]");
    expect(out.api_key).toBe("[REDACTED]");
  });

  it("redacts payment and identity data", () => {
    const out = redact({
      card_number: "4111111111111111",
      cvv: "123",
      upi_pin: "1234",
      passport_number: "Z1234567",
    }) as Record<string, unknown>;
    expect(Object.values(out)).toEqual([
      "[REDACTED]", "[REDACTED]", "[REDACTED]", "[REDACTED]",
    ]);
  });

  it("redacts webhook signatures and authorization headers", () => {
    const out = redact({
      signature: "sha256=abc",
      authorization: "Bearer x",
      cookie: "sb-access-token=y",
    }) as Record<string, unknown>;
    expect(out.signature).toBe("[REDACTED]");
    expect(out.authorization).toBe("[REDACTED]");
    expect(out.cookie).toBe("[REDACTED]");
  });

  it("redacts nested values, not just top-level ones", () => {
    const out = redact({
      request: { headers: { authorization: "Bearer x" }, body: { otp: "111111" } },
    }) as { request: { headers: Record<string, unknown>; body: Record<string, unknown> } };
    expect(out.request.headers.authorization).toBe("[REDACTED]");
    expect(out.request.body.otp).toBe("[REDACTED]");
  });

  it("redacts inside arrays", () => {
    const out = redact([{ token: "a" }, { token: "b" }]) as Array<Record<string, unknown>>;
    expect(out[0]?.token).toBe("[REDACTED]");
    expect(out[1]?.token).toBe("[REDACTED]");
  });

  it("matches partial key names, so key_secret and webhook_secret are caught", () => {
    const out = redact({
      razorpay_key_secret: "x",
      whatsapp_app_secret: "y",
      my_api_key_value: "z",
    }) as Record<string, unknown>;
    expect(Object.values(out)).toEqual(["[REDACTED]", "[REDACTED]", "[REDACTED]"]);
  });

  it("leaves ordinary operational data intact", () => {
    const out = redact({
      contact_id: "0f8b…", case_number: "GG-REC-2026-00184", amount_paise: 2500000,
    });
    expect(out).toEqual({
      contact_id: "0f8b…", case_number: "GG-REC-2026-00184", amount_paise: 2500000,
    });
  });

  it("does not blow up on deeply nested structures", () => {
    let deep: Record<string, unknown> = { token: "secret" };
    for (let i = 0; i < 20; i++) deep = { nested: deep };
    expect(() => redact(deep)).not.toThrow();
  });

  it("preserves error shape without leaking arbitrary properties", () => {
    const out = redact(new Error("boom")) as Record<string, unknown>;
    expect(out.message).toBe("boom");
    expect(out.name).toBe("Error");
  });
});
