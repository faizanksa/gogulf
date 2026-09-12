import Link from "next/link";
import { CompanyFacts } from "@/components/site/CompanyFacts";
import { CtaBand } from "@/components/site/CtaBand";
import { DevNotice } from "@/components/site/DevNotice";
import { PageHeader } from "@/components/site/PageHeader";
import { Button } from "@/components/ui/Button";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Container, Section } from "@/components/ui/Layout";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { COMPANY } from "@/content/company";
import { pageEntry } from "@/content/pages";
import { formatDate } from "@/lib/i18n/format";
import { hrefIn, pageText } from "@/lib/i18n/pages";
import { getTranslator, localizedPageMetadata, requireAvailable } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translator";
import styles from "./about.module.css";

const PATH = "/about";

export async function generateMetadata() {
  return localizedPageMetadata(PATH);
}

const VALUES: MessageKey[] = [
  "aboutPage.values.v1",
  "aboutPage.values.v2",
  "aboutPage.values.v3",
  "aboutPage.values.v4",
  "aboutPage.values.v5",
  "aboutPage.values.v6",
  "aboutPage.values.v7",
  "aboutPage.values.v8",
  "aboutPage.values.v9",
  "aboutPage.values.v10",
];

const RULES: { icon: IconName; title: MessageKey; body: MessageKey }[] = [
  { icon: "file", title: "aboutPage.rules.r1Title", body: "aboutPage.rules.r1" },
  { icon: "info", title: "aboutPage.rules.r2Title", body: "aboutPage.rules.r2" },
  { icon: "shield", title: "aboutPage.rules.r3Title", body: "aboutPage.rules.r3" },
];

/**
 * About (2C-3): who runs Go Gulf, what it does, and what it holds itself to — told only
 * with what can be checked. The company was incorporated on 22 February 2024; any longer
 * history (the 2008 heritage) stays out until the business confirms whose experience it
 * is (decision D3), and even then it is attributed to that person, never to the company.
 * Mission, vision and values are the business's own words from the previous page.
 */
export default async function AboutPage() {
  const locale = await requireAvailable(PATH);
  const t = await getTranslator();
  const href = (path: string) => hrefIn(path, locale);

  return (
    <>
      <PageHeader
        crumbs={[{ name: pageText(pageEntry(PATH), locale).breadcrumb, path: PATH }]}
        kicker={t("aboutPage.kicker")}
        title={t("aboutPage.title")}
        lead={t("aboutPage.lead", {
          legalName: COMPANY.legalName,
          date: formatDate(COMPANY.incorporationISO, locale),
          place: `${COMPANY.address.locality}, ${COMPANY.address.region}`,
        })}
      />

      <Section labelledBy="about-what">
        <Container>
          <SectionHeading id="about-what" kicker={t("aboutPage.what.kicker")} title={t("aboutPage.what.title")} />
          <div className={styles.doors}>
            <article className={styles.door} aria-labelledby="about-seekers">
              <Icon name="briefcase" size={28} className={styles.doorIcon} />
              <h3 id="about-seekers" className={styles.h3}>
                {t("aboutPage.what.seekersTitle")}
              </h3>
              <p>{t("aboutPage.what.seekers")}</p>
              <Link href={href("/candidates")} className={styles.more}>
                {t("aboutPage.what.seekersLink")}
                <Icon name="arrow-right" size={18} />
              </Link>
            </article>
            <article className={styles.door} aria-labelledby="about-employers">
              <Icon name="building" size={28} className={styles.doorIcon} />
              <h3 id="about-employers" className={styles.h3}>
                {t("aboutPage.what.employersTitle")}
              </h3>
              <p>{t("aboutPage.what.employers")}</p>
              <Link href={href("/employers")} className={styles.more}>
                {t("aboutPage.what.employersLink")}
                <Icon name="arrow-right" size={18} />
              </Link>
            </article>
          </div>
        </Container>
      </Section>

      <Section tone="subtle" labelledBy="about-purpose">
        <Container>
          <h2 id="about-purpose" className={styles.hiddenHeading}>
            {t("aboutPage.purposeHeading")}
          </h2>
          <div className={styles.purpose}>
            <div className={styles.statement}>
              <p className={styles.kicker}>{t("aboutPage.mission.kicker")}</p>
              <h3 className={styles.statementTitle}>{t("aboutPage.mission.title")}</h3>
              <p>{t("aboutPage.mission.body")}</p>
            </div>
            <div className={styles.statement}>
              <p className={styles.kicker}>{t("aboutPage.vision.kicker")}</p>
              <h3 className={styles.statementTitle}>{t("aboutPage.vision.title")}</h3>
              <p>{t("aboutPage.vision.body")}</p>
            </div>
          </div>
        </Container>
      </Section>

      <Section labelledBy="about-rules">
        <Container>
          <SectionHeading id="about-rules" kicker={t("aboutPage.rules.kicker")} title={t("aboutPage.rules.title")} />
          <ul className={styles.rules}>
            {RULES.map((rule) => (
              <li key={rule.title} className={styles.rule}>
                <Icon name={rule.icon} size={24} className={styles.doorIcon} />
                <h3 className={styles.h3}>{t(rule.title)}</h3>
                <p>{t(rule.body)}</p>
              </li>
            ))}
          </ul>
          <p className={styles.links}>
            <Link href={href("/pricing")} className={styles.more}>
              {t("aboutPage.rules.pricing")}
            </Link>
            <Link href={href("/terms-and-conditions")} className={styles.more}>
              {t("aboutPage.rules.terms")}
            </Link>
          </p>
        </Container>
      </Section>

      <Section tone="subtle" labelledBy="about-values">
        <Container>
          <SectionHeading id="about-values" kicker={t("aboutPage.values.kicker")} title={t("aboutPage.values.title")} />
          <ul className={styles.values}>
            {VALUES.map((key) => (
              <li key={key}>{t(key)}</li>
            ))}
          </ul>
          <DevNotice decision="D3">
            If the business confirms whose industry experience dates to 2008, it can be told here — attributed to that
            person, never as the company&apos;s founding date (the company was incorporated in 2024).
          </DevNotice>
        </Container>
      </Section>

      <CompanyFacts id="about-facts" />

      <CtaBand
        id="about-cta"
        title={t("aboutPage.cta.title")}
        lead={t("aboutPage.cta.lead")}
        actions={
          <>
            <Button href={href("/verify")} variant="inverse" icon="shield">
              {t("aboutPage.cta.verify")}
            </Button>
            <Button href={href("/contact")} variant="ghostInverse">
              {t("aboutPage.cta.contact")}
            </Button>
          </>
        }
      />
    </>
  );
}
