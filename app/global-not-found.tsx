import type { Metadata } from "next";
import { NotFoundContent } from "@/components/site/NotFoundContent";
import { RootDocument } from "@/components/site/RootDocument";
import { SiteShell } from "@/components/site/SiteShell";
import { SITE_NAME, SITE_URL } from "@/lib/seo";

/**
 * A URL that matches no route. The app has several root layouts — English, the other
 * languages, /admin, /portal — so there is no single layout for Next to compose a 404
 * from; this file renders the whole document itself (experimental.globalNotFound in
 * next.config.mjs). English, because an unmatched URL carries no language.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: `Page not found — ${SITE_NAME}`,
  robots: { index: false, follow: true },
};

export default function GlobalNotFound() {
  return (
    <RootDocument locale="en">
      <SiteShell structuredData={false}>
        <NotFoundContent />
      </SiteShell>
    </RootDocument>
  );
}
