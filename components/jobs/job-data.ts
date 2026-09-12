import { openJobs, type Job } from "@/content/jobs";
import { countryName, formatDate, salaryText } from "@/lib/i18n/format";
import type { AnyLocale } from "@/lib/i18n/locales";
import { hrefIn, jobLocales, jobText, type JobText } from "@/lib/i18n/pages";
import type { MessageKey, Translator } from "@/lib/i18n/translator";

/**
 * Server-side preparation of job data for display: every string translated and every
 * fact formatted for the reader's language, so the job components — including the
 * filter island in the browser — receive finished text and never a catalogue.
 */

export const TYPE_KEYS: Record<Job["employmentType"], MessageKey> = {
  "Full-Time": "jobs.type.fullTime",
  "Part-Time": "jobs.type.partTime",
  Contract: "jobs.type.contract",
  Temporary: "jobs.type.temporary",
};

const DAY = 86_400_000;

export function placeOf(job: Job, text: JobText, t: Translator): string {
  const country = countryName(job.country, t.locale);
  return text.city ? t("jobs.place", { city: text.city, country }) : country;
}

/**
 * The apply link for a job. The page is in the reader's language; the job's English
 * title, country and contract travel in the query, because they are data for staff.
 */
export function applyHrefFor(job: Job, locale: AnyLocale): string {
  const query = new URLSearchParams({ job: job.title, country: job.country, type: job.employmentType });
  return `${hrefIn("/jobs/apply", locale)}?${query.toString()}`;
}

/** Open jobs with a page in `locale`, newest first. */
export function jobsIn(locale: AnyLocale, now: Date = new Date()): Job[] {
  return openJobs(undefined, now).filter((j) => jobLocales(j).includes(locale));
}

export interface JobCardData {
  slug: string;
  href: string;
  applyHref: string;
  title: string;
  where: string;
  industry: string;
  type: string;
  salary: string | null;
  posted: string;
  postedISO: string;
  closes: string | null;
  closesISO: string | null;
  isNew: boolean;
  closingSoon: boolean;
  unconfirmed: boolean;
  /** Screen-reader completion of the Apply link: "for Site Supervisor". */
  applyHidden: string;
  /** Filter values: display labels and stable, language-neutral keys. */
  country: string;
  countryKey: string;
  industryKey: string;
  typeKey: string;
}

export interface JobCardText {
  salaryNotStated: string;
  isNew: string;
  closingSoon: string;
  apply: string;
  unconfirmed: string;
}

export function jobCardData(job: Job, t: Translator, now: Date = new Date()): JobCardData {
  const text = jobText(job, t.locale);
  const age = now.getTime() - Date.parse(`${job.postedOn}T00:00:00Z`);
  const closesAt = job.closesOn ? Date.parse(`${job.closesOn}T23:59:59Z`) : null;
  return {
    slug: job.slug,
    href: hrefIn(`/jobs/${job.slug}`, t.locale),
    applyHref: applyHrefFor(job, t.locale),
    title: text.title,
    where: placeOf(job, text, t),
    industry: text.industry,
    type: t(TYPE_KEYS[job.employmentType]),
    salary: job.salary ? salaryText(job.salary, t) : null,
    posted: t("jobs.card.posted", { date: formatDate(job.postedOn, t.locale) }),
    postedISO: job.postedOn,
    closes: job.closesOn ? t("jobs.card.closes", { date: formatDate(job.closesOn, t.locale) }) : null,
    closesISO: job.closesOn,
    isNew: age >= 0 && age <= 7 * DAY,
    closingSoon: closesAt !== null && closesAt >= now.getTime() && closesAt - now.getTime() <= 5 * DAY,
    unconfirmed: job.verification !== "confirmed",
    applyHidden: t("jobs.card.applyHidden", { title: text.title }),
    country: countryName(job.country, t.locale),
    countryKey: job.country,
    industryKey: job.industry,
    typeKey: job.employmentType,
  };
}

export function jobCardText(t: Translator): JobCardText {
  return {
    salaryNotStated: t("jobs.card.salaryNotStated"),
    isNew: t("jobs.card.new"),
    closingSoon: t("jobs.card.closingSoon"),
    apply: t("jobs.card.apply"),
    unconfirmed: t("common.unconfirmed"),
  };
}

/** Up to `limit` other open jobs, the same country or industry first. */
export function relatedJobs(job: Job, locale: AnyLocale, limit = 3): Job[] {
  const score = (j: Job) => (j.country === job.country ? 2 : 0) + (j.industry === job.industry ? 1 : 0);
  return jobsIn(locale)
    .filter((j) => j.slug !== job.slug)
    .sort((a, b) => score(b) - score(a))
    .slice(0, limit);
}
