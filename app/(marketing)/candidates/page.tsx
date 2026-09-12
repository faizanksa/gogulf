import Link from "next/link";
import { CtaBand } from "@/components/site/CtaBand";
import { OfficialChannels } from "@/components/site/OfficialChannels";
import { PageHeader } from "@/components/site/PageHeader";
import { ProcessSteps } from "@/components/site/ProcessSteps";
import { MCA_URL } from "@/components/site/CompanyFacts";
import { Button } from "@/components/ui/Button";
import { Disclosure } from "@/components/ui/Disclosure";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Container, Section } from "@/components/ui/Layout";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { VisuallyHidden } from "@/components/ui/VisuallyHidden";
import { whatsappLink } from "@/content/channels";
import { pageEntry } from "@/content/pages";
import { hrefIn, pageText } from "@/lib/i18n/pages";
import { getTranslator, localizedPageMetadata, requireAvailable } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translator";
import styles from "./candidates.module.css";

const PATH = "/candidates";

export async function generateMetadata() {
  return localizedPageMetadata(PATH);
}

const SECTIONS: { id: string; label: MessageKey }[] = [
  { id: "steps", label: "candidatesPage.nav.steps" },
  { id: "documents", label: "candidatesPage.nav.documents" },
  { id: "fees", label: "candidatesPage.nav.fees" },
  { id: "safety", label: "candidatesPage.nav.safety" },
  { id: "questions", label: "candidatesPage.nav.questions" },
];

const CHECKS: { icon: IconName; title: MessageKey; body: MessageKey }[] = [
  { icon: "phone", title: "candidatesPage.safety.check1Title", body: "candidatesPage.safety.check1" },
  { icon: "file", title: "candidatesPage.safety.check2Title", body: "candidatesPage.safety.check2" },
  { icon: "building", title: "candidatesPage.safety.check3Title", body: "candidatesPage.safety.check3" },
  { icon: "info", title: "candidatesPage.safety.check4Title", body: "candidatesPage.safety.check4" },
];

/**
 * The job-seeker hub (2C-2): for someone who may know little about Gulf recruitment and
 * is right to be wary. Plain words, in the order the questions come: how it works, what
 * you need, what it costs, how not to be cheated, then the common questions.
 *
 * Every answer restates something already approved — the policies, the business's own
 * process, the facts of the application form. Nothing here is a new promise.
 */
