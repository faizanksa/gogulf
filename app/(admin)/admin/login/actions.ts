"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { safeStaffNext } from "@/lib/admin/params";
import { logger } from "@/lib/logger";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Start a Google Workspace sign-in for staff.
 *
 * PKCE: @supabase/ssr stores the code verifier in a cookie here, and /auth/callback
 * exchanges the code for a session. Supabase accepts the return address only if it is on
 * the project's redirect allow-list (docs/GOOGLE-OAUTH.md).
 *
 * `hd=gogulf.co` asks Google to offer Workspace accounts only. It is a hint, not a control:
 * the controls are the Internal consent screen, closed sign-ups and the staff_users row
 * the JWT hook requires. An outside account that somehow signs in gets no staff claims
 * and is turned away by the route guard.
 */
export async function signInWithGoogle(formData: FormData) {
  const next = safeStaffNext(String(formData.get("next") ?? ""));
  const origin = await siteOrigin();
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?${new URLSearchParams({ next }).toString()}`,
      queryParams: { hd: "gogulf.co", prompt: "select_account" },
      skipBrowserRedirect: true,
    },
  });
  if (error || !data.url) {
    // "code" is a redacted key in lib/logger.ts, so the error's name travels as "reason".
    logger.warn("staff sign-in could not start", { reason: error?.name ?? "no_url" });
    redirect(`/admin/login?${new URLSearchParams({ reason: "sign-in-unavailable", next }).toString()}`);
  }
  redirect(data.url);
}

/** The public origin of this deployment: the configured site URL, else the request's own host. */
async function siteOrigin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured && /^https?:\/\//.test(configured)) return configured.replace(/\/+$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}
