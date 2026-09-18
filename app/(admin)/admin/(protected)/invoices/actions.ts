"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/admin/action-state";
import { AuthorizationError, requirePermission, type Permission } from "@/lib/auth/permissions";
import { explainInvoiceError } from "@/lib/billing/errors";
import { parseInvoiceForm } from "@/lib/billing/validation";
import { logger } from "@/lib/logger";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

/**
 * Invoice mutations for the staff workspace.
 *
 * Every action: requirePermission first (layer 2), then a write through the staff
 * member's own session, where RLS and invoices_before_write decide (layer 3). Nothing here
 * uses the service-role client. What the database refuses comes back as
 * explainInvoiceError's sentences, never as raw error text.
 *
 * Audit entries are written by the database (invoices_audit), in the same transaction as
 * the change and attributed to the staff member from their JWT — not by this code, which
 * could forget or be bypassed.
 *
 * Nothing here can mark an invoice paid, pending or failed. Those states belong to a
 * verified payment event and a payer opening a payment request, and the database refuses
 * a staff request for them regardless of what this file sends.
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

function refused(what: string, error: { code?: string; message?: string; details?: string | null; hint?: string | null }): ActionState {
  logger.warn(`staff ${what} refused`, { reason: error.code ?? "unknown" });
  return { ok: false, message: explainInvoiceError(error).message };
}

function formInput(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) if (typeof value === "string") out[key] = value;
  return out;
}

/**
 * Create (no id) or edit (with id) a DRAFT, and — when the Issue button was pressed —
 * issue it in the same request. An issued invoice cannot be edited: the database holds
 * its amounts and customer details, and this action says so plainly rather than saving
 * something that would be silently discarded.
 */
export async function saveInvoice(_state: ActionState, formData: FormData): Promise<ActionState> {
  const denied = await authorize("invoices.issue");
  if (denied) return denied;

  const id = String(formData.get("id") ?? "");
  const intent = formData.get("intent") === "issue" ? "issue" : "save";

  const parsed = parseInvoiceForm(formInput(formData));
  if (!parsed.ok) return { ok: false, message: "Some fields need attention.", fieldErrors: parsed.fieldErrors };

  const { billing_address, line_items, ...rest } = parsed.values;
  const row = { ...rest, billing_address: billing_address as Json, line_items: line_items as unknown as Json };
  const supabase = await createServerSupabase();

  let invoiceId = id;
  if (!id) {
    const { data, error } = await supabase.from("invoices").insert(row).select("id").single();
    if (error) return refused("invoice create", error);
    invoiceId = data.id;
  } else {
    if (!UUID.test(id)) return { ok: false, message: "The invoice was not found." };
    const { data: current } = await supabase.from("invoices").select("status").eq("id", id).maybeSingle();
    if (!current) return { ok: false, message: "The invoice was not found, or your role cannot edit it." };
    if (current.status !== "draft") return { ok: false, message: "An issued invoice cannot be edited. Void it and create a new one if something is wrong." };

    const { data, error } = await supabase.from("invoices").update(row).eq("id", id).select("id").maybeSingle();
    if (error) return refused("invoice edit", error);
    if (!data) return { ok: false, message: "The invoice was not found, or your role cannot edit it." };
  }

  revalidatePath("/admin/invoices");
  revalidatePath(`/admin/invoices/${invoiceId}`);

  if (intent === "issue") {
    const { data, error } = await supabase.from("invoices").update({ status: "issued" }).eq("id", invoiceId).eq("status", "draft").select("id").maybeSingle();
    if (error) return refused("invoice issue", error);
    if (!data) return { ok: false, message: "The draft was saved, but it could not be issued. Refresh the page and try again." };
    redirect(`/admin/invoices/${invoiceId}?saved=issued`);
  }

  redirect(`/admin/invoices/${invoiceId}?saved=${id ? "draft" : "created"}`);
}

/** Issue an existing draft without editing it. */
export async function issueInvoice(_state: ActionState, formData: FormData): Promise<ActionState> {
  const denied = await authorize("invoices.issue");
  if (denied) return denied;

  const id = String(formData.get("id") ?? "");
  if (!UUID.test(id)) return { ok: false, message: "The invoice was not found." };

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.from("invoices").update({ status: "issued" }).eq("id", id).eq("status", "draft").select("id").maybeSingle();
  if (error) return refused("invoice issue", error);
  if (!data) return { ok: false, message: "The invoice has changed since this page loaded. Refresh and try again." };

  revalidatePath("/admin/invoices");
  revalidatePath(`/admin/invoices/${id}`);
  return { ok: true, message: "Invoice issued. The payment link and QR code are ready." };
}

/**
 * Void an invoice, with a reason. The only way out of an issued invoice: there is no
 * "mark unpaid" and no reopening — a paid invoice cannot be voided here at all, because
 * reversing received money is a refund, which needs its own approved, audited flow.
 */
export async function voidInvoice(_state: ActionState, formData: FormData): Promise<ActionState> {
  const denied = await authorize("invoices.void");
  if (denied) return denied;

  const id = String(formData.get("id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!UUID.test(id)) return { ok: false, message: "The invoice was not found." };
  if (reason.length < 3 || reason.length > 500) return { ok: false, message: "Give a reason for voiding this invoice (3 to 500 characters).", fieldErrors: { reason: "Give a reason (3 to 500 characters)." } };

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("invoices")
    .update({ status: "void", void_reason: reason })
    .eq("id", id)
    .in("status", ["draft", "issued", "payment_failed"])
    .select("id")
    .maybeSingle();
  if (error) return refused("invoice void", error);
  if (!data) return { ok: false, message: "This invoice cannot be voided in its current state. Refresh the page — a payment may be in progress or already received." };

  revalidatePath("/admin/invoices");
  revalidatePath(`/admin/invoices/${id}`);
  return { ok: true, message: "Invoice voided." };
}
