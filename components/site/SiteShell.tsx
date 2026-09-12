import type { ReactNode } from "react";
import JsonLd from "@/components/JsonLd";
import { getTranslator } from "@/lib/i18n/server";
import { switcherData } from "@/lib/i18n/switcher";
import { siteJsonLdGraph } from "@/lib/seo";
import { LanguageSuggestion } from "./LanguageSuggestion";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";
import { SkipLink } from "./SkipLink";
import styles from "./SiteShell.module.css";

/**
 * The public site's shell: skip link, header, one <main> landmark, footer, and the
 * sitewide Organization + WebSite structured data. Rendered by the English root layout
 * (app/(marketing)), the other-language root layout (app/[locale]) and the global 404.
 * Its parts translate themselves on the server (lib/i18n/server.ts).
 */
export async function SiteShell({ children, structuredData = true }: { children: ReactNode; structuredData?: boolean }) {
  const t = await getTranslator();
  const switcher = switcherData(t.locale);
  return (
    <>
      <SkipLink />
      <SiteHeader switcher={switcher} />
      <main id="main-content" tabIndex={-1} className={styles.main}>
        {children}
      </main>
      <SiteFooter />
      {switcher ? <LanguageSuggestion offers={switcher.offers} paths={switcher.paths} /> : null}
      {structuredData ? <JsonLd data={siteJsonLdGraph()} /> : null}
    </>
  );
}
