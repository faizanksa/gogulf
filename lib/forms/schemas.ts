/**
 * Form validation schemas — shared by the browser and the server.
 *
 * NOT server-only: the client imports these to give immediate feedback. But
 * client-side validation is a convenience, never a control. Every route
 * re-parses the payload with the same schema before doing anything with it,
 * because anything the browser sends can be forged.
 *
 * Field names match the existing EmailJS template variables exactly
 * (from_name, reply_to, …) so the migration preserves business meaning rather
 * than quietly reshaping it.
 */

import { z } from "zod";
import { isNormalizablePhone } from "@/lib/phone";

/** Trim, and collapse the whitespace people paste in from documents. */
const cleanText = (max: number) =>
  z
    .string()
    .transform((s) => s.replace(/\s+/g, " ").trim())
    .pipe(z.string().max(max));

const requiredText = (max: number, label: string) =>
  z
    .string({ error: `${label} is required.` })
    .transform((s) => s.replace(/\s+/g, " ").trim())
    .pipe(z.string().min(1, `${label} is required.`).max(max));

/**
 * Optional free text. An empty or whitespace-only value becomes `undefined`,
 * not `""` — so downstream code has one "absent" value to check instead of two.
 *
 * Note the transform must run AFTER cleaning: `.or(z.literal(""))` does not
 * work here, because the empty string passes the first branch and the
 * alternative is never reached.
 */
const optionalText = (max: number) =>
  z
    .string()
    .max(max)
    .transform((v) => {
      const cleaned = v.replace(/\s+/g, " ").trim();
      return cleaned === "" ? undefined : cleaned;
    })
    .optional();

export const emailField = z
  .string({ error: "Email address is required." })
  .transform((s) => s.trim().toLowerCase())
  .pipe(z.string().email("Enter a valid email address.").max(254));

/**
 * Accepts what the form accepts, then checks it can be normalised to E.164.
 * The stored value is the normalised form — the raw is kept alongside so staff
 * can see exactly what the person typed.
 */
export const phoneField = z
  .string({ error: "Phone number is required." })
  .transform((v) => v.replace(/\s+/g, " ").trim())
  .pipe(z.string().max(32))
  .refine(isNormalizablePhone, {
    message: "Enter a valid phone number, including country code if outside India.",
  });

/**
 * Honeypot. A hidden field real users never fill and naive bots always do.
 *
 * It deliberately ACCEPTS any value here. Rejecting it in the schema would
 * return a 400 naming the `website` field, which tells a bot exactly what
 * tripped it and how to get past next time. The handler checks it after
 * validation and answers 200, so a bot cannot tell rejection from success.
 */
export const honeypot = z.string().max(200).optional();

// ---------------------------------------------------------------------------
// Contact
// ---------------------------------------------------------------------------

export const contactSchema = z.object({
  from_name: requiredText(120, "Name"),
  reply_to: emailField,
  // Empty means "not provided"; anything non-empty must be a valid number.
  phone: z
    .string()
    .transform((v) => (v.trim() === "" ? undefined : v.trim()))
    .optional()
    .pipe(phoneField.optional()),
  message: requiredText(5000, "Message"),
  page_source: optionalText(80),
  website: honeypot,
});

export type ContactInput = z.infer<typeof contactSchema>;

// ---------------------------------------------------------------------------
// Service inquiry
// ---------------------------------------------------------------------------

/**
 * Which desk an inquiry reaches. The existing form derives this from the
 * optgroup the selected service sits in; the server re-derives it from the
 * service name so a tampered payload cannot reroute an inquiry.
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

export const serviceInquirySchema = z.object({
  service_type: requiredText(120, "Service type"),
  from_name: requiredText(120, "Name"),
  reply_to: emailField,
  phone: phoneField,
  country: optionalText(80),
  message: optionalText(5000),
  page_source: optionalText(80),
  website: honeypot,
});

export type ServiceInquiryInput = z.infer<typeof serviceInquirySchema>;

// ---------------------------------------------------------------------------
// Job application
//
// The uploaded files are NOT part of this payload. They go to Supabase Storage
// first; this carries only the identifiers needed to find them, matching the
// existing two-phase flow.
// ---------------------------------------------------------------------------

export const jobApplicationSchema = z.object({
  from_name: requiredText(120, "Name"),
  reply_to: emailField,
  phone: phoneField,
  service_type: requiredText(160, "Role"), // job title, per the existing template
  country: optionalText(80),
  experience: optionalText(80),
  message: optionalText(5000),
  documents: optionalText(200),
  submission_id: z.string().uuid().optional(),
  page_source: optionalText(80),
  website: honeypot,
});

export type JobApplicationInput = z.infer<typeof jobApplicationSchema>;

// ---------------------------------------------------------------------------

export type FormKind = "contact" | "service-inquiry" | "job-application";

/** Field-level errors, keyed by field name, safe to render. */
export type FieldErrors = Record<string, string[]>;

export function toFieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    (out[key] ??= []).push(issue.message);
  }
  return out;
}
