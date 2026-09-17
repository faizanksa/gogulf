/**
 * The job as the public site renders it — built from the columns anon may read (0012),
 * so the same shape serves the live pages and the staff preview.
 *
 * Only what a job actually states is here. An absent salary, vacancy count, experience
 * line or closing date stays absent; the pages say "not stated" rather than inventing.
 */

import type {
  JobApplicationAccess,
  JobApplicationMethod,
  JobAvailability,
  JobClassification,
  JobEmploymentType,
  JobPromotion,
  JobSalaryPeriod,
  JobStatus,
} from "@/types/database";
import { countryNameOf, isActivelyFeatured, isOpenForApplications, isPastClosingDate } from "./model";

export interface PublicJob {
  id: string;
  reference: string;
  slug: string;
  title: string;
  category: { slug: string; name: string } | null;
  classification: JobClassification;
  countryCode: string | null;
  /** English name of the country; formatted per language by lib/i18n/format.ts. */
  country: string | null;
  city: string | null;
  employer: { disclosure: "named"; name: string } | { disclosure: "confidential" } | null;
  employmentType: JobEmploymentType | null;
  vacancies: number | null;
  salary: { currency: string; min: number; max: number; period: JobSalaryPeriod } | null;
  experience: string | null;
  education: string | null;
  languages: string | null;
  summary: string | null;
  responsibilities: string[];
  requirements: string[];
  benefits: string[];
  additionalInfo: string | null;
  availability: JobAvailability;
  closesOn: string | null;
  promotion: JobPromotion;
  featuredUntil: string | null;
  applicationAccess: JobApplicationAccess;
  applicationMethod: JobApplicationMethod;
  status: JobStatus;
  publishedAt: string | null;
  updatedAt: string;
}

/** The public columns, exactly as granted to anon in 0012. `select=*` would be refused. */
export const PUBLIC_JOB_COLUMNS = [
  "id",
  "reference",
  "slug",
  "title",
  "classification",
  "country_code",
  "city",
  "employer_disclosure",
  "employer_name",
  "employment_type",
  "vacancies",
  "salary_currency",
  "salary_min",
  "salary_max",
  "salary_period",
  "experience",
  "education",
  "languages",
  "summary",
  "responsibilities",
  "requirements",
  "benefits",
  "additional_info",
  "availability",
  "closes_on",
  "promotion",
  "featured_until",
  "application_access",
  "application_method",
  "status",
  "published_at",
  "updated_at",
].join(",");

/** The same, with the category embedded through its foreign key. */
export const PUBLIC_JOB_SELECT = `${PUBLIC_JOB_COLUMNS},category:job_categories(slug,name)`;

export interface JobRowForPublic {
  id: string;
  reference: string;
  slug: string;
  title: string;
  classification: JobClassification;
  country_code: string | null;
  city: string | null;
  employer_disclosure: "named" | "confidential" | null;
  employer_name: string | null;
  employment_type: JobEmploymentType | null;
  vacancies: number | null;
  salary_currency: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_period: JobSalaryPeriod | null;
  experience: string | null;
  education: string | null;
  languages: string | null;
  summary: string | null;
  responsibilities: string[] | null;
  requirements: string[] | null;
  benefits: string[] | null;
  additional_info: string | null;
  availability: JobAvailability;
  closes_on: string | null;
  promotion: JobPromotion;
  featured_until: string | null;
  application_access: JobApplicationAccess;
  application_method: JobApplicationMethod;
  status: JobStatus;
  published_at: string | null;
  updated_at: string;
  category?: { slug: string; name: string } | null;
}

export function toPublicJob(row: JobRowForPublic): PublicJob {
  const salary =
    row.salary_currency && row.salary_min !== null && row.salary_max !== null && row.salary_period
      ? { currency: row.salary_currency, min: row.salary_min, max: row.salary_max, period: row.salary_period }
      : null;
  const employer =
    row.employer_disclosure === "named" && row.employer_name
      ? ({ disclosure: "named", name: row.employer_name } as const)
      : row.employer_disclosure === "confidential"
        ? ({ disclosure: "confidential" } as const)
        : null;
  return {
    id: row.id,
    reference: row.reference,
    slug: row.slug,
    title: row.title,
    category: row.category ?? null,
    classification: row.classification,
    countryCode: row.country_code,
    country: countryNameOf(row.country_code),
    city: row.city,
    employer,
    employmentType: row.employment_type,
    vacancies: row.vacancies,
    salary,
    experience: row.experience,
    education: row.education,
    languages: row.languages,
    summary: row.summary,
    responsibilities: row.responsibilities ?? [],
    requirements: row.requirements ?? [],
    benefits: row.benefits ?? [],
    additionalInfo: row.additional_info,
    availability: row.availability,
    closesOn: row.closes_on,
    promotion: row.promotion,
    featuredUntil: row.featured_until,
    applicationAccess: row.application_access,
    applicationMethod: row.application_method,
    status: row.status,
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
  };
}

const state = (job: PublicJob) => ({
  status: job.status,
  availability: job.availability,
  closesOn: job.closesOn,
  promotion: job.promotion,
  featuredUntil: job.featuredUntil,
  applicationAccess: job.applicationAccess,
});

export const jobIsOpen = (job: PublicJob, now: Date = new Date()) => isOpenForApplications(state(job), now);
export const jobIsFeatured = (job: PublicJob, now: Date = new Date()) => isActivelyFeatured(state(job), now);
/** Not an active opportunity: closed by staff, or past its closing date. */
export const jobHasClosed = (job: PublicJob, now: Date = new Date()) => job.status === "closed" || isPastClosingDate(job, now);
/** Applying goes through the online form on this site (not WhatsApp only). */
export const jobUsesOnlineForm = (job: PublicJob) => job.applicationMethod === "online_form";

/**
 * Listing order: featured first, then the most recently published. Stable, so a list
 * does not reshuffle between renders of the same data.
 */
export function orderForListing(jobs: PublicJob[], now: Date = new Date()): PublicJob[] {
  return [...jobs].sort((a, b) => {
    const f = Number(jobIsFeatured(b, now)) - Number(jobIsFeatured(a, now));
    if (f !== 0) return f;
    return (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "") || a.reference.localeCompare(b.reference);
  });
}
