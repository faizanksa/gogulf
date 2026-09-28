"use client";

import { useActionState } from "react";
import { Checkbox, Input } from "@/components/form/Controls";
import { Field, type FieldText } from "@/components/form/Field";
import { Button } from "@/components/ui/Button";
import type { ActionState } from "@/lib/admin/action-state";
import { ActionMessages } from "./ActionForm";
import styles from "./admin.module.css";

const FIELD_TEXT: FieldText = { optional: "(optional)", errorPrefix: "Error:" };

/** The confirmation step of a merge. The database does the merge, or nothing at all. */
export function ContactMergeForm({
  action,
  survivorId,
  mergedId,
  mergedName,
  survivorName,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  survivorId: string;
  mergedId: string;
  mergedName: string;
  survivorName: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className={styles.form} aria-busy={pending || undefined}>
      <input type="hidden" name="survivor" value={survivorId} />
      <input type="hidden" name="merged" value={mergedId} />
      <Field id="merge-reason" label="Reason" optional hint="Kept with the merge record, e.g. “same person, applied twice”." text={FIELD_TEXT}>
        <Input name="reason" maxLength={300} autoComplete="off" />
      </Field>
      <Checkbox
        id="merge-confirm"
        name="confirm"
        value="yes"
        required
        label={`Merge “${mergedName}” into “${survivorName}”`}
        hint="This cannot be undone from the screen. The merged record is kept, read-only, and everything it held is recorded."
      />
      <div className={styles.stickyBar}>
        <Button type="submit" loading={pending}>
          {pending ? "Merging…" : "Merge contacts"}
        </Button>
        <Button href={`/admin/contacts/${survivorId}`} variant="secondary">
          Cancel
        </Button>
      </div>
      <ActionMessages state={state} />
    </form>
  );
}
