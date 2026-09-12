"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { FileInput, Input, Textarea } from "@/components/form/Controls";
import { ErrorSummary } from "@/components/form/ErrorSummary";
import { Field } from "@/components/form/Field";
import { FormStatus } from "@/components/form/FormStatus";
import { Button } from "@/components/ui/Button";
import { Receipt } from "@/components/ui/Receipt";
import { collectNativeErrors, fromServerErrors, type FormError } from "@/lib/forms/native-validation";
import { submitViaServer } from "@/lib/forms/transport";
import type { ApplyFormCopy } from "@/lib/i18n/forms";
import styles from "./ApplyForm.module.css";

// supabase-js is needed only when the applicant presses Send, so it loads then instead of
// shipping with the page (it was over a quarter of /jobs/apply's JavaScript). It starts
// loading as soon as the applicant focuses the form, so sending never waits for it.
const loadUploader = () => import("@/lib/supabase");

/**
 * The job application form (2C-1). Same data flow as before, which stays until Phase 5:
 *   1. CV, passport and any other documents upload to Supabase Storage and the
 *      application row is written — the source of truth, even if step 2 fails;
 *   2. /api/forms/job-application re-validates and sends the notification and the
 *      acknowledgement through Resend. Files are never part of that payload: it is a
 *      plain object, not a FormData scan.
 * The ?job=&country=&type= prefill contract used by every Apply link is unchanged.
 *
 * What changed is the experience: one form, labelled fields with hints, errors in text
 * tied to their fields and summarised at the top, fields that stay usable while
 * sending, and a receipt with the reference the confirmation email also carries. The
 * form renders on the server; the job from the link is filled in once the page loads.
 * Every word arrives in `copy` (lib/i18n/forms.ts applyFormCopy).
 */

const MAX_FILE_SIZE = 8 * 1024 * 1024; // the storage bucket allows 10 MB; 8 leaves headroom
const IDS: Record<string, string> = {
  from_name: "a_name",
  reply_to: "a_email",
  phone: "a_phone",
  experience: "a_experience",
  message: "a_message",
  cv: "a_cv",
  passport: "a_passport",
  other: "a_other",
};

interface Target {
  job: string;
  country: string;
  type: string;
}

interface Done {
  reference: string;
  documents: string;
  confirmationSent: boolean;
  target: Target;
}

const fill = (template: string, ...values: string[]) => values.reduce((s, v, i) => s.replaceAll(`%${i + 1}`, v), template);

