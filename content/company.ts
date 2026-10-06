import { z } from "zod";
import { ADDRESS_LINES, LEGAL_ENTITY, REGISTERED_ADDRESS, VISITOR_ADDRESS } from "@/lib/legal";
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
  shortName: LEGAL_ENTITY.shortName,
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
  /**
   * WHERE THE LEGAL NAME AND REGISTERED OFFICE MAY APPEAR (client decision, 6 Oct 2026):
   * the footer (once, compact), /verify, /about, the policy pages that identify the
   * contracting party, email footers, and the Organization structured data / llms.txt that
   * describe the same company. Nowhere else: the brand is the face of the site.
   * content/public-claims.test.ts enforces the list. The address itself is configured in
   * lib/legal.js REGISTERED_ADDRESS.
   */
  /** Optional separate address for visitors (lib/legal.js VISITOR_ADDRESS); unused while null. */
  visitorAddress: VISITOR_ADDRESS,
  website: "www.gogulf.co",
  /** Replaced "Go Gulf. Get Hired." (6 Oct 2026): Go Gulf does not hire or place anyone. Pending client approval. */
  tagline: "Go Gulf. Go prepared.",
} as const;

/**
 * verified    evidenced; may appear in copy, structured data and llms.txt
 * unresolved  not evidenced yet; kept out of production
 * refuted     confirmed untrue; must never be stated or implied anywhere
 */
const claim = z.object({
  status: z.enum(["verified", "unresolved", "refuted"]),
  decision: z.string().optional(),
  note: z.string(),
});

export const CLAIMS = validate(
  z.object({
    feesQuotedInWriting: claim,
    recruitingAgentRegistration: claim,
    raReferralModel: claim,
    directPlacement: claim,
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
    recruitingAgentRegistration: { status: "refuted", decision: "D1", note: "The company is not registered or licensed as a recruiting agent (confirmed by the business, 12 Sep 2026). Company registration (CIN) is not recruitment-agency licensing; no page, schema or translation may claim or imply otherwise." },
    raReferralModel: { status: "verified", decision: "D13", note: "Go Gulf counsels job seekers, helps prepare their profile and documents, and refers them to recruiting agents registered under the Emigration Act, 1983 (several, in Mumbai and Delhi), who run interviews, offers, visa processing and statutory fee collection (confirmed by the client, 6 Oct 2026). The partner list is NOT final: partners are published only from content/partners.ts." },
    directPlacement: { status: "refuted", decision: "D13", note: "Go Gulf does not place candidates, select them, issue offers, arrange visas or collect the recruiting agent's service charge (confirmed by the client, 6 Oct 2026). No page may say or imply that it does." },
    heritage2008: { status: "unresolved", decision: "D3", note: "Whose experience dates to 2008, and under what name. Never the company's founding (incorporated 22 Feb 2024)." },
    placementNumbers: { status: "unresolved", decision: "D3", note: "No evidence for any placement figure." },
    officesOutsideLucknow: { status: "unresolved", decision: "D3", note: "Sharjah and Jeddah appeared only in the old share image." },
    countriesRecruitedFor: { status: "unresolved", decision: "D3", note: "Which Gulf countries the business actually recruits for." },
    sectors: { status: "unresolved", decision: "D3", note: "Which sectors the business actually places into." },
    employerVerification: { status: "unresolved", decision: "D3", note: "No described employer-verification process." },
    responseTimeSla: { status: "unresolved", decision: "D3", note: "No committed response time." },
    travelServices: { status: "refuted", decision: "D2", note: "Go Gulf is not a travel agency: no flights, tours, bookings or visa services for the public (decided 27 Sep 2026; 0019). Since 6 Oct 2026 (D13) visa processing and travel for selected candidates are the registered recruiting agent's, not Go Gulf's, and may be described only as the agent's. The registered activity on the MCA record is reported as a fact on /verify, not as a service." },
    socialProfiles: { status: "unresolved", decision: "D3", note: "Ownership of the social profiles is not confirmed; see content/channels.ts." },
    gstCertificate: { status: "unresolved", decision: "D8", note: "GST certificate not supplied; GSTIN stays off structured data." },
  },
  "content/company.ts",
);

export type ClaimId = keyof typeof CLAIMS;

export function isVerified(id: ClaimId): boolean {
  return CLAIMS[id].status === "verified";
}
