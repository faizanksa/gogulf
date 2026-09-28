"use client";

import { useActionState, useState } from "react";
import { Checkbox, Select, Textarea } from "@/components/form/Controls";
import { Field, type FieldText } from "@/components/form/Field";
import { Button } from "@/components/ui/Button";
import type { ActionState } from "@/lib/admin/action-state";
import { CLOSE_REASONS, REASON_MAX, type CloseOutcome } from "@/lib/crm/case-lifecycle";
import { ActionMessages } from "./ActionForm";
import styles from "./admin.module.css";

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

const FIELD_TEXT: FieldText = { optional: "(optional)", errorPrefix: "Error:" };

export interface StageOption {
  key: string;
  name: string;
  is_won: boolean;
}

/**
 * Move an open case one stage on, or one back with a reason. Administrators may tick
 * "exceptional move" to choose any stage, with a reason. Joined is offered only to staff who
 * may close cases, because reaching it closes the case as won. The database decides.
 */
export function CaseStageForm({
  action,
  caseId,
  stages,
  current,
  canExceptional,
  canClose,
}: {
  action: Action;
  caseId: string;
  stages: StageOption[];
  current: string;
  canExceptional: boolean;
  canClose: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const [exceptional, setExceptional] = useState(false);
  const index = stages.findIndex((s) => s.key === current);
  const next = stages[index + 1];
  const previous = index > 0 ? stages[index - 1] : undefined;
  const reachable = (s: StageOption) => canClose || !s.is_won;

  const options = exceptional
    ? stages.filter((s) => s.key !== current && reachable(s)).map((s) => ({ key: s.key, label: s.name }))
    : [
        ...(next && reachable(next) ? [{ key: next.key, label: `Next: ${next.name}` }] : []),
        ...(previous ? [{ key: previous.key, label: `Back: ${previous.name} (reason needed)` }] : []),
      ];
  const [choice, setChoice] = useState(options[0]?.key ?? "");
  const selected = options.some((o) => o.key === choice) ? choice : (options[0]?.key ?? "");
  const needsReason = exceptional || (previous !== undefined && selected === previous.key);

  return (
    <form action={formAction} className={styles.form} aria-busy={pending || undefined}>
      <input type="hidden" name="case_id" value={caseId} />
      {next?.is_won && !canClose && !exceptional ? (
        <p className={styles.muted}>Moving to {next.name} closes the case as won; that needs permission to close cases.</p>
      ) : null}
      {options.length ? (
        <>
          <Field id="case-stage" label="Move to" text={FIELD_TEXT} error={state?.fieldErrors?.stage}>
            <Select name="stage" value={selected} onChange={(e) => setChoice(e.target.value)}>
              {options.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            id="case-stage-reason"
            label="Reason"
            optional={!needsReason}
            hint={needsReason ? "Required. It is kept on the case timeline and the audit trail." : "Not needed for a normal move forward."}
            text={FIELD_TEXT}
            error={state?.fieldErrors?.reason}
          >
            <Textarea name="reason" rows={2} maxLength={REASON_MAX} required={needsReason} />
          </Field>
        </>
      ) : (
        <p className={styles.muted}>There is no stage to move to from here.</p>
      )}
      {canExceptional ? (
        <Checkbox
          id="case-stage-exceptional"
          name="exceptional"
          checked={exceptional}
          onChange={(e) => setExceptional(e.target.checked)}
          label="Exceptional move"
          hint="Administrators only: any stage, skipping or going back more than one. A reason is required."
        />
      ) : null}
      <div>
        <Button type="submit" size="sm" loading={pending} disabled={!options.length}>
          {pending ? "Moving…" : "Move case"}
        </Button>
      </div>
      <ActionMessages state={state} />
    </form>
  );
}

/** Close an open case as lost or cancelled, with a reason from that outcome's list. */
export function CaseCloseForm({ action, caseId }: { action: Action; caseId: string }) {
  const [state, formAction, pending] = useActionState(action, null);
  const [outcome, setOutcome] = useState<CloseOutcome>("lost");
  const [reason, setReason] = useState("");

  return (
    <form
      action={formAction}
      className={styles.form}
      aria-busy={pending || undefined}
      onSubmit={(event) => {
        if (!window.confirm(`Close this case as ${outcome}? Its open tasks will be cancelled.`)) event.preventDefault();
      }}
    >
      <input type="hidden" name="case_id" value={caseId} />
      <Field id="case-close-outcome" label="Outcome" text={FIELD_TEXT} error={state?.fieldErrors?.outcome}>
        <Select
          name="outcome"
          value={outcome}
          onChange={(e) => {
            setOutcome(e.target.value as CloseOutcome);
            setReason("");
          }}
        >
          <option value="lost">Lost — recruitment ended unsuccessfully</option>
          <option value="cancelled">Cancelled — stopped for an administrative reason</option>
        </Select>
      </Field>
      <Field id="case-close-reason" label="Reason" text={FIELD_TEXT} error={state?.fieldErrors?.reason}>
        <Select name="reason" value={reason} onChange={(e) => setReason(e.target.value)} required>
          <option value="">Choose a reason</option>
          {CLOSE_REASONS[outcome].map((r) => (
            <option key={r.key} value={r.key}>
              {r.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field
        id="case-close-note"
        label="Note"
        optional={reason !== "other"}
        hint={reason === "other" ? "Required for “Other”." : "Internal only. Never shown to the candidate."}
        text={FIELD_TEXT}
        error={state?.fieldErrors?.note}
      >
        <Textarea name="note" rows={2} maxLength={REASON_MAX} required={reason === "other"} />
      </Field>
      <div>
        <Button type="submit" size="sm" variant="secondary" loading={pending}>
          {pending ? "Closing…" : "Close case"}
        </Button>
      </div>
      <ActionMessages state={state} />
    </form>
  );
}

/** Reopen a closed case at its last active stage, with a reason. */
export function CaseReopenForm({ action, caseId, returnsTo }: { action: Action; caseId: string; returnsTo: string | null }) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className={styles.form} aria-busy={pending || undefined}>
      <input type="hidden" name="case_id" value={caseId} />
      <Field
        id="case-reopen-reason"
        label="Reason for reopening"
        hint={returnsTo ? `The case returns to ${returnsTo}. Cancelled tasks stay cancelled.` : undefined}
        text={FIELD_TEXT}
        error={state?.fieldErrors?.reason}
      >
        <Textarea name="reason" rows={2} maxLength={REASON_MAX} required />
      </Field>
      <div>
        <Button type="submit" size="sm" variant="secondary" loading={pending}>
          {pending ? "Reopening…" : "Reopen case"}
        </Button>
      </div>
      <ActionMessages state={state} />
    </form>
  );
}

/** Give the case to an eligible colleague of its branch, or leave it unassigned. */
export function CaseOwnerForm({
  action,
  caseId,
  owners,
  current,
  currentName,
}: {
  action: Action;
  caseId: string;
  owners: { id: string; full_name: string; role_key: string }[];
  current: string | null;
  /** The current owner's name, shown even when they are no longer eligible (a closed case's historical owner). */
  currentName: string | null;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const currentListed = !current || owners.some((o) => o.id === current);
  return (
    <form action={formAction} className={styles.form} aria-busy={pending || undefined}>
      <input type="hidden" name="case_id" value={caseId} />
      <Field
        id="case-owner"
        label="Owner"
        hint="Active staff of this case's branch who can own recruitment cases."
        text={FIELD_TEXT}
      >
        <Select name="owner_id" defaultValue={current ?? ""}>
          <option value="">Unassigned</option>
          {currentListed ? null : <option value={current ?? ""}>{currentName ?? "Current owner"} (no longer eligible)</option>}
          {owners.map((o) => (
            <option key={o.id} value={o.id}>
              {o.full_name}
            </option>
          ))}
        </Select>
      </Field>
      <div>
        <Button type="submit" size="sm" variant="secondary" loading={pending}>
          {pending ? "Saving…" : "Save owner"}
        </Button>
      </div>
      <ActionMessages state={state} />
    </form>
  );
}
