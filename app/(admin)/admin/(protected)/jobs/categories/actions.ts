"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/admin/action-state";
import { AuthorizationError, requirePermission } from "@/lib/auth/permissions";
import { explainDbError } from "@/lib/jobs/errors";
import { revalidateJobPages } from "@/lib/jobs/revalidate";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Job categories are data: adding one is a row, not a deploy. Managed under jobs.manage;
 * every change is audited by the database (audit_job_categories).
 */

async function authorize(): Promise<ActionState> {
  try {
    await requirePermission("jobs.manage");
    return null;
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, message: error.message };
    throw error;
  }
}

// Not exported: a "use server" module may export only async Server Actions.
function slugFor(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

export async function createCategory(_state: ActionState, formData: FormData): Promise<ActionState> {
  const denied = await authorize();
  if (denied) return denied;
  const name = String(formData.get("name") ?? "").replace(/\s+/g, " ").trim();
  const classification = String(formData.get("classification") ?? "");
  if (name.length < 2 || name.length > 60) return { ok: false, message: "A category name is 2 to 60 characters." };
  if (classification !== "general" && classification !== "professional") return { ok: false, message: "Choose general hiring or professional." };
  const slug = slugFor(name);
  if (!slug) return { ok: false, message: "A category name must contain letters or digits." };

  const supabase = await createServerSupabase();
  const { error } = await supabase.from("job_categories").insert({ name, slug, classification, sort_order: 500 });
  if (error) return { ok: false, message: explainDbError(error).message };
  revalidatePath("/admin/jobs/categories");
  return { ok: true, message: `Added “${name}”.` };
}

export async function setCategoryActive(_state: ActionState, formData: FormData): Promise<ActionState> {
  const denied = await authorize();
  if (denied) return denied;
  const id = String(formData.get("id") ?? "");
  const active = String(formData.get("active") ?? "") === "true";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, message: "The category was not found." };

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.from("job_categories").update({ is_active: active }).eq("id", id).select("name").maybeSingle();
  if (error) return { ok: false, message: explainDbError(error).message };
  if (!data) return { ok: false, message: "The category was not found, or your role cannot change it." };
  revalidatePath("/admin/jobs/categories");
  revalidateJobPages();
  return {
    ok: true,
    message: active
      ? `“${data.name}” can be chosen for jobs again.`
      : `“${data.name}” can no longer be chosen for new jobs. Jobs already in it are unchanged.`,
  };
}
