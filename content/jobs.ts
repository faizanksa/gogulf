import { z } from "zod";
import { deploymentStage, showsUnconfirmedContent, type DeploymentStage } from "@/lib/deployment";
import { isoDate, slug, validate, verification } from "./schema";

/**
 * Job listings — until Phase 5 moves them to the database behind the same functions.
 *
 * Rules the schema enforces:
 *   - `closesOn` is explicit or null. Never computed. (The old site derived expiry as
 *     posted + 45 days, which is how three listings came to be shown as open after
 *     their structured-data expiry.)
 *   - A `confirmed` job must have a closing date and an employer disclosure.
 *   - Slugs are unique.
 *
 * The six listings below are carried over from the live site. The business has not yet
 * confirmed that they are real and current (decision D4), so they are `unconfirmed`:
 * shown on staging with a visible flag, excluded from production, and never given
 * JobPosting structured data.
 */

const employmentType = z.enum(["Full-Time", "Part-Time", "Contract", "Temporary"]);

const salary = z
  .object({
    currency: z.enum(["SAR", "AED", "QAR", "OMR", "KWD", "BHD", "INR"]),
    min: z.number().positive(),
    max: z.number().positive(),
    period: z.enum(["hour", "day", "month", "year"]),
  })
  .refine((s) => s.max >= s.min, "Salary max must be at least min");

const employer = z.discriminatedUnion("disclosure", [
  z.object({ disclosure: z.literal("named"), name: z.string().min(2) }),
  z.object({ disclosure: z.literal("confidential") }),
]);

/**
 * A translation of a job's human-written text into one language. The job's facts —
 * country, salary, dates, slug, employment type — stay language-neutral on the job itself
 * and are formatted for each language when the page renders (lib/i18n/format.ts); only
 * words a person wrote are translated. This is the shape of the future Supabase table
 * job_translations(job_id, locale, …) (docs/I18N.md).
 *
 * A translation is shown only once it is "reviewed", recording who reviewed it and when.
 * Never machine-translate a listing at request time.
 */
const jobTranslation = z
  .object({
    locale: z.enum(["hi", "ar", "ml", "ta", "bn"]),
    title: z.string().min(2).max(120),
    summary: z.string().min(20).max(600),
    industry: z.string().min(2).optional(),
    city: z.string().min(2).optional(),
    experience: z.string().min(2).max(160).optional(),
    requirements: z.array(z.string().min(3)).default([]),
    benefits: z.array(z.string().min(3)).default([]),
    status: z.enum(["draft", "in-review", "reviewed"]),
    reviewedBy: z.string().min(2).nullable(),
    reviewedOn: isoDate.nullable(),
  })
  .refine((t) => t.status !== "reviewed" || (t.reviewedBy && t.reviewedOn), "A reviewed translation records who reviewed it and when");

export type JobTranslation = z.infer<typeof jobTranslation>;

const job = z
  .object({
    slug,
    title: z.string().min(2).max(90),
    country: z.enum(["Saudi Arabia", "United Arab Emirates", "Qatar", "Oman", "Kuwait", "Bahrain"]),
    city: z.string().min(2).optional(),
    industry: z.string().min(2),
    employmentType,
    salary: salary.optional(),
    summary: z.string().min(20).max(400),
    /** Experience asked for, as the employer states it — e.g. "3+ years on Gulf construction sites". */
    experience: z.string().min(2).max(120).optional(),
    /** What the employer requires, one point per entry. Empty until the business supplies them — never invented. */
    requirements: z.array(z.string().min(3)).default([]),
    /** What the job offers beyond salary (accommodation, transport, …), as the employer states it. */
    benefits: z.array(z.string().min(3)).default([]),
    postedOn: isoDate,
    updatedOn: isoDate,
    closesOn: isoDate.nullable(),
    openings: z.number().int().positive().nullable(),
    employer: employer.nullable(),
    verification,
    verificationNote: z.string().optional(),
    translations: z.array(jobTranslation).default([]),
  })
  .superRefine((j, ctx) => {
    if (j.updatedOn < j.postedOn) ctx.addIssue({ code: "custom", message: "updatedOn is before postedOn", path: ["updatedOn"] });
    if (j.closesOn && j.closesOn < j.postedOn) ctx.addIssue({ code: "custom", message: "closesOn is before postedOn", path: ["closesOn"] });
    const langs = j.translations.map((t) => t.locale);
    if (new Set(langs).size !== langs.length) ctx.addIssue({ code: "custom", message: "At most one translation per language", path: ["translations"] });
    // A reviewed translation carries the whole job: no English list left inside a translated page.
    j.translations.forEach((t, i) => {
      if (t.status !== "reviewed") return;
      if (t.requirements.length !== j.requirements.length) ctx.addIssue({ code: "custom", message: "A reviewed translation translates every requirement", path: ["translations", i, "requirements"] });
      if (t.benefits.length !== j.benefits.length) ctx.addIssue({ code: "custom", message: "A reviewed translation translates every benefit", path: ["translations", i, "benefits"] });
      if (j.experience && !t.experience) ctx.addIssue({ code: "custom", message: "A reviewed translation translates the experience line", path: ["translations", i, "experience"] });
    });
    if (j.verification === "confirmed") {
      if (!j.closesOn) ctx.addIssue({ code: "custom", message: "A confirmed job needs an explicit closesOn date", path: ["closesOn"] });
      if (!j.employer) ctx.addIssue({ code: "custom", message: "A confirmed job needs an employer disclosure (named or confidential)", path: ["employer"] });
    }
  });

export type Job = z.infer<typeof job>;

const jobs = z.array(job).superRefine((list, ctx) => {
  const seen = new Set<string>();
  list.forEach((j, i) => {
    if (seen.has(j.slug)) ctx.addIssue({ code: "custom", message: `Duplicate slug "${j.slug}"`, path: [i, "slug"] });
    seen.add(j.slug);
  });
});

