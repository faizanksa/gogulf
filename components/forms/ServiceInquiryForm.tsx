"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Input, Select, Textarea } from "@/components/form/Controls";
import { ErrorSummary } from "@/components/form/ErrorSummary";
import { Field, type FieldText } from "@/components/form/Field";
import { FormStatus, type FormStatusText } from "@/components/form/FormStatus";
import { Button } from "@/components/ui/Button";
import { collectNativeErrors, fromServerErrors, type FormError } from "@/lib/forms/native-validation";
import { submitViaServer } from "@/lib/forms/transport";
import type { Option } from "./EmployerRequirementForm";
import styles from "./forms.module.css";

/**
 * The service inquiry form (2C-3), replacing the pre-redesign one. Same route, same
 * payload: /api/forms/service-inquiry re-validates, derives the desk from the service
 * name server-side (a tampered payload cannot reroute it) and sends through Resend.
 *
 * Service values stay the exact names the server knows (lib/forms/service-options.ts);
 * the labels shown are translated. A link to /services?service=<id>#inquiry preselects
 * a service. Every word arrives in `copy` (lib/i18n/forms.ts serviceInquiryCopy).
 */

export interface ServiceInquiryCopy {
  locale: string;
  errorSummaryTitle: string;
  honeypot: string;
  field: FieldText;
  status: FormStatusText;
  labels: { service: string; name: string; email: string; phone: string; phoneHint: string; country: string; message: string; messageHint: string };
  servicePlaceholder: string;
  groups: { seekers: string; employers: string };
  services: { seekers: (Option & { id: string })[]; employers: (Option & { id: string })[]; other: Option };
  countries: Option[];
  anyCountry: string;
  submit: string;
  sending: string;
  errors: { serviceMissing: string; nameMissing: string; emailMissing: string; emailInvalid: string; phoneMissing: string };
  outcome: { sent: string; sentNoCopy: string; failed: string; offline: string; unexpected: string };
}

const IDS: Record<string, string> = {
  service_type: "s_service",
  from_name: "s_name",
  reply_to: "s_email",
  phone: "s_phone",
  country: "s_country",
  message: "s_message",
};

export function ServiceInquiryForm({ copy }: { copy: ServiceInquiryCopy }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [errors, setErrors] = useState<FormError[]>([]);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<{ state: "idle" | "sending" | "success" | "error"; message: string }>({ state: "idle", message: "" });
  const sending = status.state === "sending";
  const errorFor = (name: string) => errors.find((e) => e.name === name)?.message;

  useEffect(() => {
    // ?service=<id> from a service card preselects it; the query exists only in the browser.
    const id = new URLSearchParams(window.location.search).get("service");
    const match = [...copy.services.seekers, ...copy.services.employers].find((s) => s.id === id);
    const select = formRef.current?.elements.namedItem("service_type") as HTMLSelectElement | null;
    if (match && select) select.value = match.value;
  }, [copy.services]);

  const messages = {
    service_type: () => copy.errors.serviceMissing,
    from_name: () => copy.errors.nameMissing,
    reply_to: (el: { validity: ValidityState }) => (el.validity.valueMissing ? copy.errors.emailMissing : copy.errors.emailInvalid),
    phone: () => copy.errors.phoneMissing,
  };

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (sending) return;
    const form = formRef.current!;
    const value = (name: string) => (form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value;

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
      "service-inquiry",
      {
        service_type: value("service_type"),
        from_name: value("from_name"),
        reply_to: value("reply_to"),
        phone: value("phone"),
        country: value("country"),
        message: value("message"),
        page_source: "Services Page",
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
    <form ref={formRef} id="inquiry-form" className={styles.form} onSubmit={handleSubmit} noValidate aria-busy={sending || undefined}>
      <div aria-hidden="true" className={styles.honeypot}>
        <label htmlFor="s_website">{copy.honeypot}</label>
        <input type="text" id="s_website" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>

      <ErrorSummary errors={errors} attempt={attempt} title={copy.errorSummaryTitle} />

      <Field id={IDS.service_type!} label={copy.labels.service} text={copy.field} error={errorFor("service_type")}>
        <Select name="service_type" required defaultValue="">
          <option value="" disabled>
            {copy.servicePlaceholder}
          </option>
          <optgroup label={copy.groups.seekers}>
            {copy.services.seekers.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </optgroup>
          <optgroup label={copy.groups.employers}>
            {copy.services.employers.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </optgroup>
          <option value={copy.services.other.value}>{copy.services.other.label}</option>
        </Select>
      </Field>

      <div className={styles.row}>
        <Field id={IDS.from_name!} label={copy.labels.name} text={copy.field} error={errorFor("from_name")}>
          <Input name="from_name" type="text" autoComplete="name" required />
        </Field>
        <Field id={IDS.reply_to!} label={copy.labels.email} text={copy.field} error={errorFor("reply_to")}>
          <Input name="reply_to" type="email" autoComplete="email" inputMode="email" spellCheck={false} required />
        </Field>
      </div>
      <div className={styles.row}>
        <Field id={IDS.phone!} label={copy.labels.phone} hint={copy.labels.phoneHint} text={copy.field} error={errorFor("phone")}>
          <Input name="phone" type="tel" autoComplete="tel" inputMode="tel" required />
        </Field>
        <Field id={IDS.country!} label={copy.labels.country} optional text={copy.field} error={errorFor("country")}>
          <Select name="country" defaultValue="">
            <option value="">{copy.anyCountry}</option>
            {copy.countries.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field id={IDS.message!} label={copy.labels.message} hint={copy.labels.messageHint} optional text={copy.field} error={errorFor("message")}>
        <Textarea name="message" rows={4} maxLength={5000} />
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
