import Link from "next/link";
import { Container, Section } from "@/components/ui/Layout";
import { FactList } from "@/components/ui/FactList";
import { Icon } from "@/components/ui/Icon";
import { LtrText } from "@/components/ui/LtrText";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { VisuallyHidden } from "@/components/ui/VisuallyHidden";
import { COMPANY } from "@/content/company";
import { formatDate } from "@/lib/i18n/format";
import { DEFAULT, LOCALES } from "@/lib/i18n/locales";
import { hrefIn } from "@/lib/i18n/pages";
import { getTranslator } from "@/lib/i18n/server";
import styles from "./CompanyFacts.module.css";

/** The MCA's public company search — where the CIN can be checked, independently of us. */
export const MCA_URL = "https://www.mca.gov.in/";

/**
 * "Check us before you trust us": the verified company facts as a band. Every value
 * comes from lib/legal.js through content/company.ts, and each can be checked
 * independently — which is the point. Nothing here is a claim that needs evidence.
 */
export async function CompanyFacts({ id = "company-facts", tone = "default" }: { id?: string; tone?: "default" | "subtle" }) {
  const t = await getTranslator();
  const englishText = t.locale === DEFAULT ? undefined : LOCALES[DEFAULT].tag;

  return (
    <Section tone={tone} spacing="tight" labelledBy={id} divided={tone === "default"}>
      <Container>
        <div className={styles.band}>
          <SectionHeading id={id} level={2} kicker={t("companyFacts.kicker")} title={t("companyFacts.heading")} lead={t("companyFacts.lead")} />
          <FactList
            layout="grid"
            items={[
              { key: "company", label: t("companyFacts.company"), value: <span lang={englishText}>{COMPANY.legalName}</span> },
              { key: "cin", label: t("companyFacts.cin"), value: <LtrText>{COMPANY.cin}</LtrText>, mono: true },
              {
                key: "incorporated",
                label: t("companyFacts.incorporated"),
                value: <time dateTime={COMPANY.incorporationISO}>{formatDate(COMPANY.incorporationISO, t.locale)}</time>,
              },
              { key: "office", label: t("companyFacts.office"), value: t("companyFacts.officeValue", { city: COMPANY.address.locality, region: COMPANY.address.region }) },
              { key: "fees", label: t("companyFacts.fees"), value: t("companyFacts.feesValue") },
            ]}
          />
          <p className={styles.links}>
            <Link href={hrefIn("/verify", t.locale)} className={styles.link}>
              <Icon name="shield" size={18} />
              {t("companyFacts.verifyLink")}
            </Link>
            <a href={MCA_URL} target="_blank" rel="noopener noreferrer" className={styles.link}>
              <Icon name="external" size={18} />
              {t("companyFacts.mcaLink")}
              <VisuallyHidden> {t("common.opensInNewTab")}</VisuallyHidden>
            </a>
          </p>
        </div>
      </Container>
    </Section>
  );
}
