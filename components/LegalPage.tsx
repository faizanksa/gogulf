import Link from "next/link";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/site/PageHeader";
import { Container, Section } from "@/components/ui/Layout";
import { LtrText } from "@/components/ui/LtrText";
import { VisuallyHidden } from "@/components/ui/VisuallyHidden";
import { pageEntry } from "@/content/pages";
import { ADDRESS_LINES, LEGAL_ENTITY, LEGAL_PAGES, POLICY_EFFECTIVE_DATE, POLICY_EFFECTIVE_ISO } from "@/lib/legal";
import { getTranslator } from "@/lib/i18n/server";
import { CONTACT } from "@/lib/seo";
import styles from "./LegalPage.module.css";

/**
 * Shared shell for the policy pages (2C-4 presentation). Only the presentation changed:
 * every word the shell shows is the wording it showed before, and each page's sections
 * are passed in untouched. A policy page is still just an array of { id, heading, body };
 * the contents list is generated from the same array, so it cannot drift from the
 * headings.
 */

interface LegalSection {
  id: string;
  heading: string;
  body: ReactNode;
}

const CONTACT_SECTION = { id: "contact-details", heading: "How to contact us about this policy" };

export default async function LegalPage({
  title,
  eyebrow,
  path,
  intro,
  sections,
}: {
  title: string;
  eyebrow?: string;
  path: string;
  intro?: string;
  sections: LegalSection[];
}) {
  const t = await getTranslator();
  const otherPages = (LEGAL_PAGES as { label: string; path: string }[]).filter((p) => p.path !== path);
  // The contact block is rendered here rather than passed in, so it is added to the
  // contents list explicitly — otherwise it would be the one section nobody can jump to.
  const tocEntries = [...sections, CONTACT_SECTION];
  const number = (i: number) => String(i + 1).padStart(2, "0");

  return (
    <>
      <PageHeader
        crumbs={[{ name: pageEntry(path).breadcrumb, path }]}
        kicker={eyebrow || "Legal"}
        title={title}
        lead={intro}
        aside={
          <ul className={styles.meta}>
            <li>
              Last updated:{" "}
              <strong>
                <time dateTime={POLICY_EFFECTIVE_ISO}>{POLICY_EFFECTIVE_DATE}</time>
              </strong>
            </li>
            <li>
              Operated by <strong>{LEGAL_ENTITY.name}</strong>
            </li>
            <li>
              GSTIN{" "}
              <strong className={styles.mono}>
                <LtrText>{LEGAL_ENTITY.gstin}</LtrText>
              </strong>
            </li>
          </ul>
        }
      />

      <Section>
        <Container>
          <div className={styles.layout}>
            <nav className={styles.toc} aria-label="On this page">
              <h2 className={styles.tocHeading}>On this page</h2>
              <ol className={styles.tocList}>
                {tocEntries.map((s) => (
                  <li key={s.id}>
                    <a href={`#${s.id}`}>{s.heading}</a>
                  </li>
                ))}
              </ol>
            </nav>

            <div className={styles.prose}>
              {sections.map((s, i) => (
                <section key={s.id} id={s.id} className={styles.section}>
                  <h2 className={styles.heading}>
                    <span className={styles.num} aria-hidden="true">
                      {number(i)}
                    </span>
                    <span>{s.heading}</span>
                  </h2>
                  {s.body}
                </section>
              ))}

              <section id={CONTACT_SECTION.id} className={styles.section}>
                <h2 className={styles.heading}>
                  <span className={styles.num} aria-hidden="true">
                    {number(sections.length)}
                  </span>
                  <span>{CONTACT_SECTION.heading}</span>
                </h2>
                <p>
                  If you have a question, a correction or a grievance relating to this policy, contact us using any of the
                  details below and we will respond.
                </p>
                <dl className={styles.contact}>
                  <div>
                    <dt>Legal entity</dt>
                    <dd>
                      {LEGAL_ENTITY.name} ({LEGAL_ENTITY.constitution})
                    </dd>
                  </div>
                  <div>
                    <dt>Brand / website</dt>
                    <dd>{LEGAL_ENTITY.brand} — www.gogulf.co</dd>
                  </div>
                  <div>
                    <dt>GSTIN</dt>
                    <dd className={styles.mono}>
                      <LtrText>{LEGAL_ENTITY.gstin}</LtrText>
                    </dd>
                  </div>
                  <div>
                    <dt>Registered address</dt>
                    <dd>
                      <address className={styles.address}>
                        {ADDRESS_LINES.map((line: string) => (
                          <span key={line}>{line}</span>
                        ))}
                      </address>
                    </dd>
                  </div>
                  <div>
                    <dt>Candidate queries</dt>
                    <dd>
                      <a href={`mailto:${CONTACT.jobsEmail}`}>{CONTACT.jobsEmail}</a>
                    </dd>
                  </div>
                  <div>
                    <dt>Business, billing &amp; grievances</dt>
                    <dd>
                      <a href={`mailto:${CONTACT.businessEmail}`}>{CONTACT.businessEmail}</a>
                    </dd>
                  </div>
                  <div>
                    <dt>Inquiry desk</dt>
                    <dd>
                      <a href={CONTACT.inquiryPhoneHref}>
                        <LtrText>{CONTACT.inquiryPhone}</LtrText>
                      </a>
                    </dd>
                  </div>
                  <div>
                    <dt>WhatsApp</dt>
                    <dd>
                      <a href={CONTACT.whatsappApplyHref} target="_blank" rel="noopener noreferrer">
                        <LtrText>{CONTACT.whatsappApply}</LtrText>
                        <VisuallyHidden> {t("common.opensWhatsApp")}</VisuallyHidden>
                      </a>
                    </dd>
                  </div>
                </dl>
                <p>
                  You can also use the form on our <Link href="/contact">Contact page</Link>.
                </p>
              </section>

              <nav className={styles.others} aria-label="Other policies">
                <span className={styles.othersLabel}>Also read:</span>
                {otherPages.map((p) => (
                  <Link key={p.path} href={p.path}>
                    {p.label}
                  </Link>
                ))}
              </nav>
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
