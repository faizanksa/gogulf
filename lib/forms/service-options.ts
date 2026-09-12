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
export const EMPLOYER_SERVICES = [
  "Employer Hiring Solutions",
  "Bulk Candidate Sourcing",
  "Recruitment Support",
  "Candidate Screening",
  "HR Support",
] as const;

export const CANDIDATE_SERVICES = [
  "Gulf Job Applications",
  "Job Matching",
  "Interview Coordination",
  "Visa & Documentation Assistance",
  "Medical Coordination",
  "Attestation & Embassy Formalities",
  "Immigration Support",
  "Air Ticket & Travel Assistance",
  "Pre-Departure Orientation",
  "Post-Joining Support",
] as const;
