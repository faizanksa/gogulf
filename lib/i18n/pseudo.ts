import type { PseudoLocaleCode } from "./paths";

/**
 * Pseudo-localisation — the standard way to test i18n without real translations
 * (Android and Chromium ship the same two pseudo-locales).
 *
 *   en-XA  accented and lengthened by about 30%, in brackets: shows hard-coded strings
 *          (they stay plain), text that gets cut off, and layouts that break when a
 *          language runs longer than English.
 *   ar-XB  wrapped in a right-to-left override, on a dir="rtl" page: shows whether the
 *          layout truly mirrors — alignment, spacing, icons and reading order.
 *
 * Never shipped to production (lib/i18n/locales.ts), never in hreflang or the sitemap.
 */

const ACCENTS: Record<string, string> = {
  a: "á", b: "ƀ", c: "ç", d: "ð", e: "é", f: "ƒ", g: "ĝ", h: "ĥ", i: "î", j: "ĵ", k: "ķ", l: "ļ", m: "ɱ",
  n: "ñ", o: "ö", p: "þ", q: "ǫ", r: "ŕ", s: "š", t: "ţ", u: "û", v: "ṽ", w: "ŵ", x: "ẋ", y: "ý", z: "ž",
  A: "Á", B: "Ɓ", C: "Ç", D: "Ð", E: "É", F: "Ƒ", G: "Ĝ", H: "Ĥ", I: "Î", J: "Ĵ", K: "Ķ", L: "Ļ", M: "Ṁ",
  N: "Ñ", O: "Ö", P: "Þ", Q: "Ǫ", R: "Ŕ", S: "Š", T: "Ţ", U: "Û", V: "Ṽ", W: "Ŵ", X: "Ẋ", Y: "Ý", Z: "Ž",
};

const RLO = "‮"; // right-to-left override
const PDF = "‬"; // pop directional formatting

export function pseudoLocalize(text: string, locale: PseudoLocaleCode): string {
  if (text.trim() === "") return text;
  if (locale === "ar-XB") return `${RLO}${text}${PDF}`;
  const accented = Array.from(text, (ch) => ACCENTS[ch] ?? ch).join("");
  // The padding breaks like words (runs of up to six), because real translations grow
  // longer in words, not in one unbreakable token.
  const length = Math.max(1, Math.round(text.length * 0.3));
  const padding = Array.from({ length: Math.ceil(length / 6) }, (_, i) => "~".repeat(Math.min(6, length - i * 6))).join(" ");
  return `[${accented} ${padding}]`;
}