export function ApplyForm({ copy }: { copy: ApplyFormCopy }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [target, setTarget] = useState<Target>({ job: "", country: "", type: "" });
  const [errors, setErrors] = useState<FormError[]>([]);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<{ state: "idle" | "sending" | "success" | "error"; message: string }>({ state: "idle", message: "" });
  const [done, setDone] = useState<Done | null>(null);
  const sending = status.state === "sending";
  const errorFor = (name: string) => errors.find((e) => e.name === name)?.message;

  useEffect(() => {
    // The job comes from the link's query string, which exists only in the browser.
    const p = new URLSearchParams(window.location.search);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTarget({ job: p.get("job") ?? "", country: p.get("country") ?? "", type: p.get("type") ?? "" });
  }, []);

  useEffect(() => {
    if (done) document.getElementById("apply-receipt-heading")?.focus();
  }, [done]);

  const messages = {
    from_name: () => copy.errors.nameMissing,
    reply_to: (el: { validity: ValidityState }) => (el.validity.valueMissing ? copy.errors.emailMissing : copy.errors.emailInvalid),
    phone: () => copy.errors.phoneMissing,
    cv: () => copy.errors.cvMissing,
    passport: () => copy.errors.passportMissing,
  };

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (sending) return;
    const form = formRef.current!;
    const field = (name: string) => form.elements.namedItem(name) as HTMLInputElement;
    const cvFile = field("cv").files?.[0] ?? null;
    const passportFile = field("passport").files?.[0] ?? null;
    const otherFiles = Array.from(field("other").files ?? []);

    const sizeErrors: FormError[] = [
      ["cv", cvFile],
      ["passport", passportFile],
      ...otherFiles.map((f) => ["other", f] as const),
    ]
      .filter((entry): entry is [string, File] => Boolean(entry[1]) && (entry[1] as File).size > MAX_FILE_SIZE)
      .map(([name, file]) => ({ name, fieldId: IDS[name] ?? name, message: fill(copy.errors.tooLarge, file.name) }));

    const clientErrors = [...collectNativeErrors(form, messages), ...sizeErrors];
    if (clientErrors.length) {
      setErrors(clientErrors);
      setAttempt((n) => n + 1);
      setStatus({ state: "idle", message: "" });
      return;
    }

    setErrors([]);
    setStatus({ state: "sending", message: "" });

    const jobTitle = target.job || copy.target.generalValue;
    const values = {
      from_name: field("from_name").value,
      reply_to: field("reply_to").value,
      phone: field("phone").value,
      experience: field("experience").value,
      message: (form.elements.namedItem("message") as HTMLTextAreaElement).value,
    };

    let saved: { submissionId: string; otherPaths: string[] };
    try {
      const { submitJobApplication } = await loadUploader();
      saved = await submitJobApplication({
        jobTitle,
        jobCountry: target.country,
        fullName: values.from_name,
        email: values.reply_to,
        phone: values.phone,
        experience: values.experience,
        message: values.message,
        pageSource: "Jobs Page",
        // Both inputs are `required`, so the native check above has already stopped an empty one.
        cvFile: cvFile!,
        passportFile: passportFile!,
        otherFiles,
      });
    } catch {
      setStatus({ state: "error", message: copy.errors.uploadFailed });
      return;
    }

    // Staff read this line in the internal email, so it stays in English.
    const documents = ["CV", "Passport", ...(saved.otherPaths.length ? [`+${saved.otherPaths.length} more document${saved.otherPaths.length > 1 ? "s" : ""}`] : [])].join(", ");

    const result = await submitViaServer(
      "job-application",
      {
        ...values,
        service_type: jobTitle,
        country: target.country,
        documents,
        submission_id: saved.submissionId,
        page_source: "Jobs Page",
        website: field("website").value,
      },
      { locale: copy.locale, messages: copy.outcome },
    );

    // The application and its documents are already saved. A failed email must never
    // tell the applicant the submission did not go through — that would be untrue.
    if (!result.ok && result.fieldErrors) setErrors(fromServerErrors(result.fieldErrors, (name) => IDS[name] ?? name));
    setDone({
      reference: saved.submissionId,
      documents,
      confirmationSent: result.ok && result.acknowledgementSent !== false,
      target: { ...target, job: jobTitle },
    });
    setStatus({ state: "success", message: "" });
    form.reset();
  }

  const jobLabel = target.job || copy.target.general;

  if (done) {
    const to = done.target.country || copy.receipt.gulf;
    const whatsappHref = `${copy.whatsapp.href}?text=${encodeURIComponent(fill(copy.whatsapp.message, done.reference))}`;
    return (
      <div className={styles.done}>
        <Receipt
          heading={copy.receipt.heading}
          headingId="apply-receipt-heading"
          status={copy.receipt.status}
          reference={done.reference}
          referenceLabel={copy.receipt.reference}
          routeLabel={fill(copy.receipt.route, copy.routeFrom, to)}
          from={copy.routeFrom}
          to={to}
          rows={[
            { label: copy.receipt.job, value: done.target.job },
            ...(done.target.country ? [{ label: copy.receipt.country, value: done.target.country }] : []),
            { label: copy.receipt.documents, value: done.documents },
          ]}
        >
          <p>{done.confirmationSent ? copy.receipt.confirmationSent : copy.receipt.confirmationFailed}</p>
          <p>{copy.receipt.next}</p>
          <p>{copy.receipt.keep}</p>
          <p className={styles.safety}>{copy.receipt.safety}</p>
        </Receipt>
        <div className={styles.doneActions}>
          <Button href={copy.jobsHref} variant="secondary">
            {copy.receipt.otherJobs}
          </Button>
          <Button href={whatsappHref} variant="whatsapp" icon="whatsapp" opensWhatsApp={copy.opensWhatsApp}>
            {copy.receipt.ask}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      id="apply-form"
      className={styles.form}
      onSubmit={handleSubmit}
      onFocusCapture={() => void loadUploader()}
      noValidate
      aria-busy={sending || undefined}
    >
      <div className={styles.target}>
        <p className={styles.targetLabel}>{copy.target.applyingFor}</p>
        <p className={styles.targetValue}>
          {jobLabel}
          {target.country ? <span className={styles.targetCountry}> — {target.country}</span> : null}
        </p>
      </div>

      {/* Honeypot — hidden from people, filled by naive bots. */}
      <div aria-hidden="true" className={styles.honeypot}>
        <label htmlFor="a_website">{copy.honeypot}</label>
        <input type="text" id="a_website" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>

      <ErrorSummary errors={errors} attempt={attempt} title={copy.errorSummaryTitle} />

      <fieldset className={styles.group}>
        <legend className={styles.legend}>{copy.groups.you}</legend>
        <Field id={IDS.from_name!} label={copy.labels.fullName} text={copy.field} error={errorFor("from_name")}>
          <Input name="from_name" type="text" autoComplete="name" required />
        </Field>
        <Field id={IDS.phone!} label={copy.labels.phone} hint={copy.labels.phoneHint} text={copy.field} error={errorFor("phone")}>
          <Input name="phone" type="tel" autoComplete="tel" inputMode="tel" required />
        </Field>
        <Field id={IDS.reply_to!} label={copy.labels.email} text={copy.field} error={errorFor("reply_to")}>
          <Input name="reply_to" type="email" autoComplete="email" inputMode="email" spellCheck={false} required />
        </Field>
        <Field id={IDS.experience!} label={copy.labels.experience} hint={copy.labels.experienceHint} optional text={copy.field} error={errorFor("experience")}>
          <Input name="experience" type="text" />
        </Field>
      </fieldset>

      <fieldset className={styles.group}>
        <legend className={styles.legend}>{copy.groups.documents}</legend>
        <Field id={IDS.cv!} label={copy.labels.cv} hint={copy.labels.cvHint} text={copy.field} error={errorFor("cv")}>
          <FileInput name="cv" accept=".pdf,.doc,.docx" required />
        </Field>
        <Field id={IDS.passport!} label={copy.labels.passport} hint={copy.labels.passportHint} text={copy.field} error={errorFor("passport")}>
          <FileInput name="passport" accept=".pdf,.jpg,.jpeg,.png" required />
        </Field>
        <Field id={IDS.other!} label={copy.labels.other} hint={copy.labels.otherHint} optional text={copy.field} error={errorFor("other")}>
          <FileInput name="other" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" multiple />
        </Field>
      </fieldset>

      <Field id={IDS.message!} label={copy.labels.message} optional text={copy.field} error={errorFor("message")}>
        <Textarea name="message" rows={4} />
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
