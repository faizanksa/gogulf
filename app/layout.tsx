import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "@/styles/tokens.css";
import "@/styles/base.css";
import { isNonProductionDeployment } from "@/lib/security-headers.mjs";
import { DEFAULT_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/seo";
import { fontVariables } from "./fonts";

/**
 * Root layout for every route group: fonts, tokens, base styles and sitewide metadata
 * defaults. The public shell (header, footer, structured data) lives in
 * app/(marketing)/layout.tsx; /admin and /portal have their own.
 */

const nonProduction = isNonProductionDeployment();

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_NAME, template: `%s — ${SITE_NAME}` },
  description: DEFAULT_DESCRIPTION,
  applicationName: SITE_NAME,
  formatDetection: { email: false, address: false, telephone: false },
  openGraph: { siteName: SITE_NAME, type: "website", locale: "en_IN" },
  twitter: { card: "summary_large_image" },
  // Staging and previews are never indexed (also enforced by robots.txt and the
  // X-Robots-Tag header).
  robots: nonProduction
    ? { index: false, follow: false }
    : { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-IN" className={fontVariables}>
      <body>{children}</body>
    </html>
  );
}
