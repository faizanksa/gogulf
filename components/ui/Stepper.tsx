import type { ReactNode } from "react";
import { cx } from "./cx";
import styles from "./Stepper.module.css";

/**
 * An ordered process. Numbers are real sequence, not decoration. Vertical on phones —
 * no horizontal scrolling — and in two columns from 1024px.
 */
export function Stepper({
  steps,
  current,
  label,
}: {
  steps: { title: ReactNode; description?: ReactNode }[];
  /** Zero-based index of the step the reader is on, if any. */
  current?: number;
  label?: string;
}) {
  return (
    <ol className={styles.stepper} aria-label={label}>
      {steps.map((step, i) => (
        <li
          key={i}
          className={cx(styles.step, current === i && styles.current, current !== undefined && i < current && styles.done)}
          aria-current={current === i ? "step" : undefined}
        >
          <span className={styles.marker} aria-hidden="true">
            {i + 1}
          </span>
          <div className={styles.body}>
            <p className={styles.title}>{step.title}</p>
            {step.description ? <p className={styles.description}>{step.description}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
