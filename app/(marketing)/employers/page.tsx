import Link from "next/link";
import { EmployerRequirementForm } from "@/components/forms/EmployerRequirementForm";
import { CompanyFacts } from "@/components/site/CompanyFacts";
import { PageHeader } from "@/components/site/PageHeader";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Container, Section } from "@/components/ui/Layout";
import { LtrText } from "@/components/ui/LtrText";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Stepper } from "@/components/ui/Stepper";
import { BUSINESS_EMAIL, PHONE } from "@/content/channels";
import { pageEntry } from "@/content/pages";
import { SERVICES } from "@/content/services";
import { employerFormCopy } from "@/lib/i18n/forms";
import { hrefIn, pageText, serviceText } from "@/lib/i18n/pages";
import { getTranslator, localizedPageMetadata, requireAvailable } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translator";
import styles from "./employers.module.css";

const PATH = "/employers";

export async function generateMetadata() {
  return localizedPageMetadata(PATH);
}

const STEPS: { title: MessageKey; body: MessageKey }[] = [
  { title: "employersPage.process.s1Title", body: "employersPage.process.s1" },
  { title: "employersPage.process.s2Title", body: "employersPage.process.s2" },
  { title: "employersPage.process.s3Title", body: "employersPage.process.s3" },
  { title: "employersPage.process.s4Title", body: "employersPage.process.s4" },
  { title: "employersPage.process.s5Title", body: "employersPage.process.s5" },
  { title: "employersPage.process.s6Title", body: "employersPage.process.s6" },
];

const POINTS: { title: MessageKey; body: MessageKey }[] = [
  { title: "employersPage.working.p1Title", body: "employersPage.working.p1" },
  { title: "employersPage.working.p2Title", body: "employersPage.working.p2" },
  { title: "employersPage.working.p3Title", body: "employersPage.working.p3" },
];

/**
 * The employer page (2C-2): a business-to-business page with its own journey —
 * requirement → enquiry → Go Gulf responds → recruitment — kept apart from the
 * job-seeker one. It builds trust through process and plain terms, not through claims
 * (no candidate-pool sizes, sectors or verified-employer networks: the claims register
 * has not cleared them). The requirement form goes to the business desk.
 */
export default async function EmployersPage() {
  const locale = await requireAvailable(PATH);
  const t = await getTranslator();
  const href = (path: string) => hrefIn(path, locale);
  const copy = await employerFormCopy();
  const phone = <LtrText>{PHONE.value}</LtrText>;

  return (
    <>
      <PageHeader
        crumbs={[{ name: pageText(pageEntry(PATH), locale).breadcrumb, path: PATH }]}
        kicker={t("employersPage.kicker")}
        title={t("employersPage.title")}
        lead={t("employersPage.lead")}
      >
        <Button href="#requirement" icon="arrow-right" iconPosition="end">
          {t("employersPage.requirement")}
        </Button>
        <Button href={PHONE.href} variant="secondary" icon="phone">
          {t.rich("employersPage.callDesk", { phone })}
        </Button>
      </PageHeader>

      <Section labelledBy="employer-services">
        <Container>
          <SectionHeading id="employer-services" kicker={t("employersPage.services.kicker")} title={t("employersPage.services.title")} lead={t("employersPage.services.lead")} />
          <ul className={styles.services}>
            {SERVICES.filter((s) => s.audience === "employers").map((service) => {
              const text = serviceText(service, locale);
              return (
                <li key={service.id} className={styles.service}>
                  <h3 className={styles.serviceName}>{text.name}</h3>
                  <p>{text.summary}</p>
                </li>
              );
            })}
          </ul>
        </Container>
      </Section>

      <Section tone="subtle" labelledBy="employer-process">
        <Container>
          <SectionHeading id="employer-process" kicker={t("employersPage.process.kicker")} title={t("employersPage.process.title")} />
          <Stepper steps={STEPS.map((s) => ({ title: t(s.title), description: t(s.body) }))} label={t("employersPage.process.title")} />
        </Container>
      </Section>

      <Section labelledBy="employer-working">
        <Container>
          <SectionHeading id="employer-working" kicker={t("employersPage.working.kicker")} title={t("employersPage.working.title")} />
          <ul className={styles.points}>
            {POINTS.map((p) => (
              <li key={p.title} className={styles.point}>
                <Icon name="check" size={24} className={styles.pointIcon} />
                <h3 className={styles.pointTitle}>{t(p.title)}</h3>
                <p>{t(p.body)}</p>
              </li>
            ))}
          </ul>
          <p className={styles.pricing}>
            <Link href={href("/pricing")}>{t("employersPage.working.pricing")}</Link>
          </p>
        </Container>
      </Section>

      <CompanyFacts id="employer-facts" tone="subtle" />

      <Section id="requirement" labelledBy="requirement-heading">
        <Container>
          <div className={styles.formLayout}>
            <div className={styles.formColumn}>
              <SectionHeading id="requirement-heading" kicker={t("employersPage.form.kicker")} title={t("employersPage.form.title")} lead={t("employersPage.form.lead")} />
              <EmployerRequirementForm copy={copy} />
            </div>
            <aside className={styles.desk} aria-labelledby="desk-heading">
              <h3 id="desk-heading" className={styles.pointTitle}>
                {t("employersPage.form.asideHeading")}
              </h3>
              <p>{t("employersPage.form.asideBody")}</p>
              <dl className={styles.deskList}>
                <div>
                  <dt>{t("employersPage.form.email")}</dt>
                  <dd>
                    <a href={BUSINESS_EMAIL.href}>{BUSINESS_EMAIL.value}</a>
                  </dd>
                </div>
                <div>
                  <dt>{t("employersPage.form.phone")}</dt>
                  <dd>
                    <a href={PHONE.href}>{phone}</a>
                  </dd>
                </div>
              </dl>
              <p className={styles.deskNote}>{t("employersPage.working.p3")}</p>
            </aside>
          </div>
        </Container>
      </Section>
    </>
  );
}
