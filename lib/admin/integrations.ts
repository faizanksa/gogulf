/**
 * What each integration is doing on THIS deployment, without a single secret.
 *
 * Presence and mode only: never a key, never a key's length, never a webhook secret. The
 * point is to let a super administrator see, from the running system, that a staging build
 * is on a TEST key and production on a LIVE one — the fact the isolation guard enforces at
 * build time (scripts/check-staging-isolation.mjs) and ordersAllowed() enforces at run time.
 */

import "server-only";

import { ordersAllowed, razorpayMode } from "@/lib/payments/razorpay";
import type { DeploymentStage } from "@/lib/deployment";

export interface IntegrationStatus {
  key: string;
  name: string;
  state: "ok" | "warning" | "off" | "info";
  summary: string;
  details: string[];
}

/** Public project refs (they appear in every browser request), named so a person can tell which database this is. */
export const KNOWN_PROJECTS: Record<string, string> = {
  julbqkeyvzwluayokcdi: "Tokyo production (the live database today)",
  exsnksrmkycloxiajwmx: "Mumbai production (the future live database)",
  noxireidrbeqcvsirjec: "Mumbai staging",
  wxolbnhyzktfjdvcnixc: "Tokyo staging (retired)",
};

export function integrationStatuses(env: Record<string, string | undefined>, stage: DeploymentStage, siteUrl: string): IntegrationStatus[] {
  const list: IntegrationStatus[] = [];

  const ref = env.NEXT_PUBLIC_SUPABASE_URL?.match(/^https:\/\/([a-z0-9]{20})\.supabase\.co/)?.[1] ?? null;
  const local = /127\.0\.0\.1|localhost/.test(env.NEXT_PUBLIC_SUPABASE_URL ?? "");
  list.push({
    key: "supabase",
    name: "Supabase (database, auth, storage)",
    state: ref || local ? "ok" : "off",
    summary: local ? "Local Supabase" : ref ? (KNOWN_PROJECTS[ref] ?? `Project ${ref}`) : "Not configured",
    details: [`Deployment: ${stage}`, ref ? `Project: ${ref}` : "No project URL", `Service-role key: ${env.SUPABASE_SERVICE_ROLE_KEY ? "present" : "absent"}`],
  });

  const mode = razorpayMode(env.RAZORPAY_KEY_ID);
  const allowed = ordersAllowed(mode, stage);
  const hasSecret = Boolean(env.RAZORPAY_KEY_SECRET);
  const hasWebhook = Boolean(env.RAZORPAY_WEBHOOK_SECRET);
  list.push({
    key: "razorpay",
    name: "Razorpay (invoice payments)",
    state: mode === "unknown" ? "off" : !hasSecret || !allowed ? "warning" : "ok",
    summary:
      mode === "unknown"
        ? "No key configured — Pay is unavailable"
        : `${mode === "live" ? "LIVE" : "TEST"} key${allowed ? "" : ` — refused on a ${stage} deployment`}`,
    details: [
      `Key id: ${mode === "unknown" ? "absent" : "present"}, key secret: ${hasSecret ? "present" : "absent"}`,
      `Checkout on this deployment: ${allowed && hasSecret ? "allowed" : "not available"}`,
      `Webhook secret: ${hasWebhook ? "present" : "absent (the endpoint answers 503)"}`,
      `Webhook URL: ${siteUrl.replace(/\/+$/, "")}/api/razorpay/webhook`,
      "Live keys belong to Production only; test keys to Preview only.",
    ],
  });

  list.push({
    key: "email",
    name: "Resend (email)",
    state: env.RESEND_API_KEY ? "ok" : "warning",
    summary: env.RESEND_API_KEY ? "Configured" : "Not configured — form emails cannot be sent",
    details: [`From: ${env.RESEND_FROM_EMAIL ?? "not set"}`, `Reply-to: ${env.RESEND_REPLY_TO ?? "not set"}`],
  });

  list.push({
    key: "google",
    name: "Google sign-in (staff)",
    state: "info",
    summary: "Managed in Supabase Auth",
    details: ["Staff sign in with a Google Workspace account; there are no passwords.", "Configuration and callback URLs: docs/GOOGLE-OAUTH.md"],
  });

  return list;
}
