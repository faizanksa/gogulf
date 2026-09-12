"use client";

import { useRef, useState, type FormEvent } from "react";
import { Input, Select, Textarea } from "@/components/form/Controls";
import { ErrorSummary } from "@/components/form/ErrorSummary";
import { Field, type FieldText } from "@/components/form/Field";
import { FormStatus, type FormStatusText } from "@/components/form/FormStatus";
import { Button } from "@/components/ui/Button";
import { collectNativeErrors, fromServerErrors, type FormError } from "@/lib/forms/native-validation";
import { submitViaServer } from "@/lib/forms/transport";
import styles from "./forms.module.css";

/**
 * The employer requirement form (2C-2). It asks what a recruiter needs to scope a
 * requirement — company, place, roles, headcount, timeline, accommodation and transport.
 *
 * It deliberately reuses the verified service-inquiry route: service_type is one of the
 * employer services, so the server routes it to the business desk (lib/email/config.ts),
 * and the details travel as a structured message. No new endpoint, template or schema,
 * so the Resend flow the business has checked is untouched. The message is written in
 * English whatever the page's language, because it is read by staff.
 */

export interface Option {
  value: string;
  label: string;
}

export interface EmployerFormCopy {
  locale: string;
  errorSummaryTitle: string;
  honeypot: string;
  field: FieldText;
  status: FormStatusText;
  groups: { company: string; need: string; contact: string };
  labels: {
    company: string;
    service: string;
    country: string;
    city: string;
    roles: string;
    rolesHint: string;
    headcount: string;
    timeline: string;
    accommodation: string;
    transport: string;
    notes: string;
    name: string;
    email: string;
    phone: string;
    phoneHint: string;
  };
  services: Option[];
  countries: Option[];
  countryPlaceholder: string;
  timelines: Option[];
  provision: Option[];
  submit: string;
  sending: string;
  errors: { companyMissing: string; countryMissing: string; rolesMissing: string; nameMissing: string; emailMissing: string; emailInvalid: string; phoneMissing: string };
  outcome: { sent: string; sentNoCopy: string; failed: string; offline: string; unexpected: string };
}

const IDS: Record<string, string> = {
  company: "e_company",
  service_type: "e_service",
  country: "e_country",
  city: "e_city",
  roles: "e_roles",
  headcount: "e_headcount",
  timeline: "e_timeline",
  accommodation: "e_accommodation",
  transport: "e_transport",
  notes: "e_notes",
  from_name: "e_name",
  reply_to: "e_email",
  phone: "e_phone",
  // The server validates the composed message; its errors belong to the roles field.
  message: "e_roles",
};

