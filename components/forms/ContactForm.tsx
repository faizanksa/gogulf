"use client";

import { useRef, useState, type FormEvent } from "react";
import { Input, Textarea } from "@/components/form/Controls";
import { ErrorSummary } from "@/components/form/ErrorSummary";
import { Field } from "@/components/form/Field";
import { FormStatus } from "@/components/form/FormStatus";
import { Button } from "@/components/ui/Button";
import type { ContactFormCopy } from "@/lib/i18n/forms";
import { collectNativeErrors, fromServerErrors, type FormError } from "@/lib/forms/native-validation";
import { submitViaServer } from "@/lib/forms/transport";
import styles from "./forms.module.css";

/**
 * The general contact form — the form kit's reference implementation (Phase 2B), moved
 * to TypeScript in 2C with its behaviour unchanged:
 *   - browser validation with the platform's own constraint API (no library shipped),
 *     authoritative validation on the server, both rendered the same way
 *   - an error summary that takes focus on a failed submit and links to each field
 *   - errors tied to their fields with aria-describedby / aria-invalid
 *   - fields stay enabled while sending; the button reports its state instead
 *   - every word arrives in `copy` (lib/i18n/forms.ts contactFormCopy); the submission
 *     carries the page's language, so the server's replies match it
 *
 * Submits to /api/forms/contact — same payload as before — which re-validates and sends
 * through Resend.
 */

const IDS: Record<string, string> = { from_name: "c_name", reply_to: "c_email", phone: "c_phone", message: "c_message" };

export function ContactForm({ copy }: { copy: ContactFormCopy }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [errors, setErrors] = useState<FormError[]>([]);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<{ state: "idle" | "sending" | "success" | "error"; message: string }>({ state: "idle", message: "" });
  const sending = status.state === "sending";
  const errorFor = (name: string) => errors.find((e) => e.name === name)?.message;

  const messages = {
    from_name: () => copy.errors.nameMissing,
    reply_to: (el: { validity: ValidityState }) => (el.validity.valueMissing ? copy.errors.emailMissing : copy.errors.emailInvalid),
    message: () => copy.errors.messageMissing,
  };

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (sending) return;
    const form = formRef.current!;
    const value = (name: string) => (form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement).value;

    const clientErrors = collectNativeErrors(form, messages);
    if (clientErrors.length) {
      setErrors(clientErrors);
      setAttempt((n) => n + 1);
      setStatus({ state: "idle", message: "" });
      return;
    }
    setErrors([]);
    setStatus({ state: "sending", message: "" });

    const result = await submitViaServer(
      "contact",
      {
        from_name: value("from_name"),
        reply_to: value("reply_to"),
        phone: value("phone"),
        message: value("message"),
        page_source: "Contact Page",
        website: value("website"),
      },
      { locale: copy.locale, messages: { offline: copy.outcome.offline, unexpected: copy.outcome.unexpected } },
    );

    if (!result.ok) {
      const serverErrors = fromServerErrors(result.fieldErrors, (name) => IDS[name] ?? name);
      if (serverErrors.length) {
        setErrors(serverErrors);
        setAttempt((n) => n + 1);
      }
      setStatus({ state: "error", message: result.error || copy.outcome.failed });
      return;
    }
    setStatus({ state: "success", message: result.acknowledgementSent === false ? copy.outcome.sentNoCopy : copy.outcome.sent });
    form.reset();
  }

  return (
    <form ref={formRef} id="contact-form" className={styles.form} onSubmit={handleSubmit} noValidate aria-busy={sending || undefined}>
      {/* Honeypot — hidden from people, filled by naive bots. */}
      <div aria-hidden="true" className={styles.honeypot}>
        <label htmlFor="c_website">{copy.honeypot}</label>
        <input type="text" id="c_website" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>

      <ErrorSummary errors={errors} attempt={attempt} title={copy.errorSummaryTitle} />

      <Field id={IDS.from_name!} label={copy.labels.fullName} text={copy.field} error={errorFor("from_name")}>
        <Input name="from_name" type="text" autoComplete="name" required />
      </Field>
      <Field id={IDS.reply_to!} label={copy.labels.email} text={copy.field} error={errorFor("reply_to")}>
        <Input name="reply_to" type="email" autoComplete="email" inputMode="email" spellCheck={false} required />
      </Field>
      <Field id={IDS.phone!} label={copy.labels.phone} hint={copy.labels.phoneHint} optional text={copy.field} error={errorFor("phone")}>
        <Input name="phone" type="tel" autoComplete="tel" inputMode="tel" />
      </Field>
      <Field id={IDS.message!} label={copy.labels.message} text={copy.field} error={errorFor("message")}>
        <Textarea name="message" required rows={5} maxLength={5000} />
      </Field>

      <div>
        <Button type="submit" loading={sending}>
          {sending ? copy.sending : copy.submit}
        </Button>
      </div>
      <FormStatus state={status.state} text={copy.status}>
        {status.message}
      </FormStatus>
    </form>
  );
}
