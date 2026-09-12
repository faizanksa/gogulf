/**
 * Shared POST handler for the public form endpoints.
 *
 * One implementation so validation, rate limiting, honeypot handling, error
 * shape and logging cannot drift between the three flows.
 *
 * Responses are deliberately uniform and uninformative about internals:
 *   200 { ok: true }                        accepted
 *   400 { ok: false, fieldErrors }          validation failed
 *   429 { ok: false, error }                rate limited
 *   500 { ok: false, error }                provider or server failure
 */

import "server-only";

import { NextResponse } from "next/server";
import type { z } from "zod";
import { DEFAULT, isActiveLocale, type AnyLocale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { toFieldErrors } from "./schemas";
import { logger } from "@/lib/logger";
import type { FlowResult } from "@/lib/email/send";

/**
 * The language of the page that sent the form, from the X-Form-Locale header
 * (lib/forms/transport.ts). Route Handlers cannot read next/root-params, and a header is
 * readable before the body, so even the rate-limit reply is in the reader's language.
 * Anything missing or unknown is English.
 */
function requestLocale(request: Request): AnyLocale {
  const value = request.headers.get("x-form-locale");
  return isActiveLocale(value) ? value : DEFAULT;
}

/** Per IP per flow. Generous for humans, tedious for scripts. */
const LIMIT = 5;
const WINDOW_SECONDS = 600;

export interface FormRouteOptions<TSchema extends z.ZodTypeAny> {
  flow: string;
  schema: TSchema;
  send: (input: z.infer<TSchema>) => Promise<FlowResult>;
}

export async function handleFormPost<TSchema extends z.ZodTypeAny>(
  request: Request,
  { flow, schema, send }: FormRouteOptions<TSchema>,
): Promise<NextResponse> {
  const ip = clientIp(request.headers);
  const t = createTranslator(requestLocale(request));

  const limited = rateLimit(`${flow}:${ip}`, LIMIT, WINDOW_SECONDS);
  if (!limited.allowed) {
    logger.warn("Form submission rate limited", { flow, ip });
    return NextResponse.json(
      { ok: false, error: t("forms.outcome.rateLimited") },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: t("forms.outcome.unreadable") }, { status: 400 });
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    // Field names only — never the submitted values, which are personal data.
    const fieldErrors = toFieldErrors(parsed.error, t);
    logger.info("Form submission failed validation", {
      flow,
      fields: Object.keys(fieldErrors),
    });
    return NextResponse.json({ ok: false, error: t("forms.outcome.checkFields"), fieldErrors }, { status: 400 });
  }

  // Honeypot: a hidden field only a bot fills. Answer 200 so the bot cannot
  // distinguish rejection from success and tune its way past the check.
  const data = parsed.data as { website?: string };
  if (data.website) {
    logger.warn("Form submission rejected by honeypot", { flow, ip });
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  try {
    const result = await send(parsed.data);

    if (!result.ok) {
      logger.error("Form submission could not be delivered", {
        flow,
        reason: result.error,
      });
      return NextResponse.json({ ok: false, error: t("forms.outcome.deliveryFailed") }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      // Surfaced so the UI can soften its wording when the receipt did not go
      // out — the submission itself still succeeded.
      acknowledgementSent: result.acknowledgementFailed !== true,
    });
  } catch (error) {
    logger.error("Unhandled error in form handler", {
      flow,
      reason: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json({ ok: false, error: t("forms.outcome.unexpected") }, { status: 500 });
  }
}
