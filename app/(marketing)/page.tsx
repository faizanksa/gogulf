import Link from "next/link";
import { JobCard } from "@/components/jobs/JobCard";
import { jobCardData, jobCardText, jobsIn } from "@/components/jobs/job-data";
import { CompanyFacts } from "@/components/site/CompanyFacts";
import { CtaBand } from "@/components/site/CtaBand";
import { ProcessSteps } from "@/components/site/ProcessSteps";
import { RouteGraphic } from "@/components/site/RouteGraphic";
import { Button } from "@/components/ui/Button";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Container, Section } from "@/components/ui/Layout";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { EmptyState } from "@/components/ui/States";
import { VisuallyHidden } from "@/components/ui/VisuallyHidden";
import { whatsappLink } from "@/content/channels";
import { SERVICES } from "@/content/services";
import { hrefIn, serviceText } from "@/lib/i18n/pages";
import { getTranslator, localizedPageMetadata, requireAvailable } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translator";
import styles from "./home.module.css";

const PATH = "/";

// The jobs preview reads the database: refreshed by staff changes, and every ten minutes
// so closing dates and featured periods pass without a deploy.
export const revalidate = 600;

export async function generateMetadata() {
  return localizedPageMetadata(PATH);
}

const RULES: { icon: IconName; title: MessageKey; body: MessageKey }[] = [
  { icon: "file", title: "home.money.rule1Title", body: "home.money.rule1" },
  { icon: "shield", title: "home.money.rule2Title", body: "home.money.rule2" },
];

/**
 * The home page (2C-2), built around the two journeys rather than the company:
 *   1. what Go Gulf does and the two doors — find a job (primary) or hire;
 *   2. the company facts anyone can check, straight after the promise;
 *   3. real open jobs (or an honest empty state);
 *   4. where each audience starts; the process; the money rules; the services; a close.
 * No photography: until real, consented photographs exist the page is typographic,
 * with one drawing (the India → Gulf route). Nothing here is a claim the claims register
 * has not cleared (content/company.ts).
 */
