"use client";

import { Select } from "@/components/form/Controls";
import type { ActionState } from "@/lib/admin/action-state";
import { ActionForm, SubmitButton } from "./ActionForm";
import styles from "./admin.module.css";

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

/** Change one person's role. The action and the database both check; this only offers it. */
export function RoleControl({ id, role, roles, name, action }: { id: string; role: string; roles: { key: string; label: string }[]; name: string; action: Action }) {
  return (
    <ActionForm
      action={action}
      hidden={{ id }}
      confirm={`Change the role of ${name}? Their access changes on their next request, and the change is recorded in the audit trail.`}
      className={styles.inlineForm}
    >
      {(pending) => (
        <div className={styles.linkRow}>
          <label className="visually-hidden" htmlFor={`role-${id}`}>
            Role for {name}
          </label>
          <Select id={`role-${id}`} name="role" defaultValue={role}>
            {roles.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </Select>
          <SubmitButton pending={pending} variant="secondary">
            Save
          </SubmitButton>
        </div>
      )}
    </ActionForm>
  );
}

/** Deactivate or reactivate. Deactivation takes effect on the person's next request. */
export function ActiveControl({ id, active, name, action }: { id: string; active: boolean; name: string; action: Action }) {
  return (
    <ActionForm
      action={action}
      hidden={{ id, active: active ? "false" : "true" }}
      confirm={active ? `Deactivate ${name}? They lose all access immediately. Their history is kept.` : undefined}
    >
      {(pending) =>
        active ? (
          <button type="submit" className={styles.dangerButton} aria-busy={pending || undefined} disabled={pending}>
            {pending ? "Working…" : "Deactivate"}
          </button>
        ) : (
          <SubmitButton pending={pending} variant="secondary">
            Reactivate
          </SubmitButton>
        )
      }
    </ActionForm>
  );
}
