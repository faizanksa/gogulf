import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RaPartnerList, type RaPartnerListText, type RaPartnerRow } from "@/components/site/RaPartnerList";
import { createTranslator } from "@/lib/i18n/translator";
import {
  EMIGRATE_URL,
  PARTNER_DISPLAY,
  PARTNERS,
  partnerForJob,
  partnerListSchema,
  publicPartnerForJob,
  publicPartners,
  publishedPartners,
  RA_LIST_URL,
  type RaPartner,
} from "./partners";

// Made-up test data. Never copy these into content/partners.ts.
const partner = (overrides: Partial<RaPartner> = {}): RaPartner => ({
  id: "test-agent",
  name: "Test Agent Pvt Ltd",
  city: "Mumbai",
  raRegistrationNumber: "TEST-RA-0001",
  active: true,
  jobReferences: [],
  ...overrides,
});

describe("the partner list as shipped", () => {
  it("is empty until the business confirms its partners: nothing is invented", () => {
    expect(PARTNERS).toEqual([]);
    expect(publishedPartners()).toEqual([]);
  });

  it("hides partners from the public site, by the client's decision", () => {
    expect(PARTNER_DISPLAY).toBe("hidden");
    expect(publicPartners()).toEqual([]);
  });

  it("links the official sources, over HTTPS, on government domains", () => {
    expect(EMIGRATE_URL).toBe("https://www.emigrate.gov.in/");
    expect(new URL(RA_LIST_URL).hostname).toBe("www.mea.gov.in");
  });
});

describe("partner schema", () => {
  it("accepts a complete partner, and a minimal one", () => {
    expect(
      partnerListSchema.safeParse([partner({ validUntil: "2030-12-31", website: "https://agent.example", capacity: "1000+", jobReferences: ["gg-job-2026-0001"] })]).success,
    ).toBe(true);
    expect(partnerListSchema.safeParse([{ id: "a", name: "Agent A", city: "Delhi", raRegistrationNumber: "RA-1", active: false }]).success).toBe(true);
  });

  it("refuses a partner without an RA registration number, name or city", () => {
    for (const field of ["raRegistrationNumber", "name", "city"] as const) {
      const { [field]: _omit, ...rest } = partner();
      expect(partnerListSchema.safeParse([rest]).success, field).toBe(false);
      expect(partnerListSchema.safeParse([{ ...rest, [field]: "  " }]).success, field).toBe(false);
    }
  });

  it("refuses a malformed date, an insecure website, an empty capacity and a missing active flag", () => {
    expect(partnerListSchema.safeParse([partner({ validUntil: "31/12/2030" })]).success).toBe(false);
    expect(partnerListSchema.safeParse([partner({ website: "http://agent.example" })]).success).toBe(false);
    expect(partnerListSchema.safeParse([partner({ capacity: " " })]).success).toBe(false);
    const { active: _omit, ...noFlag } = partner();
    expect(partnerListSchema.safeParse([noFlag]).success).toBe(false);
  });

  it("refuses duplicate ids, duplicate RA numbers and a job given to two agents", () => {
    expect(partnerListSchema.safeParse([partner(), partner({ raRegistrationNumber: "OTHER" })]).success).toBe(false);
    expect(partnerListSchema.safeParse([partner(), partner({ id: "other", raRegistrationNumber: "test-ra-0001" })]).success).toBe(false);
    expect(
      partnerListSchema.safeParse([partner({ jobReferences: ["GG-1"] }), partner({ id: "other", raRegistrationNumber: "OTHER", jobReferences: ["gg-1"] })]).success,
    ).toBe(false);
  });
});

describe("published partners", () => {
  const now = new Date("2026-10-06T12:00:00+05:30");

  it("are only the active partners whose registration has not expired", () => {
    const list = [
      partner({ id: "live" }),
      partner({ id: "inactive", active: false }),
      partner({ id: "expired", validUntil: "2026-10-05" }),
      partner({ id: "today", validUntil: "2026-10-06" }),
    ];
    expect(publishedPartners(list, now).map((p) => p.id)).toEqual(["live", "today"]);
  });

  it("find a job's agent by its reference, ignoring case, and never an unpublished one", () => {
    const list = [partner({ jobReferences: ["GG-JOB-1"] }), partner({ id: "off", raRegistrationNumber: "OFF", active: false, jobReferences: ["GG-JOB-2"] })];
    expect(partnerForJob(" gg-job-1 ", list, now)?.id).toBe("test-agent");
    expect(partnerForJob("GG-JOB-2", list, now)).toBeNull();
    expect(partnerForJob("GG-JOB-3", list, now)).toBeNull();
  });
});

