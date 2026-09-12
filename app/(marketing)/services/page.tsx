import Link from "next/link";
import { ServiceInquiryForm } from "@/components/forms/ServiceInquiryForm";
import { OfficialChannels } from "@/components/site/OfficialChannels";
import { PageHeader } from "@/components/site/PageHeader";
import { Icon } from "@/components/ui/Icon";
import { Container, Section } from "@/components/ui/Layout";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { VisuallyHidden } from "@/components/ui/VisuallyHidden";
import { pageEntry } from "@/content/pages";
import { SERVICES, type Service } from "@/content/services";
import { serviceInquiryCopy } from "@/lib/i18n/forms";
import { hrefIn, pageText, serviceText } from "@/lib/i18n/pages";
import { getTranslator, localizedPageMetadata, requireAvailable } from "@/lib/i18n/server";
import styles from "./services.module.css";

const PATH = "/services";

export async function generateMetadata() {
  return localizedPageMetadata(PATH);
}

/**
 * The service catalogue (2C-3), organised by who the service is for. Each service says
 * what it is and leads to the enquiry form with that service chosen; the form routes it
 * to the right desk server-side. Only services the business already lists are shown
 * (content/services.ts) — nothing is added to fill the page. The #inquiry anchor from
 * the old page still works.
 */
export default async function ServicesPage() {
  const locale = await requireAvailable(PATH);
  const t = await getTranslator();
  const href = (path: string) => hrefIn(path, locale);
  const copy = await serviceInquiryCopy();

  const cards = (audience: Service["audience"]) =>
    SERVICES.filter((s) => s.audience === audience).map((service) => {
      const text = serviceText(service, locale);
      return (
        <li key={service.id} id={`service-${service.id}`} className={styles.card}>
          <h3 className={styles.name}>{text.name}</h3>
          <p className={styles.summary}>{text.summary}</p>
          {service.inquiryOption ? (
            <a href={`?service=${service.id}#inquiry`} className={styles.ask}>
              {t("servicesPage.ask")}
              <VisuallyHidden>: {text.name}</VisuallyHidden>
              <Icon name="arrow-right" size={18} />
            </a>
          ) : null}
        </li>
      );
    });

  return (
    <>
      <PageHeader
        crumbs={[{ name: pageText(pageEntry(PATH), locale).breadcrumb, path: PATH }]}
        kicker={t("servicesPage.kicker")}
        title={t("servicesPage.title")}
        lead={t("servicesPage.lead")}
        aside={
          <nav className={styles.jump} aria-label={t("servicesPage.jumpLabel")}>
            <a href="#job-seekers" className={styles.jumpLink}>
              <Icon name="briefcase" size={20} />
              {t("servicesPage.seekersHeading")}
            </a>
            <a href="#employers" className={styles.jumpLink}>
              <Icon name="building" size={20} />
              {t("servicesPage.employersHeading")}
            </a>
            <a href="#inquiry" className={styles.jumpLink}>
              <Icon name="mail" size={20} />
              {t("servicesPage.inquiry.title")}
            </a>
          </nav>
        }
      />

      <Section id="job-seekers" labelledBy="seekers-heading">
        <Container>
          <SectionHeading id="seekers-heading" title={t("servicesPage.seekersHeading")} lead={t("servicesPage.seekersLead")} />
          <ul className={styles.grid}>{cards("job-seekers")}</ul>
        </Container>
      </Section>

      <Section id="employers" tone="subtle" labelledBy="employers-heading">
        <Container>
          <SectionHeading
            id="employers-heading"
            title={t("servicesPage.employersHeading")}
            lead={t("servicesPage.employersLead")}
            action={
              <Link href={`${href("/employers")}#requirement`} className={styles.more}>
                {t("servicesPage.employerForm")}
                <Icon name="arrow-right" size={18} />
              </Link>
            }
          />
          <ul className={styles.grid}>{cards("employers")}</ul>
        </Container>
      </Section>

      <Section id="inquiry" labelledBy="inquiry-heading">
        <Container>
          <div className={styles.formLayout}>
            <div className={styles.formColumn}>
              <SectionHeading id="inquiry-heading" kicker={t("servicesPage.inquiry.kicker")} title={t("servicesPage.inquiry.title")} lead={t("servicesPage.inquiry.lead")} />
              <ServiceInquiryForm copy={copy} />
            </div>
            <aside className={styles.aside} aria-labelledby="inquiry-aside-heading">
              <h3 id="inquiry-aside-heading" className={styles.name}>
                {t("servicesPage.inquiry.asideHeading")}
              </h3>
              <p>{t.rich("servicesPage.inquiry.free", { pricing: (chunks) => <Link href={href("/pricing")}>{chunks}</Link> })}</p>
              <OfficialChannels />
            </aside>
          </div>
        </Container>
      </Section>
    </>
  );
}
