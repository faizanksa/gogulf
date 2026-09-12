import type { ReactNode } from "react";
import { cx } from "./cx";
import styles from "./FactList.module.css";

export interface Fact {
  key: string;
  label: ReactNode;
  value: ReactNode;
  /** Identifiers, money, dates: set in the data face. */
  mono?: boolean;
}

/**
 * Facts set out like a document's data page: label beside value, hairlines between
 * rows, identifiers in the mono face. `rows` for a record (label | value); `grid` for a
 * compact band of short facts, label above value.
 */
export function FactList({ items, layout = "rows", className }: { items: Fact[]; layout?: "rows" | "grid"; className?: string }) {
  return (
    <dl className={cx(styles.list, styles[layout], className)}>
      {items.map((item) => (
        <div key={item.key} className={styles.row}>
          <dt className={styles.label}>{item.label}</dt>
          <dd className={cx(styles.value, item.mono && styles.mono)}>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
