import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The server accepts only a service a public form actually offers (28 Sep 2026):
 * the candidate and employer services, and "Other / Not Sure". Retired names from a stale
 * page and values a client makes up are refused by /api/forms/service-inquiry itself.
 *
 * Both public forms post there: the Services page form (any of the three groups) and the
 * Employer requirement form (employer services only, English value, translated label).
 */

vi.mock("server-only", () => ({}));
const send = vi.fn(async (_input: unknown) => ({ ok: true as const }));
vi.mock("@/lib/email/send", () => ({ sendServiceInquiryEmails: (input: unknown) => send(input) }));

import { POST } from "@/app/api/forms/service-inquiry/route";
import { SERVICES } from "@/content/services";
import { recipientForService } from "@/lib/email/config";
import { __resetRateLimits } from "@/lib/rate-limit";
import { serviceInquirySchema } from "./schemas";
import { CANDIDATE_SERVICES, EMPLOYER_SERVICES, INQUIRY_SERVICES, OTHER_SERVICE, isInquiryService } from "./service-options";

const base = { from_name: "Ravi Kumar", reply_to: "ravi@example.com", phone: "+919936309015", consent: true };

// Names the server used to accept and must now refuse.
const RETIRED = [
  "Air Ticket & Travel Assistance", // replaced 27 Sep 2026 — Go Gulf is not a travel agency
  "Post-Joining Support", // offered by no form since the redesign
  "Overseas Recruitment", // renamed 12 Sep 2026
  "Gulf Job Placement",
  "Bulk Manpower Recruitment",
  "Recruitment Process Outsourcing",
  "HR & Recruitment Support",
  "MOFA & Embassy Processing",
  // retired 6 Oct 2026 (D13): the recruiting agent's work, not a Go Gulf service
  "Flight & Joining Support (Selected Candidates)",
  "Visa & Documentation Assistance",
  "Interview Coordination",
  "Medical Coordination",
  "Job Matching",
  "Bulk Candidate Sourcing",
  "Candidate Screening",
  "Employer Hiring Solutions",
  "HR Support",
];

const UNKNOWN = [
  "Tour Package",
  "Visa Only",
  "Flight Booking",
  "anything",
  "job matching", // case matters: forms send the exact name
  "Job Matching (urgent)",
  "Gulf Job Applications; DROP TABLE x",
  "<script>alert(1)</script>",
  "Other",
];

let ip = 0;
async function post(body: Record<string, unknown>) {
  const request = new Request("http://localhost/api/forms/service-inquiry", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": `198.51.100.${++ip % 250}` },
    body: JSON.stringify(body),
  });
  const response = await POST(request);
  return { status: response.status, body: (await response.json()) as { ok: boolean; fieldErrors?: Record<string, string[]> } };
}

beforeEach(() => {
  send.mockClear();
  __resetRateLimits();
});

describe("the accepted service list", () => {
  it("is exactly what the public forms offer, plus the general option", () => {
    const offered = SERVICES.map((s) => s.inquiryOption).filter((o): o is string => Boolean(o));
    expect(new Set(INQUIRY_SERVICES)).toEqual(new Set([...offered, OTHER_SERVICE]));
    expect(INQUIRY_SERVICES).toHaveLength(offered.length + 1);
  });

  it("gives the employer form only employer services, and routes them to the business desk", () => {
    const employer = SERVICES.filter((s) => s.audience === "employers").map((s) => s.inquiryOption);
    expect(new Set(employer)).toEqual(new Set(EMPLOYER_SERVICES));
    for (const service of EMPLOYER_SERVICES) expect(recipientForService(service)).not.toBe(recipientForService(CANDIDATE_SERVICES[0]));
  });

  it("no longer contains any retired name", () => {
    for (const name of RETIRED) expect(isInquiryService(name), name).toBe(false);
  });
});

describe("serviceInquirySchema — service_type", () => {
  it.each([...INQUIRY_SERVICES])("accepts %s", (service) => {
    const parsed = serviceInquirySchema.safeParse({ ...base, service_type: service });
    expect(parsed.success).toBe(true);
  });

  it("accepts a valid name with stray whitespace, stored cleaned", () => {
    const parsed = serviceInquirySchema.safeParse({ ...base, service_type: "  Profile  &   CV Preparation " });
    expect(parsed.success && parsed.data.service_type).toBe("Profile & CV Preparation");
  });

  it.each([...RETIRED, ...UNKNOWN])("refuses %s", (service) => {
    const parsed = serviceInquirySchema.safeParse({ ...base, service_type: service });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues.map((i) => i.message)).toEqual(["forms.validation.serviceUnknown"]);
  });

  it("still reports a missing service as missing", () => {
    for (const service of ["", "   "]) {
      const parsed = serviceInquirySchema.safeParse({ ...base, service_type: service });
      expect(parsed.success).toBe(false);
      if (!parsed.success) expect(parsed.error.issues[0]?.message).toBe("forms.validation.serviceRequired");
    }
    expect(serviceInquirySchema.safeParse({ ...base }).success).toBe(false);
  });
});

describe("POST /api/forms/service-inquiry — enforced on the server", () => {
  it("delivers an enquiry for a current candidate service", async () => {
    const { status, body } = await post({ ...base, service_type: "Referral to a Registered Recruiting Agent", page_source: "Services Page" });
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("delivers an enquiry for Other / Not Sure", async () => {
    const { status } = await post({ ...base, service_type: OTHER_SERVICE, page_source: "Services Page" });
    expect(status).toBe(200);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("delivers the employer requirement form's submission, as that form sends it", async () => {
    const { status } = await post({
      service_type: "Introduce a Hiring Requirement",
      from_name: "Priya Shah",
      reply_to: "hr@example.com",
      phone: "+971501234567",
      country: "United Arab Emirates",
      message: "Company: Example LLC\nWork location: Dubai, United Arab Emirates\nRoles and trades: Masons\nTotal headcount: 40",
      page_source: "Employers Page",
      website: "",
      consent: true,
    });
    expect(status).toBe(200);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ service_type: "Introduce a Hiring Requirement", page_source: "Employers Page" }));
    expect(recipientForService("Introduce a Hiring Requirement")).toBe(recipientForService("Hiring Process Guidance"));
  });

  it.each([...RETIRED, ...UNKNOWN])("refuses %s with 400 and sends nothing", async (service) => {
    const { status, body } = await post({ ...base, service_type: service, page_source: "Services Page" });
    expect(status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.fieldErrors?.service_type).toEqual([
      "Choose one of the services in the list. The page may be out of date — reload it and choose again.",
    ]);
    expect(send).not.toHaveBeenCalled();
  });

  it("refuses a retired service even when every other field is valid and the honeypot is empty", async () => {
    const { status } = await post({ ...base, service_type: "Air Ticket & Travel Assistance", country: "Qatar", message: "Need a ticket", website: "" });
    expect(status).toBe(400);
    expect(send).not.toHaveBeenCalled();
  });

  it("refuses a non-string service", async () => {
    for (const service of [42, null, ["Job Matching"], { value: "Job Matching" }]) {
      const { status } = await post({ ...base, service_type: service });
      expect(status).toBe(400);
    }
    expect(send).not.toHaveBeenCalled();
  });
});
