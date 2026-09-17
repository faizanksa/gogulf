/**
 * Form validation schemas — the authoritative check on the server.
 *
 * Every /api/forms/* route parses its payload with these before doing anything with it,
 * because anything the browser sends can be forged. The browser forms give immediate
 * feedback with the platform's own constraint API instead, so Zod never ships to them.
 *
 * Messages are catalogue keys (messages/en.json forms.validation.*), not sentences:
 * toFieldErrors translates them into the language of the page that sent the form.
 *
 * Field names keep the previous EmailJS template variables (from_name,
 * reply_to, …) so the move to Resend preserved business meaning rather than
 * quietly reshaping it. EmailJS itself has been removed.
 */

import { z } from "zod";
import { DEFAULT } from "@/lib/i18n/locales";
import { createTranslator, type MessageKey, type Translator } from "@/lib/i18n/translator";
import { isNormalizablePhone } from "@/lib/phone";

/** A validation message, as a checked catalogue key. */
const m = (key: MessageKey) => key;
const TOO_LONG = m("forms.validation.tooLong");

const requiredText = (max: number, key: MessageKey) =>
  z
    .string({ error: key })
    .transform((s) => s.replace(/\s+/g, " ").trim())
    .pipe(z.string().min(1, key).max(max, TOO_LONG));

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
    .max(max, TOO_LONG)
    .transform((v) => {
      const cleaned = v.replace(/\s+/g, " ").trim();
      return cleaned === "" ? undefined : cleaned;
    })
    .optional();

export const emailField = z
  .string({ error: m("forms.validation.emailRequired") })
  .transform((s) => s.trim().toLowerCase())
  .pipe(z.string().email(m("forms.validation.emailInvalid")).max(254, TOO_LONG));

/**
 * Accepts what the form accepts, then checks it can be normalised to E.164.
 * The stored value is the normalised form — the raw is kept alongside so staff
 * can see exactly what the person typed.
 */
export const phoneField = z
  .string({ error: m("forms.validation.phoneRequired") })
  .transform((v) => v.replace(/\s+/g, " ").trim())
  .pipe(z.string().max(32, TOO_LONG))
  .refine(isNormalizablePhone, {
    message: m("forms.validation.phoneInvalid"),
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
  from_name: requiredText(120, "forms.validation.nameRequired"),
  reply_to: emailField,
  // Empty means "not provided"; anything non-empty must be a valid number.
  phone: z
    .string()
    .transform((v) => (v.trim() === "" ? undefined : v.trim()))
    .optional()
    .pipe(phoneField.optional()),
  message: requiredText(5000, "forms.validation.messageRequired"),
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
 *
 * The lists live in a dependency-free module so the browser form can import them
 * without pulling Zod into the page bundle. Re-exported here for server code.
 */
export { CANDIDATE_SERVICES, EMPLOYER_SERVICES } from "./service-options";

export const serviceInquirySchema = z.object({
  service_type: requiredText(120, "forms.validation.serviceRequired"),
  from_name: requiredText(120, "forms.validation.nameRequired"),
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
  from_name: requiredText(120, "forms.validation.nameRequired"),
  reply_to: emailField,
  phone: phoneField,
  service_type: requiredText(160, "forms.validation.roleRequired"), // job title, per the existing template
  job_reference: optionalText(40),
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

/**
 * Field errors in the reader's language. Our messages are catalogue keys and are
 * translated; any other (a Zod default on a machine field such as submission_id) passes
 * through unchanged.
 */
export function toFieldErrors(error: z.ZodError, t: Translator = createTranslator(DEFAULT)): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    (out[key] ??= []).push(t.has(issue.message) ? t(issue.message) : issue.message);
  }
  return out;
}
