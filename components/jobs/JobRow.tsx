import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cx } from "@/components/ui/cx";
import { Icon } from "@/components/ui/Icon";
import { LtrText } from "@/components/ui/LtrText";
import { VisuallyHidden } from "@/components/ui/VisuallyHidden";
import type { JobCardData, JobCardText } from "./job-data";
import styles from "./JobRow.module.css";

/**
 * One open job as a line on a board — the home page's compact alternative to JobCard,
 * from the same finished data. Read like a departures board: where the job is, what it
 * is, what it pays, whether it closes, and the way in. The title opens the job; "Apply"
 * opens the form for it (or WhatsApp, for a job taken that way). No urgency is derived:
 * a closing date is written as a date.
 */
export function JobRow({ job, text, headingLevel = 3 }: { job: JobCardData; text: JobCardText; headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const titleId = `job-row-${job.slug}`;
  return (
    <article className={cx(styles.row, job.featured && styles.featured)} aria-labelledby={titleId}>
      {job.where ? (
        <p className={styles.place}>
          <span className={styles.marker} aria-hidden="true" />
          {job.where}
        </p>
      ) : null}

      <div className={styles.main}>
        <div className={styles.titleLine}>
          <Heading id={titleId} className={styles.title}>
            <Link href={job.href} className={styles.titleLink}>
              {job.title}
            </Link>
          </Heading>
          {job.featured ? <Badge tone="green">{text.featured}</Badge> : null}
        </div>
        <p className={styles.meta}>
          <span className={job.professional ? styles.professional : undefined}>{job.professional ? text.professional : text.general}</span>
          {job.category ? <span>{job.category}</span> : null}
          {job.type ? <span>{job.type}</span> : null}
          <span className={styles.reference}>
            <LtrText>{job.referenceLabel}</LtrText>
          </span>
        </p>
      </div>

      <p className={job.salary ? styles.salary : styles.salaryMissing}>{job.salary ?? text.salaryNotStated}</p>

      <ul className={styles.facts}>
        <li>
          <Icon name="calendar" size={16} />
          {job.closesISO ? <time dateTime={job.closesISO}>{job.availability}</time> : job.availability}
        </li>
        {job.free ? (
          <li>
            <Icon name="check" size={16} />
            {text.free}
          </li>
        ) : null}
      </ul>

      {job.apply ? (
        <p className={styles.action}>
          {job.apply.whatsapp ? (
            <Button href={job.apply.href} variant="secondary" size="sm" icon="whatsapp" opensWhatsApp={text.opensWhatsApp}>
              {text.applyWhatsApp}
              <VisuallyHidden> {job.applyHidden}</VisuallyHidden>
            </Button>
          ) : (
            <Button href={job.apply.href} variant="secondary" size="sm" icon="arrow-right" iconPosition="end">
              {text.apply}
              <VisuallyHidden> {job.applyHidden}</VisuallyHidden>
            </Button>
          )}
        </p>
      ) : null}
    </article>
  );
}
