import { Anek_Devanagari, Anek_Latin, IBM_Plex_Mono, Mukta } from "next/font/google";

/**
 * Self-hosted typefaces (next/font downloads them at build and serves them from our
 * own domain — no request to Google at run time).
 *
 *   Display  Anek (Ek Type, Mumbai) — variable weight + width
 *   Body/UI  Mukta (Ek Type)
 *   Data     IBM Plex Mono — salaries, references, dates only
 *
 * Devanagari: Anek and Mukta each have a Devanagari face. They are declared as
 * separate, non-preloaded families that the stacks in styles/tokens.css fall back to,
 * so Hindi text renders in the brand faces while Latin-only pages never download a
 * Devanagari file (each @font-face carries a unicode-range).
 *
 * Other scripts (docs/I18N.md): each language's face is added with its first reviewed
 * catalogue — Noto Sans Arabic, Anek Malayalam, Anek Tamil, Anek Bangla — never before,
 * because every declared family puts its @font-face rules in the CSS of every page
 * (Arabic and Malayalam together measured 1.5 KB gzip). Declare it here non-preloaded,
 * with adjustFontFallback: false when it leads a stack, and add its :lang() stack in
 * styles/tokens.css in the same change.
 */

export const anekLatin = Anek_Latin({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-anek",
  display: "swap",
});

export const anekDevanagari = Anek_Devanagari({
  subsets: ["devanagari"],
  axes: ["wdth"],
  variable: "--font-anek-deva",
  display: "swap",
  preload: false,
});

export const mukta = Mukta({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-mukta",
  display: "swap",
});

export const muktaDevanagari = Mukta({
  subsets: ["devanagari"],
  weight: ["400", "600", "700"],
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
