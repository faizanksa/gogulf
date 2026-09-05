/**
 * High-level send functions — the only email API the routes use.
 *
 * Each flow sends two messages: an internal notification and an
 * acknowledgement to the person who submitted, matching the existing EmailJS
 * behaviour (notification + Auto-Reply).
 *
 * DELIVERY SEMANTICS, deliberately asymmetric:
 *   The internal notification is what the business cannot afford to lose, so
 *   its failure fails the request and the user is told to try again.
 *   The acknowledgement is a courtesy — if it fails, the submission still
 *   succeeded and saying otherwise would be a lie to the user. Its failure is
 *   logged, not surfaced.
 *
 * This mirrors the resilience decision the existing ApplyForm already makes.
 */

import "server-only";

import { resendProvider } from "./resend";
import {
  applicationsRecipient,
  contactRecipient,
  recipientForService,
  replyToForSubmitter,
  supportReplyTo,
} from "./config";
import {
  contactAcknowledgementEmail,
  contactInternalEmail,
} from "./templates/contact";
import {
  serviceInquiryAcknowledgementEmail,
  serviceInquiryInternalEmail,
} from "./templates/service-inquiry";
import {
  jobApplicationAcknowledgementEmail,
  jobApplicationInternalEmail,
} from "./templates/job-application";
import { logger } from "@/lib/logger";
import type { EmailProvider } from "./provider";
import type {
  ContactInput,
  JobApplicationInput,
  ServiceInquiryInput,
} from "@/lib/forms/schemas";

/** Injectable so tests can assert payloads without touching the network. */
function provider(override?: EmailProvider): EmailProvider {
  return override ?? resendProvider;
}

export interface FlowResult {
  /** True when the INTERNAL notification was delivered to the provider. */
  ok: boolean;
  notificationId?: string;
  acknowledgementId?: string;
  /** Safe summary. Never a raw provider response. */
  error?: string;
  /** True when the courtesy acknowledgement failed but the submission stands. */
  acknowledgementFailed?: boolean;
}

async function sendPair(
  kind: string,
  to: string,
  submitterEmail: string,
  internal: { subject: string; html: string; text: string },
  ack: { subject: string; html: string; text: string },
  emailProvider?: EmailProvider,
): Promise<FlowResult> {
  const p = provider(emailProvider);

  const notification = await p.send({
    to,
    subject: internal.subject,
    html: internal.html,
    text: internal.text,
    // Staff hit Reply and reach the person who wrote in.
    replyTo: replyToForSubmitter(submitterEmail),
    tags: { flow: kind, kind: "notification" },
  });

  if (!notification.ok) {
    return { ok: false, error: notification.error };
  }

  const acknowledgement = await p.send({
    to: submitterEmail,
    subject: ack.subject,
    html: ack.html,
    text: ack.text,
    replyTo: supportReplyTo(),
    tags: { flow: kind, kind: "acknowledgement" },
  });

  if (!acknowledgement.ok) {
    // Do not fail the submission. It was received; only the receipt was lost.
    logger.warn("Acknowledgement email failed; submission still succeeded", {
      flow: kind,
      reason: acknowledgement.error,
    });
    return {
      ok: true,
      notificationId: notification.id,
      acknowledgementFailed: true,
    };
  }

  return {
    ok: true,
    notificationId: notification.id,
    acknowledgementId: acknowledgement.id,
  };
}

export function sendContactEmails(
  input: ContactInput,
  emailProvider?: EmailProvider,
): Promise<FlowResult> {
  return sendPair(
    "contact",
    contactRecipient(),
    input.reply_to,
    contactInternalEmail(input),
    contactAcknowledgementEmail(input),
    emailProvider,
  );
}

export function sendServiceInquiryEmails(
  input: ServiceInquiryInput,
  emailProvider?: EmailProvider,
): Promise<FlowResult> {
  return sendPair(
    "service-inquiry",
    // Re-derived server-side from the service name, never taken from the payload.
    recipientForService(input.service_type),
    input.reply_to,
    serviceInquiryInternalEmail(input),
    serviceInquiryAcknowledgementEmail(input),
    emailProvider,
  );
}

export function sendJobApplicationEmails(
  input: JobApplicationInput,
  emailProvider?: EmailProvider,
): Promise<FlowResult> {
  return sendPair(
    "job-application",
    applicationsRecipient(),
    input.reply_to,
    jobApplicationInternalEmail(input),
    jobApplicationAcknowledgementEmail(input),
    emailProvider,
  );
}
