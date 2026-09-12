import { COUNTRY_CODES, type Job } from "@/content/jobs";
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

/** A job's country in `locale`, from the Unicode CLDR names built into the runtime — not a hand translation. */
export function countryName(country: Job["country"], locale: AnyLocale): string {
  if (locale === DEFAULT) return country;
  if (isPseudo(locale)) return pseudoLocalize(country, locale);
  return new Intl.DisplayNames([LOCALES[locale].tag], { type: "region" }).of(COUNTRY_CODES[country]) ?? country;
}

/** "SAR 3,500 – 4,500 / month" in the translator's language. The currency code is never translated. */
export function salaryText(salary: NonNullable<Job["salary"]>, t: Translator): string {
  return t("jobs.salaryRange", {
    currency: salary.currency,
    min: formatNumber(salary.min, t.locale),
    max: formatNumber(salary.max, t.locale),
    period: t(`jobs.perUnit.${salary.period}`),
  });
}