export function EmployerRequirementForm({ copy }: { copy: EmployerFormCopy }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [errors, setErrors] = useState<FormError[]>([]);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<{ state: "idle" | "sending" | "success" | "error"; message: string }>({ state: "idle", message: "" });
  const sending = status.state === "sending";
  const errorFor = (name: string) => errors.find((e) => e.name === name)?.message;

  const messages = {
    company: () => copy.errors.companyMissing,
    country: () => copy.errors.countryMissing,
    roles: () => copy.errors.rolesMissing,
    from_name: () => copy.errors.nameMissing,
    reply_to: (el: { validity: ValidityState }) => (el.validity.valueMissing ? copy.errors.emailMissing : copy.errors.emailInvalid),
    phone: () => copy.errors.phoneMissing,
  };

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (sending) return;
    const form = formRef.current!;
    const value = (name: string) => (form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value.trim();

    const clientErrors = collectNativeErrors(form, messages);
    if (clientErrors.length) {
      setErrors(clientErrors);
      setAttempt((n) => n + 1);
      setStatus({ state: "idle", message: "" });
      return;
    }
    setErrors([]);
    setStatus({ state: "sending", message: "" });

    const place = [value("city"), value("country")].filter(Boolean).join(", ");
    const lines = [
      ["Company", value("company")],
      ["Work location", place],
      ["Roles and trades", value("roles")],
      ["Total headcount", value("headcount")],
      ["Start", value("timeline")],
      ["Accommodation", value("accommodation")],
      ["Transport", value("transport")],
      ["Notes", value("notes")],
    ].filter(([, v]) => v);

    const result = await submitViaServer(
      "service-inquiry",
      {
        service_type: value("service_type"),
        from_name: value("from_name"),
        reply_to: value("reply_to"),
        phone: value("phone"),
        country: value("country"),
        message: lines.map(([k, v]) => `${k}: ${v}`).join("\n"),
        page_source: "Employers Page",
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
    <form ref={formRef} id="employer-form" className={styles.form} onSubmit={handleSubmit} noValidate aria-busy={sending || undefined}>
      <div aria-hidden="true" className={styles.honeypot}>
        <label htmlFor="e_website">{copy.honeypot}</label>
        <input type="text" id="e_website" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>

      <ErrorSummary errors={errors} attempt={attempt} title={copy.errorSummaryTitle} />

      <fieldset className={styles.group}>
        <legend className={styles.legend}>{copy.groups.company}</legend>
        <Field id={IDS.company!} label={copy.labels.company} text={copy.field} error={errorFor("company")}>
          <Input name="company" type="text" autoComplete="organization" required />
        </Field>
        <div className={styles.row}>
          <Field id={IDS.country!} label={copy.labels.country} text={copy.field} error={errorFor("country")}>
            <Select name="country" required defaultValue="">
              <option value="" disabled>
                {copy.countryPlaceholder}
              </option>
              {copy.countries.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field id={IDS.city!} label={copy.labels.city} optional text={copy.field} error={errorFor("city")}>
            <Input name="city" type="text" autoComplete="address-level2" />
          </Field>
        </div>
      </fieldset>

      <fieldset className={styles.group}>
        <legend className={styles.legend}>{copy.groups.need}</legend>
        <Field id={IDS.service_type!} label={copy.labels.service} text={copy.field} error={errorFor("service_type")}>
          <Select name="service_type" defaultValue={copy.services[0]?.value}>
            {copy.services.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field id={IDS.roles!} label={copy.labels.roles} hint={copy.labels.rolesHint} text={copy.field} error={errorFor("roles") ?? errorFor("message")}>
          <Textarea name="roles" rows={4} required maxLength={3000} />
        </Field>
        <div className={styles.row}>
          <Field id={IDS.headcount!} label={copy.labels.headcount} optional text={copy.field} error={errorFor("headcount")}>
            <Input name="headcount" type="number" inputMode="numeric" min={1} max={100000} />
          </Field>
          <Field id={IDS.timeline!} label={copy.labels.timeline} optional text={copy.field} error={errorFor("timeline")}>
            <Select name="timeline" defaultValue="">
              <option value="" />
              {copy.timelines.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className={styles.row}>
          <Field id={IDS.accommodation!} label={copy.labels.accommodation} optional text={copy.field} error={errorFor("accommodation")}>
            <Select name="accommodation" defaultValue="">
              <option value="" />
              {copy.provision.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field id={IDS.transport!} label={copy.labels.transport} optional text={copy.field} error={errorFor("transport")}>
            <Select name="transport" defaultValue="">
              <option value="" />
              {copy.provision.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field id={IDS.notes!} label={copy.labels.notes} optional text={copy.field} error={errorFor("notes")}>
          <Textarea name="notes" rows={3} maxLength={1500} />
        </Field>
      </fieldset>

      <fieldset className={styles.group}>
        <legend className={styles.legend}>{copy.groups.contact}</legend>
        <Field id={IDS.from_name!} label={copy.labels.name} text={copy.field} error={errorFor("from_name")}>
          <Input name="from_name" type="text" autoComplete="name" required />
        </Field>
        <div className={styles.row}>
          <Field id={IDS.reply_to!} label={copy.labels.email} text={copy.field} error={errorFor("reply_to")}>
            <Input name="reply_to" type="email" autoComplete="email" inputMode="email" spellCheck={false} required />
          </Field>
          <Field id={IDS.phone!} label={copy.labels.phone} hint={copy.labels.phoneHint} text={copy.field} error={errorFor("phone")}>
            <Input name="phone" type="tel" autoComplete="tel" inputMode="tel" required />
          </Field>
        </div>
      </fieldset>

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
