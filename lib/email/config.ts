/**
 * Sender and recipient configuration — one place, not scattered across
 * templates and routes.
 *
 * The sending domain gogulf.co is verified in Resend. Addresses below use it;
 * none is invented. If the FROM address is ever changed, it must remain on a
 * verified domain or Resend rejects the send outright.
 */

import "server-only";

import { CONTACT } from "@/lib/seo";
import { serverEnv } from "@/lib/env";
import { EMPLOYER_SERVICES } from "@/lib/forms/schemas";

/** Transactional sender. Overridable per environment so staging never sends as production. */
export function fromAddress(): string {
  return serverEnv().RESEND_FROM_EMAIL ?? "Go Gulf <no-reply@gogulf.co>";
}

/**
 * Where a human should reply if they hit Reply on an ACKNOWLEDGEMENT sent to a
 * candidate or customer. Internal notifications use the submitter's address
 * instead — see replyToForSubmitter().
 */
export function supportReplyTo(): string {
  return serverEnv().RESEND_REPLY_TO ?? CONTACT.jobsEmail;
}

/**
 * Reply-To on internal notifications: the person who submitted the form, so
 * staff can reply directly. This reproduces the previous EmailJS behaviour
 * (template Reply-To was {{reply_to}}).
 */
export function replyToForSubmitter(email: string): string {
  return email;
}

/**
 * Recipient desk for a service inquiry.
 *
 * The browser previously decided this from the optgroup and sent it as a
 * hidden `to_email` field. The server now re-derives it from the service name,
 * so a tampered payload cannot reroute an inquiry to an inbox of the sender's
 * choosing — the old hidden field was trivially editable.
 */
export function recipientForService(serviceType: string): string {
  const isEmployerService = (EMPLOYER_SERVICES as readonly string[]).includes(
    serviceType.trim(),
  );
  return isEmployerService ? CONTACT.businessEmail : CONTACT.jobsEmail;
}

/** Contact form and job applications both go to the candidate desk, as today. */
export function contactRecipient(): string {
  return CONTACT.jobsEmail;
}

export function applicationsRecipient(): string {
  return CONTACT.jobsEmail;
}
