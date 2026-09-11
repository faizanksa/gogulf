import type { ComponentPropsWithRef, ReactNode } from "react";
import { cx } from "@/components/ui/cx";
import styles from "./Controls.module.css";

/**
 * Form controls. Use inside <Field>, which supplies id, aria-describedby and
 * aria-invalid. 48px tall; borders meet the 3:1 non-text contrast minimum.
 */

export function Input({ className, ...props }: ComponentPropsWithRef<"input">) {
  return <input className={cx(styles.control, className)} {...props} />;
}

export function Textarea({ className, rows = 5, ...props }: ComponentPropsWithRef<"textarea">) {
  return <textarea rows={rows} className={cx(styles.control, styles.textarea, className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentPropsWithRef<"select"> & { children: ReactNode }) {
  return (
    <select className={cx(styles.control, styles.select, className)} {...props}>
      {children}
    </select>
  );
}

export function FileInput({ className, ...props }: Omit<ComponentPropsWithRef<"input">, "type">) {
  return <input type="file" className={cx(styles.control, styles.file, className)} {...props} />;
}

/** A single checkbox with its own label beside it. */
export function Checkbox({
  id,
  label,
  hint,
  className,
  ...props
}: Omit<ComponentPropsWithRef<"input">, "type"> & { id: string; label: ReactNode; hint?: ReactNode }) {
  return (
    <div className={cx(styles.checkboxRow, className)}>
      <input id={id} type="checkbox" className={styles.checkbox} aria-describedby={hint ? `${id}-hint` : undefined} {...props} />
      <label htmlFor={id} className={styles.checkboxLabel}>
        {label}
        {hint ? (
          <span id={`${id}-hint`} className={styles.checkboxHint}>
            {hint}
          </span>
        ) : null}
      </label>
    </div>
  );
}
