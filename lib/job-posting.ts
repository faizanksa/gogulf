import { COUNTRY_CODES, type Job } from "@/content/jobs";
import { absoluteUrl, SITE_NAME, SITE_URL } from "@/lib/seo";

/**
 * schema.org JobPosting for ONE job, rendered on that job's own page only (Google does
 * not accept JobPosting on list pages).
 *
 * Returns null — no structured data at all — unless the job is confirmed, has an
 * explicit closing date and an employer disclosure. There is no fallback expiry.
 * Optional properties (experience, qualifications, benefits, salary, openings) appear
 * only when the job states them, so the markup never says more than the page.
 */

const EMPLOYMENT_TYPES: Record<Job["employmentType"], string> = {
  "Full-Time": "FULL_TIME",
  "Part-Time": "PART_TIME",
  Contract: "CONTRACTOR",
  Temporary: "TEMPORARY",
};

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function jobPostingJsonLd(job: Job) {
  if (job.verification !== "confirmed" || !job.closesOn || !job.employer) return null;

  const hiringOrganization =
    job.employer.disclosure === "named"
      ? { "@type": "Organization", name: job.employer.name }
      : { "@type": "Organization", "@id": `${SITE_URL}/#organization`, name: SITE_NAME, sameAs: SITE_URL };

  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: `<p>${escapeHtml(job.summary)}</p>`,
    identifier: { "@type": "PropertyValue", name: SITE_NAME, value: job.slug },
    datePosted: job.postedOn,
    validThrough: `${job.closesOn}T23:59:59+05:30`,
    employmentType: EMPLOYMENT_TYPES[job.employmentType],
    industry: job.industry,
    hiringOrganization,
    jobLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressCountry: COUNTRY_CODES[job.country],
        ...(job.city ? { addressLocality: job.city } : {}),
      },
    },
    directApply: true,
    url: absoluteUrl(`/jobs/${job.slug}`),
    ...(job.experience ? { experienceRequirements: job.experience } : {}),
    ...(job.requirements.length ? { qualifications: job.requirements.join("\n") } : {}),
    ...(job.benefits.length ? { jobBenefits: job.benefits.join("\n") } : {}),
    ...(job.openings ? { totalJobOpenings: job.openings } : {}),
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
