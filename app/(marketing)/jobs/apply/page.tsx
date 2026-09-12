import Link from "next/link";
import { ApplyForm } from "@/components/jobs/ApplyForm";
import { PageHeader } from "@/components/site/PageHeader";
import { Icon } from "@/components/ui/Icon";
import { Container, Section } from "@/components/ui/Layout";
import { pageEntry } from "@/content/pages";
import { applyFormCopy } from "@/lib/i18n/forms";
import { hrefIn, pageText } from "@/lib/i18n/pages";
import { getTranslator, localizedPageMetadata, requireAvailable } from "@/lib/i18n/server";
import styles from "./apply.module.css";

const PATH = "/jobs/apply";

/** Every ?job=… variant canonicalises to /jobs/apply (lib/seo.ts buildMetadata). */
export async function generateMetadata() {
  return localizedPageMetadata(PATH);
}

/**
 * The application page (2C-1): the form beside what you need and what happens next —
 * the two questions a first-time applicant has before they start typing.
 */
export default async function ApplyPage() {
  const locale = await requireAvailable(PATH);
  const t = await getTranslator();
  const href = (path: string) => hrefIn(path, locale);
  const copy = await applyFormCopy();

  return (
    <>
      <PageHeader
        crumbs={[
          { name: pageText(pageEntry("/jobs"), locale).breadcrumb, path: "/jobs" },
          { name: pageText(pageEntry(PATH), locale).breadcrumb, path: PATH },
        ]}
        kicker={t("apply.kicker")}
        title={t("apply.title")}
        lead={t("apply.lead")}
      />

      <Section>
        <Container>
          <div className={styles.layout}>
            <div className={styles.form}>
              <ApplyForm copy={copy} />
            </div>

            <aside className={styles.aside} aria-labelledby="apply-docs-heading">
              <div className={styles.panel}>
                <h2 id="apply-docs-heading" className={styles.h2}>
                  {t("apply.aside.docsHeading")}
                </h2>
                <ul className={styles.checklist}>
                  <li>
                    <Icon name="file" size={20} />
                    {t("apply.aside.docCv")}
                  </li>
                  <li>
                    <Icon name="file" size={20} />
                    {t("apply.aside.docPassport")}
                  </li>
                  <li>
                    <Icon name="file" size={20} />
                    {t("apply.aside.docOther")}
                  </li>
                </ul>
              </div>
              <div className={styles.panel}>
                <h2 className={styles.h2}>{t("apply.aside.nextHeading")}</h2>
                <ol className={styles.next}>
                  <li>{t("apply.aside.next1")}</li>
                  <li>{t("apply.aside.next2")}</li>
                  <li>{t("apply.aside.next3")}</li>
                </ol>
                <p className={styles.note}>
                  {t.rich("apply.aside.privacy", { privacy: (chunks) => <Link href={href("/privacy-policy")}>{chunks}</Link> })}
                </p>
              </div>
            </aside>
          </div>
        </Container>
      </Section>
    </>
  );
}
