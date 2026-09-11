import Link from "next/link";
import { DevNotice } from "@/components/site/DevNotice";
import { OfficialChannels } from "@/components/site/OfficialChannels";
import { PageHeader } from "@/components/site/PageHeader";
import { Container, Section } from "@/components/ui/Layout";
import { VisuallyHidden } from "@/components/ui/VisuallyHidden";
import { BUSINESS_EMAIL, PHONE } from "@/content/channels";
import { COMPANY } from "@/content/company";
import { pageMetadata } from "@/lib/seo";
import styles from "./verify.module.css";

export const metadata = pageMetadata("/verify");

/**
 * "Is Go Gulf genuine?" — answered with facts a stranger can check independently.
 * Every statement here is either an MCA fact (lib/legal.js), a confirmed channel
 * (content/channels.ts), or wording from the published policies.
 */
export default function VerifyPage() {
  const facts: { label: string; value: React.ReactNode }[] = [
    { label: "Legal name", value: COMPANY.legalName },
    { label: "Trading as", value: COMPANY.brand },
    { label: "Corporate Identity Number (CIN)", value: <span className={styles.mono}>{COMPANY.cin}</span> },
    { label: "Company type", value: COMPANY.companyType },
    { label: "Incorporated", value: <time dateTime={COMPANY.incorporationISO}>{COMPANY.incorporationDate}</time> },
    { label: "Registrar", value: COMPANY.roc },
    { label: "Registered business activity", value: COMPANY.registeredActivity },
    {
      label: "Registered office",
      value: (
        <address className={styles.address}>
          {COMPANY.addressLines.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </address>
      ),
    },
    { label: "GSTIN", value: <span className={styles.mono}>{COMPANY.gstin}</span> },
  ];

  return (
    <>
      <PageHeader
        crumbs={[{ name: "Verify Go Gulf", path: "/verify" }]}
        title="How to check you are dealing with Go Gulf"
        lead="Before you share documents or pay anything, check these details. Each one can be confirmed independently of us."
      />

      <Section labelledBy="company-heading">
        <Container>
          <div className={styles.grid}>
            <div className={styles.block}>
              <h2 id="company-heading" className={styles.h2}>
                The company behind Go Gulf
              </h2>
              <p>
                Go Gulf is a brand of {COMPANY.legalName}. You can look the company up on the Ministry of Corporate Affairs
                website using its CIN.
              </p>
              <dl className={styles.facts}>
                {facts.map((f) => (
                  <div key={f.label} className={styles.fact}>
                    <dt>{f.label}</dt>
                    <dd>{f.value}</dd>
                  </div>
                ))}
              </dl>
              <p>
                <a href="https://www.mca.gov.in/" target="_blank" rel="noopener noreferrer">
                  Ministry of Corporate Affairs website
                  <VisuallyHidden> (opens in a new tab)</VisuallyHidden>
                </a>
              </p>
            </div>

            <div className={styles.block}>
              <h2 id="channels-heading" className={styles.h2}>
                Our official contact details
              </h2>
              <p>
                If someone claiming to be Go Gulf contacts you from a different number or address, check with us on these
                details before you act.
              </p>
              <OfficialChannels />
            </div>
          </div>
        </Container>
      </Section>

      <Section tone="subtle" labelledBy="payments-heading">
        <Container width="prose">
          <div className={styles.block}>
            <h2 id="payments-heading" className={styles.h2}>
              Our rules about payments
            </h2>
            <ul className={styles.list}>
              <li>
                Every fee is quoted to you in writing before you pay. See <Link href="/pricing">Pricing &amp; fees</Link>.
              </li>
              <li>
                If you are asked to pay an account or a person that we have not confirmed to you in writing, stop and contact
                us before paying.
              </li>
              <li>
                We do not guarantee selection, employment, a visa or a joining date. See our{" "}
                <Link href="/terms-and-conditions">Terms &amp; conditions</Link>.
              </li>
            </ul>
          </div>
        </Container>
      </Section>

      <Section labelledBy="report-heading">
        <Container width="prose">
          <div className={styles.block}>
            <h2 id="report-heading" className={styles.h2}>
              If something does not feel right
            </h2>
            <p>
              Tell us before you pay or send documents. Email <a href={BUSINESS_EMAIL.href}>{BUSINESS_EMAIL.value}</a> or call{" "}
              <a href={PHONE.href}>{PHONE.value}</a>.
            </p>
            <DevNotice decision="D1">
              Once the business confirms whether it holds an overseas Recruiting Agent registration, the registration number
              and how to check it on the government’s eMigrate portal belong on this page.
            </DevNotice>
          </div>
        </Container>
      </Section>
    </>
  );
}
