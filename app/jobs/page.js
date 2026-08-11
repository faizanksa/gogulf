import JobsBoard from "@/components/JobsBoard";
import JsonLd from "@/components/JsonLd";
import { pageMetadata, breadcrumbJsonLd } from "@/lib/seo";
import { jobPostingListJsonLd } from "@/lib/job-schema";
import { jobs } from "@/lib/jobs-data";

export const metadata = pageMetadata({
  title: "Jobs Available",
  path: "/jobs",
  description:
    "Current open positions across Saudi Arabia, UAE, Qatar, Oman, Kuwait and Bahrain. Every role is genuine and verified — apply directly online.",
});

const BREADCRUMB = breadcrumbJsonLd([{ name: "Jobs Available", path: "/jobs" }]);

export default function JobsPage() {
  return (
    <>
      <JsonLd data={BREADCRUMB} />
      <JsonLd data={jobPostingListJsonLd(jobs)} />
      <section className="page-hero">
        <div className="container">
          <div className="eyebrow" style={{ color: "var(--gold)" }}>Jobs Available</div>
          <h1>Current openings across the Gulf</h1>
          <p>Every role below is genuine and verified. Click Apply Now, fill the short form, and our team follows up directly.</p>
        </div>
      </section>

      <section>
        <div className="container">
          <JobsBoard />
        </div>
      </section>
    </>
  );
}
