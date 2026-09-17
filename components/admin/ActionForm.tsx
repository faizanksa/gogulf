"use client";

import { useActionState, type ReactNode } from "react";
import { AlertView } from "@/components/ui/AlertView";
import { Button } from "@/components/ui/Button";
import type { ActionState } from "@/lib/admin/action-state";
import styles from "./admin.module.css";

export type { ActionState } from "@/lib/admin/action-state";

/**
 * A button (or a few) that runs one Server Action and reports what happened next to it.
 * The action is the authority: it checks the permission and the database checks again,
 * so the result message is whatever the server decided, including the reasons a job
 * cannot be published yet.
 */
export function ActionForm({
  action,
  hidden,
  children,
  confirm,
  className,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  hidden: Record<string, string>;
  /** The submit buttons. Several may share the form, told apart by name/value. */
  children: (pending: boolean) => ReactNode;
  /** Asked before submitting — for actions that hide a job from the public. */
  confirm?: string;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form
      action={formAction}
      className={className}
      onSubmit={(event) => {
        if (confirm && !window.confirm(confirm)) event.preventDefault();
      }}
    >
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {children(pending)}
      <ActionMessages state={state} />
    </form>
  );
}

export function ActionMessages({ state }: { state: ActionState }) {
  if (!state) return null;
  return (
    <div className={styles.messages}>
      <AlertView tone={state.ok ? "success" : "error"} toneLabel={state.ok ? "Success" : "Error"} title={state.message} live={state.ok ? "polite" : "assertive"}>
        {state.problems?.length ? (
          <ul className={styles.problems}>
            {state.problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        ) : null}
      </AlertView>
      {state.warnings?.length ? (
        <AlertView tone="warning" toneLabel="Warning">
          <ul className={styles.problems}>
            {state.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </AlertView>
      ) : null}
    </div>
  );
}

export function SubmitButton({ pending, children, variant = "primary", name, value }: { pending: boolean; children: ReactNode; variant?: "primary" | "secondary"; name?: string; value?: string }) {
  return (
    <Button type="submit" variant={variant} size="sm" loading={pending} name={name} value={value}>
      {children}
    </Button>
  );
}
