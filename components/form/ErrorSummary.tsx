"use client";

import { useEffect, useId, useRef } from "react";
import type { FormError } from "@/lib/forms/native-validation";
import styles from "./ErrorSummary.module.css";

/**
 * Problems with a submission, listed at the top of the form. Receives focus each time
 * a submit fails (`attempt` increments), so screen-reader and keyboard users land on
 * it; each item links to — and focuses — its field.
 */
export function ErrorSummary({
  errors,
  attempt,
  title = "There is a problem",
}: {
  errors: FormError[];
  attempt: number;
  title?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const hasErrors = errors.length > 0;

  useEffect(() => {
    if (attempt > 0 && hasErrors) ref.current?.focus();
  }, [attempt, hasErrors]);

  if (!hasErrors) return null;

  return (
    <div ref={ref} tabIndex={-1} role="alert" aria-labelledby={titleId} className={styles.summary}>
      <h2 id={titleId} className={styles.title}>
        {title}
      </h2>
      <ul className={styles.list}>
        {errors.map((e) => (
          <li key={e.fieldId}>
            <a
              href={`#${e.fieldId}`}
              onClick={(event) => {
                event.preventDefault();
                const field = document.getElementById(e.fieldId);
                field?.focus();
                field?.scrollIntoView({ block: "center" });
              }}
            >
              {e.message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
