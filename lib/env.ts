/**
 * Environment validation.
 *
 * Two schemas, deliberately separate:
 *
 *   clientEnv — variables that are compiled into the browser bundle. Every one
 *               is `NEXT_PUBLIC_*` and every one is public forever.
 *   serverEnv — secrets. Reading this from client code throws at import time
 *               rather than silently shipping a key to every visitor.
 *
 * Validation is lazy: schemas are parsed on first access, not at module load,
 * so a missing integration key does not break an unrelated page. Variables that
 * belong to a later phase are optional here and are asserted by the feature
 * that needs them (see `requireServerEnv`).
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Client — safe to ship to the browser
// ---------------------------------------------------------------------------

const clientSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  // Public by design. It carries no privileges of its own; RLS bounds it.
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  // Razorpay Checkout runs in the browser and needs the key id. The SECRET
  // half is server-only and must never appear in this schema.
  NEXT_PUBLIC_RAZORPAY_KEY_ID: z.string().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
});

export type ClientEnv = z.infer<typeof clientSchema>;

let cachedClientEnv: ClientEnv | undefined;

/**
 * Next.js inlines `process.env.NEXT_PUBLIC_*` at build time only when accessed
 * by its full literal name — destructuring or dynamic lookup yields undefined
 * in the browser. Hence the explicit property list.
 */
export function clientEnv(): ClientEnv {
  if (cachedClientEnv) return cachedClientEnv;

  const parsed = clientSchema.safeParse({
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_RAZORPAY_KEY_ID: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  });

  if (!parsed.success) {
    // Names only. A validation error must never echo a value.
    const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(
      `Invalid public environment configuration: ${missing}. See .env.example.`,
    );
  }

  cachedClientEnv = parsed.data;
  return cachedClientEnv;
}

// ---------------------------------------------------------------------------
// Server — secrets
// ---------------------------------------------------------------------------

const serverSchema = z.object({
  // Required wherever the platform runs server-side.
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),
  SUPABASE_DB_URL: z.string().optional(),

  // Phase 1.5
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().email().optional(),
  RESEND_REPLY_TO: z.string().email().optional(),
  RESEND_WEBHOOK_SECRET: z.string().optional(),

  // Phase 7 — test mode during development; live keys only in production.
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),

  // Phase 3 — provider is pluggable; see lib/providers/otp.
  OTP_PROVIDER: z.enum(["firebase", "msg91", "twilio", "mock"]).optional(),
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),

  // Phase 9 — number not yet chosen.
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_APP_SECRET: z.string().optional(),
  WHATSAPP_VERIFY_TOKEN: z.string().optional(),

  // Phase 10
  TELEPHONY_PROVIDER: z.string().optional(),
  TELEPHONY_API_KEY: z.string().optional(),
  TELEPHONY_API_SECRET: z.string().optional(),
  TELEPHONY_WEBHOOK_SECRET: z.string().optional(),

  CRON_SECRET: z.string().optional(),
  SENTRY_AUTH_TOKEN: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cachedServerEnv: ServerEnv | undefined;

/**
 * Throws if called from the browser. This is the guard that turns "we must
 * remember not to import that on the client" into a build-time failure.
 */
export function serverEnv(): ServerEnv {
  if (typeof window !== "undefined") {
    throw new Error(
      "serverEnv() was called in the browser. Server secrets must never reach " +
        "client code — move this call into a Server Component, Server Action " +
        "or Route Handler.",
    );
  }

  if (cachedServerEnv) return cachedServerEnv;

  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    const bad = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Invalid server environment configuration: ${bad}.`);
  }

  cachedServerEnv = parsed.data;
  return cachedServerEnv;
}

/**
 * Assert that an optional server variable is present, at the point of use.
 *
 * Integration keys are optional in the schema because a phase that has not
 * shipped has no keys yet — but the feature that needs one must fail loudly
 * rather than sending `undefined` to a provider.
 */
export function requireServerEnv<K extends keyof ServerEnv>(
  key: K,
): NonNullable<ServerEnv[K]> {
  const value = serverEnv()[key];
  if (value === undefined || value === "") {
    throw new Error(
      `Required server environment variable ${String(key)} is not set. See .env.example.`,
    );
  }
  return value as NonNullable<ServerEnv[K]>;
}

// ---------------------------------------------------------------------------
// Deployment context
// ---------------------------------------------------------------------------

export type DeploymentEnv = "production" | "staging" | "preview" | "development";

export function deploymentEnv(): DeploymentEnv {
  if (process.env.APP_ENV === "staging") return "staging";
  if (process.env.VERCEL_ENV === "production") return "production";
  if (process.env.VERCEL_ENV === "preview") return "preview";
  if (process.env.NODE_ENV === "production") return "production";
  return "development";
}

/** True when this deployment holds real customer data. */
export function isProduction(): boolean {
  return deploymentEnv() === "production";
}

/**
 * True when the app is running server-capable (PLATFORM_MODE=server) rather
 * than as the legacy static export. Guards platform-only code paths during the
 * migration window.
 */
export function isServerMode(): boolean {
  return process.env.PLATFORM_MODE === "server";
}
