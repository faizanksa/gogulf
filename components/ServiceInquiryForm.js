"use client";

import { useRef, useState } from "react";
import { emailProviderMode, submitViaEmailJs, submitViaServer } from "@/lib/forms/transport";
import { CANDIDATE_SERVICES, EMPLOYER_SERVICES } from "@/lib/forms/schemas";

const COUNTRIES = ["Saudi Arabia", "United Arab Emirates", "Qatar", "Oman", "Kuwait", "Bahrain"];

// The service lists live in lib/forms/schemas.js so the server can decide which
// desk an inquiry reaches. Previously the browser made that call and passed the
// answer in a hidden to_email field — editable by anyone with dev tools.
export default function ServiceInquiryForm() {
  const formRef = useRef(null);
  const [toEmail, setToEmail] = useState("careers@gogulf.co");
  const [status, setStatus] = useState({ state: "idle", message: "" });
  const [fieldErrors, setFieldErrors] = useState({});

  // Still maintained for the EmailJS path, which reads to_email from the form.
  // The Resend path ignores it entirely and re-derives the recipient server-side.
  function handleServiceChange(e) {
    const select = e.target;
    const opt = select.options[select.selectedIndex];
    const group = opt.parentElement && opt.parentElement.tagName === "OPTGROUP" ? opt.parentElement.label : "";
    setToEmail(group === "For Employers" ? "business@gogulf.co" : "careers@gogulf.co");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus({ state: "sending", message: "" });
    setFieldErrors({});

    const form = formRef.current;
    const result =
      emailProviderMode() === "resend"
        ? await submitViaServer("service-inquiry", {
            service_type: form.elements.service_type.value,
            from_name: form.elements.from_name.value,
            reply_to: form.elements.reply_to.value,
            phone: form.elements.phone.value,
            country: form.elements.country.value,
            message: form.elements.message.value,
            page_source: "Services Page",
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
          ? " (We could not email you a copy, but your inquiry did reach us.)"
          : ""),
    });
    form.reset();
    setToEmail("careers@gogulf.co");
  }

  const sending = status.state === "sending";
  const errorFor = (field) => fieldErrors[field]?.[0];

  return (
    <form className="pass js-inquiry-form" id="inquiry-form" ref={formRef} onSubmit={handleSubmit} noValidate>
      <input type="hidden" name="page_source" value="Services Page" />
      {/* EmailJS path only. Ignored by the server route. */}
      <input type="hidden" name="to_email" id="to_email" value={toEmail} readOnly />

      {/* Honeypot — hidden from people, filled by naive bots. */}
      <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", height: 0, overflow: "hidden" }}>
        <label htmlFor="s_website">Leave this field empty</label>
        <input type="text" id="s_website" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>

      <div className="pass-main">
        <div className="field">
          <label htmlFor="service_type">Service Type</label>
          <select id="service_type" name="service_type" required defaultValue="" onChange={handleServiceChange} disabled={sending} aria-invalid={Boolean(errorFor("service_type"))}>
            <option value="" disabled>Select the service you need</option>
            <optgroup label="For Candidates">
              {CANDIDATE_SERVICES.map((s) => <option key={s}>{s}</option>)}
            </optgroup>
            <optgroup label="For Employers">
              {EMPLOYER_SERVICES.map((s) => <option key={s}>{s}</option>)}
            </optgroup>
            <option>Other / Not Sure</option>
          </select>
          {errorFor("service_type") && <span className="field-hint field-error">{errorFor("service_type")}</span>}
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="from_name">Full Name</label>
            <input type="text" id="from_name" name="from_name" required disabled={sending} aria-invalid={Boolean(errorFor("from_name"))} />
            {errorFor("from_name") && <span className="field-hint field-error">{errorFor("from_name")}</span>}
          </div>
          <div className="field">
            <label htmlFor="reply_to">Email Address</label>
            <input type="email" id="reply_to" name="reply_to" required disabled={sending} aria-invalid={Boolean(errorFor("reply_to"))} />
            {errorFor("reply_to") && <span className="field-hint field-error">{errorFor("reply_to")}</span>}
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="phone">Phone / WhatsApp</label>
            <input type="tel" id="phone" name="phone" required disabled={sending} aria-invalid={Boolean(errorFor("phone"))} />
            {errorFor("phone") && <span className="field-hint field-error">{errorFor("phone")}</span>}
          </div>
          <div className="field">
            <label htmlFor="country">Preferred Country</label>
            <select id="country" name="country" defaultValue="" disabled={sending}>
              <option value="">Any / Not sure</option>
              {COUNTRIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="message">Message</label>
          <textarea id="message" name="message" rows={4} placeholder="Tell us a bit more — role, industry, timeline..." disabled={sending} />
        </div>
        <button type="submit" className="btn btn-gold" disabled={sending}>
          {sending ? "Sending…" : "Submit Inquiry"}
        </button>
        <div className={`form-msg${status.state === "ok" ? " ok" : status.state === "err" ? " err" : ""}`} role="status">
          {status.message}
        </div>
      </div>

      <div className="pass-stub">
        <div>
          <div className="stamp">Go Gulf · Inquiry</div>
          <div style={{ marginTop: 26 }}>
            <div className="pass-label">Route</div>
            <div className="pass-value">Candidate → Recruiter</div>
          </div>
          <div style={{ marginTop: 20 }}>
            <div className="pass-label">Response</div>
            <div className="pass-value">Within 1–2 business days</div>
          </div>
        </div>
        <div>
          <div className="pass-label">Go Gulf. Get Hired.</div>
        </div>
      </div>
    </form>
  );
}
