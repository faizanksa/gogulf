import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { RootDocument } from "@/components/site/RootDocument";
import { SiteShell } from "@/components/site/SiteShell";
import { rootMetadata, ROOT_VIEWPORT } from "@/lib/root-metadata";

/**
 * Root layout of the English public site — the source language, at unprefixed URLs.
 * Other languages have their own root layout in app/[locale], so each page's
 * <html lang dir> is right for its language.
 *
 * Pages not yet rebuilt sit in the (legacy) and (legal) groups, whose layouts load the
 * scoped pre-redesign stylesheet.
 */
export const metadata: Metadata = rootMetadata();
export const viewport: Viewport = ROOT_VIEWPORT;

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <RootDocument locale="en">
      <SiteShell>{children}</SiteShell>
    </RootDocument>
  );
}
