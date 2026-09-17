import { describe, expect, it } from "vitest";
import { z } from "zod";
import { CHANNELS, CONFIRMED_SOCIAL } from "./channels";
import { CLAIMS } from "./company";
import { PAGES } from "./pages";
import { validate } from "./schema";
import { TRAVEL_PUBLISHED, TRAVEL_SERVICES } from "./travel";
import { organizationJsonLd } from "@/lib/seo";

describe("content validation fails loudly", () => {
  it("reports the path of every invalid field", () => {
    expect(() => validate(z.object({ a: z.number() }), { a: "x" }, "test.ts")).toThrow(/Invalid content in test\.ts:\n {2}- a:/);
  });
});

// Jobs moved to the database (0012). Their rules are tested in lib/jobs/jobs.test.ts and,
// as each role, in supabase/tests/jobs.test.sql.

describe("page registry", () => {
  it("keeps every indexable page's title short enough for the ' — Go Gulf' suffix", () => {
    for (const p of PAGES) expect((p.absoluteTitle ?? `${p.title} — Go Gulf`).length).toBeLessThanOrEqual(60);
  });

  it("covers the 13 production URLs plus /verify", () => {
    const paths = PAGES.map((p) => p.path);
    for (const path of ["/", "/about", "/services", "/jobs", "/jobs/apply", "/candidates", "/employers", "/contact", "/pricing", "/privacy-policy", "/terms-and-conditions", "/cancellation-and-refunds", "/shipping-policy", "/verify"]) {
      expect(paths).toContain(path);
    }
  });

  it("keeps unpublished pages out of the index and the sitemap", () => {
    const travel = PAGES.find((p) => p.path === "/travel")!;
    expect(travel.index).toBe(false);
    expect(travel.sitemap).toBeNull();
  });
});

describe("claims and structured data", () => {
  it("publishes no travel services until one is confirmed", () => {
    expect(TRAVEL_SERVICES).toEqual([]);
    expect(TRAVEL_PUBLISHED).toBe(false);
  });

  it("asserts only verified facts in the Organization node", () => {
    const org = organizationJsonLd() as Record<string, unknown>;
    expect(org.foundingDate).toBe("2024-02-22");
    expect(org).not.toHaveProperty("taxID");
    expect(org).not.toHaveProperty("vatID");
    expect(org).not.toHaveProperty("areaServed");
    // Not EmploymentAgency: the company is not registered or licensed as a recruiting agent.
    expect(org["@type"]).toBe("Organization");
    expect(JSON.stringify(org)).not.toMatch(/2008|placement|MOFA|verified/i);
    // No social profile is confirmed yet, so there is no sameAs.
    expect(CONFIRMED_SOCIAL).toEqual([]);
    expect(org).not.toHaveProperty("sameAs");
  });

  it("records the recruiting-agent registration as refuted, never verified", () => {
    expect(CLAIMS.recruitingAgentRegistration.status).toBe("refuted");
  });

  it("keeps every unresolved claim flagged", () => {
    for (const id of ["heritage2008", "placementNumbers", "officesOutsideLucknow", "countriesRecruitedFor", "sectors", "employerVerification", "responseTimeSla", "travelServices", "socialProfiles", "gstCertificate"] as const) {
      expect(CLAIMS[id].status).toBe("unresolved");
    }
  });

  it("records the unreachable X profile rather than linking it", () => {
    expect(CHANNELS.find((c) => c.id === "x")?.status).toBe("not-found");
  });
});
