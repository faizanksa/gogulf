"use client";

import { useActionState } from "react";
import { Select } from "@/components/form/Controls";
import { Button } from "@/components/ui/Button";
import type { ActionState } from "@/lib/admin/action-state";
import { EMPLOYER_STATUS_LABELS } from "@/lib/crm/employers";
import type { EmployerStatus } from "@/types/database";
import { ActionMessages } from "./ActionForm";
import styles from "./admin.module.css";

export interface EmployerOption {
  id: string;
  name: string;
  country_code: string;
  status: EmployerStatus;
}

/**
 * The employer choices for a job or case: the employers you can see. An inactive employer is
 * offered only when it is already the current link, so it can be kept but not newly chosen.
 * `employer_field` tells the server the picker was on the form — without it, a save leaves
 * the link alone (see parseEmployerLink).
 */
export function EmployerOptions({
  id,
  options,
  current,
  ...aria
}: {
  id: string;
  options: EmployerOption[];
  current: string | null;
  // Passed in by <Field>, which labels and describes the control it wraps.
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}) {
  const offered = options.filter((o) => o.status !== "inactive" || o.id === current);
  return (
    <>
      <input type="hidden" name="employer_field" value="1" />
      <Select id={id} name="employer_id" defaultValue={current ?? ""} {...aria}>
        <option value="">No employer record</option>
        {offered.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name} ({o.country_code}){o.status === "active" ? "" : ` · ${EMPLOYER_STATUS_LABELS[o.status]}`}
          </option>
        ))}
      </Select>
    </>
  );
}

/** Link, change or clear the employer of one recruitment case. */
export function CaseEmployerForm({
  action,
  caseId,
  options,
  current,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  caseId: string;
  options: EmployerOption[];
  current: string | null;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className={styles.form} aria-busy={pending || undefined}>
      <input type="hidden" name="case_id" value={caseId} />
      <label htmlFor="case-employer" className={styles.filterLabel}>
        Employer
      </label>
      <EmployerOptions id="case-employer" options={options} current={current} />
      <div>
        <Button type="submit" size="sm" variant="secondary" loading={pending}>
          {pending ? "Saving…" : "Save employer"}
        </Button>
      </div>
      <ActionMessages state={state} />
    </form>
  );
}
