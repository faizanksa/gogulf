"use client";

import { useRef, useState } from "react";
import { emailProviderMode, submitViaEmailJs, submitViaServer } from "@/lib/forms/transport";

// Submits through whichever email path is configured:
//   NEXT_PUBLIC_EMAIL_PROVIDER=resend -> POST /api/forms/contact (server-side)
//   otherwise                          -> EmailJS, exactly as before
//
// Both paths are live in the codebase during the migration, so switching back
// is an environment variable rather than a revert. See lib/forms/transport.js.
export default function ContactForm() {
  const formRef = useRef(null);
  const [status, setStatus] = useState({ state: "idle", message: "" });
  const [fieldErrors, setFieldErrors] = useState({});

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus({ state: "sending", message: "" });
    setFieldErrors({});

    const form = formRef.current;
    const result =
      emailProviderMode() === "resend"
        ? await submitViaServer("contact", {
            from_name: form.elements.from_name.value,
            reply_to: form.elements.reply_to.value,
            phone: form.elements.phone.value,
            message: form.elements.message.value,
            page_source: "Contact Page",
            website: form.elements.website.value,
          })
        : await submitViaEmailJs(form);

    if (!result.ok) {
      setFieldErrors(result.fieldErrors || {});
      setStatus({
        state: "err",
        message:
          result.error ||
          "Something went wrong sending your inquiry. Please try again or call us directly.",
      });
      return;
    }

    setStatus({
      state: "ok",
      message:
        "Inquiry received — our recruitment team will contact you shortly." +
        (result.acknowledgementSent === false
          ? " (We could not email you a copy, but your message did reach us.)"
          : ""),
    });
    form.reset();
  }

  const sending = status.state === "sending";
  const errorFor = (field) => fieldErrors[field]?.[0];

  return (
    <form className="js-inquiry-form" id="contact-form" ref={formRef} onSubmit={handleSubmit} noValidate>
      {/* Retained for the EmailJS template, which reads these as variables. */}
      <input type="hidden" name="page_source" value="Contact Page" />
      <input type="hidden" name="service_type" value="General Inquiry" />
      <input type="hidden" name="to_email" value="careers@gogulf.co" />

      {/* Honeypot — hidden from people, filled by naive bots. aria-hidden and
          tabIndex keep it out of the accessibility tree and tab order. */}
      <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", height: 0, overflow: "hidden" }}>
        <label htmlFor="c_website">Leave this field empty</label>
        <input type="text" id="c_website" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>

      <div className="field">
        <label htmlFor="c_name">Full Name</label>
        <input type="text" id="c_name" name="from_name" required disabled={sending} aria-invalid={Boolean(errorFor("from_name"))} />
        {errorFor("from_name") && <span className="field-hint field-error">{errorFor("from_name")}</span>}
      </div>
      <div className="field">
        <label htmlFor="c_email">Email Address</label>
        <input type="email" id="c_email" name="reply_to" required disabled={sending} aria-invalid={Boolean(errorFor("reply_to"))} />
        {errorFor("reply_to") && <span className="field-hint field-error">{errorFor("reply_to")}</span>}
      </div>
      <div className="field">
        <label htmlFor="c_phone">Phone / WhatsApp</label>
        <input type="tel" id="c_phone" name="phone" disabled={sending} aria-invalid={Boolean(errorFor("phone"))} />
        {errorFor("phone") && <span className="field-hint field-error">{errorFor("phone")}</span>}
      </div>
      <div className="field">
        <label htmlFor="c_message">Message</label>
        <textarea id="c_message" name="message" rows={4} required disabled={sending} aria-invalid={Boolean(errorFor("message"))} />
        {errorFor("message") && <span className="field-hint field-error">{errorFor("message")}</span>}
      </div>
      <button type="submit" className="btn btn-gold" disabled={sending}>
        {sending ? "Sending…" : "Send Message"}
      </button>
      <div
        className={`form-msg${status.state === "ok" ? " ok" : status.state === "err" ? " err" : ""}`}
        role="status"
      >
        {status.message}
      </div>
    </form>
  );
}
