/**
 * Service names offered in the inquiry form — shared by the browser form and the
 * server route that routes each inquiry to a desk.
 *
 * Deliberately free of Zod and every other dependency: the form imports this in the
 * browser, and importing it from lib/forms/schemas.ts used to pull Zod into the
 * /services bundle. The names are part of the payload contract — changing one changes
 * which desk an inquiry reaches.
 */

export const EMPLOYER_SERVICES = [
  "Employer Hiring Solutions",
  "Bulk Manpower Recruitment",
  "Recruitment Process Outsourcing (RPO)",
  "Candidate Screening",
  "HR & Recruitment Support",
] as const;

export const CANDIDATE_SERVICES = [
  "Overseas Recruitment",
  "Gulf Job Placement",
  "Interview Coordination",
  "Visa & Documentation Assistance",
  "Medical Coordination",
  "MOFA & Embassy Processing",
  "Immigration Support",
  "Air Ticket & Travel Assistance",
  "Pre-Departure Orientation",
  "Post-Joining Support",
] as const;
