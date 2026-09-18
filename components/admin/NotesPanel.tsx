"use client";

import { Textarea } from "@/components/form/Controls";
import type { ActionState } from "@/lib/admin/action-state";
import { ActionForm, SubmitButton } from "./ActionForm";
import styles from "./admin.module.css";

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

/** Write a team note. The server and the database both check who may, and the author is always the caller. */
export function AddNoteForm({ contactId, caseId, path, action }: { contactId: string; caseId?: string | null; path: string; action: Action }) {
  return (
    <ActionForm action={action} hidden={{ contact_id: contactId, case_id: caseId ?? "", path }}>
      {(pending) => (
        <div className={styles.inlineForm}>
          <label htmlFor="note-body" className={styles.filterLabel}>
            Add a note for the team
          </label>
          <Textarea id="note-body" name="body" rows={3} maxLength={2000} required minLength={2} />
          <div>
            <SubmitButton pending={pending}>Add note</SubmitButton>
          </div>
        </div>
      )}
    </ActionForm>
  );
}
