import "server-only";

import { deploymentStage } from "@/lib/deployment";
import { serverEnv } from "@/lib/env";
import { ordersAllowed, razorpayMode } from "./razorpay";

/**
 * Create one Razorpay order — the only place in the application that talks to
 * Razorpay's API. Both the consultation flow and the invoice flow go through here, so
 * the guards below cannot be forgotten by a new caller:
 *
 *   * a live key is refused outside a production deployment, and a test key inside one
 *     (ordersAllowed), before any request is made;
 *   * the amount is a positive integer number of paise, decided by the caller from its
 *     own record — never from a browser;
 *   * the request carries no payer identity. `notes` is for our own reference and is
 *     limited to short plain strings here, so an email or phone cannot ride along by
 *     accident.
 *
 * Nothing here decides that a payment happened. Only the signed webhook does.
 */

const RAZORPAY_ORDERS_URL = "https://api.razorpay.com/v1/orders";

export interface ProviderOrderInput {
  amountMinor: number;
  /** Our own reference (an invoice or payment reference). Shown on the Razorpay dashboard. */
  receipt: string;
  notes?: Record<string, string>;
}

export interface ProviderOrder {
  orderId: string;
  /** Safe for the browser: Razorpay Checkout needs it. The key SECRET never leaves this file. */
  keyId: string;
}

export interface ProviderOrderDeps {
  env: { RAZORPAY_KEY_ID?: string; RAZORPAY_KEY_SECRET?: string };
  stage: Parameters<typeof ordersAllowed>[1];
  fetch: typeof fetch;
}

export class ProviderOrderError extends Error {
  constructor(
    message: string,
    readonly reason: "not_configured" | "wrong_mode" | "bad_amount" | "rejected" | "malformed",
    readonly status?: number,
  ) {
    super(message);
    this.name = "ProviderOrderError";
  }
}

/**
 * Notes are our own bookkeeping, so both the names and the characters are narrow: no "@"
 * (an email address cannot ride along), no "+" or brackets (a formatted phone number
 * cannot), and only the three names callers actually use.
 */
const NOTE_KEYS = new Set(["purpose", "note", "invoice"]);
const SAFE_NOTE_VALUE = /^[\w .,:/#-]{1,80}$/;

/**
 * Refuse before any record is written: not configured, or the wrong mode for this
 * deployment. Callers that write a row first (consultation) call this ahead of the
 * insert, so a refusal leaves nothing behind.
 */
export function assertProviderReady(deps?: Partial<ProviderOrderDeps>): { keyId: string; keySecret: string } {
  const env = deps?.env ?? serverEnv();
  const stage = deps?.stage ?? deploymentStage();
  const keyId = env.RAZORPAY_KEY_ID;
  const keySecret = env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) throw new ProviderOrderError("Razorpay is not configured", "not_configured");

  const mode = razorpayMode(keyId);
  if (!ordersAllowed(mode, stage)) {
    throw new ProviderOrderError(`Razorpay ${mode} credentials must not be used from a ${stage} deployment`, "wrong_mode");
  }
  return { keyId, keySecret };
}

export async function createProviderOrder(input: ProviderOrderInput, deps?: Partial<ProviderOrderDeps>): Promise<ProviderOrder> {
  const doFetch = deps?.fetch ?? fetch;
  const { keyId, keySecret } = assertProviderReady(deps);

  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) {
    throw new ProviderOrderError("An order amount must be a positive whole number of paise", "bad_amount");
  }

  const notes: Record<string, string> = {};
  for (const [key, value] of Object.entries(input.notes ?? {})) {
    if (!NOTE_KEYS.has(key) || !SAFE_NOTE_VALUE.test(value)) throw new ProviderOrderError("An order note is not a short plain string", "bad_amount");
    notes[key] = value;
  }

  const response = await doFetch(RAZORPAY_ORDERS_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ amount: input.amountMinor, currency: "INR", receipt: input.receipt, notes }),
  });

  if (!response.ok) throw new ProviderOrderError(`Razorpay refused the order (${response.status})`, "rejected", response.status);

  const body = (await response.json().catch(() => null)) as { id?: unknown; amount?: unknown; currency?: unknown } | null;
  if (typeof body?.id !== "string" || !body.id.startsWith("order_")) {
    throw new ProviderOrderError("Razorpay did not return an order id", "malformed");
  }
  // The provider must agree on what we asked for — a mismatched amount is not something to charge.
  if (body.amount !== input.amountMinor || body.currency !== "INR") {
    throw new ProviderOrderError("Razorpay returned an order that does not match the request", "malformed");
  }
  return { orderId: body.id, keyId };
}
