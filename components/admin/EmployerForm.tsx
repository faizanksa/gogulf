"use client";

import { startTransition, useActionState, type FormEvent, type ReactElement, type ReactNode } from "react";
import { Input, Select, Textarea } from "@/components/form/Controls";
import { Field, type FieldText } from "@/components/form/Field";
import { Button } from "@/components/ui/Button";
import type { ActionState } from "@/lib/admin/action-state";
import { EMPLOYER_STATUSES, EMPLOYER_STATUS_LABELS } from "@/lib/crm/employers";
import { COUNTRIES } from "@/lib/jobs/model";
import { ActionMessages } from "./ActionForm";
import styles from "./admin.module.css";

const FIELD_TEXT: FieldText = { optional: "(optional)", errorPrefix: "Error:" };

export interface EmployerFormValues {
  id?: string;
  name?: string;
  country_code?: string;
  registration_number?: string | null;
  website?: string | null;
  contact_person?: string | null;
  email?: string | null;
  phone?: string | null;
  status?: string;
  notes?: string | null;
  branch_id?: string;
}

/**
 * Create or edit an employer (0022). The server and the database check everything again —
 * which branches a person may place an employer in is decided by RLS, not by this list.
 */
export function EmployerForm({
  action,
  values = {},
  branches,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  values?: EmployerFormValues;
  branches: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const errors = state?.fieldErrors ?? {};
  const isNew = !values.id;
  const str = (v: string | null | undefined) => v ?? "";
  // A country outside the Gulf list (an older or imported record) stays selectable.
  const countries = values.country_code && !COUNTRIES.some((c) => c.code === values.country_code)
    ? [...COUNTRIES, { code: values.country_code, name: values.country_code }]
    : COUNTRIES;

  // Dispatched by hand so a refused save keeps what was typed.
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => formAction(data));
  }

  const f = (name: string, label: string, control: ReactNode, opts: { hint?: ReactNode; optional?: boolean } = {}) => (
    <Field id={`employer-${name}`} label={label} hint={opts.hint} optional={opts.optional} text={FIELD_TEXT} error={errors[name]}>
      {control as ReactElement<Record<string, unknown>>}
    </Field>
  );

  return (
    <form action={formAction} onSubmit={onSubmit} className={styles.form} noValidate aria-busy={pending || undefined}>
      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}

      <fieldset className={styles.section}>
        <legend>Employer</legend>
        {f("name", "Name", <Input name="name" defaultValue={str(values.name)} maxLength={160} required autoComplete="off" />, {
          hint: "The employer's legal or trading name, as staff will look for it.",
        })}
        <div className={styles.fields2}>
          {f(
            "country_code",
            "Country",
            <Select name="country_code" defaultValue={str(values.country_code)} required>
              <option value="">Choose a country</option>
              {countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </Select>,
          )}
          {f(
            "status",
            "Status",
            <Select name="status" defaultValue={values.status ?? "active"}>
              {EMPLOYER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {EMPLOYER_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>,
            { hint: "An inactive employer is kept, with its jobs and cases, but not offered for new links." },
          )}
        </div>
        <div className={styles.fields2}>
          {f("registration_number", "Registration number", <Input name="registration_number" defaultValue={str(values.registration_number)} maxLength={60} autoComplete="off" spellCheck={false} />, {
            optional: true,
            hint: "Whatever the employer's country uses: CR number, trade licence, CIN.",
          })}
          {f("website", "Website", <Input name="website" type="url" defaultValue={str(values.website)} maxLength={300} autoComplete="off" spellCheck={false} />, {
            optional: true,
          })}
        </div>
        {branches.length
          ? f(
              "branch_id",
              "Branch",
              <Select name="branch_id" defaultValue={str(values.branch_id)}>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>,
              { hint: "Staff limited to one branch see only that branch's employers." },
            )
          : null}
      </fieldset>

      <fieldset className={styles.section}>
        <legend>Contact</legend>
        <div className={styles.fields2}>
          {f("contact_person", "Contact person", <Input name="contact_person" defaultValue={str(values.contact_person)} maxLength={120} autoComplete="off" />, { optional: true })}
          {f("email", "Email", <Input name="email" type="email" defaultValue={str(values.email)} maxLength={254} autoComplete="off" spellCheck={false} />, { optional: true })}
          {f("phone", "Phone", <Input name="phone" type="tel" defaultValue={str(values.phone)} maxLength={26} autoComplete="off" />, {
            optional: true,
            hint: "With the country code, e.g. +971 4 000 0000.",
          })}
        </div>
        {f("notes", "Notes", <Textarea name="notes" defaultValue={str(values.notes)} rows={5} maxLength={4000} />, {
          optional: true,
          hint: "Staff only. Record only what the employer has told you.",
        })}
      </fieldset>

      <div className={styles.stickyBar}>
        <Button type="submit" loading={pending}>
          {pending ? "Saving…" : isNew ? "Create employer" : "Save changes"}
        </Button>
        <Button href={values.id ? `/admin/employers/${values.id}` : "/admin/employers"} variant="secondary">
          Cancel
        </Button>
      </div>
      <ActionMessages state={state} />
    </form>
  );
}
