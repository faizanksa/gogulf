import { JobBoard } from "@/components/jobs/JobBoard";
import { jobCardData, jobCardText, jobsIn } from "@/components/jobs/job-data";
import { PageHeader } from "@/components/site/PageHeader";
import { Button } from "@/components/ui/Button";
import { Container, Section } from "@/components/ui/Layout";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { EmptyState } from "@/components/ui/States";
import { Stepper } from "@/components/ui/Stepper";
import { whatsappLink } from "@/content/channels";
import { pageEntry } from "@/content/pages";
import { hrefIn, pageText } from "@/lib/i18n/pages";
import { getTranslator, localizedPageMetadata, requireAvailable } from "@/lib/i18n/server";
import styles from "./jobs.module.css";

const PATH = "/jobs";

// Open and closed follow the calendar without a deploy.
export const revalidate = 3600;

export async function generateMetadata() {
  return localizedPageMetadata(PATH);
}

/**
 * The jobs list (2C-1). Every open job is rendered on the server — crawlable, and
 * complete without JavaScript — and the filter island adds search and filters. No
 * JobPosting here: Google accepts it only on each job's own page.
 *
 * With no jobs listed (production today: none is confirmed yet, decision D4) the page
 * says so plainly and offers the general application and WhatsApp instead.
 */
export default async function JobsPage() {
  const locale = await requireAvailable(PATH);
  const t = await getTranslator();
  const href = (path: string) => hrefIn(path, locale);
  const cards = jobsIn(locale).map((job) => jobCardData(job, t));
  const whatsapp = whatsappLink(t("jobsPage.whatsappGreeting"));

  return (
    <>
      <PageHeader
        crumbs={[{ name: pageText(pageEntry(PATH), locale).breadcrumb, path: PATH }]}
        kicker={t("jobsPage.kicker")}
        title={t("jobsPage.title")}
        lead={t("jobsPage.lead")}
        aside={
          <div className={styles.steps}>
            <p className={styles.stepsHeading}>{t("jobsPage.stepsHeading")}</p>
            <Stepper
              steps={[{ title: t("jobsPage.step1") }, { title: t("jobsPage.step2") }, { title: t("jobsPage.step3") }]}
              label={t("jobsPage.stepsHeading")}
            />
          </div>
        }
      />

      <Section labelledBy="jobs-list-heading">
        <Container>
          <h2 id="jobs-list-heading" className="visually-hidden">
            {t("jobsPage.listHeading")}
          </h2>
          {cards.length ? (
            <JobBoard
              jobs={cards}
              cardText={jobCardText(t)}
              text={{
                label: t("jobsPage.filters.label"),
                search: t("jobsPage.filters.search"),
                searchPlaceholder: t("jobsPage.filters.searchPlaceholder"),
                country: t("jobsPage.filters.country"),
                allCountries: t("jobsPage.filters.allCountries"),
                industry: t("jobsPage.filters.industry"),
                allIndustries: t("jobsPage.filters.allIndustries"),
                type: t("jobsPage.filters.type"),
                allTypes: t("jobsPage.filters.allTypes"),
                clear: t("jobsPage.filters.clear"),
                counts: Array.from({ length: cards.length + 1 }, (_, n) => t("jobsPage.count", { count: n })),
                noMatchTitle: t("jobsPage.noMatchTitle"),
                noMatchBody: t("jobsPage.noMatchBody"),
              }}
            />
          ) : (
            <EmptyState
              icon="briefcase"
              title={t("jobsPage.emptyTitle")}
              action={
                <div className={styles.actions}>
                  <Button href={href("/jobs/apply")}>{t("jobsPage.general")}</Button>
                  <Button href={whatsapp} variant="whatsapp" icon="whatsapp" opensWhatsApp={t("common.opensWhatsApp")}>
                    {t("jobsPage.ask")}
                  </Button>
                </div>
              }
            >
              <p>{t("jobsPage.emptyBody")}</p>
            </EmptyState>
          )}
        </Container>
      </Section>

      {cards.length ? (
        <Section tone="subtle" spacing="tight" labelledBy="jobs-general-heading">
          <Container>
            <div className={styles.general}>
              <SectionHeading id="jobs-general-heading" title={t("jobsPage.generalHeading")} lead={t("jobsPage.generalBody")} />
              <div className={styles.actions}>
                <Button href={href("/jobs/apply")}>{t("jobsPage.general")}</Button>
                <Button href={whatsapp} variant="secondary" icon="whatsapp" opensWhatsApp={t("common.opensWhatsApp")}>
                  {t("jobsPage.ask")}
                </Button>
              </div>
            </div>
          </Container>
        </Section>
      ) : null}
    </>
  );
}
