import { DEFAULT_LOCALE, LOCALE_CODES, PSEUDO_LOCALE_CODES } from "./routing.mjs";

/**
 * Locale-aware paths. Pure functions with no server imports — safe for Client
 * Components (the language menu and the language suggestion use them).
 */

export type LocaleCode = "en" | "hi" | "ar" | "ml" | "ta" | "bn";
export type PseudoLocaleCode = "en-XA" | "ar-XB";
export type AnyLocale = LocaleCode | PseudoLocaleCode;

const ALL: readonly string[] = [...LOCALE_CODES, ...PSEUDO_LOCALE_CODES];

export function isAnyLocale(value: unknown): value is AnyLocale {
  return typeof value === "string" && ALL.includes(value);
}

/** The public URL path of `path` (an English path such as "/jobs") in `locale`. */
export function localizedPath(path: string, locale: AnyLocale): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  if (locale === DEFAULT_LOCALE) return clean;
  return clean === "/" ? `/${locale}` : `/${locale}${clean}`;
}

/** Split a browser pathname into its locale and the English path beneath it. */
export function splitLocale(pathname: string): { locale: AnyLocale; path: string } {
  const [, first, ...rest] = pathname.split("/");
  if (first && first !== DEFAULT_LOCALE && isAnyLocale(first)) {
    return { locale: first, path: `/${rest.join("/")}`.replace(/\/+$/, "") || "/" };
  }
  return { locale: DEFAULT_LOCALE as AnyLocale, path: pathname.replace(/\/+$/, "") || "/" };
}
