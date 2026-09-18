"use client";

import { Select } from "@/components/form/Controls";
import type { ActionState } from "@/lib/admin/action-state";
import { RESERVED_PERMISSIONS, SCOPE_LABELS, SCOPES, type Scope } from "@/lib/admin/rbac-model";
import { ActionForm, SubmitButton } from "./ActionForm";
import styles from "./admin.module.css";

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

export interface GrantGroup {
  domain: string;
  permissions: { key: string; description: string | null; scope: Scope | null }[];
}

/**
 * One select per permission: none, own records, own branch, or everything. Reserved
 * permissions are shown but locked — the server refuses them anyway. Saving asks first,
 * because a change applies to everyone in the role on their next request.
 */
export function RoleGrantsForm({ role, label, groups, action }: { role: string; label: string; groups: GrantGroup[]; action: Action }) {
  return (
    <ActionForm action={action} hidden={{ role }} confirm={`Save these permissions for ${label}? Everyone in the role is affected on their next request, and the change is recorded in the audit trail.`}>
      {(pending) => (
        <>
          {groups.map((group) => (
            <fieldset key={group.domain} className={styles.section}>
              <legend>{group.domain}</legend>
              <ul className={styles.grantList}>
                {group.permissions.map((p) => {
                  const reserved = RESERVED_PERMISSIONS.includes(p.key);
                  return (
                    <li key={p.key} className={styles.grantRow}>
                      <label htmlFor={`perm-${p.key}`}>
                        <span className={styles.mono}>{p.key}</span>
                        {p.description ? <span className={styles.muted}> — {p.description}</span> : null}
                      </label>
                      <Select id={`perm-${p.key}`} name={`perm:${p.key}`} defaultValue={p.scope ?? ""} disabled={reserved}>
                        <option value="">None</option>
                        {SCOPES.map((s) => (
                          <option key={s} value={s}>
                            {SCOPE_LABELS[s]}
                          </option>
                        ))}
                      </Select>
                      {reserved ? <span className={styles.muted}>Reserved for super administrators</span> : null}
                    </li>
                  );
                })}
              </ul>
            </fieldset>
          ))}
          <div className={styles.stickyBar}>
            <SubmitButton pending={pending}>Save permissions</SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  );
}
