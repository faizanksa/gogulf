import { describe, expect, it } from "vitest";
import { z } from "zod";
import { CHANNELS, CONFIRMED_SOCIAL } from "./channels";
import { CLAIMS } from "./company";
import { PAGES } from "./pages";
import { validate } from "./schema";
import { SERVICES } from "./services";
import { CANDIDATE_SERVICES, EMPLOYER_SERVICES } from "@/lib/forms/service-options";
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

  it("has no travel page: Go Gulf is not a travel agency (0019)", () => {
    expect(PAGES.map((p) => p.path)).not.toContain("/travel");
    expect(PAGES.map((p) => p.id)).not.toContain("travel");
  });
});

// Go Gulf = recruitment + recruitment operations + candidate deployment (27 Sep 2026). It is
// not a travel agency: flights and travel are offered ONLY to candidates it has placed.
describe("recruitment scope", () => {
  const TRAVEL = /air ?ticket|ticketing|flight|tour|holiday|booking|travel/i;
  const SELECTED_ONLY = /selected/i;

  it("offers no standalone travel service: any travel wording is limited to selected candidates", () => {
    for (const s of SERVICES) {
      const text = `${s.id} ${s.name} ${s.summary}`;
      if (TRAVEL.test(text)) {
        expect(s.audience, s.id).toBe("job-seekers");
        expect(s.name, s.id).toMatch(SELECTED_ONLY);
        expect(s.summary, s.id).toMatch(/only for candidates selected/i);
        expect(s.summary, s.id).toMatch(/do not book flights or travel for anyone else/i);
      }
    }
    expect(SERVICES.map((s) => s.id)).not.toContain("air-ticket-travel");
    expect(SERVICES.map((s) => s.name).join(" ")).not.toMatch(/air ticket/i);
  });

  it("keeps flight and joining support for selected candidates", () => {
    const flight = SERVICES.find((s) => s.id === "flight-joining-support");
    expect(flight?.inquiryOption).toBe("Flight & Joining Support (Selected Candidates)");
  });

  it("offers travel in the enquiry form only as selected-candidate support, on the candidate desk", () => {
    for (const option of EMPLOYER_SERVICES) expect(option).not.toMatch(TRAVEL);
    for (const option of CANDIDATE_SERVICES) if (TRAVEL.test(option)) expect(option).toMatch(SELECTED_ONLY);
    expect(CANDIDATE_SERVICES as readonly string[]).not.toContain("Air Ticket & Travel Assistance");
  });

  it("keeps the recruitment services a candidate's journey needs", () => {
    const ids = SERVICES.map((s) => s.id);
    for (const id of ["job-applications", "visa-documentation", "medical-coordination", "attestation-embassy", "pre-departure"]) expect(ids).toContain(id);
  });
});

describe("claims and structured data", () => {
  it("asserts only verified facts in the Organization node", () => {
    const org = organizationJsonLd() as Record<string, unknown>;
    expect(org.foundingDate).toBe("2024-02-22");
    expect(org).not.toHaveProperty("taxID");
    expect(org).not.toHaveProperty("vatID");
    expect(org).not.toHaveProperty("areaServed");
    // Not EmploymentAgency: the company is not registered or licensed as a recruiting agent.
    // Not TravelAgency either: whatever the registered activity reads, no travel service is sold.
    expect(org["@type"]).toBe("Organization");
    expect(JSON.stringify(org)).not.toMatch(/2008|placement|MOFA|verified/i);
    // No social profile is confirmed yet, so there is no sameAs.
    expect(CONFIRMED_SOCIAL).toEqual([]);
    expect(org).not.toHaveProperty("sameAs");
  });

  it("records the recruiting-agent registration as refuted, never verified", () => {
    expect(CLAIMS.recruitingAgentRegistration.status).toBe("refuted");
  });

  it("records travel services (as a standalone business) as refuted: a permanent decision", () => {
    expect(CLAIMS.travelServices.status).toBe("refuted");
  });

  it("keeps every unresolved claim flagged", () => {
    for (const id of ["heritage2008", "placementNumbers", "officesOutsideLucknow", "countriesRecruitedFor", "sectors", "employerVerification", "responseTimeSla", "socialProfiles", "gstCertificate"] as const) {
      expect(CLAIMS[id].status).toBe("unresolved");
    }
  });

  it("records the unreachable X profile rather than linking it", () => {
    expect(CHANNELS.find((c) => c.id === "x")?.status).toBe("not-found");
  });
});
