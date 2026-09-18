"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/admin/action-state";
import { describePlan, isEmptyPlan, planPermissionChanges, RESERVED_PERMISSIONS, type Grants, type Scope } from "@/lib/admin/rbac-model";
import { AuthorizationError, requirePermission } from "@/lib/auth/permissions";
import { logger } from "@/lib/logger";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Change what one role may do. SUPER_ADMIN only: requirePermission("roles.manage") here,
 * and the "super admin manages grants" policy on role_permissions underneath (0007) — an
 * ADMIN who forged this request would be refused by the database.
 *
 * On top of RLS:
 *   * SUPER_ADMIN itself has no grants to edit (is_super short-circuits every check);
 *   * roles.manage and permissions.manage are never grantable or revocable from here
 *     (they define the escalation boundary; changing them is a reviewed migration);
 *   * a save that changes nothing writes nothing.
 * Each row written is recorded by the audit trigger on role_permissions, attributed to the caller.
 */

export async function saveRoleGrants(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await requirePermission("roles.manage");
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, message: error.message };
    throw error;
  }

  const role = String(formData.get("role") ?? "");
  if (!/^[A-Z_]{3,40}$/.test(role)) return { ok: false, message: "That role could not be read." };

  const supabase = await createServerSupabase();
  const { data: roleRow } = await supabase.from("roles").select("key,is_super").eq("key", role).maybeSingle();
  if (!roleRow) return { ok: false, message: "That role does not exist." };
  if (roleRow.is_super) return { ok: false, message: "A super administrator is unrestricted and has no grants to edit." };

  const requested: Record<string, string> = {};
  for (const [name, value] of formData.entries()) {
    if (name.startsWith("perm:") && typeof value === "string") requested[name.slice(5)] = value;
  }

  const [{ data: catalogue }, { data: currentRows }] = await Promise.all([
    supabase.from("permissions").select("id,key"),
    supabase.from("role_permissions").select("scope,permission:permissions(key)").eq("role_key", role),
  ]);
  const ids = new Map((catalogue ?? []).map((p) => [p.key, p.id]));
  const current: Grants = {};
  for (const row of (currentRows ?? []) as unknown as { scope: Scope; permission: { key: string } | null }[]) {
    if (row.permission) current[row.permission.key] = row.scope;
  }

  const plan = planPermissionChanges(current, requested, [...ids.keys()]);
  if (plan.reserved.length > 0) {
    return { ok: false, message: `${RESERVED_PERMISSIONS.join(" and ")} cannot be changed from here. They belong to super administrators alone; changing that is a reviewed database migration.` };
  }
  if (isEmptyPlan(plan)) return { ok: true, message: "No changes." };

  if (plan.insert.length) {
    const { error } = await supabase.from("role_permissions").insert(plan.insert.map((c) => ({ role_key: role, permission_id: ids.get(c.key)!, scope: c.scope })));
    if (error) return failed("grant", error.code);
  }
  for (const change of plan.update) {
    const { error } = await supabase.from("role_permissions").update({ scope: change.scope }).eq("role_key", role).eq("permission_id", ids.get(change.key)!);
    if (error) return failed("change", error.code);
  }
  if (plan.remove.length) {
    const { error } = await supabase.from("role_permissions").delete().eq("role_key", role).in("permission_id", plan.remove.map((k) => ids.get(k)!));
    if (error) return failed("revoke", error.code);
  }

  revalidatePath("/admin/roles");
  revalidatePath(`/admin/roles/${role}`);
  return { ok: true, message: `Saved: ${describePlan(plan)}. It applies to everyone in this role on their next request, and is in the audit trail.` };
}

function failed(what: string, code?: string): ActionState {
  logger.warn(`role ${what} refused`, { reason: code ?? "unknown" });
  return { ok: false, message: "Part of the change was refused by the database. Reload the page to see what was saved." };
}
