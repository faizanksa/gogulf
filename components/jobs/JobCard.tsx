import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { VisuallyHidden } from "@/components/ui/VisuallyHidden";
import type { JobCardData, JobCardText } from "./job-data";
import styles from "./JobCard.module.css";

/**
 * One job in a list. Rendered on the server (home, related jobs) and inside the filter
 * island on /jobs, from the same finished data. Two actions, so the card itself is not a
 * link: the title opens the job, "Apply" opens the form for it.
 */
export function JobCard({ job, text, headingLevel = 3 }: { job: JobCardData; text: JobCardText; headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const titleId = `job-${job.slug}`;
  return (
    <article className={styles.card} aria-labelledby={titleId}>
      <div className={styles.top}>
        <p className={styles.meta}>
          {job.industry}
          <span className={styles.dot} aria-hidden="true" />
          {job.type}
        </p>
        {job.isNew || job.closingSoon ? (
          <p className={styles.badges}>
            {job.isNew ? <Badge tone="green">{text.isNew}</Badge> : null}
            {job.closingSoon ? <Badge tone="warning">{text.closingSoon}</Badge> : null}
          </p>
        ) : null}
      </div>

      <Heading id={titleId} className={styles.title}>
        <Link href={job.href} className={styles.titleLink}>
          {job.title}
        </Link>
      </Heading>

      <p className={styles.where}>
        <Icon name="map-pin" size={18} />
        {job.where}
      </p>
      <p className={job.salary ? styles.salary : styles.salaryMissing}>{job.salary ?? text.salaryNotStated}</p>

      {job.unconfirmed ? <p className={styles.flag}>{text.unconfirmed}</p> : null}

      <div className={styles.bottom}>
        <p className={styles.dates}>
          <time dateTime={job.postedISO}>{job.posted}</time>
          {job.closes && job.closesISO ? (
            <>
              <span className={styles.dot} aria-hidden="true" />
              <time dateTime={job.closesISO}>{job.closes}</time>
            </>
          ) : null}
        </p>
        <Link href={job.applyHref} className={styles.apply}>
          {text.apply}
          <VisuallyHidden> {job.applyHidden}</VisuallyHidden>
          <Icon name="arrow-right" size={18} />
        </Link>
      </div>
    </article>
  );
}
