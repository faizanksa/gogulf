/**
 * CONTEXT 3 of 3 — Privileged client. BYPASSES ALL ROW LEVEL SECURITY.
 *
 * ===========================================================================
 * PERMITTED USES — this list is exhaustive (each one is an AdminReason):
 *
 *   1. Verified webhook handlers   (/api/webhooks/*, after signature checks)
 *   2. Scheduled jobs              (/api/cron/*, authenticated by CRON_SECRET)
 *   3. Controlled migration tooling
 *   4. System automation with no user in the request path
 *   5. Recording a payment order the server has JUST created at the provider
 *      ("payment-request"): the one call is open_invoice_payment_request, which
 *      stores a provider order id. Only the server can know an order id is real,
 *      so no browser-reachable role may call it (0017). The payer's request is
 *      the trigger, never the authority: the amount comes from the invoice row
 *      and nothing the payer sent is written anywhere.
 *
 * FORBIDDEN:
 *
 *   - Serving any other customer or staff request. Those use
 *     createServerSupabase(), so RLS remains the last line of defence.
 *   - Working around an RLS policy that is blocking a legitimate read. If the
 *     policy is wrong, fix the policy.
 *   - Anything in a Client Component. The `server-only` import below turns that
 *     mistake into a build error rather than a breach.
 * ===========================================================================
 *
 * Every call site must state which of the four permitted uses applies, via the
 * required `reason` argument. It is recorded in the audit trail so privileged
 * access is reviewable after the fact rather than only at code review.
 */

import "server-only";

import { createClient } from "@supabase/supabase-js";
import { clientEnv, requireServerEnv } from "@/lib/env";
import type { Database } from "@/types/database";

export type AdminReason =
  | "webhook"
  | "cron"
  | "migration"
  | "system-automation"
  | "payment-request";

let cached: ReturnType<typeof createClient<Database>> | undefined;

/**
 * @param reason Which permitted use this call falls under. Not decorative —
 *               it is what makes privileged access auditable.
 */
export function createAdminClient(reason: AdminReason) {
  if (typeof window !== "undefined") {
    // Belt and braces: `server-only` should already have failed the build.
    throw new Error(
      "createAdminClient() was called in the browser. The service-role key " +
        "bypasses all RLS and must never leave the server.",
    );
  }

  if (process.env.NODE_ENV !== "production") {
    console.debug(`[supabase-admin] privileged client created for: ${reason}`);
  }

  if (cached) return cached;

  const env = clientEnv();
  cached = createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    requireServerEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        // A privileged client has no user session and must never persist or
        // refresh one — that would be a route to session confusion.
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    },
  );

  return cached;
}
