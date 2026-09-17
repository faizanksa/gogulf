"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/admin/action-state";
import { AuthorizationError, requirePermission } from "@/lib/auth/permissions";
import { explainDbError } from "@/lib/jobs/errors";
import { canTransition, JOB_STATUSES, transitionAction } from "@/lib/jobs/model";
import { revalidateJobPages } from "@/lib/jobs/revalidate";
import { parseJobForm, type JobWrite } from "@/lib/jobs/validation";
import { logger } from "@/lib/logger";
import { createServerSupabase } from "@/lib/supabase/server";
import type { JobStatus } from "@/types/database";

/**
 * Job mutations for the staff workspace.
 *
 * Every action: requirePermission("jobs.manage") first (layer 2), then a write through
 * the staff member's own session, where RLS and the jobs_before_write trigger decide
 * (layer 3). Nothing here uses the service-role key. What the database refuses comes back
 * as explainDbError's sentences, never as raw error text.
 *
 * Audit entries are written by the database (jobs_audit), in the same transaction as the
 * change, attributed to the staff member from their JWT — not by this code, which could
 * forget or be bypassed.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function authorize(): Promise<ActionState> {
  try {
    await requirePermission("jobs.manage");
    return null;
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, message: error.message };
    throw error;
  }
}

function refused(what: string, error: { code?: string; message?: string; details?: string | null; hint?: string | null }): ActionState {
  const explained = explainDbError(error);
  // The code only; no row data, no free text that could carry personal data.
  logger.warn(`staff ${what} refused`, { reason: error.code ?? "unknown" });
  return { ok: false, message: explained.message, problems: explained.problems };
}

function formInput(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) if (typeof value === "string") out[key] = value;
  return out;
}

/** Create (no id) or edit (with id) a job from the staff form. */
export async function saveJob(_state: ActionState, formData: FormData): Promise<ActionState> {
  const denied = await authorize();
  if (denied) return denied;

  const id = String(formData.get("id") ?? "");
  const parsed = parseJobForm(formInput(formData));
  if (!parsed.ok) {
    return { ok: false, message: "Some fields need attention.", fieldErrors: parsed.fieldErrors as Record<string, string>, warnings: parsed.warnings };
  }

  const supabase = await createServerSupabase();

  if (!id) {
    const { data, error } = await supabase.from("jobs").insert(parsed.values).select("id, slug").single();
    if (error) return refused("job create", error);
    revalidatePath("/admin/jobs");
    const notice = parsed.warnings.length ? "&notice=normalised" : "";
    redirect(`/admin/jobs/${data.id}?saved=created${notice}`);
  }

  if (!UUID.test(id)) return { ok: false, message: "The job was not found." };
  // A published reference is frozen by the database; sending it unchanged is harmless,
  // but leaving it out when empty keeps an edit from clearing a generated reference.
  const values: Partial<JobWrite> = { ...parsed.values };
  if (!values.reference) delete values.reference;

  const { data, error } = await supabase.from("jobs").update(values).eq("id", id).select("id, slug, status").maybeSingle();
  if (error) return refused("job edit", error);
  if (!data) return { ok: false, message: "The job was not found, or your role cannot edit it." };

  revalidatePath(`/admin/jobs/${id}`);
  revalidatePath("/admin/jobs");
  revalidateJobPages(data.slug);
  return { ok: true, message: "Changes saved.", warnings: parsed.warnings };
}

/**
 * Move a job through its lifecycle. The expected current status travels with the
 * request, so a page left open while someone else changed the job cannot apply a
 * transition to a state it never saw.
 */
export async function transitionJob(_state: ActionState, formData: FormData): Promise<ActionState> {
  const denied = await authorize();
  if (denied) return denied;

  const id = String(formData.get("id") ?? "");
  const from = String(formData.get("from") ?? "") as JobStatus;
  const to = String(formData.get("to") ?? "") as JobStatus;
  if (!UUID.test(id) || !JOB_STATUSES.includes(from) || !JOB_STATUSES.includes(to) || !canTransition(from, to)) {
    return { ok: false, message: "That status change is not allowed." };
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.from("jobs").update({ status: to }).eq("id", id).eq("status", from).select("slug").maybeSingle();
  if (error) return refused("job transition", error);
  if (!data) return { ok: false, message: "The job has changed since this page loaded. Refresh and try again." };

  revalidatePath(`/admin/jobs/${id}`);
  revalidatePath("/admin/jobs");
  revalidateJobPages(data.slug);
  const action = transitionAction(from, to);
  return { ok: true, message: `${action.label}: done.` };
}

/** Feature (with an optional end date) or unfeature. Application access is untouched. */
export async function setPromotion(_state: ActionState, formData: FormData): Promise<ActionState> {
  const denied = await authorize();
  if (denied) return denied;

  const id = String(formData.get("id") ?? "");
  const promotion = String(formData.get("promotion") ?? "");
  const until = String(formData.get("featured_until") ?? "").trim();
  if (!UUID.test(id) || (promotion !== "featured" && promotion !== "standard")) return { ok: false, message: "Choose featured or standard." };
  if (until && !/^\d{4}-\d{2}-\d{2}$/.test(until)) return { ok: false, message: "Enter the featured-until date as a date." };

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("jobs")
    .update(promotion === "featured" ? { promotion, featured_until: until || null } : { promotion, featured_until: null })
    .eq("id", id)
    .select("slug")
    .maybeSingle();
  if (error) return refused("job promotion", error);
  if (!data) return { ok: false, message: "The job was not found, or your role cannot edit it." };

  revalidatePath(`/admin/jobs/${id}`);
  revalidatePath("/admin/jobs");
  revalidateJobPages(data.slug);
  return { ok: true, message: promotion === "featured" ? "The job is featured." : "The job is no longer featured." };
}

/** Copy a job into a new draft: same content, new reference, standard visibility, no history. */
export async function duplicateJob(_state: ActionState, formData: FormData): Promise<ActionState> {
  const denied = await authorize();
  if (denied) return denied;

  const id = String(formData.get("id") ?? "");
  if (!UUID.test(id)) return { ok: false, message: "The job was not found." };

  const supabase = await createServerSupabase();
  const { data: source, error: readError } = await supabase.from("jobs").select("*").eq("id", id).maybeSingle();
  if (readError || !source) return { ok: false, message: "The job was not found." };

  const copy = {
    title: `${source.title} (copy)`.slice(0, 120),
    category_id: source.category_id,
    country_code: source.country_code,
    city: source.city,
    employer_disclosure: source.employer_disclosure,
    employer_name: source.employer_name,
    employment_type: source.employment_type,
    vacancies: source.vacancies,
    salary_currency: source.salary_currency,
    salary_min: source.salary_min,
    salary_max: source.salary_max,
    salary_period: source.salary_period,
    experience: source.experience,
    education: source.education,
    languages: source.languages,
    summary: source.summary,
    responsibilities: source.responsibilities,
    requirements: source.requirements,
    benefits: source.benefits,
    additional_info: source.additional_info,
    internal_notes: source.internal_notes,
    availability: source.availability,
    // A copied deadline is almost always wrong for the new job; it is chosen again.
    closes_on: null,
    promotion: "standard" as const,
    featured_until: null,
    application_access: source.application_access,
    application_method: source.application_method,
    duplicated_from: source.id,
  };

  const { data, error } = await supabase.from("jobs").insert(copy).select("id").single();
  if (error) return refused("job duplicate", error);
  revalidatePath("/admin/jobs");
  redirect(`/admin/jobs/${data.id}?saved=duplicated`);
}
