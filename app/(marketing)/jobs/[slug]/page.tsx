import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import JsonLd from "@/components/JsonLd";
import { DevNotice } from "@/components/site/DevNotice";
import { PageHeader } from "@/components/site/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Container, Section } from "@/components/ui/Layout";
import { whatsappLink } from "@/content/channels";
import { getJob, jobIsClosed, visibleJobs, type Job } from "@/content/jobs";
import { countryName, formatDate, formatNumber, salaryText } from "@/lib/i18n/format";
import { DEFAULT, hreflangAlternates } from "@/lib/i18n/locales";
import { hrefIn, jobLocales, jobText, type JobText } from "@/lib/i18n/pages";
import { currentLocale, getTranslator, requireAvailable } from "@/lib/i18n/server";
import { createTranslator, type MessageKey, type Translator } from "@/lib/i18n/translator";
import { jobPostingJsonLd } from "@/lib/job-posting";
import { buildMetadata } from "@/lib/seo";
import styles from "./job.module.css";

/**
 * One page per job — the only place JobPosting structured data may appear.
 *
 * Foundation page (Phase 2B): the data flow, metadata, structured-data rules and apply
 * links are final; the visual design is finished in 2C-1.
 *
 * Unknown slugs 404. Unconfirmed jobs render only outside production, flagged, noindex
 * and without JobPosting. Hourly regeneration moves a job to "closed" on its closing
 * date without a deploy.
 *
 * Languages: English here; app/[locale]/jobs/[slug] serves the same page for each job
 * with a reviewed translation (content/jobs.ts). The job's facts stay language-neutral
 * and are only formatted per language; its words come from the translation.
 */
export const dynamicParams = false;
export const revalidate = 3600;

export function generateStaticParams() {
  return visibleJobs().map((j) => ({ slug: j.slug }));
}

const TYPE_KEYS: Record<Job["employmentType"], MessageKey> = {
  "Full-Time": "jobs.type.fullTime",
  "Part-Time": "jobs.type.partTime",
  Contract: "jobs.type.contract",
  Temporary: "jobs.type.temporary",
};

function placeOf(job: Job, text: JobText, t: Translator): string {
  const country = countryName(job.country, t.locale);
  return text.city ? t("jobs.place", { city: text.city, country }) : country;
}

function trimTo(text: string, max: number) {
  if (text.length <= max) return text;
  return `${text.slice(0, text.lastIndexOf(" ", max - 1))}…`;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const job = getJob(slug);
  if (!job) return {};
  const locale = await currentLocale();
  const t = createTranslator(locale);
  const text = jobText(job, locale);
  const where = placeOf(job, text, t);
  const path = `/jobs/${job.slug}`;
  return buildMetadata({
    path,
    locale,
    title: t("jobs.metaTitle", { title: text.title, where }),
    description: trimTo(t("jobs.metaDescription", { title: text.title, where, summary: text.summary }), 160),
    noIndex: job.verification !== "confirmed" || jobIsClosed(job),
    languages: hreflangAlternates(path, jobLocales(job)),
  });
}

export default async function JobPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const job = getJob(slug);
  if (!job) notFound();
  const path = `/jobs/${job.slug}`;
  const locale = await requireAvailable(path);
  const t = await getTranslator();
  const href = (p: string) => hrefIn(p, locale);

  const text = jobText(job, locale);
  const where = placeOf(job, text, t);
  const closed = jobIsClosed(job);
  // JobPosting only on the English page: the translations are its hreflang alternates,
  // and structured data must match the page it sits on word for word.
  const schema = closed || locale !== DEFAULT ? null : jobPostingJsonLd(job);
  // The apply form's prefill stays in English: it is data for staff, not reading text.
  const applyHref = `${href("/jobs/apply")}?${new URLSearchParams({ job: job.title, country: job.country, type: job.employmentType }).toString()}`;
  const askHref = whatsappLink(t("jobs.askMessage", { title: text.title, where, slug: job.slug }));

  const facts: { label: string; value: React.ReactNode }[] = [
    { label: t("jobs.location"), value: where },
    { label: t("jobs.industry"), value: text.industry },
    { label: t("jobs.contract"), value: t(TYPE_KEYS[job.employmentType]) },
    { label: t("jobs.salary"), value: job.salary ? <span className={styles.mono}>{salaryText(job.salary, t)}</span> : t("jobs.salaryNotStated") },
    { label: t("jobs.posted"), value: <time dateTime={job.postedOn}>{formatDate(job.postedOn, locale)}</time> },
    {
      label: t("jobs.closes"),
      value: job.closesOn ? <time dateTime={job.closesOn}>{formatDate(job.closesOn, locale)}</time> : t("jobs.noClosingDate"),
    },
    ...(job.openings ? [{ label: t("jobs.openings"), value: formatNumber(job.openings, locale) }] : []),
  ];

  return (
    <>
      {schema ? <JsonLd data={schema} /> : null}
      <PageHeader
        crumbs={[
          { name: t("jobs.breadcrumb"), path: "/jobs" },
          { name: text.title, path },
        ]}
        title={text.title}
        lead={`${where} · ${text.industry}`}
      >
        <Badge tone="green">{t(TYPE_KEYS[job.employmentType])}</Badge>
        {closed ? <Badge tone="error">{t("jobs.closedBadge")}</Badge> : null}
      </PageHeader>

      <Section>
        <Container>
          <div className={styles.layout}>
            <div className={styles.main}>
              {job.verification === "unconfirmed" ? <DevNotice decision="D4">{job.verificationNote}</DevNotice> : null}
              {closed ? (
                <Alert tone="info" title={t("jobs.closedTitle")}>
                  <p>{t.rich("jobs.closedBody", { jobs: (chunks) => <Link href={href("/jobs")}>{chunks}</Link> })}</p>
                </Alert>
              ) : null}

              <h2 className={styles.h2}>{t("jobs.aboutRole")}</h2>
              <p className={styles.summary}>{text.summary}</p>

              <h2 className={styles.h2}>{t("jobs.fees")}</h2>
              <p>
                {t.rich("jobs.feesBody", {
                  pricing: (chunks) => <Link href={href("/pricing")}>{chunks}</Link>,
                  verify: (chunks) => <Link href={href("/verify")}>{chunks}</Link>,
                })}
              </p>
            </div>

            <aside className={styles.aside} aria-labelledby="job-facts-heading">
              <h2 id="job-facts-heading" className={styles.h3}>
                {t("jobs.details")}
              </h2>
              <dl className={styles.facts}>
                {facts.map((f) => (
                  <div key={f.label} className={styles.fact}>
                    <dt>{f.label}</dt>
                    <dd>{f.value}</dd>
                  </div>
                ))}
              </dl>
            </aside>
          </div>
        </Container>
      </Section>

      {closed ? null : (
        <div className={styles.applyBar}>
          <div className={styles.applyInner}>
            <Button href={applyHref} icon="arrow-right" iconPosition="end">
              {t("jobs.apply")}
            </Button>
            <Button href={askHref} variant="secondary" icon="whatsapp" opensWhatsApp={t("common.opensWhatsApp")}>
              {t("jobs.askWhatsApp")}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
