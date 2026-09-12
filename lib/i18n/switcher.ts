import { activeLocales, isPseudo, LOCALES, type AnyLocale } from "./locales";
import { multilingualPaths } from "./pages";
import { createTranslator } from "./translator";

/**
 * What the two language islands need from the server (components/site/LanguageMenu,
 * LanguageSuggestion). They run in the browser, which knows the current path but not the
 * registry or the catalogues, so they receive finished strings and a small map of which
 * paths exist in which language — never a catalogue.
 *
 * null while only one language is active (production today): neither island renders. Their
 * code is still in the shared bundle (about 1.2 KB gzip; docs/I18N.md).
 */

export interface LanguageOption {
  code: AnyLocale;
  tag: string;
  dir: "ltr" | "rtl";
  autonym: string;
}

/** An offer to read the page in another language, written in that language. */
export interface LanguageOffer extends LanguageOption {
  message: string;
  action: string;
  dismiss: string;
  label: string;
  /** Real languages may be suggested from the browser's settings; pseudo-locales only when chosen. */
  detectable: boolean;
}

export interface SwitcherData {
  options: LanguageOption[];
  paths: Record<string, AnyLocale[]>;
  offers: LanguageOffer[];
}

export function switcherData(current: AnyLocale): SwitcherData | null {
  const locales = activeLocales();
  if (locales.length < 2) return null;
  const paths = multilingualPaths();
  if (Object.keys(paths).length === 0) return null;

  const options = locales.map((code) => ({ code, tag: LOCALES[code].tag, dir: LOCALES[code].dir, autonym: LOCALES[code].autonym }));
  const offers = options
    .filter((o) => o.code !== current)
    .map((o) => {
      const t = createTranslator(o.code);
      return {
        ...o,
        message: t("language.suggestion", { language: o.autonym }),
        action: t("language.switchAction", { language: o.autonym }),
        dismiss: t("language.dismiss"),
        label: t("language.menuLabel"),
        detectable: !isPseudo(o.code),
      };
    });
  return { options, paths, offers };
}
