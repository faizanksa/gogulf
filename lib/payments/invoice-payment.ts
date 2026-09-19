import "server-only";

import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicBillingClient, getPublicInvoice } from "@/lib/billing/public-data";
import { isPayable, normaliseReference } from "@/lib/billing/model";
import { assertProviderReady, createProviderOrder, ProviderOrderError, type ProviderOrderDeps } from "./provider-order";

/**
 * Start (or resume) the payment for one issued invoice — what "Pay securely" calls.
 *
 * THE ORDER OF THINGS, AND WHY
 *
 *   1. Read the invoice through public_invoice_view (anon, read-only, explicit column
 *      allow-list). Its total is the only amount used.
 *   2. Ask open_invoice_payment_request with NO order id: if a live order already exists
 *      it is returned, so reloading the page or double-clicking never mints a second
 *      order at Razorpay.
 *   3. Otherwise create the order at Razorpay (createProviderOrder: mode guard, integer
 *      paise, no payer identity), then record it against the invoice with the same
 *      function. If a concurrent request won the race, the database hands back the
 *      winner's order and ours is simply never used.
 *
 * open_invoice_payment_request is called with the privileged client, and ONLY here (0017).
 * It stores a caller-supplied provider order id, and an order id is only real if Razorpay
 * issued it to us — which only this server knows. While anon could call it, anyone holding
 * the public anon key could plant an invented order id on any issued invoice and jam it.
 *
 * What comes back is what Razorpay Checkout needs to OPEN. It is not a payment result:
 * only the signed webhook moves an invoice to paid (docs/PAYMENTS.md).
 *
 * No secret, no internal id and no payer identity is returned — the key id is public
 * by design, the amount comes from the invoice, and the reference is the one already in
 * the payer's URL.
 */

export interface InvoiceCheckout {
  keyId: string;
  orderId: string;
  amountMinor: number;
  currency: "INR";
  reference: string;
  description: string;
}

export type StartPaymentResult =
  | { ok: true; checkout: InvoiceCheckout }
  | { ok: false; reason: "not_found" | "not_payable" | "unavailable" };

interface OpenedRow {
  amount_minor: number | string;
  currency: string;
  provider_order_id: string;
}

export async function startInvoicePayment(input: string, deps?: Partial<ProviderOrderDeps>): Promise<StartPaymentResult> {
  const reference = normaliseReference(input);
  if (!reference) return { ok: false, reason: "not_found" };

  if (!publicBillingClient()) return { ok: false, reason: "unavailable" };

  const invoice = await getPublicInvoice(reference);
  if (!invoice) return { ok: false, reason: "not_found" };
  if (!isPayable(invoice.status)) return { ok: false, reason: "not_payable" };

  try {
    // Refuse a wrong-mode or missing key before touching anything.
    const { keyId } = assertProviderReady(deps);
    const supabase = createAdminClient("payment-request");

    const opened = async (orderId?: string): Promise<OpenedRow | null> => {
      const { data, error } = await supabase.rpc("open_invoice_payment_request", {
        p_reference: reference,
        ...(orderId ? { p_provider_order_id: orderId } : {}),
      });
      if (error) {
        if (error.message === "invoice_not_payable") return null;
        throw new Error(`open_invoice_payment_request failed: ${error.code ?? "unknown"}`);
      }
      return (data?.[0] as OpenedRow | undefined) ?? null;
    };

    let row = await opened();
    if (!row) {
      const order = await createProviderOrder({ amountMinor: invoice.totalMinor, receipt: reference, notes: { invoice: reference } }, deps);
      row = await opened(order.orderId);
    }
    if (!row) return { ok: false, reason: "not_payable" };

    // The database and the provider must agree with what the payer was shown.
    if (Number(row.amount_minor) !== invoice.totalMinor || row.currency !== "INR") {
      logger.error("invoice.payment.amount_mismatch", { reference });
      return { ok: false, reason: "unavailable" };
    }

    return {
      ok: true,
      checkout: {
        keyId,
        orderId: row.provider_order_id,
        amountMinor: invoice.totalMinor,
        currency: "INR",
        reference,
        description: invoice.purpose,
      },
    };
  } catch (error) {
    // The reason class only — never a payload, never a key.
    logger.error("invoice.payment.start_failed", { reference, reason: error instanceof ProviderOrderError ? error.reason : "error" });
    return { ok: false, reason: "unavailable" };
  }
}
