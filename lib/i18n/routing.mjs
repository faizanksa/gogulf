/**
 * Locale routing constants — plain JavaScript so next.config.mjs can import them.
 * lib/i18n/locales.ts is the typed registry built on these codes; a unit test keeps the
 * two in step.
 *
 * URL scheme
 *   English, the source language, has NO prefix: /jobs, /verify, /jobs/<slug>. Those
 *   pages stay in app/(marketing), exactly as before: no rewrite, no proxy, no redirect.
 *   Other languages are prefixed: /hi/verify, /ar/jobs/<slug>. They live under
 *   app/[locale], a second root layout (so <html lang dir> is right for each language),
 *   and are built only for published languages, plus pseudo-locales outside production.
 *   /en and /en/... are never public URLs; they redirect to the unprefixed path.
 */

export const DEFAULT_LOCALE = "en";

/** Every language the architecture knows, in the order the language menu lists them. */
export const LOCALE_CODES = ["en", "hi", "ar", "ml", "ta", "bn"];

/**
 * Test-only pseudo-locales, generated from English: en-XA (accented, lengthened) and
 * ar-XB (mirrored right-to-left). Built on staging and local builds only — never in
 * production, hreflang or the sitemap.
 */
export const PSEUDO_LOCALE_CODES = ["en-XA", "ar-XB"];

/** English is canonical without a prefix, so /en and /en/... redirect permanently. */
export function localeRedirects() {
  return [
    { source: `/${DEFAULT_LOCALE}`, destination: "/", permanent: true },
    { source: `/${DEFAULT_LOCALE}/:path*`, destination: "/:path*", permanent: true },
  ];
}