const PENDING_D4 = "Listed on the live site; not yet confirmed by the business as real and current (decision D4).";

export const JOBS: Job[] = validate(
  jobs,
  [
    {
      slug: "site-supervisor-saudi-arabia",
      title: "Site Supervisor",
      country: "Saudi Arabia",
      industry: "Construction",
      employmentType: "Full-Time",
      salary: { currency: "SAR", min: 3500, max: 4500, period: "month" },
      summary: "Oversee daily site activities, manage labour teams, and coordinate with project engineers on active construction sites.",
      postedOn: "2026-08-01",
      updatedOn: "2026-08-01",
      closesOn: null,
      openings: null,
      employer: null,
      verification: "unconfirmed",
      verificationNote: PENDING_D4,
    },
    {
      slug: "housekeeping-staff-uae",
      title: "Housekeeping Staff",
      country: "United Arab Emirates",
      industry: "Hospitality",
      employmentType: "Full-Time",
      salary: { currency: "AED", min: 1600, max: 2000, period: "month" },
      summary: "Maintain cleanliness and presentation standards across hotel rooms and common areas for a 4-star property.",
      postedOn: "2026-08-01",
      updatedOn: "2026-08-01",
      closesOn: null,
      openings: null,
      employer: null,
      verification: "unconfirmed",
      verificationNote: PENDING_D4,
    },
    {
      slug: "security-guard-qatar",
      title: "Security Guard",
      country: "Qatar",
      industry: "Security Services",
      employmentType: "Full-Time",
      salary: { currency: "QAR", min: 1400, max: 1800, period: "month" },
      summary: "Monitor premises, control access, and ensure safety compliance across a commercial facility.",
      postedOn: "2026-07-28",
      updatedOn: "2026-07-28",
      closesOn: null,
      openings: null,
      employer: null,
      verification: "unconfirmed",
      verificationNote: PENDING_D4,
    },
    {
      slug: "warehouse-assistant-oman",
      title: "Warehouse Assistant",
      country: "Oman",
      industry: "Logistics",
      employmentType: "Full-Time",
      salary: { currency: "OMR", min: 180, max: 220, period: "month" },
      summary: "Support inventory handling, loading and unloading, and stock organisation in a busy distribution warehouse.",
      postedOn: "2026-07-25",
      updatedOn: "2026-07-25",
      closesOn: null,
      openings: null,
      employer: null,
      verification: "unconfirmed",
      verificationNote: PENDING_D4,
    },
    {
      slug: "heavy-driver-trailer-truck-kuwait",
      title: "Heavy Driver (Trailer/Truck)",
      country: "Kuwait",
      industry: "Transportation",
      employmentType: "Full-Time",
      salary: { currency: "KWD", min: 130, max: 160, period: "month" },
      summary: "Valid heavy licence and Gulf driving experience preferred. Long and short-haul transport assignments.",
      postedOn: "2026-07-20",
      updatedOn: "2026-07-20",
      closesOn: null,
      openings: null,
      employer: null,
      verification: "unconfirmed",
      verificationNote: PENDING_D4,
    },
    {
      slug: "industrial-electrician-bahrain",
      title: "Electrician (Industrial)",
      country: "Bahrain",
      industry: "Engineering",
      employmentType: "Full-Time",
      salary: { currency: "BHD", min: 180, max: 230, period: "month" },
      summary: "Install, maintain and troubleshoot electrical systems across an industrial manufacturing facility.",
      postedOn: "2026-07-18",
      updatedOn: "2026-07-18",
      closesOn: null,
      openings: null,
      employer: null,
      verification: "unconfirmed",
      verificationNote: PENDING_D4,
    },
  ],
  "content/jobs.ts",
);

/** Closed = a closing date that has passed. A job without a closing date is open. */
export function jobIsClosed(j: Job, now: Date = new Date()): boolean {
  return j.closesOn !== null && now.getTime() > Date.parse(`${j.closesOn}T23:59:59Z`);
}

/** Jobs this deployment may show: confirmed ones anywhere; unconfirmed ones only outside production. */
export function visibleJobs(stage: DeploymentStage = deploymentStage()): Job[] {
  return JOBS.filter((j) => j.verification === "confirmed" || showsUnconfirmedContent(stage));
}

/** Open jobs, newest first — for listings. */
export function openJobs(stage: DeploymentStage = deploymentStage(), now: Date = new Date()): Job[] {
  return visibleJobs(stage)
    .filter((j) => !jobIsClosed(j, now))
    .sort((a, b) => b.postedOn.localeCompare(a.postedOn));
}

export function getJob(jobSlug: string, stage: DeploymentStage = deploymentStage()): Job | null {
  return visibleJobs(stage).find((j) => j.slug === jobSlug) ?? null;
}

export function formatSalary(s: Job["salary"]): string | null {
  if (!s) return null;
  const n = (v: number) => v.toLocaleString("en-IN");
  return `${s.currency} ${n(s.min)} – ${n(s.max)} / ${s.period}`;
}

/** The reviewed translation of a job's text into `locale`, if one exists. */
export function reviewedTranslation(j: Job, locale: string): JobTranslation | null {
  return j.translations.find((t) => t.locale === locale && t.status === "reviewed") ?? null;
}

/** ISO 3166-1 codes of the countries jobs are in — for Intl.DisplayNames (lib/i18n/format.ts). */
export const COUNTRY_CODES: Record<Job["country"], string> = {
  "Saudi Arabia": "SA",
  "United Arab Emirates": "AE",
  Qatar: "QA",
  Oman: "OM",
  Kuwait: "KW",
  Bahrain: "BH",
};
