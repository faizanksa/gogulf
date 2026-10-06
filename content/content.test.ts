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

// Go Gulf = counselling + profile and document preparation + referral to registered
// recruiting agents (6 Oct 2026, D13). It does not place candidates, and it is not a travel
// agency (0019): interviews, offers, visas, medicals, attestation and travel are the
// recruiting agent's work, never a Go Gulf service.
describe("referral model", () => {
  const AGENTS_WORK = /visa|flight|ticket|travel|tour|booking|immigration|medical|interview|sourcing|screening|placement|attestation|\bHR\b/i;
  const GO_GULF_DOES_IT = /\b(we|go gulf)\s+(arrange|book|process|issue|select|place|source|screen|schedule|coordinate|shortlist)\b/i;

  it("offers no service that is the recruiting agent's work", () => {
    for (const s of SERVICES) {
      expect(s.name, s.id).not.toMatch(AGENTS_WORK);
      expect(s.summary, s.id).not.toMatch(GO_GULF_DOES_IT);
    }
  });

  it("offers the same in the enquiry form, and none of the retired services", () => {
    for (const option of [...CANDIDATE_SERVICES, ...EMPLOYER_SERVICES]) expect(option).not.toMatch(AGENTS_WORK);
    for (const retired of ["Flight & Joining Support (Selected Candidates)", "Visa & Documentation Assistance", "Bulk Candidate Sourcing", "Candidate Screening", "Interview Coordination", "Air Ticket & Travel Assistance"]) {
      expect([...CANDIDATE_SERVICES, ...EMPLOYER_SERVICES] as string[]).not.toContain(retired);
    }
  });

  it("keeps the services a candidate's journey with Go Gulf needs, ending in the referral", () => {
    const ids = SERVICES.map((s) => s.id);
    for (const id of ["counselling", "job-applications", "profile-preparation", "document-preparation", "ra-referral"]) expect(ids).toContain(id);
  });

  it("records the referral model as verified and direct placement as refuted", () => {
    expect(CLAIMS.raReferralModel.status).toBe("verified");
    expect(CLAIMS.directPlacement.status).toBe("refuted");
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
