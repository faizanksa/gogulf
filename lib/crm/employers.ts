/**
 * Employers as the staff workspace submits them (0022).
 *
 * Pure: no Next.js, no Supabase, so every rule is unit-tested. The database is the
 * authority — RLS decides which employers a person may see and write (employers.view /
 * employers.manage, by branch), check constraints decide what a valid record is, and
 * employer_link_guard decides which employer a job or case may point at. This file turns a
 * form into clean values, and a refusal into a sentence.
 */

import type { EmployerStatus } from "@/types/database";

export const EMPLOYER_STATUSES: readonly EmployerStatus[] = ["prospect", "active", "inactive"];

export const EMPLOYER_STATUS_LABELS: Record<EmployerStatus, string> = {
  prospect: "Prospect",
  active: "Active",
  inactive: "Inactive",
};

/** The fields the create and edit screens send. The database grants UPDATE on exactly these. */
export interface EmployerWrite {
  name: string;
  country_code: string;
  registration_number: string | null;
  website: string | null;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  status: EmployerStatus;
  notes: string | null;
  branch_id?: string;
}

export type Parsed<T> = { ok: true; value: T } | { ok: false; fieldErrors: Record<string, string> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// The same shapes as the check constraints in 0022, so a refusal is explained before it happens.
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PHONE = /^\+?[0-9][0-9 ()-]{5,24}$/;
const WEBSITE = /^https?:\/\/[^\s/]+\.[^\s]+$/i;

const text = (input: Record<string, unknown>, key: string) => (typeof input[key] === "string" ? (input[key] as string) : "");
const clean = (s: string) => s.replace(/\s+/g, " ").trim();
const optional = (s: string) => (clean(s) === "" ? null : clean(s));

export function parseEmployerForm(input: Record<string, unknown>): Parsed<EmployerWrite> {
  const fieldErrors: Record<string, string> = {};

  const name = clean(text(input, "name"));
  if (name.length < 2 || name.length > 160) fieldErrors.name = "Enter the employer's name (2 to 160 characters).";
  else if (/[<>{}]|\p{Cc}/u.test(name)) fieldErrors.name = "Use letters, digits, spaces and ordinary punctuation only.";

  const country_code = clean(text(input, "country_code")).toUpperCase();
  if (!/^[A-Z]{2}$/.test(country_code)) fieldErrors.country_code = "Choose the employer's country.";

  const registration_number = optional(text(input, "registration_number"));
  if (registration_number && (registration_number.length < 2 || registration_number.length > 60)) {
    fieldErrors.registration_number = "Keep the registration number between 2 and 60 characters.";
  }

  let website = optional(text(input, "website"));
  if (website && !/^https?:\/\//i.test(website)) website = `https://${website}`;
  if (website && (website.length > 300 || !WEBSITE.test(website))) fieldErrors.website = "Enter a web address, e.g. https://example.com.";

  const contact_person = optional(text(input, "contact_person"));
  if (contact_person && (contact_person.length < 2 || contact_person.length > 120)) {
    fieldErrors.contact_person = "Keep the contact person's name between 2 and 120 characters.";
  }

  const email = optional(text(input, "email"))?.toLowerCase() ?? null;
  if (email && (email.length > 254 || !EMAIL.test(email))) fieldErrors.email = "Enter an email address, e.g. hr@example.com.";

  const phone = optional(text(input, "phone"));
  if (phone && !PHONE.test(phone)) fieldErrors.phone = "Enter a phone number with digits, spaces, brackets or dashes, e.g. +971 4 000 0000.";

  const status = text(input, "status");
  if (!(EMPLOYER_STATUSES as readonly string[]).includes(status)) fieldErrors.status = "Choose a status.";

  const notes = text(input, "notes").replace(/\r\n?/g, "\n").trim();
  if (notes.length > 4000) fieldErrors.notes = "Keep notes to 4,000 characters.";

  // Sent only by staff who may place an employer in a branch; otherwise the database
  // gives a new employer the creator's branch, and an edit leaves the branch alone.
  const branch = text(input, "branch_id");
  if (branch && !UUID.test(branch)) fieldErrors.branch_id = "Choose a branch.";

  if (Object.keys(fieldErrors).length) return { ok: false, fieldErrors };
  return {
    ok: true,
    value: {
      name,
      country_code,
      registration_number,
      website,
      contact_person,
      email,
      phone,
      status: status as EmployerStatus,
      notes: notes === "" ? null : notes,
      ...(branch ? { branch_id: branch } : {}),
    },
  };
}

/**
 * The employer picker on a job or case: an employer id, or "" for none. Undefined when the
 * form did not include the picker (the person cannot see employers), so a save never clears
 * a link that person could not see.
 */
export function parseEmployerLink(input: Record<string, unknown>): { ok: true; value: string | null | undefined } | { ok: false } {
  if (input.employer_field !== "1") return { ok: true, value: undefined };
  const raw = text(input, "employer_id");
  if (raw === "") return { ok: true, value: null };
  return UUID.test(raw) ? { ok: true, value: raw } : { ok: false };
}

/** A database refusal, as a sentence staff can act on. Never the raw error. */
export function employerRefusal(error: { code?: string; message?: string } | null | undefined): string {
  const message = error?.message ?? "";
  if (error?.code === "23505") return "An employer with this name already exists in this country. Open that record instead.";
  if (message.includes("employer_not_available")) return "That employer is not one you can link. Choose an employer from the list.";
  if (error?.code === "23514") return "Some details are not in a valid format. Check the email, phone and website.";
  if (error?.code === "42501") return "You do not have permission to change this employer.";
  return "The change was refused. You may not have permission to do this.";
}
