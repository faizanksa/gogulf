"use client";

import { Input } from "@/components/form/Controls";
import type { ActionState } from "@/lib/admin/action-state";
import { ActionForm, SubmitButton } from "./ActionForm";
import styles from "./admin.module.css";

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

/** Issue a saved draft. The database re-checks it; issuing locks the amounts. */
export function IssueInvoiceButton({ id, action }: { id: string; action: Action }) {
  return (
    <ActionForm action={action} hidden={{ id }} confirm="Issue this invoice? Its amounts and customer details will be locked, and the payment link will open.">
      {(pending) => <SubmitButton pending={pending}>Issue invoice</SubmitButton>}
    </ActionForm>
  );
}

/**
 * Void an invoice with a reason. Offered only where the database allows it (a draft, an
 * issued invoice nobody has started paying, or one whose payment failed). There is no
 * control anywhere to un-pay a paid invoice: reversing received money is a refund.
 */
export function VoidInvoiceForm({ id, action }: { id: string; action: Action }) {
  return (
    <ActionForm action={action} hidden={{ id }} confirm="Void this invoice? The payment link stops working and this cannot be undone.">
      {(pending) => (
        <div className={styles.inlineForm}>
          <label htmlFor="void-reason" className={styles.filterLabel}>
            Reason for voiding
          </label>
          <Input id="void-reason" name="reason" maxLength={500} required minLength={3} autoComplete="off" />
          <button type="submit" className={styles.dangerButton} aria-busy={pending || undefined} disabled={pending}>
            {pending ? "Working…" : "Void invoice"}
          </button>
        </div>
      )}
    </ActionForm>
  );
}
