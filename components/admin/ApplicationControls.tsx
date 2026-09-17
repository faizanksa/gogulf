"use client";

import { Select } from "@/components/form/Controls";
import type { ActionState } from "@/lib/admin/action-state";
import type { ApplicationStatus } from "@/types/database";
import { ActionForm, SubmitButton } from "./ActionForm";
import styles from "./admin.module.css";

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

const LABELS: Record<string, string> = { new: "New", screening: "Screening", rejected: "Rejected", withdrawn: "Withdrawn" };

export function ApplicationStatusControl({ id, status, action }: { id: string; status: ApplicationStatus; action: Action }) {
  return (
    <ActionForm action={action} hidden={{ id }}>
      {(pending) => (
        <div className={styles.actionItem}>
          <label htmlFor="application-status" className={styles.filterLabel}>
            Triage status
          </label>
          <Select id="application-status" name="status" defaultValue={status === "converted" ? "screening" : status}>
            {Object.entries(LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <div>
            <SubmitButton pending={pending} variant="secondary">
              Update status
            </SubmitButton>
          </div>
        </div>
      )}
    </ActionForm>
  );
}

export function ApplicationAssignControl({
  id,
  assigneeId,
  staff,
  action,
}: {
  id: string;
  assigneeId: string | null;
  staff: { id: string; full_name: string; role_key: string }[];
  action: Action;
}) {
  return (
    <ActionForm action={action} hidden={{ id }}>
      {(pending) => (
        <div className={styles.actionItem}>
          <label htmlFor="application-assignee" className={styles.filterLabel}>
            Assigned to
          </label>
          <Select id="application-assignee" name="assignee_id" defaultValue={assigneeId ?? ""}>
            <option value="">Nobody</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name} ({s.role_key.replace(/_/g, " ").toLowerCase()})
              </option>
            ))}
          </Select>
          <div>
            <SubmitButton pending={pending} variant="secondary">
              Save assignment
            </SubmitButton>
          </div>
        </div>
      )}
    </ActionForm>
  );
}

export function ConvertApplication({ id, action }: { id: string; action: Action }) {
  return (
    <ActionForm action={action} hidden={{ id }}>
      {(pending) => (
        <div className={styles.actionItem}>
          <div>
            <SubmitButton pending={pending}>Create contact and case</SubmitButton>
          </div>
          <p className={styles.actionEffect}>
            Finds the existing contact with this phone or email, or creates one, and opens a recruitment case at the New stage.
          </p>
        </div>
      )}
    </ActionForm>
  );
}
