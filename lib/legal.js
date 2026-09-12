// ===== GO GULF — legal entity, policy dates & policy constants =====
// Single source of truth for the operating company's legal identity and for
// every number quoted in the policy pages. Anything here appears verbatim on
// /privacy-policy, /terms-and-conditions, /cancellation-and-refunds,
// /shipping-policy, the Contact page and the footer — change it once here and
// it changes everywhere.
//
// PROVENANCE (updated 5 September 2026):
//   * Company name, CIN, type, classification, incorporation date, ROC,
//     registration number, capital, directors, business activity, status and
//     the registered office are transcribed from the company's MCA record.
//     That record is authoritative for the legal entity's identity.
//   * The GSTIN is carried forward from the previous GST-derived data at the
//     company's instruction, pending the GST certificate. See GSTIN note below.
//   * Nothing here is estimated. A detail that is not evidenced is absent
//     rather than guessed.
//   * The company is NOT registered or licensed as a recruiting agent
//     (confirmed by the business, 12 Sep 2026). There is no licence field here
//     and the site must never claim or imply one — company registration (the
//     CIN) is not recruitment-agency licensing. See content/company.ts CLAIMS.

export const LEGAL_ENTITY = {
  /** Registered legal name per the MCA record (title-cased for display). */
  name: "Faizan Chaudhary Gulf Travels Private Limited",
  shortName: "Faizan Chaudhary Gulf Travels Pvt. Ltd.",
  tradeName: "Faizan Chaudhary Gulf Travels Private Limited",

  /** Corporate Identity Number — publicly verifiable on the MCA portal. */
  cin: "U52291UP2024PTC198095",
  /** MCA wording. `constitution` below is the descriptive term used in prose. */
  companyType: "Private Company",
  classification: "Non-Government Company",
  constitution: "Private Limited Company",
  incorporationDate: "22 February 2024",
  incorporationISO: "2024-02-22",
  roc: "Registrar of Companies (ROC), ROC-Uttar Pradesh I",
  registrationNumber: "198095",
  businessActivity: "Activities of travel agents and tour operators",
  status: "Active",

  // GSTIN — retained at the company's instruction (5 Sep 2026).
  // Its only documentary support is a prior transcription note referencing a
  // GST Registration Certificate (Form GST REG-06) that has not been supplied
  // to this project. See docs/LEGAL-DATA-MIGRATION.md §3 for the open question
  // about whether it belongs to this entity. Update it HERE and every page
  // follows; do not hardcode a GSTIN anywhere else.
  gstin: "09AALCC6656L1ZY",
  gstRegistrationType: "Regular",
  gstRegisteredOn: "9 May 2024",

  /** Consumer-facing brand this website trades under. */
  brand: "Go Gulf",
};

/**
 * Public MCA facts, recorded for completeness.
 *
 * DELIBERATELY NOT RENDERED ON THE PUBLIC SITE. There is no legal requirement
 * to publish share capital, and a candidate weighing a significant placement
 * fee is not helped by seeing it. Available here if a filing or a partner
 * questionnaire ever needs it.
 */
export const CORPORATE_DETAILS = {
  authorisedCapitalINR: 100000,
  paidUpCapitalINR: 10000,
  /** Directors / KMP per the MCA record. Display is a business decision. */
  directors: ["Faizan Chaudhary", "Ruksana Chaudhary"],
};

/**
 * Registered office as recorded at the MCA, kept whole and structured:
 *   C/o Asha Yadav, G No-364, Mishrapur Kursi Road, Jankipuram, Lucknow,
 *   Uttar Pradesh, India, 226021
 *
 * PUBLIC DISPLAY (business instruction, 12 Sep 2026): the website shows the
 * address WITHOUT the record's care-of line — a private individual's name.
 * `careOf` stays here so the record remains complete for filings and
 * cross-checks, but nothing public reads it: every page, the structured data,
 * llms.txt and the emails use `lines` (through ADDRESS_LINES /
 * ADDRESS_ONE_LINE). content/public-claims.test.ts fails if it reaches a
 * public string. The plot number is part of the public address.
 *
 * Approved public presentation:
 *   G No-364, Mishrapur
 *   Kursi Road, Jankipuram
 *   Lucknow, Uttar Pradesh – 226021
 *   India
 */
export const REGISTERED_ADDRESS = {
  /** Part of the MCA record. Never displayed. */
  careOf: "C/o Asha Yadav",
  premises: "G No-364",
  street: "Mishrapur Kursi Road",
  area: "Jankipuram",
  /** The public street lines, in the approved presentation. */
  lines: ["G No-364, Mishrapur", "Kursi Road, Jankipuram"],
  locality: "Lucknow",
  district: "Lucknow",
  region: "Uttar Pradesh",
  postalCode: "226021",
  country: "India",
  countryCode: "IN",
};

