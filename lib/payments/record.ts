import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { ApplyEvent } from "./webhook";

/**
 * The database side of the webhook: one call to `record_payment_event`, which does
 * the insert, the state transition and the audit entry atomically and idempotently
 * (see supabase/migrations/0014_payments.sql).
 *
 * This is permitted use 1 of the privileged client — a verified webhook handler,
 * after the signature check. It is the only place in the application that writes a
 * payment, and there is no user in the request path.
 */
export const applyPaymentEvent: ApplyEvent = async (event) => {
  const supabase = createAdminClient("webhook");

  // `undefined` omits the argument, so the function's SQL default (null) applies.
  // Passing an empty string instead would turn "the provider did not send this"
  // into a value, and an order id of "" would never match a payment.
  const orNull = <T>(value: T | null): T | undefined => value ?? undefined;

  const { data, error } = await supabase.rpc("record_payment_event", {
    p_event_id: event.eventId,
    p_event_type: event.eventType,
    p_order_id: orNull(event.orderId),
    p_payment_id: orNull(event.paymentId),
    p_amount: orNull(event.amountMinor),
    p_currency: orNull(event.currency),
    p_method: orNull(event.method),
    p_error_code: orNull(event.errorCode),
    p_error_desc: orNull(event.errorDescription),
  });

  // The message is logged by the caller and never returned to the provider.
  if (error) throw new Error(`record_payment_event failed: ${error.code ?? "unknown"}`);
  if (data !== "processed" && data !== "duplicate" && data !== "ignored") {
    throw new Error(`record_payment_event returned an unexpected outcome`);
  }
  return data;
};
