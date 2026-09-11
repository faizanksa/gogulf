import { z } from "zod";
import { ADDRESS_LINES, LEGAL_ENTITY, REGISTERED_ADDRESS } from "@/lib/legal";
import { validate } from "./schema";

/**
 * Company facts and the claims register.
 *
 * FACTS come from lib/legal.js (the MCA record) and may be published.
 *
 * CLAIMS lists what the site would like to say but cannot yet evidence. Only claims
 * marked `verified` may appear in copy, structured data or llms.txt. Everything else
 * is kept out of production and, where it matters for review, shown on staging as an
 * explicitly flagged placeholder. Source: docs/REDESIGN-PLAN.md §10.
 */

export const COMPANY = {
  brand: LEGAL_ENTITY.brand,
  legalName: LEGAL_ENTITY.name,
  cin: LEGAL_ENTITY.cin,
  companyType: LEGAL_ENTITY.constitution,
  incorporationDate: LEGAL_ENTITY.incorporationDate,
  incorporationISO: LEGAL_ENTITY.incorporationISO,
  roc: LEGAL_ENTITY.roc,
  registeredActivity: LEGAL_ENTITY.businessActivity,
  status: LEGAL_ENTITY.status,
  /** Displayed on pages as instructed; NOT asserted in structured data until the GST certificate is supplied (D8). */
  gstin: LEGAL_ENTITY.gstin,
  address: REGISTERED_ADDRESS,
  addressLines: ADDRESS_LINES,
  website: "www.gogulf.co",
  tagline: "Go Gulf. Get Hired.",
} as const;

const claim = z.object({
  status: z.enum(["verified", "unresolved"]),
  decision: z.string().optional(),
  note: z.string(),
});

export const CLAIMS = validate(
  z.object({
    feesQuotedInWriting: claim,
    recruitingAgentRegistration: claim,
    heritage2008: claim,
    placementNumbers: claim,
    officesOutsideLucknow: claim,
    countriesRecruitedFor: claim,
    sectors: claim,
    employerVerification: claim,
    responseTimeSla: claim,
    travelServices: claim,
    socialProfiles: claim,
    gstCertificate: claim,
  }),
  {
    feesQuotedInWriting: { status: "verified", note: "The rule stated in the Pricing & Fees policy: no fee is payable unless quoted in writing first." },
    recruitingAgentRegistration: { status: "unresolved", decision: "D1", note: "Whether an overseas Recruiting Agent registration (Emigration Act) is held." },
    heritage2008: { status: "unresolved", decision: "D3", note: "Whose experience dates to 2008, and under what name. Never the company's founding (incorporated 22 Feb 2024)." },
    placementNumbers: { status: "unresolved", decision: "D3", note: "No evidence for any placement figure." },
    officesOutsideLucknow: { status: "unresolved", decision: "D3", note: "Sharjah and Jeddah appeared only in the old share image." },
    countriesRecruitedFor: { status: "unresolved", decision: "D3", note: "Which Gulf countries the business actually recruits for." },
    sectors: { status: "unresolved", decision: "D3", note: "Which sectors the business actually places into." },
    employerVerification: { status: "unresolved", decision: "D3", note: "No described employer-verification process." },
    responseTimeSla: { status: "unresolved", decision: "D3", note: "No committed response time." },
    travelServices: { status: "unresolved", decision: "D2", note: "Which travel/tour services are sold." },
    socialProfiles: { status: "unresolved", decision: "D3", note: "Ownership of the social profiles is not confirmed; see content/channels.ts." },
    gstCertificate: { status: "unresolved", decision: "D8", note: "GST certificate not supplied; GSTIN stays off structured data." },
  },
  "content/company.ts",
);

export type ClaimId = keyof typeof CLAIMS;

export function isVerified(id: ClaimId): boolean {
  return CLAIMS[id].status === "verified";
}
