"use client";

import { useRef, useState } from "react";
import { sendInquiry } from "@/lib/emailjs";

export default function ContactForm() {
  const formRef = useRef(null);
  const [status, setStatus] = useState({ state: "idle", message: "" });

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus({ state: "sending", message: "" });
    try {
      await sendInquiry(formRef.current);
      setStatus({ state: "ok", message: "Inquiry received — our recruitment team will contact you shortly." });
      formRef.current.reset();
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
    <form className="js-inquiry-form" id="contact-form" ref={formRef} onSubmit={handleSubmit}>
      <input type="hidden" name="page_source" value="Contact Page" />
      <input type="hidden" name="service_type" value="General Inquiry" />
      <input type="hidden" name="to_email" value="careers@gogulf.co" />
      <div className="field">
        <label htmlFor="c_name">Full Name</label>
        <input type="text" id="c_name" name="from_name" required />
      </div>
      <div className="field">
        <label htmlFor="c_email">Email Address</label>
        <input type="email" id="c_email" name="reply_to" required />
      </div>
      <div className="field">
        <label htmlFor="c_phone">Phone / WhatsApp</label>
        <input type="tel" id="c_phone" name="phone" />
      </div>
      <div className="field">
        <label htmlFor="c_message">Message</label>
        <textarea id="c_message" name="message" rows={4} required />
      </div>
      <button type="submit" className="btn btn-gold" disabled={sending}>
        {sending ? "Sending…" : "Send Message"}
      </button>
      <div className={`form-msg${status.state === "ok" ? " ok" : status.state === "err" ? " err" : ""}`} role="status">
        {status.message}
      </div>
    </form>
  );
}
