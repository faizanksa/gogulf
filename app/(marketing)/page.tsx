import Link from "next/link";
import { jobCardData, jobCardText, jobsIn } from "@/components/jobs/job-data";
import { JobRow } from "@/components/jobs/JobRow";
import { MCA_URL } from "@/components/site/CompanyFacts";
import { CopyButton } from "@/components/site/CopyButton";
import { ProcessSteps } from "@/components/site/ProcessSteps";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Container, Section } from "@/components/ui/Layout";
import { LtrText } from "@/components/ui/LtrText";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { EmptyState } from "@/components/ui/States";
import { VisuallyHidden } from "@/components/ui/VisuallyHidden";
import { whatsappLink } from "@/content/channels";
import { COMPANY } from "@/content/company";
import { SERVICES } from "@/content/services";
import { formatDate } from "@/lib/i18n/format";
import { DEFAULT, LOCALES } from "@/lib/i18n/locales";
import { hrefIn, serviceText } from "@/lib/i18n/pages";
import { getTranslator, localizedPageMetadata, requireAvailable } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translator";
import styles from "./home.module.css";

const PATH = "/";

/** How many open jobs the home page lists before sending people to /jobs. */
const JOBS_SHOWN = 4;

// The jobs board reads the database: refreshed by staff changes, and every ten minutes
// so closing dates and featured periods pass without a deploy.
export const revalidate = 600;

export async function generateMetadata() {
  return localizedPageMetadata(PATH);
}

const RULES: { title: MessageKey; body: MessageKey }[] = [
  { title: "home.money.rule1Title", body: "home.money.rule1" },
  { title: "home.money.rule2Title", body: "home.money.rule2" },
];

const DOOR_POINTS = {
  seekers: ["home.doors.seekers.point1", "home.doors.seekers.point2", "home.doors.seekers.point3"],
  employers: ["home.doors.employers.point1", "home.doors.employers.point2", "home.doors.employers.point3"],
} as const;

/**
 * The home page, built around the two journeys and one promise — "a company you can
 * check" — kept in the same place it is made:
 *   1. the promise and the two doors, beside the company record that proves it (the
 *      CIN, with a copy button and the MCA lookup);
 *   2. the open jobs as a board — destination first, pay in the data face, a way in on
 *      every line (or an honest empty state);
 *   3. where each audience starts; the ten steps as one route; the services;
 *   4. the money rules, on the page's one brand band; a close with every way in.
 * No photography: until real, consented photographs exist the page is typographic. Its
 * one drawn motif — the dotted India → Gulf route — marks the jobs and the process.
 * Nothing here is a claim the claims register has not cleared (content/company.ts).
 */
