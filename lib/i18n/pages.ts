import { getJob, reviewedTranslation, visibleJobs, type Job } from "@/content/jobs";
import { PAGES, type PageEntry } from "@/content/pages";
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
 * in it: a localizable registry page whose `locales` lists the language, or a job with a
 * reviewed translation. Pseudo-locales get every localizable page, for testing.
 */

export function pageLocales(entry: PageEntry): AnyLocale[] {
  return activeLocales().filter(
    (l) => l === DEFAULT || (entry.localizable && (isPseudo(l) || entry.locales.includes(l as LocaleCode))),
  );
}

export function jobLocales(job: Job): AnyLocale[] {
  return activeLocales().filter((l) => l === DEFAULT || isPseudo(l) || reviewedTranslation(job, l) !== null);
}

const JOB_PATH = /^\/jobs\/([^/]+)$/;

/** Languages an English path is available in, English first. Unknown paths: English only. */
export function pathLocales(path: string): AnyLocale[] {
  const entry = PAGES.find((p) => p.path === path);
  if (entry) return pageLocales(entry);
  const slug = JOB_PATH.exec(path)?.[1];
  const job = slug ? getJob(slug) : null;
  return job ? jobLocales(job) : [DEFAULT];
}

/** Job slugs with a page in `locale` — generateStaticParams for app/[locale]/jobs/[slug]. */
export function jobSlugsIn(locale: AnyLocale): string[] {
  return visibleJobs()
    .filter((j) => jobLocales(j).includes(locale))
    .map((j) => j.slug);
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
  for (const job of visibleJobs()) {
    const langs = jobLocales(job);
    if (langs.length > 1) out[`/jobs/${job.slug}`] = langs;
  }
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

export interface JobText {
  title: string;
  summary: string;
  industry: string;
  city?: string;
  experience?: string;
  requirements: string[];
  benefits: string[];
}

/** A job's words in `locale`: its reviewed translation, pseudo-localised English for testing, or the English. */
export function jobText(job: Job, locale: AnyLocale): JobText {
  const english: JobText = {
    title: job.title,
    summary: job.summary,
    industry: job.industry,
    city: job.city,
    experience: job.experience,
    requirements: job.requirements,
    benefits: job.benefits,
  };
  if (locale === DEFAULT) return english;
  if (isPseudo(locale)) {
    const p = (s: string) => pseudoLocalize(s, locale);
    return {
      title: p(job.title),
      summary: p(job.summary),
      industry: p(job.industry),
      city: job.city && p(job.city),
      experience: job.experience && p(job.experience),
      requirements: job.requirements.map(p),
      benefits: job.benefits.map(p),
    };
  }
  const tr = reviewedTranslation(job, locale);
  if (!tr) return english;
  // content/jobs.ts guarantees a reviewed translation carries every list entry and the experience line.
  return {
    title: tr.title,
    summary: tr.summary,
    industry: tr.industry ?? job.industry,
    city: tr.city ?? job.city,
    experience: tr.experience ?? job.experience,
    requirements: tr.requirements,
    benefits: tr.benefits,
  };
}
