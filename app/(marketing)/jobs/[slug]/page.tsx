import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import JsonLd from "@/components/JsonLd";
import { JobCard } from "@/components/jobs/JobCard";
import { applyHrefFor, jobCardData, jobCardText, placeOf, relatedJobs } from "@/components/jobs/job-data";
import { DevNotice } from "@/components/site/DevNotice";
import { PageHeader } from "@/components/site/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FactList, type Fact } from "@/components/ui/FactList";
import { Container, Section } from "@/components/ui/Layout";
import { LtrText } from "@/components/ui/LtrText";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Stepper } from "@/components/ui/Stepper";
import { whatsappLink } from "@/content/channels";
import { getJob, jobIsClosed, visibleJobs } from "@/content/jobs";
import { formatDate, formatNumber } from "@/lib/i18n/format";
import { DEFAULT, hreflangAlternates } from "@/lib/i18n/locales";
import { hrefIn, jobLocales, jobText } from "@/lib/i18n/pages";
import { currentLocale, getTranslator, requireAvailable } from "@/lib/i18n/server";
import { createTranslator } from "@/lib/i18n/translator";
import { jobPostingJsonLd } from "@/lib/job-posting";
import { buildMetadata } from "@/lib/seo";
import styles from "./job.module.css";

/**
 * One page per job — the only place JobPosting structured data may appear (2C-1).
 *
 * The facts come first, because that is what someone arriving from a WhatsApp link needs:
 * salary, place, contract, dates, reference — beside the text on desktop, above it on a
 * phone. What the listing does not state (requirements, benefits) is said honestly,
 * with a way to ask, rather than filled in.
 *
 * Unknown slugs 404. Unconfirmed jobs render only outside production, flagged, noindex
 * and without JobPosting. Hourly regeneration moves a job to "closed" on its closing
 * date without a deploy. English here; app/[locale]/jobs/[slug] serves the same page
 * for each job with a reviewed translation (content/jobs.ts).
 */
export const dynamicParams = false;
export const revalidate = 3600;

