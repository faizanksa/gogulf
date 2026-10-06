import { afterEach, describe, expect, it, vi } from "vitest";
import type { PartnerDisplay, RaPartner } from "@/content/partners";

/**
 * llms.txt in both partner display modes, with partners ON RECORD — so the hidden test
 * proves the route reads partners only through publicPartners(), not that the list is empty.
 */

// Made-up test data. Never copy these into content/partners.ts.
const ON_RECORD: RaPartner[] = [
  { id: "test-agent", name: "Test Agent Pvt Ltd", city: "Mumbai", raRegistrationNumber: "TEST-RA-0001", active: true, jobReferences: [] },
];

async function llms(display: PartnerDisplay): Promise<string> {
  vi.resetModules();
  vi.doMock("@/content/partners", async (importOriginal) => {
    const real = await importOriginal<typeof import("@/content/partners")>();
    return {
      ...real,
      PARTNERS: ON_RECORD,
      PARTNER_DISPLAY: display,
      publicPartners: (list = ON_RECORD, now = new Date(), mode: PartnerDisplay = display) => real.publicPartners(list, now, mode),
    };
  });
  const { GET } = await import("./route");
  return GET().text();
}

afterEach(() => {
  vi.doUnmock("@/content/partners");
});

describe("llms.txt", () => {
  it("hidden: names no partner, gives no number or city, and states the written disclosure", async () => {
    const text = await llms("hidden");
    for (const leak of ["Test Agent", "TEST-RA-0001", "Mumbai"]) expect(text, leak).not.toContain(leak);
    expect(text).toContain("Go Gulf does not publish the names of the recruiting agents it works with.");
    expect(text).toContain("Before a candidate pays anything, Go Gulf gives them in writing the agent's name, registration number, and who is responsible for what.");
    expect(text).toContain("Go Gulf is not registered as a recruiting agent.");
  });

  it("named: lists each published partner with its registration number", async () => {
    const text = await llms("named");
    expect(text).toContain("Registered recruiting-agent partners: Test Agent Pvt Ltd (Mumbai), RA registration TEST-RA-0001.");
  });
});
