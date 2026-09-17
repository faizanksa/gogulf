"use client";

import { startTransition, useActionState, useState, type FormEvent, type ReactElement, type ReactNode } from "react";
import { Input, Select, Textarea } from "@/components/form/Controls";
import { Field, type FieldText } from "@/components/form/Field";
import { Button } from "@/components/ui/Button";
import type { ActionState } from "@/lib/admin/action-state";
import {
  AVAILABILITY_LABELS,
  CLASSIFICATION_LABELS,
  COUNTRIES,
  EMPLOYMENT_TYPES,
  EMPLOYMENT_TYPE_LABELS,
  PAID_UNAVAILABLE_MESSAGE,
  SALARY_CURRENCIES,
  SALARY_PERIODS,
  STATUS_LABELS,
} from "@/lib/jobs/model";
import type { JobClassification, JobStatus } from "@/types/database";
import { ActionMessages } from "./ActionForm";
import styles from "./admin.module.css";

export interface JobFormCategory {
  id: string;
  name: string;
  classification: JobClassification;
  is_active: boolean;
}

/** The job's current values, as the form shows them. Null fields show empty. */
export interface JobFormValues {
  id?: string;
  status?: JobStatus;
  published?: boolean;
  title?: string;
  reference?: string;
  category_id?: string;
  country_code?: string | null;
  city?: string | null;
  employer_disclosure?: string | null;
  employer_name?: string | null;
  employment_type?: string | null;
  vacancies?: number | null;
  salary_currency?: string | null;
  salary_min?: number | null;
  salary_max?: number | null;
  salary_period?: string | null;
  experience?: string | null;
  education?: string | null;
  languages?: string | null;
  summary?: string | null;
  responsibilities?: string[];
  requirements?: string[];
  benefits?: string[];
  additional_info?: string | null;
  internal_notes?: string | null;
  availability?: string;
  closes_on?: string | null;
  promotion?: string;
  featured_until?: string | null;
  application_access?: string;
  application_method?: string;
}

const FIELD_TEXT: FieldText = { optional: "(optional)", errorPrefix: "Error:" };
const str = (v: string | number | null | undefined) => (v === null || v === undefined ? "" : String(v));
const lines = (v: string[] | undefined) => (v ?? []).join("\n");

/**
 * Create and edit a job. Sections follow how a recruiter thinks about a vacancy.
 *
 * The status is not edited here — lifecycle changes are deliberate actions beside the
 * form, each checked by the database. This form saves content; the database decides
 * whether that content may be public. Contradictions (an ongoing job's closing date) are
 * hidden as the choices change and removed on save, with a note saying so.
 */