export function generateStaticParams() {
  return visibleJobs().map((j) => ({ slug: j.slug }));
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
  const card = jobCardData(job, t);
  const closed = jobIsClosed(job);
  // JobPosting only on the English page: the translations are its hreflang alternates,
  // and structured data must match the page it sits on word for word.
  const schema = closed || locale !== DEFAULT ? null : jobPostingJsonLd(job);
  const applyHref = applyHrefFor(job, locale);
  const askHref = whatsappLink(t("jobs.askMessage", { title: text.title, where: card.where, slug: job.slug }));
  const related = relatedJobs(job, locale).map((j) => jobCardData(j, t));
  const cardText = jobCardText(t);

  const facts: Fact[] = [
    { key: "salary", label: t("jobs.salary"), value: card.salary ?? t("jobs.salaryNotStated"), mono: Boolean(card.salary) },
    { key: "location", label: t("jobs.location"), value: card.where },
    { key: "contract", label: t("jobs.contract"), value: card.type },
    { key: "industry", label: t("jobs.industry"), value: text.industry },
    ...(text.experience ? [{ key: "experience", label: t("jobs.experience"), value: text.experience }] : []),
    ...(job.openings ? [{ key: "openings", label: t("jobs.openings"), value: formatNumber(job.openings, locale) }] : []),
    ...(job.employer
      ? [{ key: "employer", label: t("jobs.employer"), value: job.employer.disclosure === "named" ? job.employer.name : t("jobs.employerConfidential") }]
      : []),
    { key: "posted", label: t("jobs.posted"), value: <time dateTime={job.postedOn}>{formatDate(job.postedOn, locale)}</time> },
    {
      key: "closes",
      label: t("jobs.closes"),
      value: job.closesOn ? <time dateTime={job.closesOn}>{formatDate(job.closesOn, locale)}</time> : t("jobs.noClosingDate"),
    },
    { key: "reference", label: t("jobs.reference"), value: <LtrText>{job.slug}</LtrText>, mono: true },
  ];

  const actions = closed ? null : (
    <>
      <Button href={applyHref} icon="arrow-right" iconPosition="end">
        {t("jobs.apply")}
      </Button>
      <Button href={askHref} variant="secondary" icon="whatsapp" opensWhatsApp={t("common.opensWhatsApp")}>
        {t("jobs.askWhatsApp")}
      </Button>
    </>
  );

  return (
    <>
      {schema ? <JsonLd data={schema} /> : null}
      <PageHeader
        crumbs={[
          { name: t("jobs.breadcrumb"), path: "/jobs" },
          { name: text.title, path },
        ]}
        kicker={
          <span className={styles.kicker}>
            {text.industry}
            <Badge tone="green">{card.type}</Badge>
            {closed ? <Badge tone="error">{t("jobs.closedBadge")}</Badge> : null}
            {!closed && card.closingSoon ? <Badge tone="warning">{cardText.closingSoon}</Badge> : null}
          </span>
        }
        title={text.title}
        lead={card.salary ? `${card.where} · ${card.salary}` : card.where}
      >
        {actions}
      </PageHeader>

      <Section>
        <Container>
          <div className={styles.layout}>
            <aside className={styles.aside} aria-labelledby="job-facts-heading">
              <h2 id="job-facts-heading" className={styles.asideHeading}>
                {t("jobs.keyFacts")}
              </h2>
              <FactList items={facts} />
              {actions ? <div className={styles.asideActions}>{actions}</div> : null}
            </aside>

            <div className={styles.article}>
              {job.verification === "unconfirmed" ? <DevNotice decision="D4">{job.verificationNote}</DevNotice> : null}
              {closed ? (
                <Alert tone="info" title={t("jobs.closedTitle")}>
                  <p>{t.rich("jobs.closedBody", { jobs: (chunks) => <Link href={href("/jobs")}>{chunks}</Link> })}</p>
                </Alert>
              ) : null}

              <section className={styles.block} aria-labelledby="job-about">
                <h2 id="job-about" className={styles.h2}>
                  {t("jobs.aboutRole")}
                </h2>
                <p className={styles.summary}>{text.summary}</p>
              </section>

              <section className={styles.block} aria-labelledby="job-requirements">
                <h2 id="job-requirements" className={styles.h2}>
                  {t("jobs.requirements")}
                </h2>
                {text.requirements.length ? (
                  <ul className={styles.list}>
                    {text.requirements.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p className={styles.note}>{t("jobs.requirementsMissing")}</p>
                )}
              </section>

              <section className={styles.block} aria-labelledby="job-benefits">
                <h2 id="job-benefits" className={styles.h2}>
                  {t("jobs.benefits")}
                </h2>
                {text.benefits.length ? (
                  <ul className={styles.list}>
                    {text.benefits.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p className={styles.note}>{t("jobs.benefitsMissing")}</p>
                )}
              </section>

              {closed ? null : (
                <section className={styles.block} aria-labelledby="job-how">
                  <h2 id="job-how" className={styles.h2}>
                    {t("jobs.howToApply")}
                  </h2>
                  <Stepper steps={[{ title: t("jobs.applyStep1") }, { title: t("jobs.applyStep2") }, { title: t("jobs.applyStep3") }]} />
                </section>
              )}

              <section className={styles.callout} aria-labelledby="job-fees">
                <h2 id="job-fees" className={styles.h3}>
                  {t("jobs.safety")}
                </h2>
                <p>
                  {t.rich("jobs.feesBody", {
                    pricing: (chunks) => <Link href={href("/pricing")}>{chunks}</Link>,
                    verify: (chunks) => <Link href={href("/verify")}>{chunks}</Link>,
                  })}
                </p>
              </section>
            </div>
          </div>
        </Container>
      </Section>

      {related.length ? (
        <Section tone="subtle" labelledBy="job-related">
          <Container>
            <SectionHeading
              id="job-related"
              title={t("jobs.related")}
              action={
                <Link href={href("/jobs")} className={styles.allLink}>
                  {t("jobs.allJobs")}
                </Link>
              }
            />
            <ul className={styles.related}>
              {related.map((r) => (
                <li key={r.slug}>
                  <JobCard job={r} text={cardText} />
                </li>
              ))}
            </ul>
          </Container>
        </Section>
      ) : null}

      {closed ? null : (
        <div className={styles.applyBar}>
          <div className={styles.applyInner}>
            <Button href={applyHref} icon="arrow-right" iconPosition="end">
              {t("jobs.apply")}
            </Button>
            <Button href={askHref} variant="whatsapp" icon="whatsapp" opensWhatsApp={t("common.opensWhatsApp")}>
              {t("jobs.askWhatsApp")}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
