import type { ReactNode } from "react";
import { Icon } from "./Icon";
import styles from "./Disclosure.module.css";

/**
 * Show/hide section built on native <details>/<summary>: keyboard- and screen-reader-
 * accessible with no JavaScript. Used for FAQs.
 */
export function Disclosure({ summary, children, defaultOpen }: { summary: ReactNode; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details className={styles.details} open={defaultOpen}>
      <summary className={styles.summary}>
        <span>{summary}</span>
        <Icon name="chevron-down" size={20} className={styles.chevron} />
      </summary>
      <div className={styles.content}>{children}</div>
    </details>
  );
}