export function JobForm({
  action,
  categories,
  values = {},
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  categories: JobFormCategory[];
  values?: JobFormValues;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const [availability, setAvailability] = useState(values.availability ?? "ongoing");
  const [promotion, setPromotion] = useState(values.promotion ?? "standard");
  const [disclosure, setDisclosure] = useState(values.employer_disclosure ?? "");
  const [access, setAccess] = useState(values.application_access ?? "free");
  const [categoryId, setCategoryId] = useState(values.category_id ?? "");
  const errors = state?.fieldErrors ?? {};
  const isNew = !values.id;
  const classification = categories.find((c) => c.id === categoryId)?.classification;

  // Dispatched by hand so a refused save keeps what was typed: React resets uncontrolled
  // fields after a form action completes. Without JavaScript the form still posts.
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => formAction(data));
  }

  const f = (name: string, label: string, control: ReactNode, opts: { hint?: ReactNode; optional?: boolean } = {}) => (
    <Field id={`job-${name}`} label={label} hint={opts.hint} optional={opts.optional} text={FIELD_TEXT} error={errors[name]}>
      {control as ReactElement<Record<string, unknown>>}
    </Field>
  );

  const radio = (name: string, value: string, label: string, current: string, set: (v: string) => void, hint?: string) => (
    <label className={styles.choice}>
      <input type="radio" name={name} value={value} checked={current === value} onChange={() => set(value)} />
      <span className={styles.choiceText}>
        {label}
        {hint ? <span className={styles.choiceHint}>{hint}</span> : null}
      </span>
    </label>
  );

  const general = categories.filter((c) => c.classification === "general" && (c.is_active || c.id === values.category_id));
  const professional = categories.filter((c) => c.classification === "professional" && (c.is_active || c.id === values.category_id));

  return (
    <form action={formAction} onSubmit={onSubmit} className={styles.form} noValidate aria-busy={pending || undefined}>
      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}

      <fieldset className={styles.section}>
        <legend>Basic information</legend>
        {f("title", "Job title", <Input name="title" defaultValue={values.title} maxLength={120} required />, {
          hint: "As a candidate would search for it. Staging test jobs start with “STAGING TEST —”.",
        })}
        <div className={styles.fields2}>
          {f(
            "reference",
            "Job reference",
            <Input name="reference" defaultValue={values.reference} maxLength={40} disabled={values.published} spellCheck={false} />,
            {
              optional: !values.published,
              hint: values.published
                ? "Fixed: this job has been published, and links and applications use its reference."
                : "Leave empty to generate one (GG-JOB-2026-00001). Fixed once the job is first published.",
            },
          )}
          {f(
            "category_id",
            "Category",
            <Select name="category_id" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
              <option value="">Choose a category</option>
              <optgroup label={CLASSIFICATION_LABELS.general}>
                {general.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.is_active ? "" : " (inactive)"}
                  </option>
                ))}
              </optgroup>
              <optgroup label={CLASSIFICATION_LABELS.professional}>
                {professional.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.is_active ? "" : " (inactive)"}
                  </option>
                ))}
              </optgroup>
            </Select>,
            {
              hint: classification
                ? `Classification: ${CLASSIFICATION_LABELS[classification]}. It follows the category.`
                : "The category decides whether the job is general hiring or professional.",
            },
          )}
        </div>
        <div className={styles.fields2}>
          {f(
            "country_code",
            "Country",
            <Select name="country_code" defaultValue={str(values.country_code)}>
              <option value="">Not chosen yet</option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </Select>,
            { hint: "Required to publish." },
          )}
          {f("city", "City or location", <Input name="city" defaultValue={str(values.city)} maxLength={80} />, { optional: true })}
        </div>
        <fieldset className={styles.section} style={{ padding: 0, border: 0 }}>
          <legend className={styles.h3}>Employer disclosure</legend>
          <p className={styles.sectionHint}>Required to publish. Never name an employer who has asked not to be named.</p>
          <div className={styles.choiceRow}>
            {radio("employer_disclosure", "named", "Named on the listing", disclosure, setDisclosure)}
            {radio("employer_disclosure", "confidential", "Confidential", disclosure, setDisclosure, "Shown as “the employer has asked not to be named”")}
            {radio("employer_disclosure", "", "Not decided yet", disclosure, setDisclosure)}
          </div>
          {disclosure === "named"
            ? f("employer_name", "Employer name", <Input name="employer_name" defaultValue={str(values.employer_name)} maxLength={120} />)
            : null}
          {errors.employer_disclosure ? <p className={styles.muted}>{errors.employer_disclosure}</p> : null}
        </fieldset>
      </fieldset>

      <fieldset className={styles.section}>
        <legend>Employment</legend>
        <div className={styles.fields2}>
          {f(
            "employment_type",
            "Employment type",
            <Select name="employment_type" defaultValue={str(values.employment_type)}>
              <option value="">Not chosen yet</option>
              {EMPLOYMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {EMPLOYMENT_TYPE_LABELS[t]}
                </option>
              ))}
            </Select>,
            { hint: "Required to publish." },
          )}
          {f("vacancies", "Number of vacancies", <Input name="vacancies" inputMode="numeric" defaultValue={str(values.vacancies)} />, {
            optional: true,
            hint: "Only the number the employer has confirmed.",
          })}
        </div>
        <fieldset className={styles.section} style={{ padding: 0, border: 0 }}>
          <legend className={styles.h3}>Salary</legend>
          <p className={styles.sectionHint}>Optional. Give all four, or leave all empty — the listing then says “not stated”.</p>
          <div className={styles.fields4}>
            {f(
              "salary_currency",
              "Currency",
              <Select name="salary_currency" defaultValue={str(values.salary_currency)}>
                <option value="">—</option>
                {SALARY_CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>,
            )}
            {f("salary_min", "Minimum", <Input name="salary_min" inputMode="numeric" defaultValue={str(values.salary_min)} />)}
            {f("salary_max", "Maximum", <Input name="salary_max" inputMode="numeric" defaultValue={str(values.salary_max)} />)}
            {f(
              "salary_period",
              "Per",
              <Select name="salary_period" defaultValue={str(values.salary_period)}>
                <option value="">—</option>
                {SALARY_PERIODS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>,
            )}
          </div>
        </fieldset>
        <div className={styles.fields2}>
          {f("experience", "Experience", <Input name="experience" defaultValue={str(values.experience)} maxLength={200} />, {
            optional: true,
            hint: "As the employer states it, e.g. “3 years of GCC experience”.",
          })}
          {f("education", "Education", <Input name="education" defaultValue={str(values.education)} maxLength={200} />, { optional: true })}
        </div>
        {f("languages", "Language requirements", <Input name="languages" defaultValue={str(values.languages)} maxLength={200} />, {
          optional: true,
        })}
      </fieldset>

      <fieldset className={styles.section}>
        <legend>Description</legend>
        {f("summary", "Summary", <Textarea name="summary" rows={4} defaultValue={str(values.summary)} maxLength={600} />, {
          hint: "Required to publish. 20–600 characters. Used on the job card and in search results.",
        })}
        {f("responsibilities", "Responsibilities", <Textarea name="responsibilities" rows={5} defaultValue={lines(values.responsibilities)} />, {
          optional: true,
          hint: "One per line.",
        })}
        {f("requirements", "Requirements", <Textarea name="requirements" rows={5} defaultValue={lines(values.requirements)} />, {
          optional: classification !== "professional",
          hint:
            classification === "professional"
              ? "One per line. Required to publish a professional job."
              : "One per line. Leave empty rather than inventing requirements.",
        })}
        {f("benefits", "Benefits", <Textarea name="benefits" rows={4} defaultValue={lines(values.benefits)} />, {
          optional: true,
          hint: "One per line — only what the employer has confirmed (accommodation, transport, …).",
        })}
        {f("additional_info", "Additional information", <Textarea name="additional_info" rows={4} defaultValue={str(values.additional_info)} />, {
          optional: true,
        })}
        {f("internal_notes", "Internal notes", <Textarea name="internal_notes" rows={3} defaultValue={str(values.internal_notes)} />, {
          optional: true,
          hint: "Staff only — never shown on the public site. Record a confidential employer's name here.",
        })}
      </fieldset>

      <fieldset className={styles.section}>
        <legend>Availability</legend>
        <div className={styles.choiceRow}>
          {radio("availability", "ongoing", AVAILABILITY_LABELS.ongoing, availability, setAvailability, "Recurring hiring, open until closed. No closing date.")}
          {radio("availability", "time_limited", AVAILABILITY_LABELS.time_limited, availability, setAvailability, "A specific vacancy with an application deadline.")}
        </div>
        {availability === "time_limited"
          ? f("closes_on", "Closing date", <Input name="closes_on" type="date" defaultValue={str(values.closes_on)} />, {
              hint: "Required to publish. Applications are accepted until the end of this day, India time.",
            })
          : null}
      </fieldset>

      <fieldset className={styles.section}>
        <legend>Visibility</legend>
        <div className={styles.choiceRow}>
          {radio("promotion", "standard", "Standard", promotion, setPromotion)}
          {radio("promotion", "featured", "Featured", promotion, setPromotion, "Shown first, with a Featured label.")}
        </div>
        {promotion === "featured"
          ? f("featured_until", "Featured until", <Input name="featured_until" type="date" defaultValue={str(values.featured_until)} />, {
              optional: true,
              hint: "After this day the job simply stops being featured. Its status and application access do not change.",
            })
          : null}
      </fieldset>

      <fieldset className={styles.section}>
        <legend>Application</legend>
        <div className={styles.choiceRow}>
          {radio("application_access", "free", "Free application", access, setAccess, "Candidates apply at no cost.")}
          {radio("application_access", "paid", "Paid application", access, setAccess, PAID_UNAVAILABLE_MESSAGE)}
        </div>
        {access === "paid" ? (
          <p className={styles.sectionHint} role="note">
            <strong>{PAID_UNAVAILABLE_MESSAGE}</strong> A job with paid application access can be saved as a draft or reviewed, but it
            cannot be published.
          </p>
        ) : null}
        <fieldset className={styles.section} style={{ padding: 0, border: 0 }}>
          <legend className={styles.h3}>Application method</legend>
          <div className={styles.choiceRow}>
            <label className={styles.choice}>
              <input type="radio" name="application_method" value="online_form" defaultChecked={(values.application_method ?? "online_form") === "online_form"} />
              <span className={styles.choiceText}>
                Online application form
                <span className={styles.choiceHint}>CV and passport upload on this site.</span>
              </span>
            </label>
            <label className={styles.choice}>
              <input type="radio" name="application_method" value="whatsapp" defaultChecked={values.application_method === "whatsapp"} />
              <span className={styles.choiceText}>
                WhatsApp
                <span className={styles.choiceHint}>The Apply button opens WhatsApp with the job reference.</span>
              </span>
            </label>
          </div>
        </fieldset>
      </fieldset>

      <fieldset className={styles.section}>
        <legend>Lifecycle</legend>
        <p className={styles.sectionHint}>
          {isNew
            ? "A new job starts as a draft. It is not public until it has been reviewed and published."
            : `Status: ${STATUS_LABELS[values.status ?? "draft"]}. Change it with the lifecycle actions on this page — each one is checked before it happens.`}
        </p>
      </fieldset>

      <div className={styles.stickyBar}>
        <Button type="submit" loading={pending}>
          {pending ? "Saving…" : isNew ? "Create draft" : "Save changes"}
        </Button>
        <span className={styles.muted}>{isNew ? "Saved as a draft. Nothing is public yet." : "Saving does not change the status."}</span>
      </div>
      <ActionMessages state={state} />
    </form>
  );
}
