"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/admin/action-state";
import { AuthorizationError, currentStaffId, requirePermission } from "@/lib/auth/permissions";
import { logger } from "@/lib/logger";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Add a team note to a contact (and, optionally, one of its cases).
 *
 * Team-visible only. Private channels (HR, finance) are not offered here: they need their
 * own screen and their own permission, and the database refuses a note into a channel the
 * author could not read (0009). The author is always the signed-in person — RLS rejects any
 * other author_id — and the contact must be inside the author's scope, so a forged contact
 * id from outside it is refused by the database, not just by this code.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function addNote(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await requirePermission("notes.team.create", "own");
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, message: error.message };
    throw error;
  }

  const contactId = String(formData.get("contact_id") ?? "");
  const caseId = String(formData.get("case_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  const path = String(formData.get("path") ?? "");
  if (!UUID.test(contactId) || (caseId && !UUID.test(caseId))) return { ok: false, message: "That note could not be saved." };
  if (body.length < 2) return { ok: false, message: "Write the note first.", fieldErrors: { body: "Write the note first." } };
  if (body.length > 2000) return { ok: false, message: "Keep a note under 2000 characters.", fieldErrors: { body: "Keep a note under 2000 characters." } };

  const supabase = await createServerSupabase();
  const author = await currentStaffId();
  if (!author) return { ok: false, message: "You do not have permission to do this." };

  if (caseId) {
    // A note on a case must be on a case of that contact.
    const { data: kase } = await supabase.from("cases").select("id").eq("id", caseId).eq("contact_id", contactId).maybeSingle();
    if (!kase) return { ok: false, message: "That case does not belong to this contact." };
  }

  const { error } = await supabase.from("notes").insert({ contact_id: contactId, case_id: caseId || null, body, visibility: "team", author_id: author });
  if (error) {
    logger.warn("staff note refused", { reason: error.code ?? "unknown" });
    return { ok: false, message: "The note could not be saved. You may not be able to write notes for this contact." };
  }

  // Only ever a staff-workspace path; never an open redirect and never a wildcard.
  if (/^\/admin\/[a-z]+\/[0-9a-f-]{36}$/i.test(path)) revalidatePath(path);
  return { ok: true, message: "Note added." };
}
