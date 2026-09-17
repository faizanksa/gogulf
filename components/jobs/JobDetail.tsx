import Link from "next/link";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/site/PageHeader";
import { AlertView } from "@/components/ui/AlertView";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FactList, type Fact } from "@/components/ui/FactList";
import { Container, Section } from "@/components/ui/Layout";
import { LtrText } from "@/components/ui/LtrText";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Stepper } from "@/components/ui/Stepper";
import { whatsappLink } from "@/content/channels";
import { formatDate, formatNumber } from "@/lib/i18n/format";
import type { AnyLocale } from "@/lib/i18n/locales";
import { hrefIn, jobText } from "@/lib/i18n/pages";
import type { Translator } from "@/lib/i18n/translator";
import { indianDateOf } from "@/lib/jobs/model";
import { jobHasClosed, jobIsFeatured, jobIsOpen, type PublicJob } from "@/lib/jobs/public-job";
import { JobCard } from "./JobCard";
import { applyTargetFor, jobCardData, jobCardText, placeOf } from "./job-data";
import styles from "./JobDetail.module.css";

/**
 * One job's page, as the public sees it. Used by app/(marketing)/jobs/[slug] and by the
 * staff preview, so what staff approve is exactly what is published.
 *
 * The facts come first, because that is what someone arriving from a WhatsApp link needs:
 * place, salary, contract, dates, reference — beside the text on desktop, above it on a
 * phone. A fact the job does not state is left out, or said to be missing, never filled
 * in: salary "not stated", requirements "not listed here yet".
 */
