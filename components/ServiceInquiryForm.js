"use client";

import { useRef, useState } from "react";
import { ErrorSummary } from "@/components/form/ErrorSummary";
import { fromServerErrors } from "@/lib/forms/native-validation";
import { CANDIDATE_SERVICES, EMPLOYER_SERVICES } from "@/lib/forms/service-options";
import { submitViaServer } from "@/lib/forms/transport";

const COUNTRIES = ["Saudi Arabia", "United Arab Emirates", "Qatar", "Oman", "Kuwait", "Bahrain"];

// Interim service inquiry form (Phase 2B accessibility pass; redesigned in 2C-3).
//   - submits to /api/forms/service-inquiry, which re-validates, derives the desk from
//     the service name and sends through Resend
//   - service lists come from a dependency-free module, so Zod is not shipped here
//   - server field errors are tied to their fields (aria-describedby) and listed in an
//     error summary that takes focus
//   - fields stay enabled while sending
//   - no response-time promise (none has been committed to)
export default function ServiceInquiryForm() {
  const formRef = useRef(null);
  const [status, setStatus] = useState({ state: "idle", message: "" });
  const [errors, setErrors] = useState([]);
  const [attempt, setAttempt] = useState(0);
  const sending = status.state === "sending";

  async function handleSubmit(e) {
    e.preventDefault();
    if (sending) return;
    setStatus({ state: "sending", message: "" });
    setErrors([]);

    const form = formRef.current;
    const result = await submitViaServer("service-inquiry", {
      service_type: form.elements.service_type.value,
      from_name: form.elements.from_name.value,
      reply_to: form.elements.reply_to.value,
      phone: form.elements.phone.value,
      country: form.elements.country.value,
      message: form.elements.message.value,
      page_source: "Services Page",
      website: form.elements.website.value,
    });

    if (!result.ok) {
      const list = fromServerErrors(result.fieldErrors, (name) => name);
      setErrors(list);
      if (list.length) setAttempt((n) => n + 1);
      setStatus({
        state: "err",
        message: result.error || "Something went wrong sending your inquiry. Please try again or call us directly.",
      });
      return;
    }

    setStatus({
      state: "ok",
      message:
        "Inquiry received — our team will contact you." +
        (result.acknowledgementSent === false ? " (We could not email you a copy, but your inquiry did reach us.)" : ""),
    });
    form.reset();
  }

  const errorFor = (field) => errors.find((e) => e.name === field)?.message;
  const describe = (field) => (errorFor(field) ? `${field}-error` : undefined);

  return (
    <form className="pass js-inquiry-form" id="inquiry-form" ref={formRef} onSubmit={handleSubmit} noValidate aria-busy={sending || undefined}>
      {/* Honeypot — hidden from people, filled by naive bots. */}
      <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", height: 0, overflow: "hidden" }}>
        <label htmlFor="s_website">Leave this field empty</label>
        <input type="text" id="s_website" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>

      <div className="pass-main">
        {/* English-only until this form is rebuilt in 2C with a copy prop, like ContactForm. */}
        <ErrorSummary errors={errors} attempt={attempt} title="There is a problem" />
        <div className="field" style={{ marginTop: errors.length ? 20 : 0 }}>
          <label htmlFor="service_type">Service type</label>
          <select id="service_type" name="service_type" required defaultValue="" aria-invalid={Boolean(errorFor("service_type"))} aria-describedby={describe("service_type")}>
            <option value="" disabled>Select the service you need</option>
            <optgroup label="For Candidates">
              {CANDIDATE_SERVICES.map((s) => <option key={s}>{s}</option>)}
            </optgroup>
            <optgroup label="For Employers">
              {EMPLOYER_SERVICES.map((s) => <option key={s}>{s}</option>)}
            </optgroup>
            <option>Other / Not Sure</option>
          </select>
          {errorFor("service_type") && <span id="service_type-error" className="field-hint field-error">{errorFor("service_type")}</span>}
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="from_name">Full name</label>
            <input type="text" id="from_name" name="from_name" autoComplete="name" required aria-invalid={Boolean(errorFor("from_name"))} aria-describedby={describe("from_name")} />
            {errorFor("from_name") && <span id="from_name-error" className="field-hint field-error">{errorFor("from_name")}</span>}
          </div>
          <div className="field">
            <label htmlFor="reply_to">Email address</label>
            <input type="email" id="reply_to" name="reply_to" autoComplete="email" required aria-invalid={Boolean(errorFor("reply_to"))} aria-describedby={describe("reply_to")} />
            {errorFor("reply_to") && <span id="reply_to-error" className="field-hint field-error">{errorFor("reply_to")}</span>}
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="phone">Phone or WhatsApp number</label>
            <input type="tel" id="phone" name="phone" autoComplete="tel" required aria-invalid={Boolean(errorFor("phone"))} aria-describedby={describe("phone")} />
            {errorFor("phone") && <span id="phone-error" className="field-hint field-error">{errorFor("phone")}</span>}
          </div>
          <div className="field">
            <label htmlFor="country">Preferred country</label>
            <select id="country" name="country" defaultValue="">
              <option value="">Any / Not sure</option>
              {COUNTRIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="message">Message</label>
          <textarea id="message" name="message" rows={4} placeholder="Tell us a bit more — role, industry, timeline..." />
        </div>
        <button type="submit" className="btn btn-gold" aria-disabled={sending || undefined}>
          {sending ? "Sending…" : "Submit inquiry"}
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
            <div className="pass-label">Next step</div>
            <div className="pass-value">Our team contacts you</div>
          </div>
        </div>
        <div>
          <div className="pass-label">Go Gulf. Get Hired.</div>
        </div>
      </div>
    </form>
  );
}
