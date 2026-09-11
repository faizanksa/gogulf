"use client";

import { useRef, useState } from "react";
import { ErrorSummary } from "@/components/form/ErrorSummary";
import { Field } from "@/components/form/Field";
import { Input, Textarea } from "@/components/form/Controls";
import { FormStatus } from "@/components/form/FormStatus";
import { Button } from "@/components/ui/Button";
import { collectNativeErrors, fromServerErrors } from "@/lib/forms/native-validation";
import { submitViaServer } from "@/lib/forms/transport";
import styles from "./ContactForm.module.css";

// The reference implementation of the form kit (Phase 2B):
//   - browser validation with the platform's own constraint API (no library shipped),
//     authoritative validation on the server, both rendered the same way
//   - an error summary that takes focus on a failed submit and links to each field
//   - errors tied to their fields with aria-describedby / aria-invalid
//   - fields stay enabled while sending; the button reports its state instead
//
// Submits to /api/forms/contact, which re-validates and sends through Resend.

const IDS = { from_name: "c_name", reply_to: "c_email", phone: "c_phone", message: "c_message" };

const MESSAGES = {
  from_name: () => "Enter your full name.",
  reply_to: (el) => (el.validity.valueMissing ? "Enter your email address." : "Enter an email address like name@example.com."),
  message: () => "Enter your message.",
};

export default function ContactForm() {
  const formRef = useRef(null);
  const [errors, setErrors] = useState([]);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState({ state: "idle", message: "" });
  const sending = status.state === "sending";
  const errorFor = (name) => errors.find((e) => e.name === name)?.message;

  async function handleSubmit(e) {
    e.preventDefault();
    if (sending) return;
    const form = formRef.current;

    const clientErrors = collectNativeErrors(form, MESSAGES);
    if (clientErrors.length) {
      setErrors(clientErrors);
      setAttempt((n) => n + 1);
      setStatus({ state: "idle", message: "" });
      return;
    }

    setErrors([]);
    setStatus({ state: "sending", message: "" });

    const result = await submitViaServer("contact", {
      from_name: form.elements.from_name.value,
      reply_to: form.elements.reply_to.value,
      phone: form.elements.phone.value,
      message: form.elements.message.value,
      page_source: "Contact Page",
      website: form.elements.website.value,
    });

    if (!result.ok) {
      const serverErrors = fromServerErrors(result.fieldErrors, (name) => IDS[name] ?? name);
      if (serverErrors.length) {
        setErrors(serverErrors);
        setAttempt((n) => n + 1);
      }
      setStatus({
        state: "error",
        message: result.error || "We could not send your message. Please try again, or call or WhatsApp us.",
      });
      return;
    }

    setStatus({
      state: "success",
      message:
        "Message received — our team will contact you." +
        (result.acknowledgementSent === false ? " We could not email you a copy, but your message did reach us." : ""),
    });
    form.reset();
  }

  return (
    <form ref={formRef} id="contact-form" className={styles.form} onSubmit={handleSubmit} noValidate aria-busy={sending || undefined}>
      {/* Honeypot — hidden from people, filled by naive bots. */}
      <div aria-hidden="true" className={styles.honeypot}>
        <label htmlFor="c_website">Leave this field empty</label>
        <input type="text" id="c_website" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>

      <ErrorSummary errors={errors} attempt={attempt} />

      <Field id={IDS.from_name} label="Full name" error={errorFor("from_name")}>
        <Input name="from_name" type="text" autoComplete="name" required />
      </Field>
      <Field id={IDS.reply_to} label="Email address" error={errorFor("reply_to")}>
        <Input name="reply_to" type="email" autoComplete="email" inputMode="email" spellCheck={false} required />
      </Field>
      <Field id={IDS.phone} label="Phone or WhatsApp number" hint="Include the country code if you are outside India." optional error={errorFor("phone")}>
        <Input name="phone" type="tel" autoComplete="tel" inputMode="tel" />
      </Field>
      <Field id={IDS.message} label="Message" error={errorFor("message")}>
        <Textarea name="message" required rows={5} />
      </Field>

      <div>
        <Button type="submit" loading={sending}>
          {sending ? "Sending…" : "Send message"}
        </Button>
      </div>
      <FormStatus state={status.state}>{status.message}</FormStatus>
    </form>
  );
}
