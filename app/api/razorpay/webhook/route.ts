/**
 * POST /api/razorpay/webhook
 *
 * Razorpay's signed statement about money. It is the ONLY thing that moves a payment
 * to paid: a browser returning from checkout proves nothing, and no client callback
 * writes payment state anywhere in this application.
 *
 * Production URL: https://www.gogulf.co/api/razorpay/webhook
 * Events:         order.paid, payment.authorized, payment.failed
 *
 * The decision table lives in lib/payments/webhook.ts and the database work in
 * lib/payments/record.ts, so both are unit-tested without a provider or a database.
 * Configuration (the webhook secret) is read here and nowhere else.
 *
 * Scope: consultation fees only. This endpoint cannot mark a job application as paid
 * — there is no link between payments and applications in the schema (0014).
 */

import { handleRazorpayWebhook } from "@/lib/payments/webhook";
import { applyPaymentEvent } from "@/lib/payments/record";
import { serverEnv } from "@/lib/env";

export const runtime = "nodejs";

// NOTE: no `export const dynamic = "force-dynamic"`, matching app/api/forms/*.
// That directive is incompatible with `output: 'export'`, which is still how
// production is built until the cutover. A POST-only handler is dynamic anyway.

export async function POST(request: Request) {
  // The raw body, exactly as sent. Never JSON.parse before the signature check:
  // re-serialising changes bytes, and the HMAC is over bytes.
  const rawBody = await request.text();

  const result = await handleRazorpayWebhook(
    {
      rawBody,
      signature: request.headers.get("x-razorpay-signature"),
      eventId: request.headers.get("x-razorpay-event-id"),
      secret: serverEnv().RAZORPAY_WEBHOOK_SECRET,
    },
    applyPaymentEvent,
  );

  return Response.json(result.body, {
    status: result.status,
    headers: { "cache-control": "no-store" },
  });
}
