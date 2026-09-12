import type { ElementType, ReactNode } from "react";
import { cx } from "./cx";
import styles from "./Layout.module.css";

/** Horizontal constraint + side gutter: page 1200px, prose 68ch, narrow 720px (forms). */
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

/**
 * Vertical rhythm for a page band. Label it with the id of its heading.
 *   default  white     subtle  green-tinted neutral
 *   brand    Go Gulf green, for closing calls to action     inverse  ink
 */
export function Section({
  tone = "default",
  spacing = "default",
  divided,
  labelledBy,
  id,
  className,
  children,
}: {
  tone?: "default" | "subtle" | "brand" | "inverse";
  spacing?: "default" | "tight";
  /** A hairline above the band — for two white bands in a row. */
  divided?: boolean;
  labelledBy?: string;
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className={cx(styles.section, styles[tone], spacing === "tight" && styles.tight, divided && styles.divided, className)}
    >
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

/** Responsive columns: one on phones, then 2, 3 or 4 from the tablet/desktop breakpoints. */
export function Grid({
  columns = 3,
  as: Tag = "div",
  className,
  children,
}: {
  columns?: 2 | 3 | 4;
  as?: ElementType;
  className?: string;
  children: ReactNode;
}) {
  return <Tag className={cx(styles.grid, styles[`cols${columns}`], className)}>{children}</Tag>;
}
