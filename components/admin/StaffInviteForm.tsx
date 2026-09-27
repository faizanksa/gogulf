"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import { Input, Select } from "@/components/form/Controls";
import { Field, type FieldText } from "@/components/form/Field";
import { Button } from "@/components/ui/Button";
import type { ActionState } from "@/lib/admin/action-state";
import { STAFF_DOMAIN } from "@/lib/admin/staff-onboarding";
import { ActionMessages } from "./ActionForm";
import styles from "./admin.module.css";

const FIELD_TEXT: FieldText = { optional: "(optional)", errorPrefix: "Error:" };

/**
 * Add a staff member. Offers only what the caller may give — the action and the database
 * check again. No password field exists: they sign in with Google Workspace.
 */
export function StaffInviteForm({
  action,
  roles,
  branches,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  roles: { key: string; label: string; description: string | null }[];
  branches: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const errors = state?.fieldErrors ?? {};
  const [values, setValues] = useState({ full_name: "", email: "", role: "", branch_id: branches.length === 1 ? (branches[0]?.id ?? "") : "" });
  const set = (name: keyof typeof values) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [name]: e.target.value }));
  const chosen = roles.find((r) => r.key === values.role);

  // Dispatched by hand so a refused submission keeps what was typed.
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => formAction(data));
  }

  return (
    <form action={formAction} onSubmit={onSubmit} className={styles.form} noValidate aria-busy={pending || undefined}>
      <fieldset className={styles.section}>
        <legend>Person</legend>
        <div className={styles.fields2}>
          <Field id="staff-full_name" label="Full name" text={FIELD_TEXT} error={errors.full_name}>
            <Input name="full_name" value={values.full_name} onChange={set("full_name")} maxLength={100} required autoComplete="off" />
          </Field>
          <Field id="staff-email" label="Work email" hint={`The Google Workspace address they sign in to Gmail with, ending in @${STAFF_DOMAIN}. It must already exist in Google.`} text={FIELD_TEXT} error={errors.email}>
            <Input name="email" type="email" inputMode="email" value={values.email} onChange={set("email")} maxLength={254} required autoComplete="off" spellCheck={false} />
          </Field>
        </div>
      </fieldset>

      <fieldset className={styles.section}>
        <legend>Access</legend>
        <p className={styles.sectionHint}>The role decides what they can see and change. You can change it later on the Staff page; every change is in the audit trail.</p>
        <div className={styles.fields2}>
          <Field id="staff-role" label="Role" hint={chosen?.description ?? undefined} text={FIELD_TEXT} error={errors.role}>
            <Select name="role" value={values.role} onChange={set("role")} required>
              <option value="" disabled>
                Choose a role
              </option>
              {roles.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="staff-branch_id" label="Branch" text={FIELD_TEXT} error={errors.branch_id}>
            <Select name="branch_id" value={values.branch_id} onChange={set("branch_id")} required>
              <option value="" disabled>
                Choose a branch
              </option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </fieldset>

      <div className={styles.stickyBar}>
        <Button type="submit" loading={pending}>
          {pending ? "Adding…" : "Add staff member"}
        </Button>
        <Button href="/admin/staff" variant="secondary">
          Cancel
        </Button>
      </div>
      <ActionMessages state={state} />
    </form>
  );
}
