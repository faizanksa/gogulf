// ===== GO GULF — legal entity, policy dates & policy constants =====
// Single source of truth for the operating company's legal identity and for
// every number quoted in the policy pages. Anything here appears verbatim on
// /privacy-policy, /terms-and-conditions, /cancellation-and-refunds,
// /shipping-policy, the Contact page and the footer — change it once here and
// it changes everywhere.
//
// STATUS (27 Aug 2026): the entity previously published here — its legal
// name, constitution, GSTIN, registration date and registered address — has
// been removed at the company's request. Go Gulf is being (re-)registered as
// its own legal entity and the correct details will be supplied once that is
// complete. Fill in the fields below from evidenced documents ONLY (e.g. a
// GST Registration Certificate / Form GST REG-06 or a Certificate of
// Incorporation) when that happens — do not guess or restore the old values.
//
// Every page that reads LEGAL_ENTITY / REGISTERED_ADDRESS is written to
// degrade gracefully while these are empty: it shows only the "Go Gulf"
// brand name and omits any legal-entity, GSTIN or registered-address line
// entirely, rather than rendering blanks. Once real values are filled in
// below, those lines reappear automatically — no page needs to change.

export const LEGAL_ENTITY = {
  /** Registered legal name exactly as per the incorporation/GST documents. Empty = not yet published. */
  name: "",
  shortName: "",
  /** Trade name, if it differs from the legal name. */
  tradeName: "",
  constitution: "",
  gstin: "",
  gstRegistrationType: "",
  gstRegisteredOn: "",
  /** Consumer-facing brand this website trades under — always set, independent of the entity above. */
  brand: "Go Gulf",
};

/**
 * Principal place of business as recorded on the GST registration.
 * Used for the postal address shown on Contact + every legal page, and for the
 * PostalAddress node in the site's Organization JSON-LD. Empty = not yet published.
 */
export const REGISTERED_ADDRESS = {
  lines: [],
  locality: "",
  district: "",
  region: "",
  postalCode: "",
  country: "",
  countryCode: "",
};

/** Address rendered as display lines, e.g. for an <address> block. Empty array while unpublished. */
export const ADDRESS_LINES = REGISTERED_ADDRESS.lines.length
  ? [
      ...REGISTERED_ADDRESS.lines,
      `${REGISTERED_ADDRESS.locality}, ${REGISTERED_ADDRESS.region} – ${REGISTERED_ADDRESS.postalCode}`,
      REGISTERED_ADDRESS.country,
    ]
  : [];

/** Same address on one line, for inline prose inside the policies. Empty string while unpublished. */
export const ADDRESS_ONE_LINE = ADDRESS_LINES.join(", ");

/** True once a registered legal entity name has been published — gates entity/GSTIN/address UI. */
export const HAS_LEGAL_ENTITY = Boolean(LEGAL_ENTITY.name);

/** True once a registered address has been published. */
export const HAS_REGISTERED_ADDRESS = ADDRESS_LINES.length > 0;

// Date the current wording of the policy pages took effect. Bump both values
// together whenever a policy's substance changes.
export const POLICY_EFFECTIVE_DATE = "11 August 2026";
export const POLICY_EFFECTIVE_ISO = "2026-08-11";

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
