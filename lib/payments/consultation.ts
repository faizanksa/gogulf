import "server-only";

import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertProviderReady, createProviderOrder, ProviderOrderError } from "./provider-order";

/**
 * Creating the order a consultation fee is paid against — the server half of a
 * checkout that does not exist yet.
 *
 * THE FLOW THIS PREPARES, AND THE PART THAT IS MISSING
 *
 *   consultation agreed → createConsultationOrder() (here)
 *   → the payer completes Razorpay Checkout in the browser
 *   → Razorpay's signed webhook marks the payment paid (/api/razorpay/webhook)
 *   → receipt / acknowledgement
 *
 * The checkout UI is NOT built: no page collects a payment, and nothing calls this
 * function yet. It exists so the flow can be switched on in one reviewed change
 * rather than written under time pressure on the day.
 *
 * What is settled here and must not be re-decided later:
 *
 *   * The order is created server-side. A browser never states an amount — that is
 *     how you get charged ₹1 for a ₹5,000 consultation.
 *   * The payment row is written as `created` BEFORE the payer sees a checkout, so a
 *     webhook can never arrive for an order we have no record of.
 *   * Success is never inferred here or in any client callback. Only the webhook
 *     moves a payment to paid.
 *   * Consultation fees only. This module has no access to jobs or applications.
 */

export interface ConsultationOrderInput {
  /** Whole rupees, as agreed with the customer. Converted to paise here. */
  amountRupees: number;
  contactId?: string;
  caseId?: string;
  branchId?: string;
  /** Appears on the Razorpay dashboard line; no payer identity. */
  note?: string;
}

export interface ConsultationOrder {
  paymentId: string;
  reference: string;
  providerOrderId: string;
  amountMinor: number;
  currency: "INR";
  /** Safe to hand to the browser when a checkout exists. The key SECRET never is. */
  keyId: string;
}

export async function createConsultationOrder(input: ConsultationOrderInput): Promise<ConsultationOrder> {
  // A live key outside production (or a test key inside it) is refused before any row is written.
  assertProviderReady();

  if (!Number.isInteger(input.amountRupees) || input.amountRupees <= 0) {
    throw new Error("A consultation amount must be a positive whole number of rupees");
  }
  const amountMinor = input.amountRupees * 100;

  const supabase = createAdminClient("system-automation");

  // Our record first: an order that exists at the provider but not here is an
  // unreconcilable payment waiting to happen.
  const { data: payment, error: insertError } = await supabase
    .from("payments")
    .insert({
      provider: "razorpay",
      purpose: "consultation",
      status: "created",
      // Filled in immediately below; the column is NOT NULL, so a placeholder that
      // could survive a failure is not acceptable — the insert and the provider call
      // are ordered so a failure leaves no usable row.
      provider_order_id: `pending:${crypto.randomUUID()}`,
      amount_minor: amountMinor,
      currency: "INR",
      contact_id: input.contactId ?? null,
      case_id: input.caseId ?? null,
      branch_id: input.branchId ?? null,
    })
    .select("id, reference")
    .single();

  if (insertError || !payment) throw new Error(`Could not open a payment record: ${insertError?.code ?? "unknown"}`);

  let order;
  try {
    // Refuses a live key outside production (and a test key inside it) before any request.
    order = await createProviderOrder({
      amountMinor,
      receipt: payment.reference,
      notes: { purpose: "consultation", ...(input.note ? { note: input.note } : {}) },
    });
  } catch (error) {
    // Roll our record back to failed rather than leaving it `created` forever.
    const reason = error instanceof ProviderOrderError ? error.reason : "unknown";
    await supabase
      .from("payments")
      .update({ status: "failed", failed_at: new Date().toISOString(), failure_reason: `order creation: ${reason}` })
      .eq("id", payment.id);
    logger.error("razorpay.order.create_failed", { reference: payment.reference, reason });
    throw error instanceof ProviderOrderError && error.reason === "wrong_mode" ? error : new Error("Could not create the Razorpay order");
  }
  const { error: updateError } = await supabase.from("payments").update({ provider_order_id: order.orderId }).eq("id", payment.id);
  if (updateError) throw new Error(`Could not attach the order id: ${updateError.code ?? "unknown"}`);

  logger.info("razorpay.order.created", { reference: payment.reference, orderId: order.orderId, amountMinor });

  return {
    paymentId: payment.id,
    reference: payment.reference,
    providerOrderId: order.orderId,
    amountMinor,
    currency: "INR",
    keyId: order.keyId,
  };
}
