import { SITE_NAME, SITE_TAGLINE } from "@/lib/seo";

// Required for `output: 'export'` — without this Next.js can't tell the route
// is static and the build fails.
export const dynamic = "force-static";

export default function manifest() {
  return {
    name: `${SITE_NAME} — ${SITE_TAGLINE}`,
    short_name: SITE_NAME,
    description:
      "Overseas recruitment platform connecting candidates with verified Gulf employers across Saudi Arabia, UAE, Qatar, Oman, Kuwait and Bahrain.",
    start_url: "/",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: "#1C9D4A",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
