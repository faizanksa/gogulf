"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { localizedPath, splitLocale, type AnyLocale } from "@/lib/i18n/paths";
import { dismissSuggestions, readPreferredLocale, rememberLocale, suggestionsDismissed } from "@/lib/i18n/preference";
import type { LanguageOffer } from "@/lib/i18n/switcher";
import styles from "./LanguageSuggestion.module.css";

/** The first real language in the browser's preferences that we offer ("hi-IN" → "hi"). */
function browserChoice(offers: LanguageOffer[]): string | null {
  for (const tag of navigator.languages ?? [navigator.language]) {
    const base = tag.toLowerCase().split("-")[0];
    const match = offers.find((o) => o.detectable && o.code === base);
    if (match) return match.code;
  }
  return null;
}

/**
 * Suggests the current page in the reader's language — never redirects. The language is
 * the one they chose in the language menu, otherwise the first one in their browser
 * settings that this page exists in. The offer is written in that language, sits in a
 * fixed corner (so it moves no content: no layout shift), and can be dismissed for good.
 */
export function LanguageSuggestion({ offers, paths }: { offers: LanguageOffer[]; paths: Record<string, AnyLocale[]> }) {
  const pathname = usePathname();
  const [offer, setOffer] = useState<LanguageOffer | null>(null);

  useEffect(() => {
    const { locale, path } = splitLocale(pathname);
    const available = paths[path] ?? [];
    const wanted = readPreferredLocale() ?? browserChoice(offers);
    const next =
      !suggestionsDismissed() && wanted && wanted !== locale && available.includes(wanted as AnyLocale)
        ? (offers.find((o) => o.code === wanted) ?? null)
        : null;
    // The browser's language and storage exist only after hydration, so the offer is
    // decided here rather than during render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOffer(next);
  }, [pathname, offers, paths]);

  if (!offer) return null;
  const { path } = splitLocale(pathname);

  return (
    <aside className={styles.offer} aria-label={offer.label} lang={offer.tag} dir={offer.dir}>
      <p className={styles.message}>{offer.message}</p>
      <div className={styles.actions}>
        <a href={localizedPath(path, offer.code)} hrefLang={offer.tag} className={styles.switch} onClick={() => rememberLocale(offer.code)}>
          {offer.action}
        </a>
        <button
          type="button"
          className={styles.dismiss}
          onClick={() => {
            dismissSuggestions();
            setOffer(null);
          }}
        >
          {offer.dismiss}
        </button>
      </div>
    </aside>
  );
}
