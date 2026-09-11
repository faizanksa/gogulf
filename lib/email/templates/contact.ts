/**
 * Contact form emails.
 *
 * Two messages, matching the previous EmailJS behaviour: an internal
 * notification to the candidate desk, and an acknowledgement to the sender
 * (EmailJS's Auto-Reply).
 *
 * The acknowledgement deliberately promises no outcome and no timescale beyond
 * what the site already states. It is a receipt, not a commitment.
 */

import { SITE_NAME } from "@/lib/seo";
import type { ContactInput } from "@/lib/forms/schemas";
import {
  wrapHtml,
  paragraph,
  detailTable,
  messageBlock,
  detailLines,
  textFooter,
  esc,
} from "./layout";

export function contactInternalEmail(input: ContactInput) {
  const rows = [
    { label: "Name", value: input.from_name },
    { label: "Email", value: input.reply_to },
    { label: "Phone", value: input.phone },
    { label: "Source", value: input.page_source ?? "Contact Page" },
  ];

  return {
    subject: `New contact message — ${input.from_name}`,
    html: wrapHtml({
      variant: "internal",
      title: "New contact message",
      preheader: `${input.from_name} sent a message via the contact form`,
      body:
        detailTable(rows) +
        messageBlock("Message", input.message) +
        paragraph(
          `Reply directly to this email to reach <strong>${esc(input.from_name)}</strong>.`,
        ),
    }),
    text:
      `New contact message\n\n${detailLines(rows)}\n\nMessage:\n${input.message}\n` +
      `\nReply directly to this email to reach the sender.${textFooter("internal")}`,
  };
}

export function contactAcknowledgementEmail(input: ContactInput) {
  const firstName = input.from_name.split(" ")[0] ?? input.from_name;

  return {
    subject: `We have received your message — ${SITE_NAME}`,
    html: wrapHtml({
      title: "Thanks — we have your message",
      preheader: "Our team will come back to you.",
      body:
        paragraph(`Hi ${esc(firstName)},`) +
        paragraph(
          `Thanks for getting in touch with ${esc(SITE_NAME)}. Your message has reached our team and someone will come back to you.`,
        ) +
        messageBlock("What you sent us", input.message) +
        paragraph("If you need to add anything, just reply to this email."),
    }),
    text:
      `Hi ${firstName},\n\nThanks for getting in touch with ${SITE_NAME}. Your message has ` +
      `reached our team and someone will come back to you.\n\nWhat you sent us:\n${input.message}\n\n` +
      `If you need to add anything, just reply to this email.${textFooter()}`,
  };
}
