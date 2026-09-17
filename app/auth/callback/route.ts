/**
 * GET /auth/callback — where Supabase returns a staff member after Google sign-in.
 *
 * Exchanges the one-time code for a session (PKCE: the verifier cookie was set when the
 * sign-in started, app/(admin)/admin/login/actions.ts), then sends them on to the
 * workspace. Signing in is not the same as being staff: /admin's guard classifies the
 * session and asks the database whether this person is an active staff member, and a
 * Google account with no staff record gets no further than the sign-in page.
 *
 * Outside /admin on purpose: the proxy gate would otherwise redirect the callback, which
 * by definition arrives before a session exists.
 */

import { NextResponse, type NextRequest } from "next/server";
import { safeStaffNext } from "@/lib/admin/params";
import { logger } from "@/lib/logger";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = safeStaffNext(url.searchParams.get("next"));
  const code = url.searchParams.get("code");
  const failed = (reason: string) =>
    NextResponse.redirect(new URL(`/admin/login?${new URLSearchParams({ reason, next }).toString()}`, url.origin), 303);

  // Google or Supabase refused (the account is not allowed, consent was cancelled, …).
  if (url.searchParams.get("error") || !code) return failed("sign-in-failed");

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    logger.warn("staff sign-in callback failed", { reason: error.name, status: error.status });
    return failed("sign-in-failed");
  }

  return NextResponse.redirect(new URL(next, url.origin), 303);
}
