/**
 * CONTEXT 2 of 3 — Server client, acting as the signed-in user.
 *
 * This is the default for server-side data access. It reads the session from
 * cookies and issues queries as that user, so RLS still applies. If application
 * authorization has a bug, the database is still there to stop it.
 *
 * Use for: Server Components, Server Actions and Route Handlers that serve a
 * request on behalf of a customer or staff member — which is almost all of them.
 *
 * Do NOT reach for the admin client just because a query is inconvenient. If
 * RLS blocks a legitimate read, the policy is wrong; fix the policy.
 */

import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { clientEnv } from "@/lib/env";
import type { Database } from "@/types/database";

export async function createServerSupabase() {
  // Next.js 16: cookies() is async-only. Synchronous access was removed.
  const cookieStore = await cookies();
  const env = clientEnv();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Components cannot set cookies. Session refresh is handled
            // by proxy.ts, so ignoring this is correct rather than merely safe.
          }
        },
      },
    },
  );
}

/** The authenticated auth user, or null. Verified against the auth server. */
export async function getAuthUser() {
  const supabase = await createServerSupabase();
  // getUser() revalidates the token with Supabase Auth. getSession() only reads
  // the cookie, which a client can tamper with — never use it for authorization.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
