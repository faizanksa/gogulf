import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SkipLink } from "@/components/site/SkipLink";
import { Button } from "@/components/ui/Button";
import styles from "./not-found.module.css";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: true },
};

/** Every unmatched URL, and every notFound() call. Helpful, not a dead end. */
export default function NotFound() {
  return (
    <>
      <SkipLink />
      <SiteHeader />
      <main id="main-content" tabIndex={-1} className={styles.main}>
        <div className={styles.wrap}>
          <p className={styles.code}>Error 404</p>
          <h1 className={styles.title}>We can’t find that page</h1>
          <p className={styles.lead}>
            The link may be out of date, or the job it pointed to may have closed. One of these should help:
          </p>
          <ul className={styles.links}>
            <li>
              <Link href="/jobs">Current Gulf job openings</Link>
            </li>
            <li>
              <Link href="/candidates">How applying works</Link>
            </li>
            <li>
              <Link href="/employers">Hiring from India</Link>
            </li>
            <li>
              <Link href="/verify">How to check you are dealing with Go Gulf</Link>
            </li>
          </ul>
          <div className={styles.actions}>
            <Button href="/">Go to the home page</Button>
            <Button href="/contact" variant="secondary">
              Contact Go Gulf
            </Button>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
