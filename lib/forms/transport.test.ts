import { describe, it, expect, afterEach, vi } from "vitest";

// The EmailJS path pulls in a browser SDK. Stubbed so provider *selection* can
// be tested in isolation from either provider's implementation.
//
// vi.mock is hoisted above the imports, so the factory must not close over a
// top-level variable — hence vi.hoisted for the shared spy.
const { sendInquiry } = vi.hoisted(() => ({ sendInquiry: vi.fn() }));
vi.mock("@/lib/emailjs", () => ({ sendInquiry }));

import { emailProviderMode, submitViaServer, submitViaEmailJs } from "./transport";

const original = process.env.NEXT_PUBLIC_EMAIL_PROVIDER;
afterEach(() => {
  process.env.NEXT_PUBLIC_EMAIL_PROVIDER = original;
  vi.unstubAllGlobals();
  sendInquiry.mockReset();
});

describe("provider selection", () => {
  it("defaults to EmailJS when the flag is unset", () => {
    // The live static export has no /api routes, so the safe default must be
    // the path that currently works in production.
    delete process.env.NEXT_PUBLIC_EMAIL_PROVIDER;
    expect(emailProviderMode()).toBe("emailjs");
  });

  it("uses EmailJS for any unrecognised value", () => {
    process.env.NEXT_PUBLIC_EMAIL_PROVIDER = "typo";
    expect(emailProviderMode()).toBe("emailjs");
  });

  it("selects Resend only on an exact match", () => {
    process.env.NEXT_PUBLIC_EMAIL_PROVIDER = "resend";
    expect(emailProviderMode()).toBe("resend");
  });
});

describe("submitViaServer", () => {
  it("posts JSON to the flow's endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, acknowledgementSent: true }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await submitViaServer("contact", { from_name: "A" });

    expect(result.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/forms/contact");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ from_name: "A" });
  });

  it("surfaces field errors from a 400", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ ok: false, error: "Check fields", fieldErrors: { reply_to: ["Bad"] } }),
          { status: 400 },
        ),
      ),
    );

    const result = await submitViaServer("contact", {});
    expect(result.ok).toBe(false);
    expect(result.fieldErrors?.reply_to).toEqual(["Bad"]);
  });

  it("reports a friendly message when the network fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    const result = await submitViaServer("contact", {});
    expect(result.ok).toBe(false);
    expect(result.error).toContain("could not reach the server");
  });

  it("does not crash when the server returns a non-JSON error page", async () => {
    // A 502 from an edge proxy returns HTML, not JSON.
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>502</html>", { status: 502 })));
    const result = await submitViaServer("contact", {});
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it("flags a successful submission whose acknowledgement did not send", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ok: true, acknowledgementSent: false }), { status: 200 }),
      ),
    );
    const result = await submitViaServer("contact", {});
    expect(result.ok).toBe(true);
    expect(result.acknowledgementSent).toBe(false);
  });
});

describe("submitViaEmailJs", () => {
  it("reports success when the SDK resolves", async () => {
    sendInquiry.mockResolvedValue({ status: 200 });
    const result = await submitViaEmailJs({} as HTMLFormElement);
    expect(result.ok).toBe(true);
    expect(sendInquiry).toHaveBeenCalledOnce();
  });

  it("returns the SDK's message when it rejects", async () => {
    sendInquiry.mockRejectedValue(new Error("EmailJS is not configured"));
    const result = await submitViaEmailJs({} as HTMLFormElement);
    expect(result.ok).toBe(false);
    expect(result.error).toBe("EmailJS is not configured");
  });

  it("never throws, so the form always renders an error state", async () => {
    sendInquiry.mockRejectedValue("a string, not an Error");
    const result = await submitViaEmailJs({} as HTMLFormElement);
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });
});
