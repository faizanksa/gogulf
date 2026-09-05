/**
 * Email provider interface.
 *
 * Everything above this deals in messages; nothing above it imports a vendor
 * SDK. Replacing Resend later is a new adapter plus one registry line, matching
 * the pattern already used for OTP providers.
 */

import "server-only";

export interface EmailMessage {
  to: string | string[];
  subject: string;
  html: string;
  /** Plain-text alternative. Always send one — it materially helps deliverability. */
  text: string;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
  /**
   * Groups related sends (e.g. all contact-form mail) for provider-side
   * filtering. Never used to carry personal data.
   */
  tags?: Record<string, string>;
}

export interface EmailSendResult {
  ok: boolean;
  /** Provider message id, for support and reconciliation. */
  id?: string;
  /**
   * Safe, human-readable failure summary. Never the raw provider response:
   * those can echo back request content, and this string may reach a log.
   */
  error?: string;
}

export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<EmailSendResult>;
}
