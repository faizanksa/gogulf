import { SITE_URL } from "@/lib/seo";

// Answer-engine / AI crawlers explicitly welcomed alongside the traditional
// search bots — Go Gulf wants to be discoverable both in classic search and
// in AI assistants (ChatGPT, Perplexity, Claude, Gemini, etc.), so these are
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

// Required for `output: 'export'` — without this Next.js can't tell the route
// is static and the build fails.
export const dynamic = "force-static";

// Staging and preview builds disallow everything, so a public staging domain
// is never indexed as a duplicate of gogulf.co. Opt-in on an explicit marker:
// production and local builds produce exactly the robots.txt they always have.
const isNonProductionDeployment =
  process.env.APP_ENV === "staging" || process.env.VERCEL_ENV === "preview";

export default function robots() {
  if (isNonProductionDeployment) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  return {
    rules: [
      { userAgent: "*", allow: "/" },
      ...AI_CRAWLERS.map((userAgent) => ({ userAgent, allow: "/" })),
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
