import type { MetadataRoute } from "next";
import { isNonProductionDeployment } from "@/lib/security-headers.mjs";
import { SITE_URL } from "@/lib/seo";

// Answer-engine / AI crawlers are welcomed alongside the traditional search bots —
// spelled out rather than left to a bare wildcard.
const AI_CRAWLERS = [
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  "Google-Extended",
  "Applebot-Extended",
  "PerplexityBot",
  "Perplexity-User",
  "ClaudeBot",
  "Claude-User",
  "Claude-SearchBot",
  "anthropic-ai",
  "Amazonbot",
  "meta-externalagent",
  "CCBot",
  "cohere-ai",
];

// The staff workspace, the customer portal and the API are never for crawlers.
const PRIVATE = ["/admin", "/portal", "/api/"];

export default function robots(): MetadataRoute.Robots {
  // Staging and previews disallow everything.
  if (isNonProductionDeployment()) return { rules: [{ userAgent: "*", disallow: "/" }] };

  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: PRIVATE },
      ...AI_CRAWLERS.map((userAgent) => ({ userAgent, allow: "/", disallow: PRIVATE })),
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
