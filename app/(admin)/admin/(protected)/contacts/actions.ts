"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/admin/action-state";
import { AuthorizationError, requirePermission, type Permission } from "@/lib/auth/permissions";
import { editRefusal, isUuid, mergeRefusal, parseContactEdit, parseOwner } from "@/lib/crm/contact-edit";
import { logger } from "@/lib/logger";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Contact editing and merging (0021). Each action checks the permission first (layer 2),
 * then writes through the caller's own session, where the database decides (layer 3):
 * column privileges allow only the editable fields, RLS allows only contacts in the
 * caller's scope, contacts_guard allows an owner/branch change only with contacts.assign
 * (and a move to another branch only at all scope), and merge_contacts() does everything
 * about a merge in one audited transaction. Nothing here uses the service-role client.
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

/** Save the editable details of one contact; the owner too, when the form sends it. */
export async function updateContact(_state: ActionState, formData: FormData): Promise<ActionState> {
  const denied = await authorize("contacts.update");
  if (denied) return denied;

  const input = Object.fromEntries(formData);
  const id = input.id;
  if (!isUuid(id)) return { ok: false, message: "That contact could not be read." };

  const parsed = parseContactEdit(input);
  if (!parsed.ok) return { ok: false, message: "Some fields need attention.", fieldErrors: parsed.fieldErrors };
  const owner = parseOwner(input);
  if (!owner.ok) return { ok: false, message: "Choose an owner from the list.", fieldErrors: { owner_id: "Choose an owner from the list." } };

  const supabase = await createServerSupabase();
  const changes = owner.value === undefined ? parsed.value : { ...parsed.value, owner_id: owner.value };
  const { data, error } = await supabase.from("contacts").update(changes).eq("id", id).select("id").maybeSingle();
  if (error || !data) {
    logger.warn("contact update refused", { reason: error?.code ?? "no-row" });
    return { ok: false, message: error ? editRefusal(error) : "This contact is not one you can edit." };
  }

  revalidatePath(`/admin/contacts/${id}`);
  revalidatePath("/admin/contacts");
  redirect(`/admin/contacts/${id}?saved=1`);
}

/** Merge `merged` into `survivor`. Everything is decided — and undone on failure — in the database. */
export async function mergeContact(_state: ActionState, formData: FormData): Promise<ActionState> {
  const denied = await authorize("contacts.merge");
  if (denied) return denied;

  const survivor = formData.get("survivor");
  const merged = formData.get("merged");
  const reason = String(formData.get("reason") ?? "").replace(/\s+/g, " ").trim().slice(0, 300);
  if (!isUuid(survivor) || !isUuid(merged)) return { ok: false, message: "Choose the contact to merge." };
  if (formData.get("confirm") !== "yes") return { ok: false, message: "Tick the box to confirm the merge." };

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("merge_contacts", { p_survivor: survivor, p_merged: merged, p_reason: reason || undefined });
  if (error || !data) {
    logger.warn("contact merge refused", { reason: error?.code ?? "no-row" });
    return { ok: false, message: mergeRefusal(error) };
  }

  revalidatePath(`/admin/contacts/${survivor}`);
  revalidatePath(`/admin/contacts/${merged}`);
  revalidatePath("/admin/contacts");
  redirect(`/admin/contacts/${survivor}?merged=1`);
}
