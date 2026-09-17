import { countryNameOf } from "@/lib/jobs/model";
import type { PublicJob } from "@/lib/jobs/public-job";
import { DEFAULT, isPseudo, LOCALES, type AnyLocale } from "./locales";
import { pseudoLocalize } from "./pseudo";
import type { Translator } from "./translator";

/**
 * Locale-aware writing of language-neutral facts: dates, numbers, countries, salaries.
 * The stored value never changes, only how it is written. Pseudo-locales format as English
 * and then transform, like their strings.
 *
 * Digits: salaries, dates and references use Western digits in every language — what Gulf
 * job advertisements and Indian documents use. If the Arabic reviewer prefers
 * Arabic-Indic digits, that is this one setting.
 */

const NUMBERING = { numberingSystem: "latn" } as const;

function formatTag(locale: AnyLocale): string {
  return isPseudo(locale) ? LOCALES[DEFAULT].tag : LOCALES[locale].tag;
}

export function formatDate(iso: string, locale: AnyLocale): string {
  const out = new Intl.DateTimeFormat(formatTag(locale), { day: "numeric", month: "short", year: "numeric", timeZone: "UTC", ...NUMBERING }).format(
    new Date(`${iso}T00:00:00Z`),
  );
  return isPseudo(locale) ? pseudoLocalize(out, locale) : out;
}

export function formatNumber(value: number, locale: AnyLocale): string {
  return new Intl.NumberFormat(formatTag(locale), NUMBERING).format(value);
}

/**
 * A country (by ISO 3166-1 code) in `locale`, from the Unicode CLDR names built into the
 * runtime — not a hand translation. English uses the names the business uses.
 */
export function countryName(code: string, locale: AnyLocale): string {
  const english = countryNameOf(code) ?? code;
  if (locale === DEFAULT) return english;
  if (isPseudo(locale)) return pseudoLocalize(english, locale);
  return new Intl.DisplayNames([LOCALES[locale].tag], { type: "region" }).of(code) ?? english;
}

/** "SAR 3,500 – 4,500 / month" in the translator's language. The currency code is never translated. */
export function salaryText(salary: NonNullable<PublicJob["salary"]>, t: Translator): string {
  return t("jobs.salaryRange", {
    currency: salary.currency,
    min: formatNumber(salary.min, t.locale),
    max: formatNumber(salary.max, t.locale),
    period: t(`jobs.perUnit.${salary.period}`),
  });
}
