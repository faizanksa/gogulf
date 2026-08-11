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

export default function robots() {
  return {
    rules: [
      { userAgent: "*", allow: "/" },
      ...AI_CRAWLERS.map((userAgent) => ({ userAgent, allow: "/" })),
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
