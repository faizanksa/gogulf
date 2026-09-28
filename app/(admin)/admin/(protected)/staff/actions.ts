"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/admin/action-state";
import { wouldLeaveNoSuperAdmin } from "@/lib/admin/rbac-model";
import { ensureStaffLogin } from "@/lib/admin/staff-login";
import { onboardStaff } from "@/lib/admin/staff-onboarding";
import { AuthorizationError, currentStaffId, hasPermission, requirePermission, type Permission } from "@/lib/auth/permissions";
import { ownsOpenCasesRefusal } from "@/lib/crm/case-lifecycle";
import { logger } from "@/lib/logger";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Staff administration. Every action: requirePermission first (layer 2), then a write
 * through the caller's own session, where the 0007/0009 policies decide (layer 3). The
 * audit entry is written by the database trigger on staff_users, attributed to the caller.
 *
 * What this file adds on top of RLS, deliberately:
 *   * nobody changes their own role or deactivates themselves from here — no self-lock-out;
 *   * the last active SUPER_ADMIN cannot be deactivated or demoted, because from that state
 *     nobody could administer the platform again.
 *
 * Adding a staff member (inviteStaff) follows docs/SECURITY-MODEL.md §3, the same procedure
 * as `npm run bootstrap:admins`: the staff row goes in through the caller's session first,
 * and only then does lib/admin/staff-login.ts create the confirmed, passwordless sign-in
 * account — the one privileged step in this file, and the only one in any staff action
 * (asserted in lib/admin/actions-guard.test.ts). No password is ever set.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function authorize(permission: Permission): Promise<ActionState> {
  try {
    await requirePermission(permission);
    return null;
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, message: error.message };
    throw error;
  }
}

async function roster() {
  const supabase = await createServerSupabase();
  const { data } = await supabase.from("staff_users").select("id,role_key,is_active");
  return (data ?? []) as { id: string; role_key: string; is_active: boolean }[];
}

/** Change one person's role. SUPER_ADMIN only: roles.manage. */
export async function setStaffRole(_state: ActionState, formData: FormData): Promise<ActionState> {
  const denied = await authorize("roles.manage");
  if (denied) return denied;

  const id = String(formData.get("id") ?? "");
  const role = String(formData.get("role") ?? "");
  if (!UUID.test(id) || !/^[A-Z_]{3,40}$/.test(role)) return { ok: false, message: "That change could not be read." };
  if (id === (await currentStaffId())) return { ok: false, message: "You cannot change your own role. Ask another super administrator." };

  const supabase = await createServerSupabase();
  const { data: known } = await supabase.from("roles").select("key").eq("key", role).maybeSingle();
  if (!known) return { ok: false, message: "That role does not exist." };

  const staff = await roster();
  const target = staff.find((s) => s.id === id);
  if (!target) return { ok: false, message: "That staff member was not found." };
  if (target.role_key === role) return { ok: true, message: "No change." };
  if (target.role_key === "SUPER_ADMIN" && role !== "SUPER_ADMIN" && target.is_active && wouldLeaveNoSuperAdmin(staff, id)) {
    return { ok: false, message: "This is the only active super administrator. Make someone else a super administrator first." };
  }

  const { data, error } = await supabase.from("staff_users").update({ role_key: role }).eq("id", id).select("id").maybeSingle();
  if (error || !data) {
    logger.warn("staff role change refused", { reason: error?.code ?? "no-row" });
    return { ok: false, message: ownsOpenCasesRefusal(error) ?? "The change was refused. You may not have permission." };
  }
  revalidatePath("/admin/staff");
  return { ok: true, message: "Role changed. It takes effect on their next request." };
}

/** Activate or deactivate. users.manage — and, for a SUPER_ADMIN, the last-one rule. */
export async function setStaffActive(_state: ActionState, formData: FormData): Promise<ActionState> {
  const denied = await authorize("users.manage");
  if (denied) return denied;

  const id = String(formData.get("id") ?? "");
  const active = formData.get("active") === "true";
  if (!UUID.test(id)) return { ok: false, message: "That change could not be read." };
  if (!active && id === (await currentStaffId())) return { ok: false, message: "You cannot deactivate yourself." };

  const staff = await roster();
  const target = staff.find((s) => s.id === id);
  if (!target) return { ok: false, message: "That staff member was not found." };
  if (target.is_active === active) return { ok: true, message: "No change." };
  if (!active && target.role_key === "SUPER_ADMIN" && wouldLeaveNoSuperAdmin(staff, id)) {
    return { ok: false, message: "This is the only active super administrator and cannot be deactivated." };
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.from("staff_users").update({ is_active: active }).eq("id", id).select("id").maybeSingle();
  if (error || !data) {
    logger.warn("staff activation refused", { reason: error?.code ?? "no-row" });
    return { ok: false, message: ownsOpenCasesRefusal(error) ?? "The change was refused. You may not have permission." };
  }
  revalidatePath("/admin/staff");
  return { ok: true, message: active ? "Reactivated." : "Deactivated. They are signed out on their next request." };
}

/**
 * Add a staff member: users.manage, and roles.manage as well for a SUPER_ADMIN (RLS enforces
 * both — 0009). Every write is the caller's own, so the audit trail names them; the sign-in
 * account in between is the only privileged call. See lib/admin/staff-onboarding.ts.
 */
export async function inviteStaff(_state: ActionState, formData: FormData): Promise<ActionState> {
  const denied = await authorize("users.manage");
  if (denied) return denied;

  const supabase = await createServerSupabase();
  const result = await onboardStaff(Object.fromEntries(formData), {
    canCreateSuperAdmin: await hasPermission("roles.manage"),
    roleExists: async (key) => Boolean((await supabase.from("roles").select("key").eq("key", key).maybeSingle()).data),
    branchExists: async (id) => Boolean((await supabase.from("branches").select("id").eq("id", id).eq("is_active", true).maybeSingle()).data),
    findStaff: async (email) => {
      const { data } = await supabase.from("staff_users").select("id,auth_user_id,is_active,role_key").eq("email", email).maybeSingle();
      return data ? { id: data.id, authUserId: data.auth_user_id, isActive: data.is_active, role: data.role_key } : null;
    },
    insertStaff: async (invite) => {
      const { data, error } = await supabase
        .from("staff_users")
        .insert({ email: invite.email, full_name: invite.fullName, role_key: invite.role, branch_id: invite.branchId, is_active: true })
        .select("id")
        .maybeSingle();
      if (error || !data) {
        logger.warn("staff insert refused", { reason: error?.code ?? "no-row" });
        return { ok: false, conflict: error?.code === "23505" };
      }
      return { ok: true, id: data.id };
    },
    ensureLogin: ensureStaffLogin,
    linkLogin: async (staffId, authUserId) => {
      const { data, error } = await supabase.from("staff_users").update({ auth_user_id: authUserId }).eq("id", staffId).is("auth_user_id", null).select("id").maybeSingle();
      if (error || !data) {
        logger.warn("staff login link refused", { reason: error?.code ?? "no-row" });
        const { data: now } = await supabase.from("staff_users").select("auth_user_id").eq("id", staffId).maybeSingle();
        return { ok: false, conflict: error?.code === "23505", linkedTo: now?.auth_user_id ?? null };
      }
      return { ok: true };
    },
  });

  revalidatePath("/admin/staff");
  if (result.ok && result.staffId) redirect(`/admin/staff?added=${result.staffId}`);
  return result;
}
