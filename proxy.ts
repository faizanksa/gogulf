/**
 * proxy.ts — Next.js 16 replaced the `middleware` convention with `proxy`.
 * Node.js runtime only; the `edge` runtime is not supported here.
 *
 * Responsibilities, in order:
 *   1. Refresh the Supabase auth session cookie. Server Components cannot set
 *      cookies, so this is the only place the refresh can happen.
 *   2. Gate /admin and /portal behind a session.
 *   3. Apply security headers to every response.
 *
 * IMPORTANT: this is a coarse gate, not the security boundary. It answers
 * "is there a session?", never "may this person see this record?" — that is
 * decided by permission checks in Server Actions and by RLS in the database.
 * A proxy check can be bypassed by anything that talks to the database
 * directly; RLS cannot.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { LOGIN_PATHS, protectedAreaFor } from "@/lib/auth/route-guard";

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-DNS-Prefetch-Control": "off",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(self)",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
};

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // The public marketing site must keep rendering even if Supabase is
  // misconfigured — it does not depend on it.
  if (supabaseUrl && supabaseKey) {
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    });

    // getUser() revalidates against the auth server. getSession() only reads a
    // cookie the client can tamper with, and must never gate access.
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Which paths need a session — and which KIND is decided downstream — lives
    // in lib/auth/route-guard.ts. The login pages are exempt.
    const { pathname } = request.nextUrl;
    const area = protectedAreaFor(pathname);

    if (area && !user) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = LOGIN_PATHS[area];
      // Relative path only — never echo an absolute URL back into a redirect
      // parameter, which is how open-redirect bugs start.
      loginUrl.searchParams.set("next", pathname);
      const redirect = NextResponse.redirect(loginUrl);
      applySecurityHeaders(redirect);
      return redirect;
    }
  }

  applySecurityHeaders(response);
  return response;
}

/**
 * Staging and preview deployments must never be indexed — a crawlable duplicate
 * of the site is an SEO regression, and staging forms are not the place for real
 * enquiries. Vercel Authentication keeps staging.gogulf.co private today (preview
 * custom domains are protected on Hobby too); this header is defence in depth in
 * case that protection is ever relaxed.
 *
 * Opt-IN on purpose: only an explicit staging/preview marker adds the header.
 * Production and local runs are left exactly as they were.
 */
const isNonProductionDeployment =
  process.env.APP_ENV === "staging" || process.env.VERCEL_ENV === "preview";

function applySecurityHeaders(response: NextResponse) {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }
  if (isNonProductionDeployment) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  }
}

export const config = {
  // Without a matcher, proxy runs on every request including static assets,
  // which would make auth logic block CSS and images.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons/|assets/|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|txt|xml|webmanifest)$).*)",
  ],
};
