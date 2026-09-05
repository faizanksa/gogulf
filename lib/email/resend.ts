/**
 * Resend adapter. SERVER ONLY.
 *
 * The `server-only` import makes an accidental client import a build error
 * rather than a leaked API key. RESEND_API_KEY is read through requireServerEnv,
 * which throws in the browser.
 */

import "server-only";

import { Resend } from "resend";
import { requireServerEnv } from "@/lib/env";
import { fromAddress } from "./config";
import { logger } from "@/lib/logger";
import type { EmailMessage, EmailProvider, EmailSendResult } from "./provider";

let client: Resend | undefined;

function getClient(): Resend {
  if (!client) client = new Resend(requireServerEnv("RESEND_API_KEY"));
  return client;
}

/**
 * Reduce a provider error to something safe to log and return.
 *
 * Provider errors can echo back parts of the request, including recipient
 * addresses and body content. Only the message text is kept, and it is capped.
 */
function safeErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message).slice(0, 200);
  }
  if (error instanceof Error) return error.message.slice(0, 200);
  return "Email provider returned an unexpected error.";
}

export const resendProvider: EmailProvider = {
  name: "resend",

  async send(message: EmailMessage): Promise<EmailSendResult> {
    try {
      const { data, error } = await getClient().emails.send({
        from: fromAddress(),
        to: Array.isArray(message.to) ? message.to : [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
        ...(message.replyTo ? { replyTo: message.replyTo } : {}),
        ...(message.cc ? { cc: message.cc } : {}),
        ...(message.bcc ? { bcc: message.bcc } : {}),
        ...(message.tags
          ? {
              tags: Object.entries(message.tags).map(([name, value]) => ({
                name,
                value,
              })),
            }
          : {}),
      });

      if (error) {
        // Subject only — never the body, never the recipient list.
        logger.error("Resend rejected an email", {
          provider: "resend",
          subject: message.subject,
          reason: safeErrorMessage(error),
        });
        return { ok: false, error: safeErrorMessage(error) };
      }

      logger.info("Email sent", {
        provider: "resend",
        subject: message.subject,
        messageId: data?.id,
      });
      return { ok: true, id: data?.id };
    } catch (error) {
      logger.error("Resend request failed", {
        provider: "resend",
        subject: message.subject,
        reason: safeErrorMessage(error),
      });
      return { ok: false, error: safeErrorMessage(error) };
    }
  },
};
