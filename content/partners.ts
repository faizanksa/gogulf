import { z } from "zod";
import { isoDate, slug, validate } from "./schema";

/**
 * Registered recruiting-agent (RA) partners.
 *
 * Go Gulf is NOT a registered recruiting agent (content/company.ts CLAIMS). It counsels
 * job seekers, helps prepare their profile and documents, and refers them to recruiting
 * agents registered under the Emigration Act, 1983. Those agents run interviews, offers,
 * visa processing and the collection of their statutory service charge.
 *
 * This list is what the site publishes about those agents. It starts EMPTY on purpose:
 * the partner list is not final, and nothing here may be invented. While it is empty the
 * site says so plainly ("…being confirmed and will be published here"), and no page shows
 * a placeholder partner.
 *
 * HOW TO ADD A PARTNER (only from details the business has confirmed in writing):
 *   1. Check the agent on the official list of active recruiting agents (RA_LIST_URL
 *      below) and copy the registration number exactly as it appears there.
 *   2. Add an entry to PARTNER_DATA:
 *        {
 *          id: "example-agent",                 // lowercase-hyphenated, never changes
 *          name: "Agent's registered name",
 *          city: "Mumbai",
 *          raRegistrationNumber: "B-0000/MUM/PER/…", // exactly as registered
 *          validUntil: "2030-12-31",            // optional: registration expiry
 *          website: "https://…",                // optional
 *          active: true,                        // false hides it without deleting it
 *          jobReferences: ["GG-JOB-2026-0001"], // optional: jobs this agent handles
 *        },
 *   3. Run `npm test` (the schema rejects a malformed entry) and deploy.
 * A partner is shown only while `active` is true AND its `validUntil` (if any) has not
 * passed. To withdraw one, set `active: false`.
 */

/** The official eMigrate portal of the Ministry of External Affairs. */
export const EMIGRATE_URL = "https://www.emigrate.gov.in/";

/**
 * Where the Ministry of External Affairs publishes the district- and state-wise list of
 * active recruiting agents (a dated PDF linked from this page, replaced as it is updated —
 * so the stable page is linked, not the file). Confirmed 6 Oct 2026.
 */
export const RA_LIST_URL = "https://www.mea.gov.in/overseas-employment.htm";

const partner = z.object({
  id: slug,
  name: z.string().trim().min(2).max(160),
  city: z.string().trim().min(2).max(80),
  /** Exactly as it appears on the official list. Never empty: a partner without one is not shown. */
  raRegistrationNumber: z.string().trim().min(3).max(80),
  validUntil: isoDate.optional(),
  website: z.string().url().startsWith("https://").optional(),
  active: z.boolean(),
  /** References of the jobs (GG-JOB-…) whose applications go to this agent. */
  jobReferences: z.array(z.string().trim().toUpperCase().min(3)).default([]),
});

export type RaPartner = z.infer<typeof partner>;

export const partnerListSchema = z.array(partner).superRefine((list, ctx) => {
  const ids = new Set<string>();
  const numbers = new Set<string>();
  const jobs = new Map<string, string>();
  list.forEach((p, i) => {
    if (ids.has(p.id)) ctx.addIssue({ code: "custom", message: `Duplicate id ${p.id}`, path: [i, "id"] });
    const number = p.raRegistrationNumber.toUpperCase();
    if (numbers.has(number)) ctx.addIssue({ code: "custom", message: `Duplicate RA registration number ${p.raRegistrationNumber}`, path: [i, "raRegistrationNumber"] });
    for (const ref of p.jobReferences) {
      const owner = jobs.get(ref);
      if (owner) ctx.addIssue({ code: "custom", message: `Job ${ref} is already assigned to ${owner}`, path: [i, "jobReferences"] });
      jobs.set(ref, p.id);
    }
    ids.add(p.id);
    numbers.add(number);
  });
});

/** The confirmed partners. EMPTY until the business confirms them — see the steps above. */
const PARTNER_DATA: z.input<typeof partnerListSchema> = [];

export const PARTNERS: RaPartner[] = validate(partnerListSchema, PARTNER_DATA, "content/partners.ts");

/** Today in India, as YYYY-MM-DD — registrations expire by the Indian calendar date. */
function indianToday(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(now);
}

/** Partners the public may see: active, and not past their registration's expiry. */
export function publishedPartners(list: RaPartner[] = PARTNERS, now: Date = new Date()): RaPartner[] {
  const today = indianToday(now);
  return list.filter((p) => p.active && (!p.validUntil || p.validUntil >= today));
}

/** The published partner handling a job, if one is recorded for its reference. */
export function partnerForJob(reference: string, list: RaPartner[] = PARTNERS, now: Date = new Date()): RaPartner | null {
  const ref = reference.trim().toUpperCase();
  return publishedPartners(list, now).find((p) => p.jobReferences.includes(ref)) ?? null;
}
