import { Suspense } from "react";
import Link from "next/link";
import ApplyForm from "@/components/ApplyForm";
import JsonLd from "@/components/JsonLd";
import { pageMetadata, breadcrumbJsonLd } from "@/lib/seo";

export const metadata = pageMetadata("/jobs/apply");

const BREADCRUMB = breadcrumbJsonLd([
  { name: "Jobs Available", path: "/jobs" },
  { name: "Apply Now", path: "/jobs/apply" },
]);

export default function ApplyPage() {
  return (
    <>
      <JsonLd data={BREADCRUMB} />
      <section className="page-hero">
        <div className="container">
          <div className="eyebrow" style={{ color: "var(--gold)" }}>Apply Now</div>
          <h1>Submit your application</h1>
          <p>
            Fill in the short form below. Your application is emailed to our recruitment team instantly,
            and you&apos;ll receive a confirmation email for your records.
          </p>
        </div>
      </section>

      <section>
        <div className="container">
          <p style={{ marginBottom: 24 }}>
            <Link href="/jobs" style={{ color: "var(--teal)", fontWeight: 600 }}>← Back to all openings</Link>
          </p>
          <Suspense fallback={null}>
            <ApplyForm />
          </Suspense>
        </div>
      </section>
    </>
  );
}