export default async function CandidatesPage() {
  const locale = await requireAvailable(PATH);
  const t = await getTranslator();
  const href = (path: string) => hrefIn(path, locale);
  const opensWhatsApp = t("common.opensWhatsApp");
  const whatsapp = whatsappLink(t("candidatesPage.whatsappGreeting"));
  const links = {
    terms: (chunks: React.ReactNode[]) => <Link href={href("/terms-and-conditions")}>{chunks}</Link>,
    pricing: (chunks: React.ReactNode[]) => <Link href={href("/pricing")}>{chunks}</Link>,
    verify: (chunks: React.ReactNode[]) => <Link href={href("/verify")}>{chunks}</Link>,
  };

  return (
    <>
      <PageHeader
        crumbs={[{ name: pageText(pageEntry(PATH), locale).breadcrumb, path: PATH }]}
        kicker={t("candidatesPage.kicker")}
        title={t("candidatesPage.title")}
        lead={t("candidatesPage.lead")}
        aside={
          <nav className={styles.toc} aria-label={t("candidatesPage.onThisPage")}>
            <p className={styles.tocHeading}>{t("candidatesPage.onThisPage")}</p>
            <ol className={styles.tocList}>
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`}>{t(s.label)}</a>
                </li>
              ))}
            </ol>
          </nav>
        }
      >
        <Button href={href("/jobs")} icon="arrow-right" iconPosition="end">
          {t("candidatesPage.findJob")}
        </Button>
        <Button href={whatsapp} variant="secondary" icon="whatsapp" opensWhatsApp={opensWhatsApp}>
          {t("candidatesPage.ask")}
        </Button>
      </PageHeader>

      <Section id="steps" labelledBy="steps-heading">
        <Container>
          <SectionHeading id="steps-heading" kicker={t("candidatesPage.steps.kicker")} title={t("candidatesPage.steps.title")} lead={t("candidatesPage.steps.lead")} />
          <ProcessSteps tone="on-white" />
        </Container>
      </Section>

      <Section id="documents" tone="subtle" labelledBy="documents-heading">
        <Container>
          <SectionHeading id="documents-heading" kicker={t("candidatesPage.documents.kicker")} title={t("candidatesPage.documents.title")} lead={t("candidatesPage.documents.lead")} />
          <div className={styles.columns}>
            <div className={styles.panel}>
              <h3 className={styles.h3}>{t("candidatesPage.documents.applyHeading")}</h3>
              <ul className={styles.checklist}>
                {(["candidatesPage.documents.apply1", "candidatesPage.documents.apply2", "candidatesPage.documents.apply3"] as const).map((key) => (
                  <li key={key}>
                    <Icon name="file" size={20} />
                    {t(key)}
                  </li>
                ))}
              </ul>
              <p className={styles.panelAction}>
                <Link href={href("/jobs/apply")}>{t("candidatesPage.documents.applyLink")}</Link>
              </p>
            </div>
            <div className={styles.panel}>
              <h3 className={styles.h3}>{t("candidatesPage.documents.laterHeading")}</h3>
              <ul className={styles.checklist}>
                {(["candidatesPage.documents.later1", "candidatesPage.documents.later2", "candidatesPage.documents.later3"] as const).map((key) => (
                  <li key={key}>
                    <Icon name="calendar" size={20} />
                    {t(key)}
                  </li>
                ))}
              </ul>
              <p className={styles.panelNote}>{t("candidatesPage.documents.laterNote")}</p>
            </div>
          </div>
        </Container>
      </Section>

      <Section id="fees" labelledBy="fees-heading">
        <Container>
          <div className={styles.split}>
            <SectionHeading id="fees-heading" kicker={t("candidatesPage.fees.kicker")} title={t("candidatesPage.fees.title")} lead={t("candidatesPage.fees.lead")} />
            <div>
              <ol className={styles.rules}>
                {(["candidatesPage.fees.rule1", "candidatesPage.fees.rule2", "candidatesPage.fees.rule3", "candidatesPage.fees.rule4"] as const).map((key) => (
                  <li key={key}>{t(key)}</li>
                ))}
              </ol>
              <p className={styles.links}>
                <Link href={href("/pricing")}>{t("candidatesPage.fees.pricing")}</Link>
                <Link href={href("/cancellation-and-refunds")}>{t("candidatesPage.fees.refunds")}</Link>
              </p>
            </div>
          </div>
        </Container>
      </Section>

      <Section id="safety" tone="subtle" labelledBy="safety-heading">
        <Container>
          <SectionHeading id="safety-heading" kicker={t("candidatesPage.safety.kicker")} title={t("candidatesPage.safety.title")} lead={t("candidatesPage.safety.lead")} />
          <div className={styles.safety}>
            <ul className={styles.checks}>
              {CHECKS.map((check) => (
                <li key={check.title} className={styles.check}>
                  <Icon name={check.icon} size={24} className={styles.checkIcon} />
                  <h3 className={styles.h3}>{t(check.title)}</h3>
                  <p>{t(check.body)}</p>
                </li>
              ))}
            </ul>
            <div className={styles.channels}>
              <h3 className={styles.h3}>{t("candidatesPage.safety.channelsHeading")}</h3>
              <OfficialChannels />
              <p className={styles.links}>
                <Link href={href("/verify")}>
                  <Icon name="shield" size={18} />
                  {t("candidatesPage.safety.verify")}
                </Link>
                <a href={MCA_URL} target="_blank" rel="noopener noreferrer">
                  {t("candidatesPage.safety.mca")}
                  <VisuallyHidden> {t("common.opensInNewTab")}</VisuallyHidden>
                </a>
              </p>
            </div>
          </div>
        </Container>
      </Section>

      <Section id="questions" labelledBy="questions-heading">
        <Container width="prose">
          <SectionHeading id="questions-heading" kicker={t("candidatesPage.faq.kicker")} title={t("candidatesPage.faq.title")} />
          <div className={styles.faq}>
            <Disclosure summary={t("candidatesPage.faq.q1")}>
              <p>{t.rich("candidatesPage.faq.a1", { terms: links.terms })}</p>
            </Disclosure>
            <Disclosure summary={t("candidatesPage.faq.q2")}>
              <p>{t.rich("candidatesPage.faq.a2", { pricing: links.pricing })}</p>
            </Disclosure>
            <Disclosure summary={t("candidatesPage.faq.q3")}>
              <p>{t("candidatesPage.faq.a3")}</p>
            </Disclosure>
            <Disclosure summary={t("candidatesPage.faq.q4")}>
              <p>{t("candidatesPage.faq.a4")}</p>
            </Disclosure>
            <Disclosure summary={t("candidatesPage.faq.q5")}>
              <p>{t("candidatesPage.faq.a5")}</p>
            </Disclosure>
            <Disclosure summary={t("candidatesPage.faq.q6")}>
              <p>{t.rich("candidatesPage.faq.a6", { verify: links.verify })}</p>
            </Disclosure>
          </div>
        </Container>
      </Section>

      <CtaBand
        id="candidates-cta"
        title={t("candidatesPage.cta.title")}
        lead={t("candidatesPage.cta.lead")}
        actions={
          <>
            <Button href={href("/jobs")} variant="inverse">
              {t("candidatesPage.cta.findJob")}
            </Button>
            <Button href={href("/jobs/apply")} variant="ghostInverse">
              {t("candidatesPage.cta.general")}
            </Button>
          </>
        }
      />
    </>
  );
}
