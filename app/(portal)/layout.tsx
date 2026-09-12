import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { RootDocument } from "@/components/site/RootDocument";
import { rootMetadata, ROOT_VIEWPORT } from "@/lib/root-metadata";

/**
 * Root layout of the customer portal. English until the portal is localised; the CRM
 * already records each contact's preferred_language for when it is (docs/I18N.md).
 */
export const metadata: Metadata = rootMetadata();
export const viewport: Viewport = ROOT_VIEWPORT;

export default function PortalRootLayout({ children }: { children: ReactNode }) {
  return <RootDocument locale="en">{children}</RootDocument>;
}
