import type { Metadata } from "next";
import { notFound } from "next/navigation";
import JsonLd from "@/components/JsonLd";
import { JobDetail } from "@/components/jobs/JobDetail";
import { placeOf, relatedJobs } from "@/components/jobs/job-data";
import { DEFAULT, hreflangAlternates } from "@/lib/i18n/locales";
import { jobLocales, jobText } from "@/lib/i18n/pages";
import { currentLocale, getTranslator, requireAvailable } from "@/lib/i18n/server";
import { createTranslator } from "@/lib/i18n/translator";
import { jobPostingJsonLd } from "@/lib/job-posting";
import { getPublicJob } from "@/lib/jobs/public-data";
import { jobHasClosed, jobIsOpen } from "@/lib/jobs/public-job";
import { buildMetadata } from "@/lib/seo";

/**
 * One page per job — the only place JobPosting structured data may appear.
 *
 * Jobs come from the database. A published job renders in full; a closed one renders
 * with a "this position has closed" notice, noindex and without JobPosting, so an old
 * link shared on WhatsApp explains itself instead of vanishing. Drafts, jobs in review
 * and archived jobs are not readable by the public client at all, and 404.
 *
 * Pages are generated on first request and cached (no paths are known at build), then
 * refreshed by staff changes and every ten minutes. English here;
 * app/[locale]/jobs/[slug] serves the same page in the pseudo-locales for testing.
 */
export const revalidate = 600;

export function generateStaticParams() {
  return [];
}

function trimTo(text: string, max: number) {
  if (text.length <= max) return text;
  return `${text.slice(0, text.lastIndexOf(" ", max - 1))}…`;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const job = await getPublicJob(slug);
  if (!job) return {};
  const locale = await currentLocale();
  const t = createTranslator(locale);
  const text = jobText(job, locale);
  const where = placeOf(job, text, t);
  const path = `/jobs/${job.slug}`;
  return buildMetadata({
    path,
    locale,
    title: where ? t("jobs.metaTitle", { title: text.title, where }) : text.title,
    description: trimTo(t("jobs.metaDescription", { title: text.title, where, summary: text.summary ?? "" }), 160),
    // Only a job that is open today is worth a search result.
    noIndex: jobHasClosed(job) || !jobIsOpen(job),
    languages: hreflangAlternates(path, jobLocales()),
  });
}

export default async function JobPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const job = await getPublicJob(slug);
  if (!job) notFound();
  const locale = await requireAvailable(`/jobs/${job.slug}`);
  const t = await getTranslator();
  // JobPosting only on the English page, and only while the job is open (lib/job-posting.ts).
  const schema = locale === DEFAULT ? jobPostingJsonLd(job) : null;
  const related = jobIsOpen(job) ? await relatedJobs(job, locale) : [];

  return (
    <>
      {schema ? <JsonLd data={schema} /> : null}
      <JobDetail job={job} locale={locale} t={t} related={related} />
    </>
  );
}
