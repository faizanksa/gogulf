import "server-only";

import { logger } from "@/lib/logger";
import { MAX_WEBHOOK_BYTES, normaliseEvent, verifyWebhookSignature, type NormalisedEvent } from "./razorpay";

/**
 * What the Razorpay webhook route decides, with no I/O of its own.
 *
 * The route reads the environment and hands the database call in as `apply`; this
 * function owns the order of checks and the status codes. That split is what makes
 * every branch below testable without a provider account or a database.
 *
 * STATUS CODES, AND WHY EACH ONE
 *
 *   503  the endpoint is deployed but not configured (no webhook secret). Razorpay
 *        retries, which is right: the delivery is not lost, it is deferred.
 *   401  the signature is absent or wrong. Not retryable, and never explained.
 *   400  the request is malformed (no event id, unparseable body, not an event).
 *        Retrying would send the same broken thing again.
 *   200  recorded. Includes duplicates and events we deliberately ignore —
 *        Razorpay's job is done and it must stop retrying.
 *   500  our side failed (the database call threw). Razorpay retries, and should.
 */

export type WebhookOutcome = "processed" | "duplicate" | "ignored";

export interface WebhookRequest {
  rawBody: string;
  signature: string | null;
  eventId: string | null;
  secret: string | undefined;
}

export interface WebhookResult {
  status: number;
  body: { status: string; outcome?: WebhookOutcome };
}

/** The database step: applying one event, idempotently. Injected so it can be faked. */
export type ApplyEvent = (event: NormalisedEvent & { eventId: string }) => Promise<WebhookOutcome>;

export async function handleRazorpayWebhook(request: WebhookRequest, apply: ApplyEvent): Promise<WebhookResult> {
  const { rawBody, signature, eventId, secret } = request;

  if (!secret) {
    logger.warn("razorpay.webhook.unconfigured", { reason: "RAZORPAY_WEBHOOK_SECRET is not set" });
    return { status: 503, body: { status: "not_configured" } };
  }

  // Bytes, not characters: a multi-byte payload is bigger than its string length.
  const bytes = Buffer.byteLength(rawBody, "utf8");
  if (bytes > MAX_WEBHOOK_BYTES) {
    logger.warn("razorpay.webhook.too_large", { bytes });
    return { status: 413, body: { status: "too_large" } };
  }

  // Signature first: nothing else in the request is trusted until it passes, and a
  // failure is not explained beyond "invalid".
  if (!verifyWebhookSignature(rawBody, signature, secret)) {
    logger.warn("razorpay.webhook.invalid_signature", { hasSignature: Boolean(signature), bytes });
    return { status: 401, body: { status: "invalid_signature" } };
  }

  if (!eventId) {
    logger.warn("razorpay.webhook.missing_event_id", {});
    return { status: 400, body: { status: "missing_event_id" } };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    logger.warn("razorpay.webhook.unparseable", { eventId });
    return { status: 400, body: { status: "invalid_json" } };
  }

  const event = normaliseEvent(parsed);
  if (!event) {
    logger.warn("razorpay.webhook.not_an_event", { eventId });
    return { status: 400, body: { status: "invalid_event" } };
  }

  try {
    const outcome = await apply({ ...event, eventId });
    // Safe identifiers only: provider ids, the event type and the outcome. No payer
    // identity has been read out of the payload, so none can be logged.
    logger.info("razorpay.webhook.recorded", {
      eventId,
      eventType: event.eventType,
      orderId: event.orderId,
      paymentId: event.paymentId,
      outcome,
    });
    return { status: 200, body: { status: "ok", outcome } };
  } catch (error) {
    logger.error("razorpay.webhook.apply_failed", {
      eventId,
      eventType: event.eventType,
      error: error instanceof Error ? error.message : "unknown",
    });
    // 500 so Razorpay retries: an event that we failed to record must come back.
    return { status: 500, body: { status: "error" } };
  }
}
