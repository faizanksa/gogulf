/**
 * CONTEXT 1 of 3 — Browser client.
 *
 * Runs in the user's browser with the public anon key. Carries no privileges of
 * its own: everything it can reach is bounded by Row Level Security, and every
 * query executes as the signed-in user (or as `anon` when signed out).
 *
 * Use for: client-side reads and realtime subscriptions inside Client
 * Components, where RLS already expresses the access rule.
 *
 * Never import a service-role client here. See lib/supabase/admin.ts.
 */

"use client";

import { createBrowserClient } from "@supabase/ssr";
import { clientEnv } from "@/lib/env";
import type { Database } from "@/types/database";

export function createClient() {
  const env = clientEnv();
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
