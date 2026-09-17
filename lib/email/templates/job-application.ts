/**
 * Job application emails.
 *
 * The uploaded CV, passport and other documents are deliberately NOT attached —
 * the same decision the EmailJS flow made, and the right one: documents belong
 * in access-controlled storage, not scattered across mailboxes. The mail names
 * what was uploaded and carries the submission ID so staff can find the files.
 */

import { SITE_NAME } from "@/lib/seo";
import type { JobApplicationInput } from "@/lib/forms/schemas";
import {
  wrapHtml,
  paragraph,
  detailTable,
  messageBlock,
  detailLines,
  textFooter,
  esc,
} from "./layout";

export function jobApplicationInternalEmail(input: JobApplicationInput) {
  const rows = [
    { label: "Role", value: input.service_type },
    { label: "Job reference", value: input.job_reference },
    { label: "Country", value: input.country },
    { label: "Name", value: input.from_name },
    { label: "Email", value: input.reply_to },
    { label: "Phone", value: input.phone },
    { label: "Experience", value: input.experience },
    { label: "Documents", value: input.documents },
    { label: "Submission ID", value: input.submission_id },
    { label: "Source", value: input.page_source ?? "Jobs Page" },
  ];

  const storageNote = input.submission_id
    ? "Uploaded documents are in storage under the submission ID above — they are not attached to this email."
    : "No document upload was recorded for this submission.";

  return {
    subject: `New application — ${input.service_type}${input.country ? ` (${input.country})` : ""}`,
    html: wrapHtml({
      variant: "internal",
      title: "New job application",
      preheader: `${input.from_name} applied for ${input.service_type}`,
      body:
        detailTable(rows) +
        (input.message ? messageBlock("Message", input.message) : "") +
        paragraph(storageNote) +
        paragraph(
          `Reply directly to this email to reach <strong>${esc(input.from_name)}</strong>.`,
        ),
    }),
    text:
      `New job application\n\n${detailLines(rows)}\n` +
      (input.message ? `\nMessage:\n${input.message}\n` : "") +
      `\n${storageNote}\n` +
      `\nReply directly to this email to reach the applicant.${textFooter("internal")}`,
  };
}

export function jobApplicationAcknowledgementEmail(input: JobApplicationInput) {
  const firstName = input.from_name.split(" ")[0] ?? input.from_name;
  const summary = [
    { label: "Role", value: input.service_type },
    { label: "Job reference", value: input.job_reference },
    { label: "Country", value: input.country },
    { label: "Documents received", value: input.documents },
    { label: "Reference", value: input.submission_id },
  ];

  return {
    subject: `Application received — ${input.service_type}`,
    html: wrapHtml({
      title: "Your application has been received",
      preheader: `We have received your application for ${input.service_type}.`,
      body:
        paragraph(`Hi ${esc(firstName)},`) +
        paragraph(
          `Thanks for applying through ${esc(SITE_NAME)}. We have received your application and our recruitment team will review it.`,
        ) +
        detailTable(summary) +
        (input.submission_id
          ? paragraph(
              "Please keep the reference above — quote it if you contact us about this application.",
            )
          : "") +
        paragraph("If you need to send anything else, just reply to this email."),
    }),
    text:
      `Hi ${firstName},\n\nThanks for applying through ${SITE_NAME}. We have received your ` +
      `application and our recruitment team will review it.\n\n${detailLines(summary)}\n\n` +
      (input.submission_id
        ? "Please keep the reference above — quote it if you contact us about this application.\n"
        : "") +
      `If you need to send anything else, just reply to this email.${textFooter()}`,
  };
}
