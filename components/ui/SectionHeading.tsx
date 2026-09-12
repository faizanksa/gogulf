import type { ReactNode } from "react";
import { cx } from "./cx";
import styles from "./SectionHeading.module.css";

/**
 * The opening of a page band: an optional kicker (a short topic line, sentence case —
 * never a shouted label), the heading, an optional lead and an optional action on the
 * side. Give it the `id` its <Section labelledBy> points at.
 */
export function SectionHeading({
  id,
  kicker,
  title,
  lead,
  action,
  level = 2,
  align = "start",
  onDark,
  className,
}: {
  id: string;
  kicker?: ReactNode;
  title: ReactNode;
  lead?: ReactNode;
  action?: ReactNode;
  level?: 2 | 3;
  align?: "start" | "center";
  /** On a brand or ink band. */
  onDark?: boolean;
  className?: string;
}) {
  const Heading = level === 2 ? "h2" : "h3";
  const text = (
    <div className={cx(styles.text, align === "center" && styles.center)}>
      {kicker ? <p className={styles.kicker}>{kicker}</p> : null}
      <Heading id={id} className={cx(styles.title, level === 3 && styles.title3)}>
        {title}
      </Heading>
      {lead ? <p className={styles.lead}>{lead}</p> : null}
    </div>
  );
  return (
    <div className={cx(styles.heading, action ? styles.withAction : undefined, onDark && styles.onDark, className)}>
      {text}
      {action ? <div className={styles.action}>{action}</div> : null}
    </div>
  );
}
