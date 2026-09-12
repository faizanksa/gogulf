import type { Metadata, Viewport } from "next";
import { isNonProductionDeployment } from "@/lib/security-headers.mjs";
import { DEFAULT_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/seo";

/**
 * Sitewide metadata defaults. Every root layout exports them — the English public site
 * (app/(marketing)), the other languages (app/[locale]), /admin and /portal — so splitting
 * the app into several root layouts changes nothing a browser or crawler sees.
 */
export function rootMetadata(ogLocale = "en_IN"): Metadata {
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: SITE_NAME, template: `%s — ${SITE_NAME}` },
    description: DEFAULT_DESCRIPTION,
    applicationName: SITE_NAME,
    formatDetection: { email: false, address: false, telephone: false },
    openGraph: { siteName: SITE_NAME, type: "website", locale: ogLocale },
    twitter: { card: "summary_large_image" },
    // Staging and previews are never indexed (also enforced by robots.txt and the
    // X-Robots-Tag header).
    robots: isNonProductionDeployment()
      ? { index: false, follow: false }
      : { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
  };
}

export const ROOT_VIEWPORT: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};
