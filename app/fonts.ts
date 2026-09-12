import { Anek_Devanagari, Anek_Latin, IBM_Plex_Mono, Mukta } from "next/font/google";

/**
 * Self-hosted typefaces (next/font downloads them at build and serves them from our
 * own domain — no request to Google at run time).
 *
 *   Display  Anek (Ek Type, Mumbai) — variable weight
 *   Body/UI  Mukta (Ek Type) — 400 and 600
 *   Data     IBM Plex Mono — salaries, references, identifiers, dates only
 *
 * Font budget (docs/REDESIGN-PLAN.md §13: ≤ 120 KB, two families preloaded). Phase 2B
 * measured 145 KB preloaded, most of it Anek's width axis. 2C loads Anek with its
 * weight axis only, and Mukta with two weights: bold text uses 600 (tokens
 * --weight-bold), so the browser never fakes a bold.
 *
 * Devanagari: Anek and Mukta each have a Devanagari face, declared as separate,
 * non-preloaded families that the stacks in styles/tokens.css fall back to. Latin-only
 * pages never download them (each @font-face carries a unicode-range).
 *
 * Other scripts (docs/I18N.md): each language's face is added with its first reviewed
 * catalogue — Noto Sans Arabic, Anek Malayalam, Anek Tamil, Anek Bangla — never before,
 * because every declared family puts its @font-face rules in the CSS of every page
 * (Arabic and Malayalam together measured 1.5 KB gzip). Declare it here non-preloaded,
 * with adjustFontFallback: false when it leads a stack, and add its :lang() stack in
 * styles/tokens.css in the same change.
 */

// `optional`, not `swap`, for the display face (2C final pass): with `swap` the hero
// heading — the home page's largest element — was repainted when Anek arrived, so LCP
// waited for the font (4.7 s on Lighthouse's slow 4G). With `optional` the heading
// paints at once; Anek is used if it arrives within the block period (it is preloaded,
// and cached for every later page), otherwise the metric-matched fallback stays for
// that page view. No layout shift either way: next/font sizes the fallback to Anek.
export const anekLatin = Anek_Latin({
  subsets: ["latin"],
  variable: "--font-anek",
  display: "optional",
});

export const anekDevanagari = Anek_Devanagari({
  subsets: ["devanagari"],
  variable: "--font-anek-deva",
  display: "swap",
  preload: false,
});

export const mukta = Mukta({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-mukta",
  display: "swap",
});

export const muktaDevanagari = Mukta({
  subsets: ["devanagari"],
  weight: ["400", "600"],
  variable: "--font-mukta-deva",
  display: "swap",
  preload: false,
});

export const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
  preload: false,
});

/** Class names that declare the font CSS variables; applied to <html>. */
export const fontVariables = [anekLatin, anekDevanagari, mukta, muktaDevanagari, plexMono]
  .map((f) => f.variable)
  .join(" ");
