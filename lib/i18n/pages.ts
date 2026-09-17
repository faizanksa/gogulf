import { PAGES, type PageEntry } from "@/content/pages";
import type { PublicJob } from "@/lib/jobs/public-job";
import type { Service } from "@/content/services";
import { CATALOGS, lookup } from "./catalogs";
import { activeLocales, DEFAULT, isPseudo, localizedPath, type AnyLocale, type LocaleCode } from "./locales";
import { pseudoLocalize } from "./pseudo";

/**
 * Which pages exist in which language on this deployment, their words in each, and
 * where links should point.
 *
 * A page is available in a language when the language is active (its catalogue is
 * published, or it is a pseudo-locale outside production) AND the page's own words exist
 * in it: a localizable registry page whose `locales` lists the language. Pseudo-locales
 * get every localizable page, for testing.
 *
 * Jobs come from the database and are written in English. Until a reviewed translation
 * of a job can be stored (a job_translations table, docs/I18N.md), a job page exists in
 * English — and in the pseudo-locales outside production, so right-to-left layout stays
 * testable. No listing is ever machine-translated.
 */

export function pageLocales(entry: PageEntry): AnyLocale[] {
  return activeLocales().filter(
    (l) => l === DEFAULT || (entry.localizable && (isPseudo(l) || entry.locales.includes(l as LocaleCode))),
  );
}

/** Languages a job page exists in. Knowing the job is not needed while no job has a translation. */
export function jobLocales(): AnyLocale[] {
  return activeLocales().filter((l) => l === DEFAULT || isPseudo(l));
}

const JOB_PATH = /^\/jobs\/([^/]+)$/;

/** Languages an English path is available in, English first. Unknown paths: English only. */
export function pathLocales(path: string): AnyLocale[] {
  const entry = PAGES.find((p) => p.path === path);
  if (entry) return pageLocales(entry);
  // Whether the job exists is the job page's own question (it 404s); which languages a
  // job page is written in does not depend on the job yet.
  return JOB_PATH.test(path) ? jobLocales() : [DEFAULT];
}

export function isAvailableIn(path: string, locale: AnyLocale): boolean {
  return pathLocales(path).includes(locale);
}

/**
 * The href for a link to `path` (an English path, optionally with a #fragment) from a page
 * in `locale`: that language's version when it exists, otherwise the English page.
 */
export function hrefIn(path: string, locale: AnyLocale): string {
  if (locale === DEFAULT) return path;
  const [pathname = "/", fragment] = path.split("#");
  const target = isAvailableIn(pathname, locale) ? localizedPath(pathname, locale) : pathname;
  return fragment === undefined ? target : `${target}#${fragment}`;
}

/**
 * Every English path available in more than one language, with those languages. The
 * language menu runs in the browser, where it knows the current path but not the
 * registry, so the server hands it this map. Empty while English is the only active
 * language — production today — and then no menu is rendered at all.
 */
export function multilingualPaths(): Record<string, AnyLocale[]> {
  const out: Record<string, AnyLocale[]> = {};
  for (const entry of PAGES) {
    const langs = pageLocales(entry);
    if (langs.length > 1) out[entry.path] = langs;
  }
  // Job pages are not listed: jobs are English-only today, so no real language menu
  // could offer one. (Pseudo-locale job pages remain reachable by URL for testing.)
  return out;
}

export interface PageText {
  title: string;
  description: string;
  breadcrumb: string;
  absoluteTitle?: string;
}

/** A registered page's title, description and breadcrumb in `locale`. */
export function pageText(entry: PageEntry, locale: AnyLocale): PageText {
  const { title, description, breadcrumb, absoluteTitle } = entry;
  if (locale === DEFAULT) return { title, description, breadcrumb, absoluteTitle };
  if (isPseudo(locale)) {
    const p = (s: string) => pseudoLocalize(s, locale);
    return { title: p(title), description: p(description), breadcrumb: p(breadcrumb), absoluteTitle: absoluteTitle && p(absoluteTitle) };
  }
  const field = (name: string) => lookup(CATALOGS[locale], `pages.${entry.id}.${name}`);
  const text = { title: field("title"), description: field("description"), breadcrumb: field("breadcrumb") };
  if (!text.title || !text.description || !text.breadcrumb) {
    throw new Error(`messages/${locale}.json has no complete pages.${entry.id} entry, but content/pages.ts lists ${locale} for ${entry.path}`);
  }
  return { title: text.title, description: text.description, breadcrumb: text.breadcrumb, absoluteTitle: field("absoluteTitle") };
}

export interface ServiceText {
  name: string;
  summary: string;
}

/**
 * A service's name and summary in `locale`. The English source lives in
 * content/services.ts (like page titles in the registry); other languages add
 * services.items.<id>.name / .summary to their catalogue. A published catalogue must
 * carry every service (i18n.test.ts), so the English fallback only serves drafts.
 */
export function serviceText(service: Service, locale: AnyLocale): ServiceText {
  if (locale === DEFAULT) return { name: service.name, summary: service.summary };
  if (isPseudo(locale)) return { name: pseudoLocalize(service.name, locale), summary: pseudoLocalize(service.summary, locale) };
  const field = (name: string) => lookup(CATALOGS[locale], `services.items.${service.id}.${name}`);
  return { name: field("name") ?? service.name, summary: field("summary") ?? service.summary };
}

/** The words a person wrote for a job — the only parts of a listing that are ever translated. */
export interface JobText {
  title: string;
  summary: string | null;
  category: string | null;
  city: string | null;
  experience: string | null;
  education: string | null;
  languages: string | null;
  responsibilities: string[];
  requirements: string[];
  benefits: string[];
  additionalInfo: string | null;
}

/** A job's words in `locale`: pseudo-localised English for testing, otherwise the English. */
export function jobText(job: PublicJob, locale: AnyLocale): JobText {
  const english: JobText = {
    title: job.title,
    summary: job.summary,
    category: job.category?.name ?? null,
    city: job.city,
    experience: job.experience,
    education: job.education,
    languages: job.languages,
    responsibilities: job.responsibilities,
    requirements: job.requirements,
    benefits: job.benefits,
    additionalInfo: job.additionalInfo,
  };
  if (!isPseudo(locale)) return english;
  const p = (s: string) => pseudoLocalize(s, locale);
  const pn = (s: string | null) => (s === null ? null : p(s));
  return {
    title: p(english.title),
    summary: pn(english.summary),
    category: pn(english.category),
    city: pn(english.city),
    experience: pn(english.experience),
    education: pn(english.education),
    languages: pn(english.languages),
    responsibilities: english.responsibilities.map(p),
    requirements: english.requirements.map(p),
    benefits: english.benefits.map(p),
    additionalInfo: pn(english.additionalInfo),
  };
}
