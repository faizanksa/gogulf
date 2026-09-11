import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import { VisuallyHidden } from "./VisuallyHidden";
import styles from "./States.module.css";

/** Nothing to show — says why and offers the next step. Never a dead end. */
export function EmptyState({
  icon = "search",
  title,
  headingLevel = 2,
  children,
  action,
}: {
  icon?: IconName;
  title: ReactNode;
  headingLevel?: 2 | 3;
  children?: ReactNode;
  action?: ReactNode;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <div className={styles.empty}>
      <Icon name={icon} size={32} className={styles.emptyIcon} />
      <Heading className={styles.emptyTitle}>{title}</Heading>
      {children ? <div className={styles.emptyBody}>{children}</div> : null}
      {action ? <div>{action}</div> : null}
    </div>
  );
}

/**
 * Placeholder blocks while content loads. The container announces "Loading" once;
 * the blocks themselves are hidden from assistive technology.
 */
export function Skeleton({ lines = 3, label = "Loading" }: { lines?: number; label?: string }) {
  return (
    <div className={styles.skeleton} role="status">
      <VisuallyHidden>{label}</VisuallyHidden>
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} className={styles.bar} aria-hidden="true" style={{ inlineSize: `${100 - i * 12}%` }} />
      ))}
    </div>
  );
}
