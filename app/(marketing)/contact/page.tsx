import Link from "next/link";
import { ContactForm } from "@/components/forms/ContactForm";
import { OfficialChannels } from "@/components/site/OfficialChannels";
import { PageHeader } from "@/components/site/PageHeader";
import { Button } from "@/components/ui/Button";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Container, Section } from "@/components/ui/Layout";
import { LtrText } from "@/components/ui/LtrText";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { PHONE, whatsappLink } from "@/content/channels";
import { COMPANY } from "@/content/company";
import { pageEntry } from "@/content/pages";
import { contactFormCopy } from "@/lib/i18n/forms";
import { hrefIn, pageText } from "@/lib/i18n/pages";
import { getTranslator, localizedPageMetadata, requireAvailable } from "@/lib/i18n/server";
import styles from "./contact.module.css";

const PATH = "/contact";

export async function generateMetadata() {
  return localizedPageMetadata(PATH);
}

/**
 * Contact (2C-3). People arrive here for four different reasons, and each has a better
 * route than a general message: a job (apply online), help (WhatsApp, phone or a service
 * enquiry), hiring (the employer requirement form) and anything else (the message form
 * below). Each route uses an existing, verified submission path — the contact form still
 * posts to /api/forms/contact exactly as before, so its Resend flow is untouched.
 *
 * The WhatsApp channel and YouTube links the old page carried are not listed: the
 * business has not confirmed it owns them (content/channels.ts).
 */
export default async function ContactPage() {
  const locale = await requireAvailable(PATH);
  const t = await getTranslator();
  const href = (path: string) => hrefIn(path, locale);
  const copy = await contactFormCopy();
  const opensWhatsApp = t("common.opensWhatsApp");
  const phone = <LtrText>{PHONE.value}</LtrText>;

  const purposes: { id: string; icon: IconName; title: string; body: string; actions: React.ReactNode }[] = [
    {
      id: "job",
      icon: "briefcase",
      title: t("contactPage.job.title"),
      body: t("contactPage.job.body"),
      actions: (
        <>
          <Button href={href("/jobs")} size="sm">
            {t("contactPage.job.find")}
          </Button>
          <Link href={href("/jobs/apply")} className={styles.more}>
            {t("contactPage.job.general")}
          </Link>
        </>
      ),
    },
    {
      id: "assisted",
      icon: "whatsapp",
      title: t("contactPage.assisted.title"),
      body: t("contactPage.assisted.body"),
      actions: (
        <>
          <Button href={whatsappLink(t("contactPage.assisted.greeting"))} variant="whatsapp" size="sm" icon="whatsapp" opensWhatsApp={opensWhatsApp}>
            {t("contactPage.assisted.whatsapp")}
          </Button>
          <a href={PHONE.href} className={styles.more}>
            {t.rich("contactPage.assisted.call", { phone })}
          </a>
          <Link href={`${href("/services")}#inquiry`} className={styles.more}>
            {t("contactPage.assisted.service")}
          </Link>
        </>
      ),
    },
    {
      id: "employer",
      icon: "building",
      title: t("contactPage.employer.title"),
      body: t("contactPage.employer.body"),
      actions: (
        <Button href={`${href("/employers")}#requirement`} variant="secondary" size="sm">
          {t("contactPage.employer.cta")}
        </Button>
      ),
    },
    {
      id: "general",
      icon: "mail",
      title: t("contactPage.general.title"),
      body: t("contactPage.general.body"),
      actions: (
        <a href="#message" className={styles.more}>
          {t("contactPage.general.cta")}
        </a>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        crumbs={[{ name: pageText(pageEntry(PATH), locale).breadcrumb, path: PATH }]}
        kicker={t("contactPage.kicker")}
        title={t("contactPage.title")}
        lead={t("contactPage.lead")}
      />

      <Section labelledBy="contact-purpose">
        <Container>
          <SectionHeading id="contact-purpose" title={t("contactPage.purposeHeading")} />
          <ul className={styles.purposes}>
            {purposes.map((p) => (
              <li key={p.id} className={styles.purpose} aria-labelledby={`purpose-${p.id}`}>
                <Icon name={p.icon} size={24} className={styles.icon} />
                <h3 id={`purpose-${p.id}`} className={styles.h3}>
                  {p.title}
                </h3>
                <p>{p.body}</p>
                <div className={styles.actions}>{p.actions}</div>
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      <Section id="message" tone="subtle" labelledBy="message-heading">
        <Container>
          <div className={styles.formLayout}>
            <div className={styles.formColumn}>
              <SectionHeading id="message-heading" kicker={t("contactPage.form.kicker")} title={t("contactPage.form.title")} lead={t("contactPage.form.lead")} />
              <ContactForm copy={copy} />
              <p className={styles.policies}>
                {t.rich("contactPage.form.policies", {
                  privacy: (chunks) => <Link href={href("/privacy-policy")}>{chunks}</Link>,
                  terms: (chunks) => <Link href={href("/terms-and-conditions")}>{chunks}</Link>,
                })}
              </p>
            </div>
            <aside className={styles.aside} aria-label={t("contactPage.aside.label")}>
              <div className={styles.asideBlock}>
                <h3 className={styles.h3}>{t("contactPage.aside.channels")}</h3>
                <OfficialChannels />
              </div>
              <div className={styles.asideBlock}>
                <h3 className={styles.h3}>{t("contactPage.aside.office")}</h3>
                <p className={styles.legalName}>{COMPANY.legalName}</p>
                <address className={styles.address}>
                  {COMPANY.addressLines.map((line) => (
                    <span key={line}>{line}</span>
                  ))}
                </address>
                <p className={styles.gstin}>
                  {t("contactPage.aside.gstin")} <span className={styles.mono}>{COMPANY.gstin}</span>
                </p>
              </div>
            </aside>
          </div>
        </Container>
      </Section>
    </>
  );
}
