"use client";

import { useRef, useState } from "react";
import { sendInquiry } from "@/lib/emailjs";

const CANDIDATE_SERVICES = [
  "Overseas Recruitment",
  "Gulf Job Placement",
  "Interview Coordination",
  "Visa & Documentation Assistance",
  "Medical Coordination",
  "MOFA & Embassy Processing",
  "Immigration Support",
  "Air Ticket & Travel Assistance",
  "Pre-Departure Orientation",
  "Post-Joining Support",
];

const EMPLOYER_SERVICES = [
  "Employer Hiring Solutions",
  "Bulk Manpower Recruitment",
  "Recruitment Process Outsourcing (RPO)",
  "Candidate Screening",
  "HR & Recruitment Support",
];

const COUNTRIES = ["Saudi Arabia", "United Arab Emirates", "Qatar", "Oman", "Kuwait", "Bahrain"];

export default function ServiceInquiryForm() {
  const formRef = useRef(null);
  const [toEmail, setToEmail] = useState("careers@gogulf.co");
  const [status, setStatus] = useState({ state: "idle", message: "" });

  function handleServiceChange(e) {
    const select = e.target;
    const opt = select.options[select.selectedIndex];
    const group = opt.parentElement && opt.parentElement.tagName === "OPTGROUP" ? opt.parentElement.label : "";
    setToEmail(group === "For Employers" ? "business@gogulf.co" : "careers@gogulf.co");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus({ state: "sending", message: "" });
    try {
      await sendInquiry(formRef.current);
      setStatus({ state: "ok", message: "Inquiry received — our recruitment team will contact you shortly." });
      formRef.current.reset();
      setToEmail("careers@gogulf.co");
    } catch (err) {
      setStatus({
        state: "err",
        message: err instanceof Error ? err.message : "Something went wrong sending your inquiry. Please try again or call us directly.",
      });
      console.error("EmailJS error:", err);
    }
  }

  const sending = status.state === "sending";

  return (
    <form className="pass js-inquiry-form" id="inquiry-form" ref={formRef} onSubmit={handleSubmit}>
      <input type="hidden" name="page_source" value="Services Page" />
      <input type="hidden" name="to_email" id="to_email" value={toEmail} readOnly />
      <div className="pass-main">
        <div className="field">
          <label htmlFor="service_type">Service Type</label>
          <select id="service_type" name="service_type" required defaultValue="" onChange={handleServiceChange}>
            <option value="" disabled>Select the service you need</option>
            <optgroup label="For Candidates">
              {CANDIDATE_SERVICES.map((s) => <option key={s}>{s}</option>)}
            </optgroup>
            <optgroup label="For Employers">
              {EMPLOYER_SERVICES.map((s) => <option key={s}>{s}</option>)}
            </optgroup>
            <option>Other / Not Sure</option>
          </select>
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="from_name">Full Name</label>
            <input type="text" id="from_name" name="from_name" required />
          </div>
          <div className="field">
            <label htmlFor="reply_to">Email Address</label>
            <input type="email" id="reply_to" name="reply_to" required />
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="phone">Phone / WhatsApp</label>
            <input type="tel" id="phone" name="phone" required />
          </div>
          <div className="field">
            <label htmlFor="country">Preferred Country</label>
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
