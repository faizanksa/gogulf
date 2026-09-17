import { whatsappLink } from "@/content/channels";
import { countryName, formatDate, salaryText } from "@/lib/i18n/format";
import type { AnyLocale } from "@/lib/i18n/locales";
import { hrefIn, jobLocales, jobText, type JobText } from "@/lib/i18n/pages";
import type { Translator } from "@/lib/i18n/translator";
import { indianDateOf } from "@/lib/jobs/model";
import { listOpenJobs } from "@/lib/jobs/public-data";
import { jobIsFeatured, jobIsOpen, jobUsesOnlineForm, type PublicJob } from "@/lib/jobs/public-job";

/**
 * Server-side preparation of job data for display: every string translated and every
 * fact formatted for the reader's language, so the job components — including the
 * filter island in the browser — receive finished text and never a catalogue.
 *
 * Only what the job states is shown. No badge is derived to create urgency: a closing
 * date is written as a date, never as "closing soon".
 */

export function placeOf(job: PublicJob, text: JobText, t: Translator): string {
  const country = job.countryCode ? countryName(job.countryCode, t.locale) : "";
  if (text.city && country) return t("jobs.place", { city: text.city, country });
  return text.city ?? country;
}

/** The online form for this job. The reference identifies the job; the page looks it up. */
export function applyHrefFor(job: PublicJob, locale: AnyLocale): string {
  return `${hrefIn("/jobs/apply", locale)}?${new URLSearchParams({ ref: job.reference }).toString()}`;
}

/** Where "Apply" goes: the online form, or WhatsApp for jobs taken that way. Null when closed. */
export function applyTargetFor(job: PublicJob, t: Translator, now: Date = new Date()): { href: string; whatsapp: boolean } | null {
  if (!jobIsOpen(job, now)) return null;
  if (jobUsesOnlineForm(job)) return { href: applyHrefFor(job, t.locale), whatsapp: false };
  const text = jobText(job, t.locale);
  return {
    href: whatsappLink(t("jobs.applyMessage", { title: text.title, where: placeOf(job, text, t), reference: job.reference })),
    whatsapp: true,
  };
}

/** Open jobs with a page in `locale`, featured first. */
export async function jobsIn(locale: AnyLocale): Promise<PublicJob[]> {
  if (!jobLocales().includes(locale)) return [];
  return listOpenJobs();
}

export interface JobCardData {
  slug: string;
  href: string;
  reference: string;
  referenceLabel: string;
  apply: { href: string; whatsapp: boolean } | null;
  title: string;
  where: string;
  category: string | null;
  type: string | null;
  salary: string | null;
  /** "Ongoing hiring" or "Apply by 30 Sep 2026". */
  availability: string;
  closesISO: string | null;
  updated: string;
  updatedISO: string;
  featured: boolean;
  professional: boolean;
  free: boolean;
  /** Screen-reader completion of the Apply link: "for Site Supervisor". */
  applyHidden: string;
  /** Filter values: display labels and stable, language-neutral keys. */
  country: string;
  countryKey: string;
  categoryKey: string;
  typeKey: string;
  availabilityKey: "ongoing" | "time_limited";
  /** Lower-cased text the search box matches against. */
  searchText: string;
}

export interface JobCardText {
  salaryNotStated: string;
  featured: string;
  free: string;
  professional: string;
  general: string;
  view: string;
  apply: string;
  applyWhatsApp: string;
  opensWhatsApp: string;
}

export function jobCardData(job: PublicJob, t: Translator, now: Date = new Date()): JobCardData {
  const text = jobText(job, t.locale);
  const updatedISO = indianDateOf(job.updatedAt);
  return {
    slug: job.slug,
    href: hrefIn(`/jobs/${job.slug}`, t.locale),
    reference: job.reference,
    referenceLabel: t("jobs.card.reference", { reference: job.reference }),
    apply: applyTargetFor(job, t, now),
    title: text.title,
    where: placeOf(job, text, t),
    category: text.category,
    type: job.employmentType ? t(`jobs.type.${job.employmentType}`) : null,
    salary: job.salary ? salaryText(job.salary, t) : null,
    availability:
      job.availability === "time_limited" && job.closesOn
        ? t("jobs.card.applyBy", { date: formatDate(job.closesOn, t.locale) })
        : t("jobs.card.ongoing"),
    closesISO: job.availability === "time_limited" ? job.closesOn : null,
    updated: t("jobs.card.updated", { date: formatDate(updatedISO, t.locale) }),
    updatedISO,
    featured: jobIsFeatured(job, now),
    professional: job.classification === "professional",
    free: job.applicationAccess === "free",
    applyHidden: t("jobs.card.applyHidden", { title: text.title }),
    country: job.countryCode ? countryName(job.countryCode, t.locale) : "",
    countryKey: job.countryCode ?? "",
    categoryKey: job.category?.slug ?? "",
    typeKey: job.employmentType ?? "",
    availabilityKey: job.availability,
    searchText: [text.title, text.category, job.reference, placeOf(job, text, t)].filter(Boolean).join(" ").toLowerCase(),
  };
}

export function jobCardText(t: Translator): JobCardText {
  return {
    salaryNotStated: t("jobs.card.salaryNotStated"),
    featured: t("jobs.card.featured"),
    free: t("jobs.card.free"),
    professional: t("jobs.card.professional"),
    general: t("jobs.card.general"),
    view: t("jobs.card.view"),
    apply: t("jobs.card.apply"),
    applyWhatsApp: t("jobs.card.applyWhatsApp"),
    opensWhatsApp: t("common.opensWhatsApp"),
  };
}

/** Up to `limit` other open jobs: the same category, then country, then classification. */
export async function relatedJobs(job: PublicJob, locale: AnyLocale, limit = 3): Promise<PublicJob[]> {
  const score = (j: PublicJob) =>
    (j.category?.slug && j.category.slug === job.category?.slug ? 4 : 0) +
    (j.countryCode === job.countryCode ? 2 : 0) +
    (j.classification === job.classification ? 1 : 0);
  return (await jobsIn(locale))
    .filter((j) => j.id !== job.id)
    .sort((a, b) => score(b) - score(a))
    .slice(0, limit);
}
