/**
 * Response headers shared by next.config.mjs (every page and asset) and proxy.ts
 * (responses the proxy generates itself for /admin and /portal). Plain JavaScript so
 * next.config.mjs can import it.
 */

export const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self)" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

/** Staging and previews must never be indexed — a crawlable duplicate is an SEO regression. */
export const NOINDEX_HEADER = { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" };

/** Opt-in on an explicit marker, so production and local builds are unaffected. */
export function isNonProductionDeployment(env = process.env) {
  return env.APP_ENV === "staging" || env.VERCEL_ENV === "preview";
}
