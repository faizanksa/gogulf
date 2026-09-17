"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/admin/action-state";
import { AuthorizationError, requirePermission, type Permission } from "@/lib/auth/permissions";
import { explainDbError } from "@/lib/jobs/errors";
import { logger } from "@/lib/logger";
import { createServerSupabase } from "@/lib/supabase/server";
import type { ApplicationStatus } from "@/types/database";

/**
 * Triage and conversion of job applications. requirePermission first; then the staff
 * member's own session, where the scoped RLS policies from 0013 decide which
 * applications they may touch. Audit entries are written by the database.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// "converted" is set only by convert_job_application, together with the links it creates.
const TRIAGE: readonly ApplicationStatus[] = ["new", "screening", "rejected", "withdrawn"];

async function authorize(...permissions: Permission[]): Promise<ActionState> {
  try {
    for (const p of permissions) await requirePermission(p, "own");
    return null;
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, message: error.message };
    throw error;
  }
}

export async function setApplicationStatus(_state: ActionState, formData: FormData): Promise<ActionState> {
  const denied = await authorize("applications.screen");
  if (denied) return denied;
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as ApplicationStatus;
  if (!UUID.test(id) || !TRIAGE.includes(status)) return { ok: false, message: "Choose a valid status." };

  const supabase = await createServerSupabase();
  // A converted application stays converted: its contact and case already exist.
  const { data, error } = await supabase
    .from("job_applications")
    .update({ status })
    .eq("id", id)
    .neq("status", "converted")
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, message: explainDbError(error).message };
  if (!data) return { ok: false, message: "The application was not found, is already converted, or your role cannot change it." };
  revalidatePath(`/admin/applications/${id}`);
  revalidatePath("/admin/applications");
  return { ok: true, message: "Status updated." };
}

export async function assignApplication(_state: ActionState, formData: FormData): Promise<ActionState> {
  const denied = await authorize("applications.screen");
  if (denied) return denied;
  const id = String(formData.get("id") ?? "");
  const assignee = String(formData.get("assignee_id") ?? "");
  if (!UUID.test(id) || (assignee && !UUID.test(assignee))) return { ok: false, message: "Choose a colleague." };

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("job_applications")
    .update({ assignee_id: assignee || null })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, message: explainDbError(error).message };
  if (!data) return { ok: false, message: "The application was not found, or your role cannot assign it." };
  revalidatePath(`/admin/applications/${id}`);
  revalidatePath("/admin/applications");
  return { ok: true, message: assignee ? "Assigned." : "Unassigned." };
}

/** Application → contact (found or created) → recruitment case, in one database transaction. */
export async function convertApplication(_state: ActionState, formData: FormData): Promise<ActionState> {
  const denied = await authorize("applications.screen", "contacts.create", "cases.create");
  if (denied) return denied;
  const id = String(formData.get("id") ?? "");
  if (!UUID.test(id)) return { ok: false, message: "The application was not found." };

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("convert_job_application", { p_application_id: id });
  if (error) {
    logger.warn("application conversion refused", { reason: error.code ?? "unknown" });
    return { ok: false, message: explainDbError(error).message };
  }
  const result = data as { case_number?: string; contact_created?: boolean; already_converted?: boolean } | null;
  revalidatePath(`/admin/applications/${id}`);
  revalidatePath("/admin/applications");
  revalidatePath("/admin/contacts");
  revalidatePath("/admin/cases");
  if (result?.already_converted) return { ok: true, message: `Already converted to case ${result.case_number ?? ""}.` };
  return {
    ok: true,
    message: `Opened case ${result?.case_number ?? ""} ${result?.contact_created ? "for a new contact" : "for the existing contact with this phone or email"}.`,
  };
}
