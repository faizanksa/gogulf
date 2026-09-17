import Link from "next/link";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import type { ApplicationStatus, JobStatus } from "@/types/database";
import { hrefWith, pageCount, PAGE_SIZE } from "@/lib/admin/params";
import { STATUS_LABELS } from "@/lib/jobs/model";
import styles from "./admin.module.css";

/** Server-rendered building blocks for the staff workspace. */

export function PageTitle({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className={styles.pageTitle}>
      <div className={styles.pageTitleText}>
        {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
        <h1 className={styles.h1}>{title}</h1>
        {description ? <p className={styles.description}>{description}</p> : null}
      </div>
      {actions ? <div className={styles.titleActions}>{actions}</div> : null}
    </div>
  );
}

export function Panel({ id, title, actions, children }: { id: string; title: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className={styles.panel} aria-labelledby={id}>
      <div className={styles.panelHead}>
        <h2 id={id} className={styles.h2}>
          {title}
        </h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

const JOB_TONES: Record<JobStatus, "neutral" | "green" | "blue" | "warning" | "error"> = {
  draft: "neutral",
  review: "warning",
  published: "green",
  closed: "blue",
  archived: "neutral",
};

export function JobStatusBadge({ status }: { status: JobStatus }) {
  return <Badge tone={JOB_TONES[status]}>{STATUS_LABELS[status]}</Badge>;
}

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  new: "New",
  screening: "Screening",
  converted: "Converted to case",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

const APPLICATION_TONES: Record<ApplicationStatus, "neutral" | "green" | "blue" | "warning" | "error"> = {
  new: "warning",
  screening: "blue",
  converted: "green",
  rejected: "neutral",
  withdrawn: "neutral",
};

export function ApplicationStatusBadge({ status }: { status: ApplicationStatus }) {
  return <Badge tone={APPLICATION_TONES[status]}>{APPLICATION_STATUS_LABELS[status]}</Badge>;
}

export const STAGE_LABELS: Record<string, string> = {
  subscriber: "Subscriber",
  lead: "Lead",
  opportunity: "Opportunity",
  customer: "Customer",
  past_customer: "Past customer",
  disqualified: "Disqualified",
};

export const CASE_STATUS_LABELS: Record<string, string> = { open: "Open", won: "Won", lost: "Lost", cancelled: "Cancelled" };

const IST: Intl.DateTimeFormatOptions = { timeZone: "Asia/Kolkata" };

/** "17 Sep 2026" — a timestamp as its date in India. */
export function formatDay(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T00:00:00+05:30`) : new Date(iso);
  return new Intl.DateTimeFormat("en-IN", { ...IST, day: "numeric", month: "short", year: "numeric" }).format(d);
}

/** "17 Sep 2026, 1:30 pm IST" */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return `${new Intl.DateTimeFormat("en-IN", { ...IST, day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso))} IST`;
}

export function Time({ iso, withTime = false }: { iso: string | null | undefined; withTime?: boolean }) {
  if (!iso) return <>—</>;
  return <time dateTime={iso}>{withTime ? formatDateTime(iso) : formatDay(iso)}</time>;
}

export function Pagination({
  path,
  params,
  page,
  total,
  noun,
}: {
  path: string;
  params: Record<string, string>;
  page: number;
  total: number;
  noun: [string, string];
}) {
  const pages = pageCount(total);
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(total, page * PAGE_SIZE);
  return (
    <nav className={styles.pagination} aria-label="Pages">
      <p className={styles.muted}>
        {total === 0 ? `No ${noun[1]}` : `${from.toLocaleString("en-IN")}–${to.toLocaleString("en-IN")} of ${total.toLocaleString("en-IN")} ${total === 1 ? noun[0] : noun[1]}`}
        {pages > 1 ? ` · page ${page} of ${pages}` : ""}
      </p>
      {pages > 1 ? (
        <div className={styles.pageLinks}>
          <Link
            className={styles.pageLink}
            href={hrefWith(path, params, { page: Math.max(1, page - 1) })}
            aria-disabled={page <= 1 ? "true" : undefined}
            tabIndex={page <= 1 ? -1 : undefined}
          >
            Previous
          </Link>
          <Link
            className={styles.pageLink}
            href={hrefWith(path, params, { page: Math.min(pages, page + 1) })}
            aria-disabled={page >= pages ? "true" : undefined}
            tabIndex={page >= pages ? -1 : undefined}
          >
            Next
          </Link>
        </div>
      ) : null}
    </nav>
  );
}

/** A GET form: filters are part of the URL and work without JavaScript. */
export function FilterForm({ label, clearHref, active, children }: { label: string; clearHref: string; active: boolean; children: ReactNode }) {
  return (
    <form method="get" role="search" aria-label={label} className={styles.filters}>
      {children}
      <div className={styles.filterActions}>
        <button type="submit" className={styles.pageLink}>
          Apply filters
        </button>
        {active ? (
          <Link href={clearHref} className={styles.textButton}>
            Clear
          </Link>
        ) : null}
      </div>
    </form>
  );
}

export function FilterField({ id, label, search, children }: { id: string; label: string; search?: boolean; children: ReactNode }) {
  return (
    <div className={`${styles.filterField} ${search ? styles.filterSearch : ""}`}>
      <label htmlFor={id} className={styles.filterLabel}>
        {label}
      </label>
      {children}
    </div>
  );
}

export function NotAllowed({ what }: { what: string }) {
  return (
    <>
      <PageTitle title="Not available for your role" />
      <div className={styles.panel}>
        <p>Your role does not include {what}. If you need it, ask a super administrator.</p>
        <p>
          <Link href="/admin">Back to the dashboard</Link>
        </p>
      </div>
    </>
  );
}
