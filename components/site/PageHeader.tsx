import type { ReactNode } from "react";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import type { Crumb } from "@/lib/seo";
import styles from "./PageHeader.module.css";

/** Interior page opening: breadcrumbs, one h1, an optional lead and actions. */
export function PageHeader({
  crumbs,
  title,
  lead,
  children,
}: {
  crumbs: Crumb[];
  title: ReactNode;
  lead?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className={styles.header}>
      <div className={styles.inner}>
        <Breadcrumbs items={crumbs} />
        <h1 className={styles.title}>{title}</h1>
        {lead ? <p className={styles.lead}>{lead}</p> : null}
        {children ? <div className={styles.actions}>{children}</div> : null}
      </div>
    </div>
  );
}
