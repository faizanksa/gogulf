import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { integrationStatuses } from "./integrations";

const SECRETS = {
  RAZORPAY_KEY_ID: "rzp_test_SECRETIDVALUE123",
  RAZORPAY_KEY_SECRET: "razorpay-secret-value-xyz",
  RAZORPAY_WEBHOOK_SECRET: "whsec-webhook-value-abc",
  RESEND_API_KEY: "re_resend-api-key-value",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key-value",
  NEXT_PUBLIC_SUPABASE_URL: "https://noxireidrbeqcvsirjec.supabase.co",
};
const byKey = (list: ReturnType<typeof integrationStatuses>, key: string) => list.find((i) => i.key === key)!;

describe("integrationStatuses", () => {
  it("never reveals a credential — not its value, and not a fragment of it", () => {
    const text = JSON.stringify(integrationStatuses(SECRETS, "staging", "https://staging.gogulf.co"));
    for (const secret of ["SECRETIDVALUE123", "razorpay-secret-value-xyz", "whsec-webhook-value-abc", "re_resend-api-key-value", "service-role-key-value"]) {
      expect(text).not.toContain(secret);
    }
    expect(text).not.toMatch(/rzp_test_[A-Za-z0-9]/); // not even the key id's prefix plus a character
  });

  it("names the database this deployment is on, so Tokyo vs Mumbai is visible at a glance", () => {
    const at = (ref: string) => byKey(integrationStatuses({ NEXT_PUBLIC_SUPABASE_URL: `https://${ref}.supabase.co` }, "production", "https://www.gogulf.co"), "supabase").summary;
    expect(at("julbqkeyvzwluayokcdi")).toMatch(/Tokyo production/);
    expect(at("exsnksrmkycloxiajwmx")).toMatch(/Mumbai production/);
    expect(at("noxireidrbeqcvsirjec")).toMatch(/Mumbai staging/);
  });

  it("shows TEST on staging as working, and refuses to call a LIVE key working there", () => {
    const test = byKey(integrationStatuses(SECRETS, "staging", "https://staging.gogulf.co"), "razorpay");
    expect(test.summary).toBe("TEST key");
    expect(test.state).toBe("ok");

    const live = byKey(integrationStatuses({ ...SECRETS, RAZORPAY_KEY_ID: "rzp_live_x" }, "staging", "https://staging.gogulf.co"), "razorpay");
    expect(live.summary).toMatch(/LIVE key — refused on a staging deployment/);
    expect(live.state).toBe("warning");
  });

  it("shows LIVE on production as working, and a TEST key there as refused", () => {
    expect(byKey(integrationStatuses({ ...SECRETS, RAZORPAY_KEY_ID: "rzp_live_x" }, "production", "https://www.gogulf.co"), "razorpay").state).toBe("ok");
    expect(byKey(integrationStatuses(SECRETS, "production", "https://www.gogulf.co"), "razorpay").summary).toMatch(/refused on a production deployment/);
  });

  it("says plainly when Razorpay is not configured, and when its webhook secret is missing", () => {
    const none = byKey(integrationStatuses({}, "staging", "https://staging.gogulf.co"), "razorpay");
    expect(none.state).toBe("off");
    expect(none.summary).toMatch(/Pay is unavailable/);
    const noHook = byKey(integrationStatuses({ RAZORPAY_KEY_ID: "rzp_test_a", RAZORPAY_KEY_SECRET: "b" }, "staging", "https://staging.gogulf.co"), "razorpay");
    expect(noHook.details.join(" ")).toMatch(/absent \(the endpoint answers 503\)/);
  });

  it("gives the exact webhook URL for the environment", () => {
    expect(byKey(integrationStatuses(SECRETS, "production", "https://www.gogulf.co/"), "razorpay").details.join(" ")).toContain("https://www.gogulf.co/api/razorpay/webhook");
  });
});
