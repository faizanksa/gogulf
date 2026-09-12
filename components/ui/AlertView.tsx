import type { ReactNode } from "react";
import { cx } from "./cx";
import { Icon } from "./Icon";
import { VisuallyHidden } from "./VisuallyHidden";
import styles from "./Alert.module.css";

export type AlertTone = "info" | "success" | "warning" | "error";

export interface AlertViewProps {
  tone?: AlertTone;
  /** The spoken tone ("Warning: …"), already translated. */
  toneLabel: string;
  title?: ReactNode;
  children?: ReactNode;
  live?: "polite" | "assertive";
  className?: string;
}

/**
 * An inline message. Icon and a spoken tone label accompany the colour.
 * `live` makes it announce when it appears: "polite" (status) or "assertive" (alert).
 * Leave it off for messages present when the page loads.
 *
 * This is the form for Client Components, which receive `toneLabel` as a prop. Server
 * Components use <Alert>, which translates the label itself.
 */
export function AlertView({ tone = "info", toneLabel, title, children, live, className }: AlertViewProps) {
  const role = live === "assertive" ? "alert" : live === "polite" ? "status" : undefined;
  return (
    <div className={cx(styles.alert, styles[tone], className)} role={role}>
      <Icon name={tone} size={22} className={styles.icon} />
      <div className={styles.body}>
        {title ? (
          <p className={styles.title}>
            <VisuallyHidden>{toneLabel}: </VisuallyHidden>
            {title}
          </p>
        ) : (
          <VisuallyHidden>{toneLabel}: </VisuallyHidden>
        )}
        {children ? <div className={styles.content}>{children}</div> : null}
      </div>
    </div>
  );
}
