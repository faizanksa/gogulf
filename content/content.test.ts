import { describe, expect, it } from "vitest";
import { z } from "zod";
import { CHANNELS, CONFIRMED_SOCIAL } from "./channels";
import { CLAIMS } from "./company";
import { JOBS, getJob, jobIsClosed, openJobs, visibleJobs, type Job } from "./jobs";
import { PAGES } from "./pages";
import { validate } from "./schema";
import { TRAVEL_PUBLISHED, TRAVEL_SERVICES } from "./travel";
import { jobPostingJsonLd } from "@/lib/job-posting";
import { organizationJsonLd } from "@/lib/seo";

describe("content validation fails loudly", () => {
  it("reports the path of every invalid field", () => {
    expect(() => validate(z.object({ a: z.number() }), { a: "x" }, "test.ts")).toThrow(/Invalid content in test\.ts:\n {2}- a:/);
  });
});

describe("jobs", () => {
  it("has unique slugs", () => {
    expect(new Set(JOBS.map((j) => j.slug)).size).toBe(JOBS.length);
  });

  it("never computes an expiry — a job without closesOn is open, never 'expired'", () => {
    const noClose = JOBS.find((j) => j.closesOn === null)!;
    expect(jobIsClosed(noClose, new Date("2099-01-01"))).toBe(false);
  });

  it("closes at the end of its closing day", () => {
    const j = { ...JOBS[0]!, closesOn: "2026-09-15" } as Job;
    expect(jobIsClosed(j, new Date("2026-09-15T12:00:00Z"))).toBe(false);
    expect(jobIsClosed(j, new Date("2026-09-16T00:00:01Z"))).toBe(true);
  });

  it("excludes unconfirmed jobs from production and shows them elsewhere", () => {
    const unconfirmed = JOBS.filter((j) => j.verification === "unconfirmed");
    expect(unconfirmed.length).toBeGreaterThan(0);
    expect(visibleJobs("production").some((j) => j.verification === "unconfirmed")).toBe(false);
    expect(visibleJobs("staging").length).toBe(JOBS.length);
    expect(getJob(unconfirmed[0]!.slug, "production")).toBeNull();
    expect(openJobs("production").length).toBe(0);
  });

  it("emits no JobPosting for an unconfirmed job", () => {
    for (const j of JOBS.filter((x) => x.verification === "unconfirmed")) expect(jobPostingJsonLd(j)).toBeNull();
  });

  it("emits JobPosting only with an explicit closing date and an employer disclosure", () => {
    const base = { ...JOBS[0]!, verification: "confirmed" as const };
    expect(jobPostingJsonLd({ ...base, closesOn: null, employer: { disclosure: "confidential" } })).toBeNull();
    expect(jobPostingJsonLd({ ...base, closesOn: "2026-10-01", employer: null })).toBeNull();
    const posting = jobPostingJsonLd({ ...base, closesOn: "2026-10-01", employer: { disclosure: "confidential" } });
    expect(posting).toMatchObject({ "@type": "JobPosting", validThrough: "2026-10-01T23:59:59+05:30", directApply: true });
  });
});

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
    expect(org["@type"]).toBe("EmploymentAgency");
    expect(JSON.stringify(org)).not.toMatch(/2008|placement|MOFA|verified/i);
    // No social profile is confirmed yet, so there is no sameAs.
    expect(CONFIRMED_SOCIAL).toEqual([]);
    expect(org).not.toHaveProperty("sameAs");
  });

  it("keeps every unresolved claim flagged", () => {
    for (const id of ["recruitingAgentRegistration", "heritage2008", "placementNumbers", "officesOutsideLucknow", "countriesRecruitedFor", "sectors", "employerVerification", "responseTimeSla", "travelServices", "socialProfiles", "gstCertificate"] as const) {
      expect(CLAIMS[id].status).toBe("unresolved");
    }
  });

  it("records the unreachable X profile rather than linking it", () => {
    expect(CHANNELS.find((c) => c.id === "x")?.status).toBe("not-found");
  });
});
