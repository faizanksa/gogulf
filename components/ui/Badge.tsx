import type { ReactNode } from "react";
import { cx } from "./cx";
import { Icon, type IconName } from "./Icon";
import styles from "./Badge.module.css";

/** A short status label. Always carries text — colour is never the only signal. */
export function Badge({
  tone = "neutral",
  icon,
  children,
}: {
  tone?: "neutral" | "green" | "blue" | "warning" | "error";
  icon?: IconName;
  children: ReactNode;
}) {
  return (
    <span className={cx(styles.badge, styles[tone])}>
      {icon ? <Icon name={icon} size={14} /> : null}
      {children}
    </span>
  );
}