export default async function HomePage() {
  const locale = await requireAvailable(PATH);
  const t = await getTranslator();
  const href = (path: string) => hrefIn(path, locale);
  // Featured jobs first (the listing order), then the newest.
  const jobs = (await jobsIn(locale)).slice(0, 3).map((job) => jobCardData(job, t));
  const cardText = jobCardText(t);
  const whatsapp = whatsappLink(t("home.whatsappGreeting"));
  const opensWhatsApp = t("common.opensWhatsApp");

  return (
    <>
      <section className={styles.hero} aria-labelledby="home-title">
        <div className={styles.heroInner}>
          <div className={styles.heroText}>
            <p className={styles.kicker}>{t("home.kicker")}</p>
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
              {t.rich("home.askFirst", {
                wa: (chunks) => (
                  <a href={whatsapp} target="_blank" rel="noopener noreferrer">
                    {chunks}
                    <VisuallyHidden> {opensWhatsApp}</VisuallyHidden>
                  </a>
                ),
              })}
            </p>
          </div>
          <div className={styles.heroArt}>
            <RouteGraphic />
          </div>
        </div>
      </section>

      <CompanyFacts id="home-facts" />

      <Section tone="subtle" labelledBy="home-jobs">
        <Container>
          <SectionHeading
            id="home-jobs"
            kicker={t("home.jobs.kicker")}
            title={t("home.jobs.title")}
            lead={t("home.jobs.lead")}
            action={
              jobs.length ? (
                <Link href={href("/jobs")} className={styles.more}>
                  {t("home.jobs.all")}
                  <Icon name="arrow-right" size={18} />
                </Link>
              ) : undefined
            }
          />
          {jobs.length ? (
            <ul className={styles.jobs}>
              {jobs.map((job) => (
                <li key={job.slug}>
                  <JobCard job={job} text={cardText} />
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
      </Section>

      <Section labelledBy="home-doors">
        <Container>
          <SectionHeading id="home-doors" kicker={t("home.doors.kicker")} title={t("home.doors.title")} />
          <div className={styles.doors}>
            <article className={styles.door} aria-labelledby="door-seekers">
              <Icon name="briefcase" size={28} className={styles.doorIcon} />
              <h3 id="door-seekers" className={styles.doorTitle}>
                {t("home.doors.seekers.title")}
              </h3>
              <p className={styles.doorLead}>{t("home.doors.seekers.lead")}</p>
              <ul className={styles.checks}>
                {(["home.doors.seekers.point1", "home.doors.seekers.point2", "home.doors.seekers.point3"] as const).map((key) => (
                  <li key={key}>
                    <Icon name="check" size={20} />
                    {t(key)}
                  </li>
                ))}
              </ul>
              <div className={styles.doorActions}>
                <Button href={href("/jobs")}>{t("home.doors.seekers.cta")}</Button>
                <Link href={href("/candidates")} className={styles.more}>
                  {t("home.doors.seekers.more")}
                </Link>
              </div>
            </article>
            <article className={styles.door} aria-labelledby="door-employers">
              <Icon name="building" size={28} className={styles.doorIcon} />
              <h3 id="door-employers" className={styles.doorTitle}>
                {t("home.doors.employers.title")}
              </h3>
              <p className={styles.doorLead}>{t("home.doors.employers.lead")}</p>
              <ul className={styles.checks}>
                {(["home.doors.employers.point1", "home.doors.employers.point2", "home.doors.employers.point3"] as const).map((key) => (
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

      <Section tone="subtle" labelledBy="home-process">
        <Container>
          <SectionHeading id="home-process" kicker={t("home.process.kicker")} title={t("home.process.title")} lead={t("home.process.lead")} />
          <ProcessSteps />
          <p className={styles.after}>
            <Link href={href("/candidates")} className={styles.more}>
              {t("home.process.more")}
              <Icon name="arrow-right" size={18} />
            </Link>
          </p>
        </Container>
      </Section>

      <Section labelledBy="home-money">
        <Container>
          <SectionHeading id="home-money" kicker={t("home.money.kicker")} title={t("home.money.title")} lead={t("home.money.lead")} />
          <ul className={styles.rules}>
            {RULES.map((rule) => (
              <li key={rule.title} className={styles.rule}>
                <Icon name={rule.icon} size={24} className={styles.ruleIcon} />
                <h3 className={styles.ruleTitle}>{t(rule.title)}</h3>
                <p>{t(rule.body)}</p>
              </li>
            ))}
            <li className={styles.rule}>
              <Icon name="info" size={24} className={styles.ruleIcon} />
              <h3 className={styles.ruleTitle}>{t("home.money.rule3Title")}</h3>
              <p>{t.rich("home.money.rule3", { terms: (chunks) => <Link href={href("/terms-and-conditions")}>{chunks}</Link> })}</p>
            </li>
          </ul>
          <p className={styles.links}>
            <Link href={href("/pricing")} className={styles.more}>
              {t("home.money.pricing")}
            </Link>
            <Link href={href("/verify")} className={styles.more}>
              <Icon name="shield" size={18} />
              {t("home.money.verify")}
            </Link>
          </p>
        </Container>
      </Section>

      <Section tone="subtle" labelledBy="home-services">
        <Container>
          <SectionHeading
            id="home-services"
            kicker={t("home.services.kicker")}
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

      <CtaBand
        id="home-cta"
        title={t("home.cta.title")}
        lead={t("home.cta.lead")}
        actions={
          <>
            <Button href={href("/jobs")} variant="inverse">
              {t("home.cta.findJob")}
            </Button>
            <Button href={href("/contact")} variant="ghostInverse">
              {t("home.cta.contact")}
            </Button>
          </>
        }
      />
    </>
  );
}
