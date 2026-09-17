import Link from "next/link";
import { ApplyForm, type ApplyTarget } from "@/components/jobs/ApplyForm";
import { PageHeader } from "@/components/site/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { Icon } from "@/components/ui/Icon";
import { Container, Section } from "@/components/ui/Layout";
import { pageEntry } from "@/content/pages";
import { applyFormCopy } from "@/lib/i18n/forms";
import { hrefIn, pageText } from "@/lib/i18n/pages";
import { getTranslator, localizedPageMetadata, requireAvailable } from "@/lib/i18n/server";
import { getPublicJobByReference } from "@/lib/jobs/public-data";
import { jobIsOpen, jobUsesOnlineForm } from "@/lib/jobs/public-job";
import styles from "./apply.module.css";

const PATH = "/jobs/apply";

/** Every ?job=… variant canonicalises to /jobs/apply (lib/seo.ts buildMetadata). */
export async function generateMetadata() {
  return localizedPageMetadata(PATH);
}

/**
 * The application page: the form beside what you need and what happens next — the two
 * questions a first-time applicant has before they start typing.
 *
 * ?ref=<job reference> names the job. It is looked up here, on the server: the form is
 * attached to the job only while that job is published, free to apply for, open and
 * taken through this form. Otherwise the page says the job is not accepting applications
 * and offers a general application instead. The database checks the same thing again
 * when the application is saved (0013).
 */
export default async function ApplyPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const locale = await requireAvailable(PATH);
  const t = await getTranslator();
  const href = (path: string) => hrefIn(path, locale);
  const copy = await applyFormCopy();
  const query = await searchParams;
  const ref = typeof query.ref === "string" ? query.ref : null;
  const job = ref ? await getPublicJobByReference(ref) : null;
  const open = job !== null && jobIsOpen(job) && jobUsesOnlineForm(job);
  const target: ApplyTarget | null =
    job && open ? { jobId: job.id, job: job.title, country: job.country ?? "", reference: job.reference } : null;
  const notOpen = ref !== null && !open;

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
              {notOpen ? (
                <div className={styles.notice}>
                  <Alert tone="warning" title={t("apply.notOpen.title")}>
                    <p>{t.rich("apply.notOpen.body", { jobs: (chunks) => <Link href={href("/jobs")}>{chunks}</Link> })}</p>
                  </Alert>
                </div>
              ) : null}
              <ApplyForm copy={copy} target={target} />
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
