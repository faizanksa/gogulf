import "server-only";

import { deploymentStage } from "@/lib/deployment";
import { serverEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { ordersAllowed, razorpayMode } from "./razorpay";

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

const RAZORPAY_ORDERS_URL = "https://api.razorpay.com/v1/orders";

export async function createConsultationOrder(input: ConsultationOrderInput): Promise<ConsultationOrder> {
  const env = serverEnv();
  const keyId = env.RAZORPAY_KEY_ID;
  const keySecret = env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) throw new Error("Razorpay is not configured");

  // A live key outside production, or a test key in production, is refused before a
  // request is made. This is what makes it safe to hold live credentials locally.
  const mode = razorpayMode(keyId);
  const stage = deploymentStage();
  if (!ordersAllowed(mode, stage)) {
    throw new Error(`Razorpay ${mode} credentials must not be used from a ${stage} deployment`);
  }

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

  const response = await fetch(RAZORPAY_ORDERS_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: amountMinor,
      currency: "INR",
      receipt: payment.reference,
      notes: { purpose: "consultation", ...(input.note ? { note: input.note } : {}) },
    }),
  });

  if (!response.ok) {
    // Roll our record back to failed rather than leaving it `created` forever.
    await supabase
      .from("payments")
      .update({ status: "failed", failed_at: new Date().toISOString(), failure_reason: `order creation returned ${response.status}` })
      .eq("id", payment.id);
    logger.error("razorpay.order.create_failed", { reference: payment.reference, status: response.status });
    throw new Error("Could not create the Razorpay order");
  }

  const order = (await response.json()) as { id?: string };
  if (!order.id) throw new Error("Razorpay did not return an order id");

  const { error: updateError } = await supabase.from("payments").update({ provider_order_id: order.id }).eq("id", payment.id);
  if (updateError) throw new Error(`Could not attach the order id: ${updateError.code ?? "unknown"}`);

  logger.info("razorpay.order.created", { reference: payment.reference, orderId: order.id, amountMinor });

  return {
    paymentId: payment.id,
    reference: payment.reference,
    providerOrderId: order.id,
    amountMinor,
    currency: "INR",
    keyId,
  };
}
