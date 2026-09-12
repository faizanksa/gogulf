import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { RootDocument } from "@/components/site/RootDocument";
import { SiteShell } from "@/components/site/SiteShell";
import { LOCALES, prefixedLocales } from "@/lib/i18n/locales";
import { currentLocale } from "@/lib/i18n/server";
import { rootMetadata, ROOT_VIEWPORT } from "@/lib/root-metadata";

/**
 * Root layout for every language except English: /hi/…, /ar/…, /ml/… — and, outside
 * production, the pseudo-locales /en-XA/… and /ar-XB/…. English keeps its unprefixed URLs
 * in app/(marketing).
 *
 * Only languages whose catalogue is published are built (lib/i18n/catalogs.ts). Today
 * that is none, so production builds no page here and every prefixed URL is a 404.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return prefixedLocales().map((locale) => ({ locale }));
}

export async function generateMetadata(): Promise<Metadata> {
  return rootMetadata(LOCALES[await currentLocale()].ogLocale);
}

export const viewport: Viewport = ROOT_VIEWPORT;

export default async function LocaleLayout({ children }: { children: ReactNode }) {
  return (
    <RootDocument locale={await currentLocale()}>
      <SiteShell>{children}</SiteShell>
    </RootDocument>
  );
}
