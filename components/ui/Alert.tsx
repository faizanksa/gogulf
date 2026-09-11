import type { ReactNode } from "react";
import { cx } from "./cx";
import { Icon } from "./Icon";
import { VisuallyHidden } from "./VisuallyHidden";
import styles from "./Alert.module.css";

const TONE = {
  info: { icon: "info", label: "Information" },
  success: { icon: "success", label: "Success" },
  warning: { icon: "warning", label: "Warning" },
  error: { icon: "error", label: "Error" },
} as const;

/**
 * An inline message. Icon and a spoken tone label accompany the colour.
 * `live` makes it announce when it appears: "polite" (status) or "assertive" (alert).
 * Leave it off for messages present when the page loads.
 */
export function Alert({
  tone = "info",
  title,
  children,
  live,
  className,
}: {
  tone?: keyof typeof TONE;
  title?: ReactNode;
  children?: ReactNode;
  live?: "polite" | "assertive";
  className?: string;
}) {
  const role = live === "assertive" ? "alert" : live === "polite" ? "status" : undefined;
  return (
    <div className={cx(styles.alert, styles[tone], className)} role={role}>
      <Icon name={TONE[tone].icon} size={22} className={styles.icon} />
      <div className={styles.body}>
        {title ? (
          <p className={styles.title}>
            <VisuallyHidden>{TONE[tone].label}: </VisuallyHidden>
            {title}
          </p>
        ) : (
          <VisuallyHidden>{TONE[tone].label}: </VisuallyHidden>
        )}
        {children ? <div className={styles.content}>{children}</div> : null}
      </div>
    </div>
  );
}
