import Link from "next/link";
import { MCA_URL } from "@/components/site/CompanyFacts";
import { OfficialChannels } from "@/components/site/OfficialChannels";
import { PageHeader } from "@/components/site/PageHeader";
import { FactList, type Fact } from "@/components/ui/FactList";
import { Icon } from "@/components/ui/Icon";
import { Container, Section } from "@/components/ui/Layout";
import { LtrText } from "@/components/ui/LtrText";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { VisuallyHidden } from "@/components/ui/VisuallyHidden";
import { BUSINESS_EMAIL, PHONE } from "@/content/channels";
import { COMPANY } from "@/content/company";
import { pageEntry } from "@/content/pages";
import { formatDate } from "@/lib/i18n/format";
import { hrefIn, pageText } from "@/lib/i18n/pages";
import { getTranslator, localizedPageMetadata, requireAvailable } from "@/lib/i18n/server";
import styles from "./verify.module.css";

const PATH = "/verify";

export async function generateMetadata() {
  return localizedPageMetadata(PATH);
}

/**
 * "Is Go Gulf genuine?" — answered with facts a stranger can check independently.
 * Every statement here is either an MCA fact (lib/legal.js), a confirmed channel
 * (content/channels.ts), or wording from the published policies.
 *
 * The record's values (names, numbers, the address) are data and stay as registered; the
 * words around them come from the catalogues, so the page translates like any other.
 *
 * Company registration is not recruitment-agency licensing. The page shows what the
 * CIN proves — that the company exists and is registered — and says plainly that it is
 * not a licence for a line of business. There is no licence section: the company holds
 * no recruiting-agent registration (content/company.ts CLAIMS), and none is implied.
 */
export default async function VerifyPage() {
  const locale = await requireAvailable(PATH);
  const t = await getTranslator();
  const href = (path: string) => hrefIn(path, locale);

  const facts: Fact[] = [
    { key: "legal-name", label: t("verifyPage.facts.legalName"), value: COMPANY.legalName },
    { key: "brand", label: t("verifyPage.facts.brand"), value: COMPANY.brand },
    { key: "cin", label: t("verifyPage.facts.cin"), value: <LtrText>{COMPANY.cin}</LtrText>, mono: true },
    { key: "type", label: t("verifyPage.facts.type"), value: COMPANY.companyType },
    { key: "incorporated", label: t("verifyPage.facts.incorporated"), value: <time dateTime={COMPANY.incorporationISO}>{formatDate(COMPANY.incorporationISO, locale)}</time> },
    { key: "registrar", label: t("verifyPage.facts.registrar"), value: COMPANY.roc },
    { key: "activity", label: t("verifyPage.facts.activity"), value: COMPANY.registeredActivity },
    {
      key: "office",
      label: t("verifyPage.facts.office"),
      value: (
        <address className={styles.address}>
          {COMPANY.addressLines.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </address>
      ),
    },
    { key: "gstin", label: t("verifyPage.facts.gstin"), value: <LtrText>{COMPANY.gstin}</LtrText>, mono: true },
  ];

  return (
    <>
      <PageHeader
        crumbs={[{ name: pageText(pageEntry(PATH), locale).breadcrumb, path: PATH }]}
        kicker={t("verifyPage.kicker")}
        title={t("verifyPage.title")}
        lead={t("verifyPage.lead")}
      />

      <Section labelledBy="company-heading">
        <Container>
          <div className={styles.grid}>
            <div className={styles.block}>
              <SectionHeading id="company-heading" title={t("verifyPage.company.heading")} lead={t("verifyPage.company.body", { legalName: COMPANY.legalName })} />
              <FactList items={facts} />
              <p className={styles.note}>{t("verifyPage.company.registration")}</p>
              <p className={styles.links}>
                <a href={MCA_URL} target="_blank" rel="noopener noreferrer">
                  {t("verifyPage.company.mca")}
                  <VisuallyHidden> {t("common.opensInNewTab")}</VisuallyHidden>
                </a>
              </p>
            </div>

            <aside className={styles.channels} aria-labelledby="channels-heading">
              <h2 id="channels-heading" className={styles.h2}>
                <Icon name="shield" size={24} className={styles.icon} />
                {t("verifyPage.channels.heading")}
              </h2>
              <p>{t("verifyPage.channels.body")}</p>
              <OfficialChannels />
            </aside>
          </div>
        </Container>
      </Section>

      <Section tone="subtle" labelledBy="payments-heading">
        <Container width="prose">
          <SectionHeading id="payments-heading" title={t("verifyPage.payments.heading")} />
          <ol className={styles.rules}>
            <li>{t.rich("verifyPage.payments.r1", { pricing: (chunks) => <Link href={href("/pricing")}>{chunks}</Link> })}</li>
            <li>{t("verifyPage.payments.r2")}</li>
            <li>{t.rich("verifyPage.payments.r3", { terms: (chunks) => <Link href={href("/terms-and-conditions")}>{chunks}</Link> })}</li>
          </ol>
        </Container>
      </Section>

      <Section labelledBy="report-heading">
        <Container width="prose">
          <SectionHeading id="report-heading" title={t("verifyPage.report.heading")} />
          <p className={styles.report}>
            {t.rich("verifyPage.report.body", {
              email: <a href={BUSINESS_EMAIL.href}>{BUSINESS_EMAIL.value}</a>,
              phone: (
                <a href={PHONE.href}>
                  <LtrText>{PHONE.value}</LtrText>
                </a>
              ),
            })}
          </p>
        </Container>
      </Section>
    </>
  );
}
