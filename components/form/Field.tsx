import { cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { cx } from "@/components/ui/cx";
import { Icon } from "@/components/ui/Icon";
import { VisuallyHidden } from "@/components/ui/VisuallyHidden";
import styles from "./Field.module.css";

/**
 * Label, hint, error and control, wired together:
 *   - the label is visible and bound with htmlFor
 *   - hint and error are linked to the control through aria-describedby
 *   - aria-invalid is set only while there is an error
 * Order follows the GOV.UK pattern: label, hint, error, control — so the error is read
 * before the reader reaches the field. Optional fields are marked, not required ones.
 */
export function Field({
  id,
  label,
  hint,
  error,
  optional,
  className,
  children,
}: {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  className?: string;
  children: ReactElement<Record<string, unknown>>;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  const control = isValidElement(children)
    ? cloneElement(children, { id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })
    : children;

  return (
    <div className={cx(styles.field, error && styles.hasError, className)}>
      <label htmlFor={id} className={styles.label}>
        {label}
        {optional ? <span className={styles.optional}> (optional)</span> : null}
      </label>
      {hint ? (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className={styles.error}>
          <Icon name="error" size={18} />
          <VisuallyHidden>Error: </VisuallyHidden>
          {error}
        </p>
      ) : null}
      {control}
    </div>
  );
}

/** A group of related controls (radio buttons, checkboxes) with a legend. */
export function Fieldset({ legend, hint, id, children }: { legend: ReactNode; hint?: ReactNode; id: string; children: ReactNode }) {
  return (
    <fieldset className={styles.fieldset} aria-describedby={hint ? `${id}-hint` : undefined}>
      <legend className={styles.legend}>{legend}</legend>
      {hint ? (
        <p id={`${id}-hint`} className={styles.hint}>
          {hint}
        </p>
      ) : null}
      {children}
    </fieldset>
  );
}
