import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Razorpay primitives: signature verification, event normalisation, and the rule
 * that keeps live keys out of everything that is not production.
 *
 * Everything here is pure and synchronous so it can be tested exhaustively without a
 * network, a database or a provider account. The route wires it to the environment;
 * `lib/payments/webhook.ts` holds the decision table.
 *
 * SCOPE: consultation fees only. Nothing in this module knows what a job or a job
 * application is, and it must stay that way — paid job applications are not approved
 * (docs/PAYMENTS.md, content/company.ts claims register).
 */

/** Events we act on. Anything else is recorded and ignored rather than guessed at. */
export const HANDLED_EVENTS = ["order.paid", "payment.captured", "payment.authorized", "payment.failed"] as const;
export type HandledEvent = (typeof HANDLED_EVENTS)[number];

/** A webhook body larger than this is refused before any work is done on it. */
export const MAX_WEBHOOK_BYTES = 1_048_576; // 1 MiB; real events are a few KB

export type RazorpayMode = "live" | "test" | "unknown";

export function razorpayMode(keyId: string | undefined): RazorpayMode {
  if (!keyId) return "unknown";
  if (keyId.startsWith("rzp_live_")) return "live";
  if (keyId.startsWith("rzp_test_")) return "test";
  return "unknown";
}

/**
 * A live key may only be used by a production deployment. Test keys are refused in
 * production for the same reason in reverse: a "successful" payment that never
 * existed is worse than a failed one.
 *
 * This is the guard that makes it safe for a developer to hold live credentials in
 * `.env.local` — which is where they end up in practice, whatever the policy says.
 */
export function ordersAllowed(mode: RazorpayMode, stage: "production" | "staging" | "preview" | "local"): boolean {
  if (mode === "unknown") return false;
  return stage === "production" ? mode === "live" : mode === "test";
}

/**
 * Razorpay signs the RAW request body with the webhook secret (HMAC SHA-256, hex).
 * The body must be verified exactly as received: parsing and re-serialising JSON
 * changes key order and whitespace, and the signature then never matches — which is
 * the classic way this check gets "fixed" into uselessness.
 */
export function verifyWebhookSignature(rawBody: string, signature: string | null | undefined, secret: string): boolean {
  if (!signature || !secret) return false;
  // Reject anything that is not lower-case hex before touching Buffer.from, which
  // silently truncates on invalid input.
  if (!/^[0-9a-f]+$/i.test(signature)) return false;

  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest();
  const provided = Buffer.from(signature, "hex");
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}

export interface NormalisedEvent {
  eventType: string;
  orderId: string | null;
  paymentId: string | null;
  amountMinor: number | null;
  currency: string | null;
  method: string | null;
  errorCode: string | null;
  errorDescription: string | null;
}

type Entity = Record<string, unknown> | undefined;
const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);
const int = (v: unknown): number | null => (typeof v === "number" && Number.isSafeInteger(v) ? v : null);

/**
 * Pull the few fields we store out of a webhook body. Everything else — the payer's
 * name, email, phone and any card metadata — is deliberately dropped here, so it
 * cannot reach the database even by accident.
 *
 * Returns null when the body is not a Razorpay event at all.
 */
export function normaliseEvent(body: unknown): NormalisedEvent | null {
  if (typeof body !== "object" || body === null) return null;
  const event = body as Record<string, unknown>;
  const eventType = str(event.event);
  if (!eventType) return null;

  const payload = (event.payload ?? {}) as Record<string, unknown>;
  const payment = ((payload.payment as Record<string, unknown>)?.entity ?? undefined) as Entity;
  const order = ((payload.order as Record<string, unknown>)?.entity ?? undefined) as Entity;

  return {
    eventType,
    orderId: str(payment?.order_id) ?? str(order?.id),
    paymentId: str(payment?.id),
    amountMinor: int(payment?.amount) ?? int(order?.amount),
    currency: str(payment?.currency) ?? str(order?.currency),
    method: str(payment?.method),
    errorCode: str(payment?.error_code),
    errorDescription: str(payment?.error_description),
  };
}