/** Address rendered as display lines, e.g. for an <address> block. */
export const ADDRESS_LINES = [
  ...REGISTERED_ADDRESS.lines,
  `${REGISTERED_ADDRESS.locality}, ${REGISTERED_ADDRESS.region} – ${REGISTERED_ADDRESS.postalCode}`,
  REGISTERED_ADDRESS.country,
];

/** Same address on one line, for inline prose inside the policies. */
export const ADDRESS_ONE_LINE = ADDRESS_LINES.join(", ");

/**
 * BUSINESS HERITAGE — deliberately separate from the legal entity above.
 *
 * The company was incorporated on 22 February 2024. The business has operated
 * in the travel and overseas-recruitment field since 2008. Both are true, and
 * conflating them is not: claiming the company was founded in 2008 would
 * contradict the MCA record.
 *
 * So: `LEGAL_ENTITY.incorporationISO` is the company's founding date and is
 * what structured data asserts. This constant carries the heritage claim as
 * marketing copy, phrased so it describes experience rather than incorporation.
 *
 * Wording is pending the company's confirmation of the underlying history —
 * see docs/LEGAL-DATA-MIGRATION.md §7.
 */
export const BUSINESS_HERITAGE = {
  sinceYear: 2008,
  /** Describes experience, never the company's founding. */
  statement: "Serving the industry since 2008",
  longStatement:
    "Built on industry experience since 2008. Faizan Chaudhary Gulf Travels Private Limited was incorporated in 2024.",
};

// Date the current wording of the policy pages took effect. Bump both values
// together whenever a policy's substance changes.
// 2026-09-05: operating company identity updated to the MCA record.
// 2026-09-06: email processor changed from EmailJS to Resend.
// 2026-09-12: registered office shown without the care-of line; the unapproved
//             "1–2 business days" response time, "no hidden charges" and
//             "genuine, screened opportunities" statements removed; wording that
//             implied recruiting-agent status made neutral (intent unchanged);
//             the obsolete Google Fonts processor entry removed (fonts are
//             self-hosted).
export const POLICY_EFFECTIVE_DATE = "12 September 2026";
export const POLICY_EFFECTIVE_ISO = "2026-09-12";

// ---------------------------------------------------------------------------
// Refund timing.
//
// DELIBERATELY the only duration on the legal pages, and it is NOT a Go Gulf
// service-level promise: it describes how the payment gateway and the banking
// rail actually behave once a refund has been initiated. No internal
// acknowledge/decide/initiate SLA is published, because the company has not
// committed to one — the policy says instead that requests are reviewed on
// their facts and that any agreed timelines live in the written service
// agreement. Do not reintroduce invented day-counts here.
// ---------------------------------------------------------------------------
export const REFUND_BANK_CREDIT_WINDOW = "5–7 working days";

/**
 * Courts whose exclusive jurisdiction the Terms specify.
 * BUSINESS DECISION, confirmed by the company — chosen because it is the seat
 * of the company. It is not derived from the GST registration, which evidences
 * the place of business only, not a contractual forum.
 */
export const JURISDICTION_CITY = "Lucknow, Uttar Pradesh";

// ---------------------------------------------------------------------------
// NO FEE-PAYER CONSTANT ON PURPOSE.
//
// Nothing in this repository or in the site copy establishes who bears Go
// Gulf's service fees. The only pre-existing fee statement anywhere on the site
// is "No Hidden Charges / 100% transparent" (app/about/page.js, app/page.js) —
// which says fees are disclosed, not who pays them or whether a given service
// carries one at all.
//
// Go Gulf sells to two distinct audiences: candidates (overseas recruitment,
// documentation, visa/medical/travel coordination) and employers (hiring
// solutions, bulk manpower, RPO, screening, HR support). Those are separate
// engagements on separate commercial terms.
//
// /pricing therefore describes the two arrangements and the quotation process,
// and asserts NOTHING about amounts or about who is or is not charged. Do not
// add a constant here claiming one side is free unless it is evidenced.
// ---------------------------------------------------------------------------

/** The policy pages, in the order they are cross-linked and listed in the footer. */
export const LEGAL_PAGES = [
  { label: "Privacy Policy", path: "/privacy-policy" },
  { label: "Terms & Conditions", path: "/terms-and-conditions" },
  { label: "Pricing & Fees", path: "/pricing" },
  { label: "Cancellation & Refunds", path: "/cancellation-and-refunds" },
  { label: "Shipping & Delivery Policy", path: "/shipping-policy" },
];
