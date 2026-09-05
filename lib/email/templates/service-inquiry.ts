/**
 * Service inquiry emails.
 *
 * Routing note: the internal notification goes to the candidate desk or the
 * business desk depending on the selected service. That decision is made
 * server-side in lib/email/config.ts, not carried in the payload — the old
 * hidden `to_email` field was editable by anyone with dev tools.
 */

import { SITE_NAME } from "@/lib/seo";
import type { ServiceInquiryInput } from "@/lib/forms/schemas";
import {
  wrapHtml,
  paragraph,
  detailTable,
  messageBlock,
  detailLines,
  textFooter,
  esc,
} from "./layout";

export function serviceInquiryInternalEmail(input: ServiceInquiryInput) {
  const rows = [
    { label: "Service", value: input.service_type },
    { label: "Name", value: input.from_name },
    { label: "Email", value: input.reply_to },
    { label: "Phone", value: input.phone },
    { label: "Country", value: input.country },
    { label: "Source", value: input.page_source ?? "Services Page" },
  ];

  return {
    subject: `New service inquiry — ${input.service_type}`,
    html: wrapHtml({
      variant: "internal",
      title: "New service inquiry",
      preheader: `${input.from_name} — ${input.service_type}`,
      body:
        detailTable(rows) +
        (input.message ? messageBlock("Message", input.message) : "") +
        paragraph(
          `Reply directly to this email to reach <strong>${esc(input.from_name)}</strong>.`,
        ),
    }),
    text:
      `New service inquiry\n\n${detailLines(rows)}\n` +
      (input.message ? `\nMessage:\n${input.message}\n` : "") +
      `\nReply directly to this email to reach the sender.${textFooter("internal")}`,
  };
}

export function serviceInquiryAcknowledgementEmail(input: ServiceInquiryInput) {
  const firstName = input.from_name.split(" ")[0] ?? input.from_name;
  const summary = [
    { label: "Service", value: input.service_type },
    { label: "Preferred country", value: input.country },
  ];

  return {
    subject: `We have received your inquiry — ${SITE_NAME}`,
    html: wrapHtml({
      title: "Thanks — we have your inquiry",
      preheader: `Your inquiry about ${input.service_type} has reached our team.`,
      body:
        paragraph(`Hi ${esc(firstName)},`) +
        paragraph(
          `Thanks for your inquiry about <strong>${esc(input.service_type)}</strong>. It has reached the right team and someone will be in touch.`,
        ) +
        detailTable(summary) +
        paragraph("If you would like to add anything, just reply to this email."),
    }),
    text:
      `Hi ${firstName},\n\nThanks for your inquiry about ${input.service_type}. It has reached ` +
      `the right team and someone will be in touch.\n\n${detailLines(summary)}\n\n` +
      `If you would like to add anything, just reply to this email.${textFooter()}`,
  };
}
