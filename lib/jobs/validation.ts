/**
 * Turning the staff job form into a database write, and explaining what stops a job
 * from being published.
 *
 * Two kinds of rule, deliberately different:
 *
 *   field rules     always apply (lengths, formats, a complete salary). A draft may be
 *                   incomplete, but what it does say must be well-formed.
 *   publish rules   apply only when a job moves to review or published — the minimum
 *                   facts of a genuine listing. They mirror job_publish_problems() in
 *                   0012, which remains the authority; this copy exists so the form can
 *                   explain a refusal before it is attempted.
 *
 * Contradictions are normalised, never silently: an ongoing job's closing date, a
 * standard job's featured-until date and a confidential employer's name are removed,
 * and the staff member is told why. Nothing is ever filled in for them.
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
} from "@/types/database";
import {
  COUNTRIES,
  EMPLOYMENT_TYPES,
  PAID_UNAVAILABLE_MESSAGE,
  SALARY_CURRENCIES,
  SALARY_PERIODS,
  endOfIndianDay,
  todayInIndia,
} from "./model";

/** The columns a staff member writes. Everything else is derived by the database. */
export interface JobWrite {
  title: string;
  reference?: string;
  category_id: string;
  country_code: string | null;
  city: string | null;
  employer_disclosure: JobEmployerDisclosure | null;
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
  responsibilities: string[];
  requirements: string[];
  benefits: string[];
  additional_info: string | null;
  internal_notes: string | null;
  availability: JobAvailability;
  closes_on: string | null;
  promotion: JobPromotion;
  featured_until: string | null;
  application_access: JobApplicationAccess;
  application_method: JobApplicationMethod;
}

export type JobField = keyof JobWrite;

export type ParseResult =
  | { ok: true; values: JobWrite; warnings: string[] }
  | { ok: false; fieldErrors: Partial<Record<JobField, string>>; warnings: string[] };

type Input = Record<string, string | undefined>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const REFERENCE = /^[A-Z0-9]+(-[A-Z0-9]+)*$/;

const clean = (value: string | undefined) => (value ?? "").replace(/\s+/g, " ").trim();
/** Multi-line text keeps its line breaks; only surrounding space goes. */
const cleanBlock = (value: string | undefined) => (value ?? "").replace(/\r\n?/g, "\n").trim();

function isRealDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** One entry per non-empty line. Bullets typed by hand ("- ", "• ") are dropped. */
export function linesOf(value: string | undefined): string[] {
  return cleanBlock(value)
    .split("\n")
    .map((line) => line.replace(/^\s*(?:[-*•·]|\d+[.)])\s+/, "").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

export function parseJobForm(input: Input, now: Date = new Date()): ParseResult {
  const errors: Partial<Record<JobField, string>> = {};
  const warnings: string[] = [];

  const optionalText = (field: JobField, min: number, max: number, label: string, block = false): string | null => {
    const value = block ? cleanBlock(input[field]) : clean(input[field]);
    if (!value) return null;
    if (value.length < min || value.length > max) errors[field] = `${label} must be between ${min} and ${max} characters.`;
    return value;
  };

  const list = (field: JobField, label: string): string[] => {
    const items = linesOf(input[field]);
    if (items.length > 30) errors[field] = `${label}: at most 30 lines.`;
    else if (items.some((i) => i.length < 2 || i.length > 300)) errors[field] = `${label}: each line must be between 2 and 300 characters.`;
    return items;
  };

  const optionalInt = (field: JobField, label: string, min: number, max: number): number | null => {
    const raw = clean(input[field]).replace(/,/g, "");
    if (!raw) return null;
    if (!/^\d+$/.test(raw)) {
      errors[field] = `${label} must be a whole number.`;
      return null;
    }
    const n = Number(raw);
    if (n < min || n > max) errors[field] = `${label} must be between ${min.toLocaleString("en-IN")} and ${max.toLocaleString("en-IN")}.`;
    return n;
  };

  const oneOf = <T extends string>(field: JobField, allowed: readonly T[], label: string, fallback: T | null): T | null => {
    const raw = clean(input[field]);
    if (!raw) return fallback;
    if (!(allowed as readonly string[]).includes(raw)) {
      errors[field] = `Choose a valid ${label}.`;
      return fallback;
    }
    return raw as T;
  };

  // BASIC INFORMATION
  const title = clean(input.title);
  if (title.length < 2 || title.length > 120) errors.title = "Enter a job title between 2 and 120 characters.";

  const reference = clean(input.reference).toUpperCase();
  if (reference && (!REFERENCE.test(reference) || reference.length < 3 || reference.length > 40)) {
    errors.reference = "A reference uses capital letters, digits and single hyphens, 3 to 40 characters.";
  }

  const category_id = clean(input.category_id);
  if (!UUID.test(category_id)) errors.category_id = "Choose a category.";

  const country_code = oneOf("country_code", COUNTRIES.map((c) => c.code), "country", null);
  const city = optionalText("city", 2, 80, "City or location");

  const employer_disclosure = oneOf<JobEmployerDisclosure>("employer_disclosure", ["named", "confidential"], "employer disclosure", null);
  let employer_name = optionalText("employer_name", 2, 120, "Employer name");
  if (employer_disclosure === "named" && !employer_name && !errors.employer_name) {
    errors.employer_name = "Enter the employer's name, or mark the employer as confidential.";
  }
  if (employer_disclosure !== "named" && employer_name) {
    warnings.push(
      employer_disclosure === "confidential"
        ? "The employer is confidential, so the name was not saved on the listing. Record it in internal notes."
        : "The employer name was not saved because disclosure is not set. Choose \"Named on the listing\" to show it.",
    );
    employer_name = null;
  }

  // EMPLOYMENT
  const employment_type = oneOf("employment_type", EMPLOYMENT_TYPES, "employment type", null);
  const vacancies = optionalInt("vacancies", "Number of vacancies", 1, 10000);

  const salary_currency = oneOf("salary_currency", SALARY_CURRENCIES, "salary currency", null);
  const salary_min = optionalInt("salary_min", "Minimum salary", 1, 100_000_000);
  const salary_max = optionalInt("salary_max", "Maximum salary", 1, 100_000_000);
  const salary_period = oneOf("salary_period", SALARY_PERIODS, "salary period", null);
  const salaryParts = [salary_currency, salary_min, salary_max, salary_period];
  const salaryGiven = salaryParts.some((p) => p !== null);
  if (salaryGiven && salaryParts.some((p) => p === null)) {
    errors.salary_min ??= "Give the currency, minimum, maximum and period together — or leave the salary empty.";
  } else if (salary_min !== null && salary_max !== null && salary_max < salary_min) {
    errors.salary_max = "The maximum salary cannot be lower than the minimum.";
  }

  const experience = optionalText("experience", 2, 200, "Experience");
  const education = optionalText("education", 2, 200, "Education");
  const languages = optionalText("languages", 2, 200, "Language requirements");

  // DESCRIPTION
  const summary = optionalText("summary", 20, 600, "Summary", true);
  const responsibilities = list("responsibilities", "Responsibilities");
  const requirements = list("requirements", "Requirements");
  const benefits = list("benefits", "Benefits");
  const additional_info = optionalText("additional_info", 2, 2000, "Additional information", true);
  const internalRaw = cleanBlock(input.internal_notes);
  if (internalRaw.length > 4000) errors.internal_notes = "Internal notes can be at most 4,000 characters.";
  const internal_notes = internalRaw || null;

  // AVAILABILITY
  const availability = oneOf<JobAvailability>("availability", ["ongoing", "time_limited"], "availability", "ongoing") ?? "ongoing";
  let closes_on: string | null = clean(input.closes_on) || null;
  if (closes_on && !isRealDate(closes_on)) {
    errors.closes_on = "Enter the closing date as a real date.";
    closes_on = null;
  }
  if (availability === "ongoing" && closes_on) {
    warnings.push("Ongoing jobs have no closing date, so the date you entered was removed.");
    closes_on = null;
  }
  if (availability === "time_limited" && closes_on && closes_on < todayInIndia(now)) {
    warnings.push("The closing date has already passed. The job cannot be published until it is moved forward.");
  }

  // VISIBILITY
  const promotion = oneOf<JobPromotion>("promotion", ["standard", "featured"], "visibility", "standard") ?? "standard";
  let featured_until: string | null = clean(input.featured_until) || null;
  if (featured_until && !isRealDate(featured_until)) {
    errors.featured_until = "Enter the featured-until date as a real date.";
    featured_until = null;
  }
  if (promotion === "standard" && featured_until) {
    warnings.push("Standard jobs are not featured, so the featured-until date was removed.");
    featured_until = null;
  }
  if (promotion === "featured" && featured_until && now.getTime() >= endOfIndianDay(featured_until)) {
    warnings.push("The featured-until date has passed, so the job is not shown as featured.");
  }

  // APPLICATION
  const application_access = oneOf<JobApplicationAccess>("application_access", ["free", "paid"], "application access", "free") ?? "free";
  if (application_access === "paid") warnings.push(`${PAID_UNAVAILABLE_MESSAGE} This job can be saved but cannot be published.`);
  const application_method =
    oneOf<JobApplicationMethod>("application_method", ["online_form", "whatsapp"], "application method", "online_form") ?? "online_form";

  if (Object.keys(errors).length) return { ok: false, fieldErrors: errors, warnings };

  return {
    ok: true,
    warnings,
    values: {
      title,
      ...(reference ? { reference } : {}),
      category_id,
      country_code,
      city,
      employer_disclosure,
      employer_name,
      employment_type,
      vacancies,
      salary_currency: salaryGiven ? salary_currency : null,
      salary_min: salaryGiven ? salary_min : null,
      salary_max: salaryGiven ? salary_max : null,
      salary_period: salaryGiven ? salary_period : null,
      experience,
      education,
      languages,
      summary,
      responsibilities,
      requirements,
      benefits,
      additional_info,
      internal_notes,
      availability,
      closes_on,
      promotion,
      featured_until,
      application_access,
      application_method,
    },
  };
}

// ---------------------------------------------------------------------------
// Publish rules — mirror of job_publish_problems() in 0012
// ---------------------------------------------------------------------------

export const PUBLISH_PROBLEMS = [
  "category_missing",
  "category_inactive",
  "country_missing",
  "employment_type_missing",
  "summary_missing",
  "employer_disclosure_missing",
  "closing_date_missing",
  "closing_date_passed",
  "requirements_missing",
  "paid_application_unavailable",
] as const;
export type PublishProblem = (typeof PUBLISH_PROBLEMS)[number];

export const PROBLEM_MESSAGES: Record<PublishProblem, string> = {
  category_missing: "Choose a category.",
  category_inactive: "The category is no longer active. Choose another category.",
  country_missing: "Choose the country the job is in.",
  employment_type_missing: "Choose the employment type.",
  summary_missing: "Write a summary of the job (at least 20 characters).",
  employer_disclosure_missing: "Say whether the employer is named on the listing or confidential.",
  closing_date_missing: "A time-limited job needs a closing date.",
  closing_date_passed: "The closing date has passed. Move it forward before publishing.",
  requirements_missing: "A professional job must list its requirements.",
  paid_application_unavailable: `${PAID_UNAVAILABLE_MESSAGE} Switch to free application to publish.`,
};

export function isPublishProblem(value: string): value is PublishProblem {
  return (PUBLISH_PROBLEMS as readonly string[]).includes(value);
}

export interface PublishCheckInput {
  classification: JobClassification;
  categoryActive: boolean | null;
  country_code: string | null;
  employment_type: string | null;
  summary: string | null;
  employer_disclosure: string | null;
  availability: JobAvailability;
  closes_on: string | null;
  requirements: readonly string[];
  application_access: JobApplicationAccess;
}

/**
 * What stops the job reaching `target`. `entering` is true when the status is changing
 * (not an edit of a job already in that status) — the database relaxes two rules for
 * edits, and so does this.
 */
export function publishProblems(
  job: PublishCheckInput,
  target: "review" | "published",
  { entering = true, now = new Date() }: { entering?: boolean; now?: Date } = {},
): PublishProblem[] {
  const problems: PublishProblem[] = [];
  if (job.categoryActive === null) problems.push("category_missing");
  else if (!job.categoryActive && entering) problems.push("category_inactive");
  if (!job.country_code) problems.push("country_missing");
  if (!job.employment_type) problems.push("employment_type_missing");
  if (!job.summary) problems.push("summary_missing");
  if (!job.employer_disclosure) problems.push("employer_disclosure_missing");
  if (job.availability === "time_limited" && !job.closes_on) problems.push("closing_date_missing");
  if (job.classification === "professional" && job.requirements.length === 0) problems.push("requirements_missing");
  if (job.application_access === "paid" && target === "published") problems.push("paid_application_unavailable");
  if (target === "published" && entering && job.availability === "time_limited" && job.closes_on && job.closes_on < todayInIndia(now)) {
    problems.push("closing_date_passed");
  }
  return problems;
}
