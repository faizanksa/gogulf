// ===== GO GULF — JobPosting JSON-LD =====
// Turns lib/jobs-data.js into schema.org JobPosting structured data, so
// listings are eligible for Google for Jobs / rich job results and are
// legible to AI answer engines. See: https://schema.org/JobPosting

import { absoluteUrl, GULF_COUNTRIES, SITE_NAME, SITE_URL } from "@/lib/seo";

const EMPLOYMENT_TYPE_MAP = {
  "full-time": "FULL_TIME",
  "part-time": "PART_TIME",
  "contract": "CONTRACTOR",
  "contractor": "CONTRACTOR",
  "temporary": "TEMPORARY",
  "internship": "INTERN",
  "intern": "INTERN",
  "volunteer": "VOLUNTEER",
  "per-diem": "PER_DIEM",
};

function mapEmploymentType(type) {
  const key = String(type || "").trim().toLowerCase();
  return EMPLOYMENT_TYPE_MAP[key] || "OTHER";
}

// Parses strings like "SAR 3,500 – 4,500 / month" into a schema.org
// MonetaryAmount. Returns null (field omitted) rather than guessing when the
// format doesn't match, so malformed salary data never emits bad rich results.
function parseSalary(salary) {
  const match = String(salary || "").match(
    /^([A-Z]{3})\s+([\d,]+)\s*[–—-]\s*([\d,]+)\s*\/\s*(\w+)/
  );
  if (!match) return null;
  const [, currency, min, max, unit] = match;
  const unitMap = { month: "MONTH", year: "YEAR", week: "WEEK", day: "DAY", hour: "HOUR" };
  const unitText = unitMap[unit.toLowerCase()];
  if (!unitText) return null;
  return {
    "@type": "MonetaryAmount",
    currency,
    value: {
      "@type": "QuantitativeValue",
      minValue: Number(min.replace(/,/g, "")),
      maxValue: Number(max.replace(/,/g, "")),
      unitText,
    },
  };
}

function slugify(str) {
  return String(str)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Google recommends an explicit expiry; without one, listings are assumed
// stale after ~30 days. Go Gulf's postings don't carry their own expiry date,
// so a fixed 45-day validity window from `posted` is applied here.
const VALID_FOR_DAYS = 45;

export function jobPostingJsonLd(job) {
  const posted = new Date(job.posted);
  const validThrough = new Date(posted);
  validThrough.setDate(validThrough.getDate() + VALID_FOR_DAYS);
  const salary = parseSalary(job.salary);
  const countryCode = GULF_COUNTRIES[job.country];

  return {
    "@type": "JobPosting",
    identifier: {
      "@type": "PropertyValue",
      name: SITE_NAME,
      value: slugify(`${job.title}-${job.country}`),
    },
    title: job.title,
    description: job.description,
    industry: job.industry,
    employmentType: mapEmploymentType(job.type),
    datePosted: job.posted,
    validThrough: validThrough.toISOString().slice(0, 10),
    directApply: true,
    hiringOrganization: {
      "@type": "Organization",
      name: SITE_NAME,
      sameAs: SITE_URL,
      logo: absoluteUrl("/assets/go-gulf-logo.png"),
    },
    jobLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressCountry: countryCode || job.country,
      },
    },
    url: absoluteUrl("/jobs"),
    ...(salary ? { baseSalary: salary } : {}),
  };
}

export function jobPostingListJsonLd(jobs) {
  return {
    "@context": "https://schema.org",
    "@graph": jobs.map(jobPostingJsonLd),
  };
}
