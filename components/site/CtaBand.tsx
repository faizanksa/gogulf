import type { ReactNode } from "react";
import { Container, Section } from "@/components/ui/Layout";
import styles from "./CtaBand.module.css";

/**
 * A closing call to action on the brand-green band: one sentence of why, one primary
 * action (Button variant "inverse") and at most one alternative ("ghostInverse").
 */
export function CtaBand({ id, title, lead, actions }: { id: string; title: ReactNode; lead?: ReactNode; actions: ReactNode }) {
  return (
    <Section tone="brand" labelledBy={id}>
      <Container>
        <div className={styles.inner}>
          <div className={styles.text}>
            <h2 id={id} className={styles.title}>
              {title}
            </h2>
            {lead ? <p className={styles.lead}>{lead}</p> : null}
          </div>
          <div className={styles.actions}>{actions}</div>
        </div>
      </Container>
    </Section>
  );
}
