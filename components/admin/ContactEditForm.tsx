"use client";

import { startTransition, useActionState, type FormEvent, type ReactElement, type ReactNode } from "react";
import { Checkbox, Input, Select, Textarea } from "@/components/form/Controls";
import { Field, type FieldText } from "@/components/form/Field";
import { Button } from "@/components/ui/Button";
import type { ActionState } from "@/lib/admin/action-state";
import { LIFECYCLE_STAGES } from "@/lib/crm/contact-edit";
import { ActionMessages } from "./ActionForm";
import styles from "./admin.module.css";

const FIELD_TEXT: FieldText = { optional: "(optional)", errorPrefix: "Error:" };

const STAGE_LABELS: Record<string, string> = {
  subscriber: "Subscriber",
  lead: "Lead",
  opportunity: "Opportunity",
  customer: "Customer",
  past_customer: "Past customer",
  disqualified: "Disqualified",
};

const LANGUAGES = [
  ["en", "English"],
  ["hi", "Hindi"],
  ["ar", "Arabic"],
  ["ml", "Malayalam"],
  ["bn", "Bengali"],
  ["ta", "Tamil"],
] as const;

export interface ContactEditValues {
  id: string;
  full_name: string;
  display_name: string | null;
  lifecycle_stage: string;
  country_code: string | null;
  nationality: string | null;
  preferred_language: string;
  date_of_birth: string | null;
  gender: string | null;
  notes_summary: string | null;
  consent_email: boolean;
  consent_whatsapp: boolean;
  consent_sms: boolean;
  consent_calls: boolean;
  consent_marketing: boolean;
  owner_id: string | null;
}

/**
 * Edit one contact. Only the fields the database lets staff write are here (0021); the
 * owner appears only for staff who may assign contacts. The server and the database check
 * everything again — this form only offers.
 */
export function ContactEditForm({
  action,
  values,
  owners,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  values: ContactEditValues;
  /** Present only when the caller may reassign the owner. */
  owners: { id: string; full_name: string }[] | null;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const errors = state?.fieldErrors ?? {};

  // Dispatched by hand so a refused save keeps what was typed.
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => formAction(data));
  }

  const f = (name: string, label: string, control: ReactNode, opts: { hint?: ReactNode; optional?: boolean } = {}) => (
    <Field id={`contact-${name}`} label={label} hint={opts.hint} optional={opts.optional} text={FIELD_TEXT} error={errors[name]}>
      {control as ReactElement<Record<string, unknown>>}
    </Field>
  );

  return (
    <form action={formAction} onSubmit={onSubmit} className={styles.form} noValidate aria-busy={pending || undefined}>
      <input type="hidden" name="id" value={values.id} />

      <fieldset className={styles.section}>
        <legend>Person</legend>
        <div className={styles.fields2}>
          {f("full_name", "Full name", <Input name="full_name" defaultValue={values.full_name} maxLength={120} required autoComplete="off" />)}
          {f("display_name", "Display name", <Input name="display_name" defaultValue={values.display_name ?? ""} maxLength={120} autoComplete="off" />, { optional: true })}
          {f("nationality", "Nationality", <Input name="nationality" defaultValue={values.nationality ?? ""} maxLength={60} autoComplete="off" />, { optional: true })}
          {f(
            "country_code",
            "Country",
            <Input name="country_code" defaultValue={values.country_code ?? ""} maxLength={2} autoComplete="off" spellCheck={false} />,
            { optional: true, hint: "Two-letter code, e.g. IN or AE." },
          )}
          {f("date_of_birth", "Date of birth", <Input name="date_of_birth" type="date" defaultValue={values.date_of_birth ?? ""} />, { optional: true })}
          {f("gender", "Gender", <Input name="gender" defaultValue={values.gender ?? ""} maxLength={30} autoComplete="off" />, { optional: true })}
          {f(
            "preferred_language",
            "Preferred language",
            <Select name="preferred_language" defaultValue={values.preferred_language}>
              {LANGUAGES.map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </Select>,
          )}
        </div>
      </fieldset>

      <fieldset className={styles.section}>
        <legend>Relationship</legend>
        <div className={styles.fields2}>
          {f(
            "lifecycle_stage",
            "Stage",
            <Select name="lifecycle_stage" defaultValue={values.lifecycle_stage}>
              {LIFECYCLE_STAGES.map((s) => (
                <option key={s} value={s}>
                  {STAGE_LABELS[s] ?? s}
                </option>
              ))}
            </Select>,
          )}
          {owners
            ? f(
                "owner_id",
                "Owner",
                <Select name="owner_id" defaultValue={values.owner_id ?? ""}>
                  <option value="">Nobody</option>
                  {owners.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.full_name}
                    </option>
                  ))}
                </Select>,
                { hint: "Changing the owner is recorded in the audit trail." },
              )
            : null}
        </div>
        {f("notes_summary", "Summary", <Textarea name="notes_summary" defaultValue={values.notes_summary ?? ""} rows={4} maxLength={2000} />, {
          optional: true,
          hint: "A short standing summary. Use notes for anything dated.",
        })}
      </fieldset>

      <fieldset className={styles.section}>
        <legend>Consent</legend>
        <p className={styles.sectionHint}>
          Record only what the person agreed to. Applying for a job is not consent to marketing. Every change is dated and on the audit trail.
        </p>
        <Checkbox id="consent_email" name="consent_email" label="Email" defaultChecked={values.consent_email} />
        <Checkbox id="consent_whatsapp" name="consent_whatsapp" label="WhatsApp" defaultChecked={values.consent_whatsapp} />
        <Checkbox id="consent_sms" name="consent_sms" label="SMS" defaultChecked={values.consent_sms} />
        <Checkbox id="consent_calls" name="consent_calls" label="Phone calls" defaultChecked={values.consent_calls} />
        <Checkbox id="consent_marketing" name="consent_marketing" label="Marketing" defaultChecked={values.consent_marketing} />
      </fieldset>

      <div className={styles.stickyBar}>
        <Button type="submit" loading={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
        <Button href={`/admin/contacts/${values.id}`} variant="secondary">
          Cancel
        </Button>
      </div>
      <ActionMessages state={state} />
    </form>
  );
}
