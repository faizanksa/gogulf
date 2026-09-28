"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/admin/action-state";
import { AuthorizationError, requirePermission, type Permission } from "@/lib/auth/permissions";
import { caseLifecycleRefusal, parseAssign, parseClose, parseReopen, parseStageMove } from "@/lib/crm/case-lifecycle";
import { logger } from "@/lib/logger";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * The case lifecycle (0025). Each action checks its own permission first (layer 2), then calls
 * the database function that is the only way to make the change (layer 3): move_case_stage,
 * close_case, reopen_case, assign_case. Those re-check the session, the case's visibility and
 * the permission at the case's scope, enforce the stage and reason rules, and write the
 * timeline and audit entries. Nothing here uses the service-role client.
 */

async function authorize(permission: Permission): Promise<ActionState> {
  try {
    await requirePermission(permission, "own");
    return null;
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, message: error.message };
    throw error;
  }
}

function refused(what: string, error: { code?: string; message?: string }): ActionState {
  logger.warn(`case ${what} refused`, { reason: error.code ?? "unknown" });
  return { ok: false, message: caseLifecycleRefusal(error) };
}

/** Move a case one stage on, one back (with a reason), or — administrators — anywhere, exceptionally. */
export async function moveCaseStage(_state: ActionState, formData: FormData): Promise<ActionState> {
  const denied = await authorize("cases.stage.change");
  if (denied) return denied;

  const parsed = parseStageMove(Object.fromEntries(formData));
  if (!parsed.ok) return { ok: false, message: parsed.message, fieldErrors: parsed.fieldErrors };
  const { caseId, stage, reason, exceptional } = parsed.value;

  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("move_case_stage", {
    p_case: caseId,
    p_stage_key: stage,
    p_reason: reason ?? undefined,
    p_exceptional: exceptional,
  });
  if (error) return refused("stage move", error);

  revalidatePath(`/admin/cases/${caseId}`);
  revalidatePath("/admin/cases");
  return { ok: true, message: stage === "completed" ? "Moved to Joined. The case is closed as won." : "Stage changed. It is on the timeline." };
}

/** Close an open case as lost or cancelled, with a listed reason. Its open tasks are cancelled. */
export async function closeCase(_state: ActionState, formData: FormData): Promise<ActionState> {
  const denied = await authorize("cases.close");
  if (denied) return denied;

  const parsed = parseClose(Object.fromEntries(formData));
  if (!parsed.ok) return { ok: false, message: parsed.message, fieldErrors: parsed.fieldErrors };
  const { caseId, outcome, reason, note } = parsed.value;

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("close_case", { p_case: caseId, p_outcome: outcome, p_reason: reason, p_note: note ?? undefined });
  if (error) return refused("close", error);

  const cancelled = Number((data as { tasks_cancelled?: number } | null)?.tasks_cancelled ?? 0);
  revalidatePath(`/admin/cases/${caseId}`);
  revalidatePath("/admin/cases");
  return {
    ok: true,
    message: `Case closed as ${outcome}.${cancelled ? ` ${cancelled} open task${cancelled === 1 ? " was" : "s were"} cancelled.` : ""}`,
  };
}

/** Reopen a closed case at its last active stage, with a reason. */
export async function reopenCase(_state: ActionState, formData: FormData): Promise<ActionState> {
  const denied = await authorize("cases.close");
  if (denied) return denied;

  const parsed = parseReopen(Object.fromEntries(formData));
  if (!parsed.ok) return { ok: false, message: parsed.message, fieldErrors: parsed.fieldErrors };

  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("reopen_case", { p_case: parsed.value.caseId, p_reason: parsed.value.reason });
  if (error) return refused("reopen", error);

  revalidatePath(`/admin/cases/${parsed.value.caseId}`);
  revalidatePath("/admin/cases");
  return { ok: true, message: "Case reopened at its last active stage." };
}

/** Give a case to an eligible owner, or leave it unassigned. */
export async function assignCase(_state: ActionState, formData: FormData): Promise<ActionState> {
  const denied = await authorize("cases.assign");
  if (denied) return denied;

  const parsed = parseAssign(Object.fromEntries(formData));
  if (!parsed.ok) return { ok: false, message: parsed.message };

  const supabase = await createServerSupabase();
  // assign_case takes null for "unassigned"; the generated type does not say so.
  const { data, error } = await supabase.rpc("assign_case", { p_case: parsed.value.caseId, p_owner: parsed.value.owner as string });
  if (error) return refused("assignment", error);

  revalidatePath(`/admin/cases/${parsed.value.caseId}`);
  revalidatePath("/admin/cases");
  if ((data as { unchanged?: boolean } | null)?.unchanged) return { ok: true, message: "No change." };
  return { ok: true, message: parsed.value.owner ? "Owner changed." : "The case is now unassigned." };
}
