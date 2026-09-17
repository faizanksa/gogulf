/**
 * The job model shared by the public site and the staff workspace — no framework, no
 * database client, so every rule here is unit-tested.
 *
 * The database is the authority (supabase/migrations/0012_jobs.sql). This file mirrors
 * what the staff workspace needs to explain those rules before a save is attempted, and
 * the reading rules the public site applies: whether a job is open, whether it is
 * featured right now.
 */

import type {
  JobApplicationAccess,
  JobApplicationMethod,
  JobAvailability,
  JobClassification,
  JobEmployerDisclosure,
  JobEmploymentType,
  JobPromotion,
  JobSalaryPeriod,
  JobStatus,
} from "@/types/database";

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

export const JOB_STATUSES: readonly JobStatus[] = ["draft", "review", "published", "closed", "archived"];
export const STATUS_LABELS: Record<JobStatus, string> = {
  draft: "Draft",
  review: "In review",
  published: "Published",
  closed: "Closed",
  archived: "Archived",
};

export const CLASSIFICATIONS: readonly JobClassification[] = ["general", "professional"];
export const CLASSIFICATION_LABELS: Record<JobClassification, string> = {
  general: "General hiring",
  professional: "Professional",
};

export const AVAILABILITY_LABELS: Record<JobAvailability, string> = {
  ongoing: "Ongoing",
  time_limited: "Time-limited",
};

export const PROMOTION_LABELS: Record<JobPromotion, string> = {
  standard: "Standard",
  featured: "Featured",
};

export const ACCESS_LABELS: Record<JobApplicationAccess, string> = {
  free: "Free application",
  paid: "Paid application",
};

export const METHOD_LABELS: Record<JobApplicationMethod, string> = {
  online_form: "Online application form",
  whatsapp: "WhatsApp",
};

export const EMPLOYMENT_TYPES: readonly JobEmploymentType[] = ["full_time", "part_time", "contract", "temporary"];
export const EMPLOYMENT_TYPE_LABELS: Record<JobEmploymentType, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  contract: "Contract",
  temporary: "Temporary",
};

export const DISCLOSURE_LABELS: Record<JobEmployerDisclosure, string> = {
  named: "Named on the listing",
  confidential: "Confidential",
};

export const SALARY_CURRENCIES = ["SAR", "AED", "QAR", "OMR", "KWD", "BHD", "INR"] as const;
export type SalaryCurrency = (typeof SALARY_CURRENCIES)[number];
export const SALARY_PERIODS: readonly JobSalaryPeriod[] = ["month", "year", "day", "hour"];

/** The countries jobs are advertised in, by ISO 3166-1 code — the stored value. */
export const COUNTRIES = [
  { code: "SA", name: "Saudi Arabia" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "QA", name: "Qatar" },
  { code: "OM", name: "Oman" },
  { code: "KW", name: "Kuwait" },
  { code: "BH", name: "Bahrain" },
] as const;
export type CountryCode = (typeof COUNTRIES)[number]["code"];

export function countryNameOf(code: string | null | undefined): string | null {
  if (!code) return null;
  return COUNTRIES.find((c) => c.code === code)?.name ?? code;
}

/**
 * Paid application access exists in the model and is refused at publication by the
 * database. Nothing in the product may offer it to a candidate. The staff workspace says
 * so beside the option.
 */
export const PAID_APPLICATIONS_AVAILABLE = false;
export const PAID_UNAVAILABLE_MESSAGE = "Paid application access is not currently available.";

// ---------------------------------------------------------------------------
// Lifecycle — the same table as jobs_before_write
// ---------------------------------------------------------------------------

export const TRANSITIONS: Record<JobStatus, readonly JobStatus[]> = {
  draft: ["review", "archived"],
  review: ["draft", "published", "archived"],
  published: ["draft", "closed", "archived"],
  closed: ["published", "archived"],
  archived: ["draft"],
};

export function canTransition(from: JobStatus, to: JobStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export interface TransitionAction {
  to: JobStatus;
  /** Button text. */
  label: string;
  /** What happens, in one sentence, for the confirmation line under the button. */
  effect: string;
  tone: "primary" | "secondary" | "danger";
}

export function transitionAction(from: JobStatus, to: JobStatus): TransitionAction {
  const key = `${from}>${to}`;
  switch (key) {
    case "draft>review":
      return { to, label: "Submit for review", effect: "Checks the listing is complete. It stays private.", tone: "primary" };
    case "review>draft":
      return { to, label: "Return to draft", effect: "Takes it out of review for more editing.", tone: "secondary" };
    case "review>published":
      return { to, label: "Publish", effect: "Makes the job public on the Jobs page.", tone: "primary" };
    case "published>draft":
      return { to, label: "Unpublish", effect: "Removes it from the public site. Applications are kept.", tone: "secondary" };
    case "published>closed":
      return { to, label: "Close", effect: "Stops new applications. The page stays up, marked closed.", tone: "secondary" };
    case "closed>published":
      return { to, label: "Reopen", effect: "Accepts applications again.", tone: "primary" };
    case "archived>draft":
      return { to, label: "Restore", effect: "Brings it back as a draft.", tone: "secondary" };
    default:
      return { to, label: "Archive", effect: "Hides it everywhere. Applications and history are kept.", tone: "danger" };
  }
}

export function availableTransitions(from: JobStatus): TransitionAction[] {
  return TRANSITIONS[from].map((to) => transitionAction(from, to));
}

// ---------------------------------------------------------------------------
// Dates — calendar dates, inclusive, in India (Asia/Kolkata, UTC+05:30, no DST)
// ---------------------------------------------------------------------------

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** Today's date in India, as YYYY-MM-DD. */
export function todayInIndia(now: Date = new Date()): string {
  return new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** The first instant after `isoDate` ends in India. A date is valid while now is before this. */
export function endOfIndianDay(isoDate: string): number {
  return Date.parse(`${isoDate}T00:00:00Z`) + 24 * 60 * 60 * 1000 - IST_OFFSET_MS;
}

/** The date part of a timestamp, as it reads in India. */
export function indianDateOf(timestamp: string): string {
  return todayInIndia(new Date(timestamp));
}

export interface ReadableJobState {
  status: JobStatus;
  availability: JobAvailability;
  closesOn: string | null;
  promotion: JobPromotion;
  featuredUntil: string | null;
  applicationAccess: JobApplicationAccess;
}

/** Past its closing date: a time-limited job whose date has ended in India. */
export function isPastClosingDate(job: Pick<ReadableJobState, "availability" | "closesOn">, now: Date = new Date()): boolean {
  return job.availability === "time_limited" && job.closesOn !== null && now.getTime() >= endOfIndianDay(job.closesOn);
}

/** Accepting applications — the same rule job_applications_intake enforces. */
export function isOpenForApplications(job: ReadableJobState, now: Date = new Date()): boolean {
  if (job.status !== "published" || job.applicationAccess !== "free") return false;
  if (job.availability === "ongoing") return true;
  return job.closesOn !== null && !isPastClosingDate(job, now);
}

/** Featured right now. A lapsed featured_until simply stops counting — nothing is changed. */
export function isActivelyFeatured(job: Pick<ReadableJobState, "promotion" | "featuredUntil">, now: Date = new Date()): boolean {
  if (job.promotion !== "featured") return false;
  return job.featuredUntil === null || now.getTime() < endOfIndianDay(job.featuredUntil);
}
