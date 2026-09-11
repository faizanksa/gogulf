import { describe, it, expect, afterEach, vi } from "vitest";
import { submitViaServer } from "./transport";

afterEach(() => {
  vi.unstubAllGlobals();
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
