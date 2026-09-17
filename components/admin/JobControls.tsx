"use client";

import { useState } from "react";
import { Input } from "@/components/form/Controls";
import type { ActionState } from "@/lib/admin/action-state";
import type { TransitionAction } from "@/lib/jobs/model";
import type { JobStatus } from "@/types/database";
import { ActionForm, SubmitButton } from "./ActionForm";
import styles from "./admin.module.css";

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

/** The lifecycle buttons for a job's current status. The database re-checks each one. */
export function JobLifecycle({ id, status, actions, action }: { id: string; status: JobStatus; actions: TransitionAction[]; action: Action }) {
  return (
    <ul className={styles.actionsList}>
      {actions.map((a) => (
        <li key={a.to} className={styles.actionItem}>
          <ActionForm
            action={action}
            hidden={{ id, from: status, to: a.to }}
            confirm={
              a.to === "archived"
                ? "Archive this job? It will be hidden everywhere. Applications and history are kept."
                : a.label === "Unpublish"
                  ? "Unpublish this job? It will be removed from the public site."
                  : a.label === "Close"
                    ? "Close this job? It will stop accepting applications."
                    : undefined
            }
          >
            {(pending) =>
              a.tone === "danger" ? (
                <button type="submit" className={styles.dangerButton} aria-busy={pending || undefined} disabled={pending}>
                  {pending ? "Working…" : a.label}
                </button>
              ) : (
                <SubmitButton pending={pending} variant={a.tone === "primary" ? "primary" : "secondary"}>
                  {a.label}
                </SubmitButton>
              )
            }
          </ActionForm>
          <p className={styles.actionEffect}>{a.effect}</p>
        </li>
      ))}
    </ul>
  );
}

/** Feature or unfeature, with an optional end date. Access and status are untouched. */
export function JobPromotionControl({
  id,
  promotion,
  featuredUntil,
  action,
}: {
  id: string;
  promotion: "standard" | "featured";
  featuredUntil: string | null;
  action: Action;
}) {
  const [until, setUntil] = useState(featuredUntil ?? "");
  if (promotion === "featured") {
    return (
      <div className={styles.actionsList}>
        <ActionForm action={action} hidden={{ id, promotion: "featured" }}>
          {(pending) => (
            <div className={styles.actionItem}>
              <label htmlFor="featured-until" className={styles.filterLabel}>
                Featured until <span className={styles.muted}>(optional)</span>
              </label>
              <Input id="featured-until" name="featured_until" type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
              <div>
                <SubmitButton pending={pending} variant="secondary">
                  Update featured date
                </SubmitButton>
              </div>
            </div>
          )}
        </ActionForm>
        <ActionForm action={action} hidden={{ id, promotion: "standard" }}>
          {(pending) => (
            <SubmitButton pending={pending} variant="secondary">
              Unfeature
            </SubmitButton>
          )}
        </ActionForm>
      </div>
    );
  }
  return (
    <ActionForm action={action} hidden={{ id, promotion: "featured" }}>
      {(pending) => (
        <div className={styles.actionItem}>
          <label htmlFor="featured-until" className={styles.filterLabel}>
            Featured until <span className={styles.muted}>(optional)</span>
          </label>
          <Input id="featured-until" name="featured_until" type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
          <p className={styles.actionEffect}>After this day it stops being featured on its own. Leave empty to feature until you unfeature it.</p>
          <div>
            <SubmitButton pending={pending}>Feature this job</SubmitButton>
          </div>
        </div>
      )}
    </ActionForm>
  );
}

export function DuplicateJob({ id, action }: { id: string; action: Action }) {
  return (
    <ActionForm action={action} hidden={{ id }}>
      {(pending) => (
        <SubmitButton pending={pending} variant="secondary">
          Duplicate as a new draft
        </SubmitButton>
      )}
    </ActionForm>
  );
}
