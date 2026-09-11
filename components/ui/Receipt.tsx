import type { ReactNode } from "react";
import { Icon } from "./Icon";
import styles from "./Receipt.module.css";

/**
 * Confirmation receipt — the boarding-pass idea, reserved for "we have it": a
 * reference to keep, the route, the status, and what happens next.
 */
export function Receipt({
  heading,
  headingId,
  reference,
  from,
  to,
  status,
  rows = [],
  children,
}: {
  heading: ReactNode;
  headingId: string;
  reference: string;
  from: string;
  to: string;
  status: string;
  rows?: { label: string; value: ReactNode }[];
  children?: ReactNode;
}) {
  return (
    <section className={styles.receipt} aria-labelledby={headingId}>
      <div className={styles.main}>
        <p className={styles.status}>
          <Icon name="success" size={20} />
          {status}
        </p>
        <h2 id={headingId} className={styles.heading}>
          {heading}
        </h2>
        <dl className={styles.facts}>
          <div>
            <dt>Reference</dt>
            <dd className={styles.reference}>{reference}</dd>
          </div>
          {rows.map((r) => (
            <div key={r.label}>
              <dt>{r.label}</dt>
              <dd>{r.value}</dd>
            </div>
          ))}
        </dl>
        {children ? <div className={styles.next}>{children}</div> : null}
      </div>
      <div className={styles.stub} aria-label={`Route: ${from} to ${to}`} role="img">
        <span className={styles.place}>{from}</span>
        <span className={styles.line} aria-hidden="true" />
        <span className={styles.place}>{to}</span>
      </div>
    </section>
  );
}
