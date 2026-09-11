import type { ReactNode } from "react";
import JsonLd from "@/components/JsonLd";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SkipLink } from "@/components/site/SkipLink";
import { siteJsonLdGraph } from "@/lib/seo";
import styles from "./marketing.module.css";

/**
 * The public site's shell: skip link, header, one <main> landmark, footer, and the
 * sitewide Organization + WebSite structured data.
 *
 * Pages not yet rebuilt sit in the (legacy) and (legal) groups, whose layouts load the
 * scoped pre-redesign stylesheet.
 */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SkipLink />
      <SiteHeader />
      <main id="main-content" tabIndex={-1} className={styles.main}>
        {children}
      </main>
      <SiteFooter />
      <JsonLd data={siteJsonLdGraph()} />
    </>
  );
}
