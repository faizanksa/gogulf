import JobsBoard from "@/components/JobsBoard";
import JsonLd from "@/components/JsonLd";
import { formatSalary, openJobs } from "@/content/jobs";
import { breadcrumbJsonLd, pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("/jobs");

// Open/closed follows the calendar without a deploy.
export const revalidate = 3600;

const BREADCRUMB = breadcrumbJsonLd([{ name: "Jobs", path: "/jobs" }]);

// Interim jobs page (Phase 2B). JobPosting structured data moved to each job's own page
// (/jobs/[slug]) — Google does not accept it on list pages — and listings now come from
// the validated content layer. Rebuilt on the design system in 2C-1.
export default function JobsPage() {
  const jobs = openJobs().map((j) => ({
    slug: j.slug,
    title: j.title,
    country: j.country,
    industry: j.industry,
    type: j.employmentType,
    salary: formatSalary(j.salary),
    posted: j.postedOn,
    description: j.summary,
    unconfirmed: j.verification !== "confirmed",
  }));

  return (
    <>
      <JsonLd data={BREADCRUMB} />
      <section className="page-hero">
        <div className="container">
          <div className="eyebrow" style={{ color: "var(--gold)" }}>Jobs available</div>
          <h1>Current openings across the Gulf</h1>
          <p>Read the details of each role, then apply online or ask us about it on WhatsApp.</p>
        </div>
      </section>

      <section>
        <div className="container">
          <JobsBoard jobs={jobs} />
        </div>
      </section>
    </>
  );
}