describe("public partners: what any public page, llms.txt or job page may name", () => {
  const now = new Date("2026-10-06T12:00:00+05:30");
  const list = [partner({ jobReferences: ["GG-JOB-1"] }), partner({ id: "second", name: "Second Agent LLP", raRegistrationNumber: "TEST-RA-0002" })];

  it("hidden: none, and no job names its agent, even with published partners on record", () => {
    expect(publishedPartners(list, now)).toHaveLength(2);
    expect(publicPartners(list, now, "hidden")).toEqual([]);
    expect(publicPartnerForJob("GG-JOB-1", list, now, "hidden")).toBeNull();
  });

  it("named: the published partners, and the job's agent", () => {
    expect(publicPartners(list, now, "named").map((p) => p.id)).toEqual(["test-agent", "second"]);
    expect(publicPartnerForJob("GG-JOB-1", list, now, "named")?.name).toBe("Test Agent Pvt Ltd");
    expect(publicPartners([partner({ active: false })], now, "named")).toEqual([]);
  });
});

describe("partner block rendering", () => {
  const t = createTranslator("en");
  const text: RaPartnerListText = {
    disclosure: t("partners.disclosure"),
    empty: t("partners.empty"),
    city: t("partners.city"),
    raNumber: t("partners.raNumber"),
    validUntil: t("partners.validUntil"),
    website: t("partners.website"),
    opensInNewTab: t("common.opensInNewTab"),
    check: "Check any agent on the official list.",
  };
  const rows: RaPartnerRow[] = [
    { id: "a", name: "Agent A", city: "Pune", raNumber: "RA-AAA" },
    { id: "b", name: "Agent B", city: "Delhi", raNumber: "RA-BBB", website: "https://agent-b.example/" },
  ];
  const render = (display: "hidden" | "named", partners: RaPartnerRow[]) => renderToStaticMarkup(createElement(RaPartnerList, { display, partners, text }));

  it("states the written-disclosure promise", () => {
    expect(text.disclosure).toBe(
      "We work with registered recruiting agents. Before you pay anything, we give you in writing the agent's name, registration number, and who is responsible for what.",
    );
  });

  it("hidden: renders no partner name, number, city or website even if partners are passed", () => {
    const html = render("hidden", rows);
    for (const leak of ["Agent A", "Agent B", "RA-AAA", "RA-BBB", "Pune", "Delhi", "agent-b.example", text.raNumber, text.empty]) {
      expect(html, leak).not.toContain(leak);
    }
    expect(html).not.toContain("<ul");
    expect(html).toContain("Before you pay anything, we give you in writing the agent&#x27;s name, registration number, and who is responsible for what.");
    expect(html).toContain("Check any agent on the official list.");
  });

  it("named, with no partner yet: says so honestly, with no placeholder, and keeps the promise", () => {
    const html = render("named", []);
    expect(html).toContain("We refer candidates to registered recruiting agents. Our current partner list is being confirmed and will be published here.");
    expect(html).not.toContain("<ul");
    expect(html).toContain("who is responsible for what");
  });

  it("named, with several partners: each with its RA number directly under its name", () => {
    const html = render("named", rows);
    expect(html).not.toContain(text.empty);
    expect(html.match(/<li/g)).toHaveLength(2);
    expect(html).toMatch(/Agent A<\/p><p[^>]*>RA registration number: <bdi dir="ltr">RA-AAA<\/bdi><\/p>/);
    expect(html).toMatch(/Agent B<\/p><p[^>]*>RA registration number: <bdi dir="ltr">RA-BBB<\/bdi><\/p>/);
    expect(html).toContain('href="https://agent-b.example/" target="_blank" rel="noopener noreferrer"');
    expect(html).toContain("who is responsible for what");
  });
});
