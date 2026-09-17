import type { JobEmploymentType } from "@/types/database";
import { indianDateOf } from "@/lib/jobs/model";
import { jobIsOpen, jobUsesOnlineForm, type PublicJob } from "@/lib/jobs/public-job";
import { absoluteUrl, SITE_NAME, SITE_URL } from "@/lib/seo";

/**
 * schema.org JobPosting for ONE job, rendered on that job's own English page only (Google
 * does not accept JobPosting on list pages, and structured data must match its page).
 *
 * Returns null — no structured data at all — unless the job is published, accepting
 * applications and complete: a summary, a country, an employment type, an employer
 * disclosure and a publication date. A closed job, or one past its closing date, is
 * never an active JobPosting.
 *
 * Nothing is invented. `validThrough` is the job's own closing date for a time-limited job
 * and absent for ongoing hiring, which has no expiry to state. Salary, openings,
 * experience, education, qualifications and benefits appear only when the job states them.
 */

const EMPLOYMENT_TYPES: Record<JobEmploymentType, string> = {
  full_time: "FULL_TIME",
  part_time: "PART_TIME",
  contract: "CONTRACTOR",
  temporary: "TEMPORARY",
};

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function description(job: PublicJob): string {
  const parts = [`<p>${escapeHtml(job.summary ?? "")}</p>`];
  const section = (heading: string, items: string[]) =>
    items.length ? `<p><strong>${heading}</strong></p><ul>${items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>` : "";
  parts.push(section("Responsibilities", job.responsibilities));
  parts.push(section("Requirements", job.requirements));
  parts.push(section("What the job offers", job.benefits));
  return parts.join("");
}

export function jobPostingJsonLd(job: PublicJob, now: Date = new Date()) {
  if (job.status !== "published" || !jobIsOpen(job, now)) return null;
  if (!job.summary || !job.countryCode || !job.employmentType || !job.employer || !job.publishedAt) return null;
  if (job.availability === "time_limited" && !job.closesOn) return null;

  const hiringOrganization =
    job.employer.disclosure === "named"
      ? { "@type": "Organization", name: job.employer.name }
      : { "@type": "Organization", "@id": `${SITE_URL}/#organization`, name: SITE_NAME, sameAs: SITE_URL };

  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: description(job),
    identifier: { "@type": "PropertyValue", name: SITE_NAME, value: job.reference },
    datePosted: indianDateOf(job.publishedAt),
    ...(job.availability === "time_limited" && job.closesOn ? { validThrough: `${job.closesOn}T23:59:59+05:30` } : {}),
    employmentType: EMPLOYMENT_TYPES[job.employmentType],
    hiringOrganization,
    jobLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressCountry: job.countryCode,
        ...(job.city ? { addressLocality: job.city } : {}),
      },
    },
    directApply: jobUsesOnlineForm(job),
    url: absoluteUrl(`/jobs/${job.slug}`),
    ...(job.experience ? { experienceRequirements: job.experience } : {}),
    ...(job.education ? { educationRequirements: job.education } : {}),
    ...(job.requirements.length ? { qualifications: job.requirements.join("\n") } : {}),
    ...(job.benefits.length ? { jobBenefits: job.benefits.join("\n") } : {}),
    ...(job.vacancies ? { totalJobOpenings: job.vacancies } : {}),
    ...(job.salary
      ? {
          baseSalary: {
            "@type": "MonetaryAmount",
            currency: job.salary.currency,
            value: {
              "@type": "QuantitativeValue",
              minValue: job.salary.min,
              maxValue: job.salary.max,
              unitText: job.salary.period.toUpperCase(),
            },
          },
        }
      : {}),
  };
}
