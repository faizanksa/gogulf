import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { cx } from "@/components/ui/cx";
import { Icon } from "@/components/ui/Icon";
import { VisuallyHidden } from "@/components/ui/VisuallyHidden";
import type { JobCardData, JobCardText } from "./job-data";
import styles from "./JobCard.module.css";

/**
 * One job in a list. Rendered on the server (home, related jobs) and inside the filter
 * island on /jobs, from the same finished data. Two actions, so the card itself is not a
 * link: the title opens the job, "Apply" opens the form for it (or WhatsApp, for a job
 * taken that way).
 *
 * Professional opportunities sit on a white, bordered card; general hiring on the quiet
 * surface tone. A featured job carries a label and an accent — never a countdown.
 */
export function JobCard({ job, text, headingLevel = 3 }: { job: JobCardData; text: JobCardText; headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const titleId = `job-${job.slug}`;
  return (
    <article
      className={cx(styles.card, job.professional ? styles.professional : styles.general, job.featured && styles.featured)}
      aria-labelledby={titleId}
    >
      <div className={styles.top}>
        <p className={styles.meta}>
          <span className={styles.track}>
            {job.professional ? <Icon name="briefcase" size={16} /> : null}
            {job.professional ? text.professional : text.general}
          </span>
          {job.category ? (
            <>
              <span className={styles.dot} aria-hidden="true" />
              {job.category}
            </>
          ) : null}
          {job.type ? (
            <>
              <span className={styles.dot} aria-hidden="true" />
              {job.type}
            </>
          ) : null}
        </p>
        {job.featured ? (
          <p className={styles.badges}>
            <Badge tone="green">{text.featured}</Badge>
          </p>
        ) : null}
      </div>

      <Heading id={titleId} className={styles.title}>
        <Link href={job.href} className={styles.titleLink}>
          {job.title}
        </Link>
      </Heading>

      {job.where ? (
        <p className={styles.where}>
          <Icon name="map-pin" size={18} />
          {job.where}
        </p>
      ) : null}
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

      <div className={styles.bottom}>
        <p className={styles.dates}>
          <time dateTime={job.updatedISO}>{job.updated}</time>
          <span className={styles.dot} aria-hidden="true" />
          <span className={styles.reference}>{job.referenceLabel}</span>
        </p>
        <p className={styles.actions}>
          <Link href={job.href} className={styles.view}>
            {text.view}
            <VisuallyHidden> {job.applyHidden}</VisuallyHidden>
          </Link>
          {job.apply ? (
            job.apply.whatsapp ? (
              <a href={job.apply.href} className={styles.apply} target="_blank" rel="noopener noreferrer">
                {text.applyWhatsApp}
                <VisuallyHidden>
                  {" "}
                  {job.applyHidden} {text.opensWhatsApp}
                </VisuallyHidden>
                <Icon name="arrow-right" size={18} />
              </a>
            ) : (
              <Link href={job.apply.href} className={styles.apply}>
                {text.apply}
                <VisuallyHidden> {job.applyHidden}</VisuallyHidden>
                <Icon name="arrow-right" size={18} />
              </Link>
            )
          ) : null}
        </p>
      </div>
    </article>
  );
}
