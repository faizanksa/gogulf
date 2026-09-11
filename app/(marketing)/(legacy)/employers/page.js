import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import { breadcrumbJsonLd, pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("/employers");

const BREADCRUMB = breadcrumbJsonLd([{ name: "Employers", path: "/employers" }]);

const SOLUTIONS = [
  ["01", "Bulk Manpower Recruitment", "Sourcing for large industrial, construction and facility projects."],
  ["02", "Recruitment Process Outsourcing", "We run your hiring pipeline end to end, on your timeline."],
  ["03", "Candidate Screening", "Checking and shortlisting candidates against your requirements."],
  ["04", "Interview Coordination", "We schedule and coordinate interviews with shortlisted candidates."],
  ["05", "HR & Recruitment Support", "Ongoing support for onboarding and workforce management."],
  ["06", "Documentation Support", "Help with contracts, MOFA attestation and immigration paperwork."],
];

const WHY_US = [
  ["Screening against your brief", "Candidates are shortlisted against the requirement you share."],
  ["One point of contact", "A single contact through the process."],
];

// Interim employer page (Phase 2B): unverified claims removed — "sourced and verified",
// "verified talent pool", "fast turnaround", "compliance-first / to Gulf regulatory
// standards". Rebuilt on the design system, with its own requirement form, in 2C-2.
export default function EmployersPage() {
  return (
    <>
      <JsonLd data={BREADCRUMB} />
      <section className="page-hero">
        <div className="container">
          <div className="eyebrow" style={{ color: "var(--gold)" }}>For employers</div>
          <h1>Hire from India for your Gulf operation</h1>
          <p>From single hires to bulk recruitment, we handle sourcing, screening and documentation, and send you candidates to interview.</p>
          <Link href="/services#inquiry" className="btn btn-gold" style={{ marginTop: 20 }}>Request manpower</Link>
        </div>
      </section>

      <section>
        <div className="container">
          <div className="section-head">
            <div className="eyebrow">Hiring Solutions</div>
            <h2>Built for companies that hire at scale</h2>
          </div>
          <div className="grid-3">
            {SOLUTIONS.map(([num, title, desc]) => (
              <div className="card" key={num}>
                <span className="num">{num}</span>
                <h3>{title}</h3>
                <p>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-sand">
        <div className="container two-col">
          <div>
            <div className="eyebrow">Working with Go Gulf</div>
            <h2>A recruitment partner, not just a supplier</h2>
            <p>We manage the recruitment journey — enquiry, screening, interviews, offer, documentation, visa processing and deployment — so your team sees candidates ready for interview.</p>
          </div>
          <div className="grid-2" style={{ gap: 16 }}>
            {WHY_US.map(([title, desc]) => (
              <div className="card" key={title}>
                <h3>{title}</h3>
                <p style={{ marginBottom: 0 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-ink">
        <div className="container" style={{ maxWidth: 700 }}>
          <div className="eyebrow" style={{ color: "var(--gold)" }}>Start Hiring</div>
          <h2>Tell us your manpower requirement</h2>
          <p style={{ color: "rgba(255,255,255,.72)" }}>
            Select &quot;Employer Hiring Solutions&quot; or &quot;Bulk Manpower Recruitment&quot; as your service type, and
            share your requirement — our team will follow up directly.
          </p>
          <Link href="/services#inquiry" className="btn btn-gold" style={{ marginTop: 8 }}>Submit a Service Inquiry</Link>
          <p style={{ marginTop: 22, marginBottom: 0, color: "rgba(255,255,255,.72)", fontSize: ".9rem" }}>
            Employer engagements are quoted against your specific requirement. See{" "}
            <Link href="/pricing" style={{ color: "var(--gold)", fontWeight: 600 }}>Pricing &amp; Fees</Link>{" "}
            for how commercial terms are agreed. Requesting a quotation is free.
          </p>
        </div>
      </section>
    </>
  );
}
