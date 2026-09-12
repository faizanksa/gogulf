import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { RootDocument } from "@/components/site/RootDocument";
import { rootMetadata, ROOT_VIEWPORT } from "@/lib/root-metadata";

/** Root layout of the staff area. English until the staff workspace is localised. */
export const metadata: Metadata = rootMetadata();
export const viewport: Viewport = ROOT_VIEWPORT;

export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return <RootDocument locale="en">{children}</RootDocument>;
}