export default async function HomePage() {
  const locale = await requireAvailable(PATH);
  const t = await getTranslator();
  const href = (path: string) => hrefIn(path, locale);
  // Featured jobs first (the listing order), then the newest.
  const openJobs = await jobsIn(locale);
  const jobs = openJobs.slice(0, JOBS_SHOWN).map((job) => jobCardData(job, t));
  const cardText = jobCardText(t);
  const whatsapp = whatsappLink(t("home.whatsappGreeting"));
  const opensWhatsApp = t("common.opensWhatsApp");
  const englishText = locale === DEFAULT ? undefined : LOCALES[DEFAULT].tag;

  return (
    <>
      <section className={styles.hero} aria-labelledby="home-title">
        <div className={styles.heroInner}>
          <div className={styles.heroText}>
            <h1 id="home-title" className={styles.title}>
              {t("home.title")}
            </h1>
            <p className={styles.lead}>{t("home.lead")}</p>
            <div className={styles.actions}>
              <Button href={href("/jobs")} icon="arrow-right" iconPosition="end">
                {t("home.findJob")}
              </Button>
              <Button href={href("/employers")} variant="secondary">
                {t("home.hire")}
              </Button>
            </div>
            <p className={styles.ask}>
              <Icon name="whatsapp" size={18} className={styles.askIcon} />
              <span>
                {t.rich("home.askFirst", {
                  wa: (chunks) => (
                    <a href={whatsapp} target="_blank" rel="noopener noreferrer">
                      {chunks}
                      <VisuallyHidden> {opensWhatsApp}</VisuallyHidden>
                    </a>
                  ),
                })}
              </span>
            </p>
          </div>

          <aside className={styles.record} aria-labelledby="home-record">
            <h2 id="home-record" className={styles.recordTitle}>
              {t("companyFacts.heading")}
            </h2>
            <p className={styles.recordLead}>{t("companyFacts.lead")}</p>
            <dl className={styles.recordFacts}>
              <div className={styles.cin}>
                <dt>{t("companyFacts.cin")}</dt>
                <dd>
                  <span className={styles.cinLine}>
                    <span className={styles.cinValue}>
                      <LtrText>{COMPANY.cin}</LtrText>
                    </span>
                    <CopyButton
                      value={COMPANY.cin}
                      label={t("home.record.copy")}
                      done={t("home.record.copied")}
                      icons={{ copy: <Icon name="copy" size={18} />, done: <Icon name="check" size={18} /> }}
                    />
                  </span>
                  <a href={MCA_URL} target="_blank" rel="noopener noreferrer" className={styles.recordLink}>
                    <Icon name="external" size={18} />
                    {t("companyFacts.mcaLink")}
                    <VisuallyHidden> {t("common.opensInNewTab")}</VisuallyHidden>
                  </a>
                </dd>
              </div>
              <div>
                <dt>{t("companyFacts.company")}</dt>
                <dd lang={englishText}>{COMPANY.legalName}</dd>
              </div>
              <div>
                <dt>{t("companyFacts.incorporated")}</dt>
                <dd>
                  <time dateTime={COMPANY.incorporationISO}>{formatDate(COMPANY.incorporationISO, locale)}</time>
                </dd>
              </div>
              <div>
                <dt>{t("companyFacts.office")}</dt>
                <dd>{t("companyFacts.officeValue", { city: COMPANY.address.locality, region: COMPANY.address.region })}</dd>
              </div>
              <div>
                <dt>{t("companyFacts.fees")}</dt>
                <dd>{t("companyFacts.feesValue")}</dd>
              </div>
            </dl>
          </aside>
        </div>
      </section>

      <section className={styles.board} aria-labelledby="home-jobs">
        <Container>
          <SectionHeading
            id="home-jobs"
            className={styles.heading}
            title={t("home.jobs.title")}
            lead={t("home.jobs.lead")}
            action={
              jobs.length ? (
                <Link href={href("/jobs")} className={styles.more}>
                  {openJobs.length > jobs.length ? t("home.jobs.allCount", { count: openJobs.length }) : t("home.jobs.all")}
                  <Icon name="arrow-right" size={18} />
                </Link>
              ) : undefined
            }
          />
          {jobs.length ? (
            <ul className={styles.jobs}>
              {jobs.map((job) => (
                <li key={job.slug}>
                  <JobRow job={job} text={cardText} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon="briefcase"
              headingLevel={3}
              title={t("home.jobs.emptyTitle")}
              action={
                <div className={styles.actions}>
                  <Button href={href("/jobs/apply")}>{t("home.jobs.general")}</Button>
                  <Button href={whatsapp} variant="whatsapp" icon="whatsapp" opensWhatsApp={opensWhatsApp}>
                    {t("home.jobs.ask")}
                  </Button>
                </div>
              }
            >
              <p>{t("home.jobs.emptyBody")}</p>
            </EmptyState>
          )}
        </Container>
      </section>

      <Section tone="subtle" labelledBy="home-doors">
        <Container>
          <SectionHeading id="home-doors" title={t("home.doors.title")} className={styles.heading} />
          <div className={styles.doors}>
            <article className={`${styles.door} ${styles.doorPrimary}`} aria-labelledby="door-seekers">
              <h3 id="door-seekers" className={styles.doorTitle}>
                {t("home.doors.seekers.title")}
              </h3>
              <p className={styles.doorLead}>{t("home.doors.seekers.lead")}</p>
              <ul className={styles.checks}>
                {DOOR_POINTS.seekers.map((key) => (
                  <li key={key}>
                    <Icon name="check" size={20} />
                    {t(key)}
                  </li>
                ))}
              </ul>
              <div className={styles.doorActions}>
                <Button href={href("/jobs")} icon="arrow-right" iconPosition="end">
                  {t("home.doors.seekers.cta")}
                </Button>
                <Link href={href("/candidates")} className={styles.more}>
                  {t("home.doors.seekers.more")}
                </Link>
              </div>
            </article>
            <article className={styles.door} aria-labelledby="door-employers">
              <h3 id="door-employers" className={styles.doorTitle}>
                {t("home.doors.employers.title")}
              </h3>
              <p className={styles.doorLead}>{t("home.doors.employers.lead")}</p>
              <ul className={styles.checks}>
                {DOOR_POINTS.employers.map((key) => (
                  <li key={key}>
                    <Icon name="check" size={20} />
                    {t(key)}
                  </li>
                ))}
              </ul>
              <div className={styles.doorActions}>
                <Button href={`${href("/employers")}#requirement`} variant="secondary">
                  {t("home.doors.employers.cta")}
                </Button>
                <Link href={`${href("/services")}#employers`} className={styles.more}>
                  {t("home.doors.employers.more")}
                </Link>
              </div>
            </article>
          </div>
        </Container>
      </Section>

      <Section labelledBy="home-process">
        <Container>
          <SectionHeading
            id="home-process"
            className={styles.heading}
            title={t("home.process.title")}
            lead={t("home.process.lead")}
            action={
              <Link href={href("/candidates")} className={styles.more}>
                {t("home.process.more")}
                <Icon name="arrow-right" size={18} />
              </Link>
            }
          />
          <ProcessSteps layout="route" tone="on-white" />
        </Container>
      </Section>

      <Section tone="subtle" labelledBy="home-services">
        <Container>
          <SectionHeading
            id="home-services"
            className={styles.heading}
            title={t("home.services.title")}
            action={
              <Link href={href("/services")} className={styles.more}>
                {t("home.services.all")}
                <Icon name="arrow-right" size={18} />
              </Link>
            }
          />
          <div className={styles.services}>
            {(["job-seekers", "employers"] as const).map((audience) => (
              <div key={audience} className={styles.serviceGroup}>
                <h3 className={styles.serviceHeading}>{t(audience === "job-seekers" ? "home.services.seekers" : "home.services.employers")}</h3>
                <ul className={styles.serviceList}>
                  {SERVICES.filter((s) => s.audience === audience)
                    .slice(0, 4)
                    .map((service) => {
                      const text = serviceText(service, locale);
                      return (
                        <li key={service.id}>
                          <span className={styles.serviceName}>{text.name}</span>
                          <span className={styles.serviceSummary}>{text.summary}</span>
                        </li>
                      );
                    })}
                </ul>
              </div>
            ))}
          </div>
        </Container>
      </Section>

      <Section tone="brand" labelledBy="home-money">
        <Container>
          <div className={styles.money}>
            <div className={styles.moneyIntro}>
              <SectionHeading id="home-money" title={t("home.money.title")} lead={t("home.money.lead")} onDark className={`${styles.heading} ${styles.moneyHeading}`} />
              <p className={styles.moneyLinks}>
                <Link href={href("/pricing")} className={styles.onBrandLink}>
                  <Icon name="file" size={18} />
                  {t("home.money.pricing")}
                </Link>
                <Link href={href("/verify")} className={styles.onBrandLink}>
                  <Icon name="shield" size={18} />
                  {t("home.money.verify")}
                </Link>
              </p>
            </div>
            <ul className={styles.rules}>
              {RULES.map((rule) => (
                <li key={rule.title} className={styles.rule}>
                  <h3 className={styles.ruleTitle}>{t(rule.title)}</h3>
                  <p>{t(rule.body)}</p>
                </li>
              ))}
              <li className={styles.rule}>
                <h3 className={styles.ruleTitle}>{t("home.money.rule3Title")}</h3>
                <p>{t.rich("home.money.rule3", { terms: (chunks) => <Link href={href("/terms-and-conditions")}>{chunks}</Link> })}</p>
              </li>
            </ul>
          </div>
        </Container>
      </Section>

      <section className={styles.close} aria-labelledby="home-cta">
        <Container>
          <div className={styles.closeInner}>
            <h2 id="home-cta" className={styles.closeTitle}>
              {t("home.cta.title")}
            </h2>
            <p className={styles.closeLead}>{t("home.cta.lead")}</p>
            <div className={styles.closeActions}>
              <Button href={href("/jobs")} icon="arrow-right" iconPosition="end">
                {t("home.cta.findJob")}
              </Button>
              <Button href={whatsapp} variant="whatsapp" icon="whatsapp" opensWhatsApp={opensWhatsApp}>
                {t("home.jobs.ask")}
              </Button>
              <Link href={href("/contact")} className={styles.more}>
                {t("home.cta.contact")}
              </Link>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
