"use client";

/**
 * Client-side transport selection — the reversible switch between the new
 * server-side Resend path and the existing browser-side EmailJS path.
 *
 * WHY A FLAG RATHER THAN A CUTOVER
 * The live site is a static export. Route Handlers are not emitted in that
 * build, so /api/forms/* simply does not exist there. Flipping providers is
 * therefore coupled to the deployment mode, and both must move together:
 *
 *   NEXT_PUBLIC_EMAIL_PROVIDER unset | "emailjs"  -> EmailJS (current live path)
 *   NEXT_PUBLIC_EMAIL_PROVIDER = "resend"         -> POST /api/forms/*
 *                                                    REQUIRES PLATFORM_MODE=server
 *
 * The flag is NEXT_PUBLIC_ because the browser has to know which path to take.
 * It is a mode selector, not a secret: the Resend API key never leaves the
 * server.
 *
 * Rolling back is one environment variable and a redeploy — no code change.
 */

import { sendInquiry } from "@/lib/emailjs";

export type EmailProviderMode = "emailjs" | "resend";

export function emailProviderMode(): EmailProviderMode {
  return process.env.NEXT_PUBLIC_EMAIL_PROVIDER === "resend" ? "resend" : "emailjs";
}

export interface SubmitResult {
  ok: boolean;
  /** Safe to display. */
  error?: string;
  fieldErrors?: Record<string, string[]>;
  /** False when the submission succeeded but the receipt email did not go out. */
  acknowledgementSent?: boolean;
}

/**
 * Submit through the server route.
 *
 * `payload` is a plain object rather than a FormData scan, so file inputs can
 * never be swept into it by accident — the mistake the EmailJS path had to work
 * around by keeping file inputs outside the <form> element.
 */
export async function submitViaServer(
  endpoint: "contact" | "service-inquiry" | "job-application",
  payload: Record<string, unknown>,
): Promise<SubmitResult> {
  let response: Response;
  try {
    response = await fetch(`/api/forms/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    return {
      ok: false,
      error: "We could not reach the server. Check your connection and try again.",
    };
  }

  let body: SubmitResult | null = null;
  try {
    body = (await response.json()) as SubmitResult;
  } catch {
    body = null;
  }

  if (!response.ok) {
    return {
      ok: false,
      error:
        body?.error ??
        "Something went wrong sending your message. Please try again, or contact us directly.",
      fieldErrors: body?.fieldErrors,
    };
  }

  return { ok: true, acknowledgementSent: body?.acknowledgementSent !== false };
}

/**
 * Submit through the existing EmailJS path. Kept intact so rollback is a
 * configuration change, not a revert.
 */
export async function submitViaEmailJs(form: HTMLFormElement): Promise<SubmitResult> {
  try {
    await sendInquiry(form);
    return { ok: true, acknowledgementSent: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Something went wrong sending your inquiry. Please try again or call us directly.",
    };
  }
}
