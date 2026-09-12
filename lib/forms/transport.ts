"use client";

/**
 * Browser → server form submission.
 *
 * Every form posts a plain JSON object to its /api/forms/* route. The route validates
 * it again with Zod, applies the honeypot and rate limit, and sends the email through
 * Resend on the server — the Resend key never reaches the browser.
 *
 * EmailJS (browser-side email) was removed from this codebase on 11 Sep 2026 at the
 * business's instruction. The live site still runs its EmailJS build from `main` until
 * the approved cutover, which also retires its three NEXT_PUBLIC_EMAILJS_* variables.
 * Form routes need the server build (PLATFORM_MODE=server).
 */

export interface SubmitResult {
  ok: boolean;
  /** Safe to display. */
  error?: string;
  fieldErrors?: Record<string, string[]>;
  /** False when the submission succeeded but the receipt email did not go out. */
  acknowledgementSent?: boolean;
}

export interface SubmitOptions {
  /** The page's language (sent as X-Form-Locale); the server words its replies in it. */
  locale?: string;
  /** Messages for failures the server cannot word: no connection, or a reply that is not ours. */
  messages?: { offline: string; unexpected: string };
}

/** Used by the forms not yet given a copy prop (ServiceInquiryForm, ApplyForm — rebuilt in 2C). */
const ENGLISH = {
  offline: "We could not reach the server. Check your connection and try again.",
  unexpected: "Something went wrong sending your message. Please try again, or contact us directly.",
};

/**
 * Submit to a form route.
 *
 * `payload` is a plain object rather than a FormData scan, so file inputs can never be
 * swept into it by accident.
 */
export async function submitViaServer(
  endpoint: "contact" | "service-inquiry" | "job-application",
  payload: Record<string, unknown>,
  { locale, messages = ENGLISH }: SubmitOptions = {},
): Promise<SubmitResult> {
  let response: Response;
  try {
    // The language travels as a header, so the endpoint URL stays the same in every language.
    response = await fetch(`/api/forms/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(locale ? { "X-Form-Locale": locale } : {}) },
      body: JSON.stringify(payload),
    });
  } catch {
    return { ok: false, error: messages.offline };
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
      error: body?.error ?? messages.unexpected,
      fieldErrors: body?.fieldErrors,
    };
  }

  return { ok: true, acknowledgementSent: body?.acknowledgementSent !== false };
}
