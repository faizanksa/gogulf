import type { ElementType, ReactNode } from "react";
import { cx } from "./cx";
import styles from "./Layout.module.css";

/** Horizontal constraint + side gutter. */
export function Container({
  width = "page",
  as: Tag = "div",
  className,
  children,
}: {
  width?: "page" | "prose" | "narrow";
  as?: ElementType;
  className?: string;
  children: ReactNode;
}) {
  return <Tag className={cx(styles.container, styles[width], className)}>{children}</Tag>;
}

/** Vertical rhythm for a page band. Label it with the id of its heading. */
export function Section({
  tone = "default",
  spacing = "default",
  labelledBy,
  className,
  children,
}: {
  tone?: "default" | "subtle" | "inverse";
  spacing?: "default" | "tight";
  labelledBy?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={labelledBy} className={cx(styles.section, styles[tone], spacing === "tight" && styles.tight, className)}>
      {children}
    </section>
  );
}

/** A bordered panel. Use for grouped content, not as decoration. */
export function Card({
  as: Tag = "div",
  tone = "default",
  className,
  children,
}: {
  as?: ElementType;
  tone?: "default" | "subtle";
  className?: string;
  children: ReactNode;
}) {
  return <Tag className={cx(styles.card, tone === "subtle" && styles.cardSubtle, className)}>{children}</Tag>;
}

/** Vertical stack with consistent gaps. */
export function Stack({
  gap = 4,
  as: Tag = "div",
  className,
  children,
}: {
  gap?: 2 | 3 | 4 | 5 | 6;
  as?: ElementType;
  className?: string;
  children: ReactNode;
}) {
  return <Tag className={cx(styles.stack, styles[`gap${gap}`], className)}>{children}</Tag>;
}
