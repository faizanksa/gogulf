/**
 * Editing a contact and merging two, as the staff workspace submits them (0021).
 *
 * Pure: no Next.js, no Supabase, so every rule is unit-tested. The database is still the
 * authority — column privileges decide WHICH fields staff may write at all, RLS decides
 * WHICH contacts, contacts_guard decides owner/branch moves, and merge_contacts() decides
 * everything about a merge. This file only turns a form into clean values and a database
 * refusal into a sentence.
 */

import type { LifecycleStage } from "@/types/database";

export const LIFECYCLE_STAGES: readonly LifecycleStage[] = ["subscriber", "lead", "opportunity", "customer", "past_customer", "disqualified"];

/** The only fields the edit screen sends. The database grants UPDATE on exactly these (0021). */
export interface ContactEdit {
  full_name: string;
  display_name: string | null;
  lifecycle_stage: LifecycleStage;
  country_code: string | null;
  nationality: string | null;
  preferred_language: string;
  date_of_birth: string | null;
  gender: string | null;
  notes_summary: string | null;
  consent_email: boolean;
  consent_whatsapp: boolean;
  consent_sms: boolean;
  consent_calls: boolean;
  consent_marketing: boolean;
}

export type Parsed<T> = { ok: true; value: T } | { ok: false; fieldErrors: Record<string, string> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

const text = (input: Record<string, unknown>, key: string) => (typeof input[key] === "string" ? (input[key] as string) : "");
const clean = (s: string) => s.replace(/\s+/g, " ").trim();
const optional = (s: string) => (clean(s) === "" ? null : clean(s));
const checked = (input: Record<string, unknown>, key: string) => input[key] === "on" || input[key] === "true";

export function parseContactEdit(input: Record<string, unknown>, today: Date = new Date()): Parsed<ContactEdit> {
  const fieldErrors: Record<string, string> = {};

  const full_name = clean(text(input, "full_name"));
  if (full_name.length < 2 || full_name.length > 120) fieldErrors.full_name = "Enter the full name (2 to 120 characters).";
  else if (/[<>{}]|\p{Cc}/u.test(full_name)) fieldErrors.full_name = "Use letters, spaces and ordinary punctuation only.";

  const display_name = optional(text(input, "display_name"));
  if (display_name && display_name.length > 120) fieldErrors.display_name = "Keep the display name to 120 characters.";

  const stage = text(input, "lifecycle_stage");
  if (!(LIFECYCLE_STAGES as readonly string[]).includes(stage)) fieldErrors.lifecycle_stage = "Choose a stage.";

  const country = optional(text(input, "country_code"))?.toUpperCase() ?? null;
  if (country && !/^[A-Z]{2}$/.test(country)) fieldErrors.country_code = "Use a two-letter country code, e.g. IN or AE.";

  const nationality = optional(text(input, "nationality"));
  if (nationality && nationality.length > 60) fieldErrors.nationality = "Keep nationality to 60 characters.";

  const language = clean(text(input, "preferred_language")) || "en";
  if (!/^[a-z]{2}(-[A-Z]{2})?$/.test(language)) fieldErrors.preferred_language = "Choose a language.";

  const dob = optional(text(input, "date_of_birth"));
  if (dob) {
    const d = /^\d{4}-\d{2}-\d{2}$/.test(dob) ? new Date(`${dob}T00:00:00Z`) : null;
    if (!d || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== dob) fieldErrors.date_of_birth = "Enter a real date.";
    else if (d > today || d.getUTCFullYear() < 1900) fieldErrors.date_of_birth = "Enter a date of birth in the past.";
  }

  const gender = optional(text(input, "gender"));
  if (gender && gender.length > 30) fieldErrors.gender = "Keep this to 30 characters.";

  const notes = text(input, "notes_summary").trim();
  if (notes.length > 2000) fieldErrors.notes_summary = "Keep the summary to 2,000 characters.";

  if (Object.keys(fieldErrors).length) return { ok: false, fieldErrors };
  return {
    ok: true,
    value: {
      full_name,
      display_name,
      lifecycle_stage: stage as LifecycleStage,
      country_code: country,
      nationality,
      preferred_language: language,
      date_of_birth: dob,
      gender,
      notes_summary: notes === "" ? null : notes,
      consent_email: checked(input, "consent_email"),
      consent_whatsapp: checked(input, "consent_whatsapp"),
      consent_sms: checked(input, "consent_sms"),
      consent_calls: checked(input, "consent_calls"),
      consent_marketing: checked(input, "consent_marketing"),
    },
  };
}

/** The owner field: a staff id, or "" for nobody. Undefined when the form did not send it. */
export function parseOwner(input: Record<string, unknown>): { ok: true; value: string | null | undefined } | { ok: false } {
  if (!("owner_id" in input)) return { ok: true, value: undefined };
  const raw = text(input, "owner_id");
  if (raw === "") return { ok: true, value: null };
  return isUuid(raw) ? { ok: true, value: raw } : { ok: false };
}

/** A database refusal, as a sentence staff can act on. Never the raw error. */
export function editRefusal(error: { code?: string; message?: string } | null | undefined): string {
  const message = error?.message ?? "";
  if (message.includes("contact_merged")) return "This contact was merged into another and can no longer be edited.";
  if (message.includes("cross_branch_move_requires_all_scope")) return "Only staff who work across all branches can move a contact to another branch.";
  if (message.includes("contacts_assign_required")) return "Changing the owner or branch needs the permission to assign contacts.";
  return "The change was refused. You may not have permission to edit this contact.";
}

export function mergeRefusal(error: { code?: string; message?: string } | null | undefined): string {
  const message = error?.message ?? "";
  if (message.includes("cannot_merge_contact_into_itself")) return "A contact cannot be merged into itself.";
  if (message.includes("contact_already_merged")) return "That contact has already been merged into another one.";
  if (message.includes("survivor_is_merged")) return "This contact was itself merged into another. Merge into that contact instead.";
  if (message.includes("cross_branch_merge_requires_all_scope")) return "Only staff who work across all branches can merge contacts from different branches.";
  if (message.includes("contact_not_found")) return "One of the contacts no longer exists.";
  if (error?.code === "42501") return "You do not have permission to merge these contacts.";
  return "The merge was refused and nothing was changed.";
}
