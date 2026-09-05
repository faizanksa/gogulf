/**
 * Shared email chrome and escaping.
 *
 * Email HTML is not web HTML: no external stylesheets, inline styles only,
 * tables for structure, and a plain-text alternative for every message.
 */

import { LEGAL_ENTITY, ADDRESS_ONE_LINE } from "@/lib/legal";
import { SITE_URL, CONTACT, SITE_NAME } from "@/lib/seo";

/**
 * Escape user-supplied text before it enters an HTML email.
 *
 * Form input reaches staff inboxes. Some clients render HTML, so unescaped
 * input is an injection vector into a colleague's mail client.
 */
export function esc(value: string | undefined | null): string {
  if (value === undefined || value === null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const BRAND = "#16794A";
const INK = "#10150F";
const MUTED = "#5F6960";
const RULE = "#DCE3DA";

export interface Row {
  label: string;
  value: string | undefined | null;
}

/** Label/value rows, skipping empties so blank fields do not clutter the mail. */
export function detailRows(rows: Row[]): string {
  return rows
    .filter((r) => r.value !== undefined && r.value !== null && String(r.value).trim() !== "")
    .map(
      (r) => `
        <tr>
          <td style="padding:8px 16px 8px 0;color:${MUTED};font-size:13px;vertical-align:top;white-space:nowrap;">${esc(r.label)}</td>
          <td style="padding:8px 0;color:${INK};font-size:14px;vertical-align:top;">${esc(r.value)}</td>
        </tr>`,
    )
    .join("");
}

export function detailLines(rows: Row[]): string {
  return rows
    .filter((r) => r.value !== undefined && r.value !== null && String(r.value).trim() !== "")
    .map((r) => `${r.label}: ${r.value}`)
    .join("\n");
}

export interface LayoutOptions {
  title: string;
  preheader?: string;
  body: string;
  /** Internal mail gets a plainer, denser frame than customer-facing mail. */
  variant?: "internal" | "external";
}

export function wrapHtml({ title, preheader, body, variant = "external" }: LayoutOptions): string {
  const isInternal = variant === "internal";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
</head>
<body style="margin:0;padding:0;background:#FAFBF9;">
${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAFBF9;padding:24px 12px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#FFFFFF;border:1px solid ${RULE};border-radius:6px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
      <tr>
        <td style="padding:20px 28px;border-bottom:1px solid ${RULE};">
          <span style="font-size:17px;font-weight:700;color:${BRAND};letter-spacing:-0.2px;">GO GULF</span>
          ${isInternal ? `<span style="float:right;font-size:11px;color:${MUTED};text-transform:uppercase;letter-spacing:1px;">Website submission</span>` : ""}
        </td>
      </tr>
      <tr>
        <td style="padding:28px;">
          <h1 style="margin:0 0 16px;font-size:19px;line-height:1.3;color:${INK};font-weight:600;">${esc(title)}</h1>
          ${body}
        </td>
      </tr>
      <tr>
        <td style="padding:18px 28px;border-top:1px solid ${RULE};background:#F1F4F0;color:${MUTED};font-size:11px;line-height:1.6;">
          ${
            isInternal
              ? `Sent automatically by the ${esc(SITE_NAME)} website.`
              : `${esc(LEGAL_ENTITY.name)} &middot; trading as ${esc(LEGAL_ENTITY.brand)}<br>
                 ${esc(ADDRESS_ONE_LINE)}<br>
                 CIN ${esc(LEGAL_ENTITY.cin)} &middot; GSTIN ${esc(LEGAL_ENTITY.gstin)}<br>
                 <a href="${SITE_URL}" style="color:${BRAND};text-decoration:none;">${SITE_URL.replace(/^https?:\/\//, "")}</a>
                 &middot; <a href="mailto:${esc(CONTACT.jobsEmail)}" style="color:${BRAND};text-decoration:none;">${esc(CONTACT.jobsEmail)}</a>`
          }
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

/** Footer for the plain-text alternative. */
export function textFooter(variant: "internal" | "external" = "external"): string {
  if (variant === "internal") {
    return `\n\n--\nSent automatically by the ${SITE_NAME} website.`;
  }
  return `\n\n--\n${LEGAL_ENTITY.name}, trading as ${LEGAL_ENTITY.brand}\n${ADDRESS_ONE_LINE}\nCIN ${LEGAL_ENTITY.cin} | GSTIN ${LEGAL_ENTITY.gstin}\n${SITE_URL} | ${CONTACT.jobsEmail}`;
}

export function paragraph(text: string): string {
  return `<p style="margin:0 0 14px;font-size:14px;line-height:1.65;color:${INK};">${text}</p>`;
}

export function detailTable(rows: Row[]): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:4px 0 18px;border-top:1px solid ${RULE};border-bottom:1px solid ${RULE};">${detailRows(rows)}</table>`;
}

export function messageBlock(label: string, message: string): string {
  return `
    <div style="margin:0 0 18px;">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:${MUTED};margin-bottom:6px;">${esc(label)}</div>
      <div style="padding:14px 16px;background:#F1F4F0;border-left:3px solid ${BRAND};border-radius:0 4px 4px 0;font-size:14px;line-height:1.6;color:${INK};white-space:pre-wrap;">${esc(message)}</div>
    </div>`;
}
