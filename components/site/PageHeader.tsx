import type { ReactNode } from "react";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { cx } from "@/components/ui/cx";
import type { Crumb } from "@/lib/seo";
import styles from "./PageHeader.module.css";

/**
 * Interior page opening: breadcrumbs, an optional kicker, one h1, an optional lead,
 * actions, and an optional aside (a fact panel, a summary) beside the text from 1024px.
 */
export function PageHeader({
  crumbs,
  kicker,
  title,
  lead,
  aside,
  children,
}: {
  crumbs: Crumb[];
  kicker?: ReactNode;
  title: ReactNode;
  lead?: ReactNode;
  aside?: ReactNode;
  /** Actions: one primary button at most. */
  children?: ReactNode;
}) {
  return (
    <div className={styles.header}>
      <div className={styles.inner}>
        <Breadcrumbs items={crumbs} />
        <div className={cx(styles.layout, aside ? styles.withAside : undefined)}>
          <div className={styles.text}>
            {kicker ? <p className={styles.kicker}>{kicker}</p> : null}
            <h1 className={styles.title}>{title}</h1>
            {lead ? <p className={styles.lead}>{lead}</p> : null}
            {children ? <div className={styles.actions}>{children}</div> : null}
          </div>
          {aside ? <div className={styles.aside}>{aside}</div> : null}
        </div>
      </div>
    </div>
  );
}
