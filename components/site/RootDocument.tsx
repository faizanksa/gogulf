import type { ReactNode } from "react";
import "@/styles/tokens.css";
import "@/styles/base.css";
import { fontVariables } from "@/app/fonts";
import { LOCALES, type AnyLocale } from "@/lib/i18n/locales";

/**
 * The <html> and <body> of every root layout. `lang` and `dir` come from the locale
 * registry, so an Arabic page is right-to-left at the document level: the browser, screen
 * readers and every logical CSS property follow it, not just a wrapper inside the page.
 */
export function RootDocument({ locale, children }: { locale: AnyLocale; children: ReactNode }) {
  const { tag, dir } = LOCALES[locale];
  return (
    <html lang={tag} dir={dir} className={fontVariables}>
      <body>{children}</body>
    </html>
  );
}
