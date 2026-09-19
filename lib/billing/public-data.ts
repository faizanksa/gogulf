/**
 * What a payer's browser is allowed to know about an invoice.
 *
 * The client carries the public anon key and no cookies. anon has no privilege on
 * `invoices` or `payments` at all; the ONLY door is one read-only SECURITY DEFINER
 * function (0015): public_invoice_view returns an explicit column allow-list. Recording a
 * payment request is NOT available to this client — open_invoice_payment_request is
 * server-only since 0017 (lib/payments/invoice-payment.ts calls it with the privileged
 * client), because it stores a caller-supplied provider order id.
 * Nothing here can read a staff note, a billing address, a contact or an internal id.
 *
 * Deliberately not cached: a payer must see "Paid" the moment the webhook has recorded
 * it, not after a revalidation window.
 */

import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database, InvoiceStatus } from "@/types/database";
import { normaliseReference } from "./model";

export interface PublicInvoice {
  reference: string;
  status: InvoiceStatus;
  purpose: string;
  totalMinor: number;
  currency: "INR";
  dueDate: string | null;
  issuedAt: string | null;
}

export function publicBillingClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  });
}

/** One invoice by reference, or null — never a draft, never an unknown reference. */
export async function getPublicInvoice(input: string): Promise<PublicInvoice | null> {
  const reference = normaliseReference(input);
  const supabase = publicBillingClient();
  if (!reference || !supabase) return null;

  const { data, error } = await supabase.rpc("public_invoice_view", { p_reference: reference });
  // A failure is not "no such invoice": say so loudly rather than showing a payer a 404
  // for an invoice they were sent.
  if (error) throw new Error(`Public invoice: read failed (${error.code ?? "unknown"})`);
  const row = data?.[0];
  if (!row) return null;

  return {
    reference: row.reference,
    status: row.status,
    purpose: row.purpose,
    totalMinor: Number(row.total_minor),
    currency: "INR",
    dueDate: row.due_date,
    issuedAt: row.issued_at,
  };
}
