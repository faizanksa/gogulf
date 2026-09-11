import Link from "next/link";
import type { ReactNode } from "react";
import { SkipLink } from "./SkipLink";
import styles from "./AreaShell.module.css";

/**
 * Minimal chrome for the staff and customer areas — deliberately not the marketing
 * header, so a signed-in area is never mistaken for a public page. Phase 3/4 replace
 * it with the real application shells.
 */
export function AreaShell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <SkipLink />
      <header className={styles.header}>
        <div className={styles.inner}>
          <Link href="/" className={styles.brand}>
            Go Gulf<span className="visually-hidden">, public website</span>
          </Link>
          <span className={styles.label}>{label}</span>
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className={styles.main}>
        <div className={styles.content}>
          <h1 className="visually-hidden">{label}</h1>
          {children}
        </div>
      </main>
    </>
  );
}
