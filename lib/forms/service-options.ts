/**
 * Service names offered in the inquiry form — shared by the browser form and the
 * server route that routes each inquiry to a desk.
 *
 * Deliberately free of Zod and every other dependency: the form imports this in the
 * browser, and importing it from lib/forms/schemas.ts used to pull Zod into the
 * /services bundle. The names are part of the payload contract — changing one changes
 * which desk an inquiry reaches.
 */

//
// Renamed 12 Sep 2026 so no service name implies a registered or licensed recruiting
// agency ("Overseas Recruitment", "Gulf Job Placement", "Bulk Manpower Recruitment",
// "Recruitment Process Outsourcing", "HR & Recruitment Support", "MOFA & Embassy
// Processing"). Routing is unchanged: each list still decides the desk.
//
// 27 Sep 2026: "Air Ticket & Travel Assistance" replaced by "Flight & Joining Support
// (Selected Candidates)". Go Gulf is not a travel agency: it arranges travel only for
// candidates it has placed, as part of recruitment. The candidate desk still receives it.
// 6 Oct 2026 (copy/ra-partner-model): Go Gulf is not a recruiting agent and does not place
// candidates. It counsels, prepares profiles and documents, and refers candidates to
// registered recruiting agents (RAs); employers are introduced to those agents. Every
// option that described sourcing, screening, interviews, visas, medicals, attestation,
// flights or HR work done by Go Gulf was retired. Routing is unchanged: EMPLOYER_SERVICES
// still go to the business desk, CANDIDATE_SERVICES to the candidate desk.
export const EMPLOYER_SERVICES = [
  "Introduce a Hiring Requirement",
  "Hiring Process Guidance",
] as const;

export const CANDIDATE_SERVICES = [
  "Career Counselling",
  "Gulf Job Applications",
  "Profile & CV Preparation",
  "Document Preparation",
  "Referral to a Registered Recruiting Agent",
] as const;
// 28 Sep 2026: "Post-Joining Support" removed — a leftover of the pre-redesign form that no
// form has offered since; the server now accepts only what a form can actually send.

/** The general option, offered by the Services page form. */
export const OTHER_SERVICE = "Other / Not Sure";

/**
 * Every service name the server accepts from a public form (/api/forms/service-inquiry):
 * the candidate and employer services, and the general option. Anything else — a retired
 * name from a stale page, or a value made up by a client — is refused by the server
 * (lib/forms/schemas.ts), whatever the browser's own validation did. Kept exactly equal to
 * what the forms offer by lib/forms/service-validation.test.ts.
 */
export const INQUIRY_SERVICES: readonly string[] = [...CANDIDATE_SERVICES, ...EMPLOYER_SERVICES, OTHER_SERVICE];

export function isInquiryService(value: string): boolean {
  return INQUIRY_SERVICES.includes(value);
}
