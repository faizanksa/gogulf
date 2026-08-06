"use client";

// ===== GO GULF — EmailJS helper =====
// SETUP REQUIRED (see EMAILJS-SETUP.md):
//   1. Create a free account at https://www.emailjs.com
//   2. Connect your inbox (e.g. info@gogulf.com) as an Email Service
//   3. Create an Email Template with the fields used by the site's forms
//   4. Copy .env.local.example to .env.local and fill in the three keys below
import emailjs from "@emailjs/browser";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY;
const SERVICE_ID = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID;
const TEMPLATE_ID = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID;

export const isEmailJsConfigured = Boolean(PUBLIC_KEY && SERVICE_ID && TEMPLATE_ID);

let initialized = false;
function ensureInit() {
  if (!initialized && isEmailJsConfigured) {
    emailjs.init({ publicKey: PUBLIC_KEY });
    initialized = true;
  }
}

// Sends a native <form> element's fields via EmailJS. Field names must match
// the template variables documented in EMAILJS-SETUP.md (from_name, reply_to,
// phone, message, service_type, country, experience, resume_link, page_source,
// to_email).
export async function sendInquiry(formEl) {
  if (!isEmailJsConfigured) {
    throw new Error(
      "Form is not connected yet — add your EmailJS keys to .env.local (see EMAILJS-SETUP.md)."
    );
  }
  ensureInit();
  return emailjs.sendForm(SERVICE_ID, TEMPLATE_ID, formEl);
}