export function JobDetail({
  job,
  locale,
  t,
  related = [],
  banner,
  now = new Date(),
}: {
  job: PublicJob;
  locale: AnyLocale;
  t: Translator;
  related?: PublicJob[];
  /** Shown above the text — the staff preview's "not public" notice. */
  banner?: ReactNode;
  now?: Date;
}) {
  const href = (p: string) => hrefIn(p, locale);
  const path = `/jobs/${job.slug}`;
  const text = jobText(job, locale);
  const card = jobCardData(job, t, now);
  const closed = jobHasClosed(job, now) || !jobIsOpen(job, now);
  const featured = jobIsFeatured(job, now);
  const apply = applyTargetFor(job, t, now);
  const askHref = whatsappLink(t("jobs.askMessage", { title: text.title, where: card.where, reference: job.reference }));
  const cardText = jobCardText(t);
  const relatedCards = related.map((j) => jobCardData(j, t, now));
  const date = (iso: string) => <time dateTime={iso}>{formatDate(iso, locale)}</time>;

  const facts: Fact[] = [
    { key: "salary", label: t("jobs.salary"), value: card.salary ?? t("jobs.salaryNotStated"), mono: Boolean(card.salary) },
    ...(card.where ? [{ key: "location", label: t("jobs.location"), value: card.where }] : []),
    ...(card.type ? [{ key: "contract", label: t("jobs.contract"), value: card.type }] : []),
    ...(text.category ? [{ key: "category", label: t("jobs.category"), value: text.category }] : []),
    {
      key: "opportunity",
      label: t("jobs.opportunity"),
      value: job.classification === "professional" ? t("jobs.professional") : t("jobs.general"),
    },
    ...(text.experience ? [{ key: "experience", label: t("jobs.experience"), value: text.experience }] : []),
    ...(text.education ? [{ key: "education", label: t("jobs.education"), value: text.education }] : []),
    ...(text.languages ? [{ key: "languages", label: t("jobs.languages"), value: text.languages }] : []),
    ...(job.vacancies ? [{ key: "openings", label: t("jobs.openings"), value: formatNumber(job.vacancies, locale) }] : []),
    ...(job.employer
      ? [{ key: "employer", label: t("jobs.employer"), value: job.employer.disclosure === "named" ? job.employer.name : t("jobs.employerConfidential") }]
      : []),
    {
      key: "availability",
      label: t("jobs.availability"),
      value: job.availability === "ongoing" ? t("jobs.ongoing") : t("jobs.timeLimited"),
    },
    ...(job.availability === "time_limited" && job.closesOn ? [{ key: "closes", label: t("jobs.closes"), value: date(job.closesOn) }] : []),
    ...(job.publishedAt ? [{ key: "posted", label: t("jobs.posted"), value: date(indianDateOf(job.publishedAt)) }] : []),
    { key: "updated", label: t("jobs.updated"), value: date(indianDateOf(job.updatedAt)) },
    ...(job.applicationAccess === "free" ? [{ key: "application", label: t("jobs.application"), value: t("jobs.applicationFree") }] : []),
    { key: "reference", label: t("jobs.reference"), value: <LtrText>{job.reference}</LtrText>, mono: true },
  ];

  const actions = apply ? (
    apply.whatsapp ? (
      <Button href={apply.href} variant="whatsapp" icon="whatsapp" opensWhatsApp={t("common.opensWhatsApp")}>
        {t("jobs.applyWhatsApp")}
      </Button>
    ) : (
      <>
        <Button href={apply.href} icon="arrow-right" iconPosition="end">
          {t("jobs.apply")}
        </Button>
        <Button href={askHref} variant="secondary" icon="whatsapp" opensWhatsApp={t("common.opensWhatsApp")}>
          {t("jobs.askWhatsApp")}
        </Button>
      </>
    )
  ) : null;

  const list = (items: string[]) => (
    <ul className={styles.list}>
      {items.map((item, i) => (
        <li key={`${i}-${item}`}>{item}</li>
      ))}
    </ul>
  );

  return (
    <>
      <PageHeader
        crumbs={[
          { name: t("jobs.breadcrumb"), path: "/jobs" },
          { name: text.title, path },
        ]}
        kicker={
          <span className={styles.kicker}>
            {text.category ?? (job.classification === "professional" ? t("jobs.professional") : t("jobs.general"))}
            {card.type ? <Badge tone="green">{card.type}</Badge> : null}
            {featured && !closed ? <Badge tone="blue">{t("jobs.featured")}</Badge> : null}
            {closed ? <Badge tone="error">{t("jobs.closedBadge")}</Badge> : null}
          </span>
        }
        title={text.title}
        lead={card.salary ? [card.where, card.salary].filter(Boolean).join(" · ") : card.where}
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
              {banner}
              {closed ? (
                <AlertView tone="info" toneLabel={t("common.tone.info")} title={t("jobs.closedTitle")}>
                  <p>{t.rich("jobs.closedBody", { jobs: (chunks) => <Link href={href("/jobs")}>{chunks}</Link> })}</p>
                </AlertView>
              ) : null}

              {text.summary ? (
                <section className={styles.block} aria-labelledby="job-about">
                  <h2 id="job-about" className={styles.h2}>
                    {t("jobs.aboutRole")}
                  </h2>
                  <p className={styles.summary}>{text.summary}</p>
                </section>
              ) : null}

              {text.responsibilities.length ? (
                <section className={styles.block} aria-labelledby="job-responsibilities">
                  <h2 id="job-responsibilities" className={styles.h2}>
                    {t("jobs.responsibilities")}
                  </h2>
                  {list(text.responsibilities)}
                </section>
              ) : null}

              <section className={styles.block} aria-labelledby="job-requirements">
                <h2 id="job-requirements" className={styles.h2}>
                  {t("jobs.requirements")}
                </h2>
                {text.requirements.length ? list(text.requirements) : <p className={styles.note}>{t("jobs.requirementsMissing")}</p>}
              </section>

              <section className={styles.block} aria-labelledby="job-benefits">
                <h2 id="job-benefits" className={styles.h2}>
                  {t("jobs.benefits")}
                </h2>
                {text.benefits.length ? list(text.benefits) : <p className={styles.note}>{t("jobs.benefitsMissing")}</p>}
              </section>

              {text.additionalInfo ? (
                <section className={styles.block} aria-labelledby="job-additional">
                  <h2 id="job-additional" className={styles.h2}>
                    {t("jobs.additionalInfo")}
                  </h2>
                  {text.additionalInfo.split(/\n{2,}/).map((para, i) => (
                    <p key={i} className={styles.summary}>
                      {para}
                    </p>
                  ))}
                </section>
              ) : null}

              {apply ? (
                <section className={styles.block} aria-labelledby="job-how">
                  <h2 id="job-how" className={styles.h2}>
                    {t("jobs.howToApply")}
                  </h2>
                  <Stepper
                    steps={
                      apply.whatsapp
                        ? [{ title: t("jobs.applyStepWhatsApp") }, { title: t("jobs.applyStep2") }, { title: t("jobs.applyStep3") }]
                        : [{ title: t("jobs.applyStep1") }, { title: t("jobs.applyStep2") }, { title: t("jobs.applyStep3") }]
                    }
                  />
                </section>
              ) : null}

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

      {relatedCards.length ? (
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
              {relatedCards.map((r) => (
                <li key={r.slug}>
                  <JobCard job={r} text={cardText} />
                </li>
              ))}
            </ul>
          </Container>
        </Section>
      ) : null}

      {apply ? (
        <div className={styles.applyBar}>
          <div className={styles.applyInner}>
            {apply.whatsapp ? (
              <Button href={apply.href} variant="whatsapp" icon="whatsapp" opensWhatsApp={t("common.opensWhatsApp")}>
                {t("jobs.applyWhatsApp")}
              </Button>
            ) : (
              <>
                <Button href={apply.href} icon="arrow-right" iconPosition="end">
                  {t("jobs.apply")}
                </Button>
                <Button href={askHref} variant="whatsapp" icon="whatsapp" opensWhatsApp={t("common.opensWhatsApp")}>
                  {t("jobs.askWhatsApp")}
                </Button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
