import { deploymentStage, showsUnconfirmedContent, type DeploymentStage } from "@/lib/deployment";
import { isCatalogPublished } from "./catalogs";
import { localizedPath, type AnyLocale, type LocaleCode, type PseudoLocaleCode } from "./paths";
import { DEFAULT_LOCALE, LOCALE_CODES, PSEUDO_LOCALE_CODES } from "./routing.mjs";

export { isAnyLocale, localizedPath, splitLocale } from "./paths";
export type { AnyLocale, LocaleCode, PseudoLocaleCode } from "./paths";

/**
 * The language registry. See docs/I18N.md for the full model.
 *
 *   tier     source   English — every string is written here first
 *            primary  approved for launch now (Hindi, Arabic, Malayalam)
 *            later    planned (Tamil, Bengali); adding one is a registry entry + a catalogue
 *            pseudo   generated from English for testing; never in production
 *
 * A language's routes are built only when its catalogue is published (a recorded native
 * review — lib/i18n/catalogs.ts). Until then it exists in the architecture, not on the site.
 */

export interface LocaleDef {
  code: AnyLocale;
  /** BCP 47 tag for <html lang>, hreflang and Intl formatting. */
  tag: string;
  dir: "ltr" | "rtl";
  /** The language's own name, as the language menu shows it. */
  autonym: string;
  englishName: string;
  /** ISO 15924 script — decides the font stack. */
  script: "Latn" | "Deva" | "Arab" | "Mlym" | "Taml" | "Beng";
  ogLocale: string;
  tier: "source" | "primary" | "later" | "pseudo";
}

export const LOCALES: Record<AnyLocale, LocaleDef> = {
  en: { code: "en", tag: "en-IN", dir: "ltr", autonym: "English", englishName: "English", script: "Latn", ogLocale: "en_IN", tier: "source" },
  hi: { code: "hi", tag: "hi-IN", dir: "ltr", autonym: "हिन्दी", englishName: "Hindi", script: "Deva", ogLocale: "hi_IN", tier: "primary" },
  ar: { code: "ar", tag: "ar", dir: "rtl", autonym: "العربية", englishName: "Arabic", script: "Arab", ogLocale: "ar_AR", tier: "primary" },
  ml: { code: "ml", tag: "ml-IN", dir: "ltr", autonym: "മലയാളം", englishName: "Malayalam", script: "Mlym", ogLocale: "ml_IN", tier: "primary" },
  ta: { code: "ta", tag: "ta-IN", dir: "ltr", autonym: "தமிழ்", englishName: "Tamil", script: "Taml", ogLocale: "ta_IN", tier: "later" },
  bn: { code: "bn", tag: "bn-IN", dir: "ltr", autonym: "বাংলা", englishName: "Bengali", script: "Beng", ogLocale: "bn_IN", tier: "later" },
  "en-XA": { code: "en-XA", tag: "en-XA", dir: "ltr", autonym: "[Ƥšéûðö Éñĝļîšĥ]", englishName: "Pseudo-English (test)", script: "Latn", ogLocale: "en_XA", tier: "pseudo" },
  "ar-XB": { code: "ar-XB", tag: "ar-XB", dir: "rtl", autonym: "Pseudo-RTL (test)", englishName: "Pseudo right-to-left (test)", script: "Latn", ogLocale: "ar_XB", tier: "pseudo" },
};

export const DEFAULT: LocaleCode = DEFAULT_LOCALE as LocaleCode;

export function isPseudo(locale: AnyLocale): locale is PseudoLocaleCode {
  return LOCALES[locale].tier === "pseudo";
}

/** Real languages whose catalogue is published. English always; the rest after review. */
export function publishedLocales(): LocaleCode[] {
  return (LOCALE_CODES as LocaleCode[]).filter((code) => isCatalogPublished(code));
}

/** Languages this deployment builds routes for: published ones, plus pseudo-locales outside production. */
export function activeLocales(stage: DeploymentStage = deploymentStage()): AnyLocale[] {
  return [...publishedLocales(), ...(showsUnconfirmedContent(stage) ? (PSEUDO_LOCALE_CODES as PseudoLocaleCode[]) : [])];
}

/** Languages served under a URL prefix (app/[locale]): every active one except English. */
export function prefixedLocales(stage: DeploymentStage = deploymentStage()): AnyLocale[] {
  return activeLocales(stage).filter((l) => l !== DEFAULT);
}

export function isActiveLocale(value: unknown, stage: DeploymentStage = deploymentStage()): value is AnyLocale {
  return typeof value === "string" && (activeLocales(stage) as string[]).includes(value);
}

/**
 * hreflang alternates for a page available in `locales`. Pseudo-locales never appear, and
 * nothing is emitted for a single-language page (a self-only hreflang set adds nothing).
 * x-default points at English, the canonical language.
 */
export function hreflangAlternates(path: string, locales: readonly AnyLocale[]): Record<string, string> | undefined {
  const real = locales.filter((l) => !isPseudo(l));
  if (real.length < 2) return undefined;
  const languages: Record<string, string> = {};
  for (const l of real) languages[LOCALES[l].tag] = localizedPath(path, l);
  languages["x-default"] = localizedPath(path, DEFAULT);
  return languages;
}
