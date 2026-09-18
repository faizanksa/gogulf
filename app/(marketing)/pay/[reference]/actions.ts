"use server";

import { headers } from "next/headers";
import { normaliseReference } from "@/lib/billing/model";
import { startInvoicePayment, type InvoiceCheckout } from "@/lib/payments/invoice-payment";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/**
 * "Pay securely" on the customer payment page. Public by design — a payer has no login —
 * so it accepts exactly one input, the invoice reference already in their URL, and
 * nothing else: not an amount, not an id. What is charged is decided by
 * startInvoicePayment from the invoice itself.
 *
 * Rate limited per address and per invoice (lib/rate-limit.ts, per-instance and honest
 * about it): the real guards are in the database — one live order per invoice, amount read
 * from the invoice — and this only raises the cost of hammering Razorpay's API.
 */
export type BeginPaymentResult =
  | { ok: true; checkout: InvoiceCheckout }
  | { ok: false; reason: "not_found" | "not_payable" | "unavailable" | "rate_limited" };

export async function beginPayment(reference: string): Promise<BeginPaymentResult> {
  const ref = normaliseReference(String(reference ?? ""));
  if (!ref) return { ok: false, reason: "not_found" };

  const ip = clientIp(await headers());
  if (!rateLimit(`pay:ip:${ip}`, 30, 60).allowed || !rateLimit(`pay:ref:${ref}`, 12, 60).allowed) {
    return { ok: false, reason: "rate_limited" };
  }

  return startInvoicePayment(ref);
}
