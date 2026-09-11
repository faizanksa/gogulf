/**
 * proxy.ts — Next.js 16's name for middleware. Node.js runtime only.
 *
 * Runs ONLY for /admin and /portal (see `config.matcher`). Marketing pages are served
 * without a function invocation; their security headers come from next.config.mjs.
 *
 * Layer 1 of 3 (docs/REDESIGN-PLAN.md §19): verify the session, classify it with
 * sessionKind(), and route it with routeDecision(). "A session exists" is never enough.
 * The area layouts re-check against the database (layer 2); RLS is layer 3.
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { protectedAreaFor, routeDecision, sessionKind, type AccessTokenClaims } from "@/lib/auth/route-guard";
import { NOINDEX_HEADER, SECURITY_HEADERS } from "@/lib/security-headers.mjs";

function withHeaders(response: NextResponse): NextResponse {
  for (const { key, value } of SECURITY_HEADERS) response.headers.set(key, value);
  // Staff and customer areas are never indexed, on any deployment.
  response.headers.set(NOINDEX_HEADER.key, NOINDEX_HEADER.value);
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  let response = NextResponse.next({ request });

  const area = protectedAreaFor(pathname);
  if (!area) return withHeaders(response); // the login pages

  let claims: AccessTokenClaims | null = null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && key) {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        },
      },
    });
    // getClaims() verifies the token (with the auth server for symmetric keys). A cookie
    // decoded by hand could be forged; this cannot.
    const { data } = await supabase.auth.getClaims();
    claims = (data?.claims as AccessTokenClaims | undefined) ?? null;
  }
  // No Supabase configuration → no verifiable session → treated as anonymous (fail closed).

  const decision = routeDecision(area, sessionKind(claims), pathname);
  if (decision.action === "allow") return withHeaders(response);

  const next =
    decision.action === "redirect"
      ? NextResponse.redirect(new URL(decision.to, request.url))
      : NextResponse.rewrite(new URL("/__not-found", request.url));
  // Keep any refreshed session cookies on the response we actually send.
  for (const cookie of response.cookies.getAll()) next.cookies.set(cookie);
  return withHeaders(next);
}

export const config = {
  matcher: ["/admin/:path*", "/portal/:path*"],
};
