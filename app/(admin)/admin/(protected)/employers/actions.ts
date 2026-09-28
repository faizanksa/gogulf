"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/admin/action-state";
import { AuthorizationError, requirePermission, type Permission } from "@/lib/auth/permissions";
import { employerRefusal, parseEmployerForm, parseEmployerLink } from "@/lib/crm/employers";
import { isUuid } from "@/lib/crm/contact-edit";
import { logger } from "@/lib/logger";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Employers (0022). Each action checks the permission first (layer 2), then writes through
 * the caller's own session, where the database decides (layer 3): RLS allows only employers
 * in the caller's employers.manage scope, check constraints decide what a valid record is,
 * and employer_link_guard allows a case to point only at an employer the caller can see.
 * Every write is audited by the database. Nothing here uses the service-role client.
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

/** Create (no id) or edit (with id) an employer. */
export async function saveEmployer(_state: ActionState, formData: FormData): Promise<ActionState> {
  const denied = await authorize("employers.manage");
  if (denied) return denied;

  const input = Object.fromEntries(formData);
  const id = input.id;
  const parsed = parseEmployerForm(input);
  if (!parsed.ok) return { ok: false, message: "Some fields need attention.", fieldErrors: parsed.fieldErrors };

  const supabase = await createServerSupabase();

  if (!id) {
    // Every employer has a branch (0022). The form preselects the creator's own.
    const { branch_id, ...rest } = parsed.value;
    if (!branch_id) return { ok: false, message: "Some fields need attention.", fieldErrors: { branch_id: "Choose a branch." } };
    const { data, error } = await supabase.from("employers").insert({ ...rest, branch_id }).select("id").single();
    if (error || !data) {
      logger.warn("employer create refused", { reason: error?.code ?? "no-row" });
      return { ok: false, message: employerRefusal(error) };
    }
    revalidatePath("/admin/employers");
    redirect(`/admin/employers/${data.id}?saved=created`);
  }

  if (!isUuid(id)) return { ok: false, message: "That employer could not be read." };
  const { data, error } = await supabase.from("employers").update(parsed.value).eq("id", id).select("id").maybeSingle();
  if (error || !data) {
    logger.warn("employer update refused", { reason: error?.code ?? "no-row" });
    return { ok: false, message: error ? employerRefusal(error) : "This employer is not one you can edit." };
  }

  revalidatePath(`/admin/employers/${id}`);
  revalidatePath("/admin/employers");
  redirect(`/admin/employers/${id}?saved=1`);
}

/** Link a recruitment case to an employer, change it, or clear it. */
export async function setCaseEmployer(_state: ActionState, formData: FormData): Promise<ActionState> {
  const denied = await authorize("cases.update");
  if (denied) return denied;

  const input = Object.fromEntries(formData);
  const caseId = input.case_id;
  const link = parseEmployerLink(input);
  if (!isUuid(caseId) || !link.ok || link.value === undefined) return { ok: false, message: "Choose an employer from the list." };

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.from("case_recruitment").update({ employer_id: link.value }).eq("case_id", caseId).select("case_id").maybeSingle();
  if (error || !data) {
    logger.warn("case employer refused", { reason: error?.code ?? "no-row" });
    return { ok: false, message: error ? employerRefusal(error) : "This case is not one you can edit." };
  }

  revalidatePath(`/admin/cases/${caseId}`);
  return { ok: true, message: link.value ? "Employer saved." : "Employer removed from this case." };
}
