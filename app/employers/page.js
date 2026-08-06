import Link from "next/link";

export const metadata = {
  title: "For Employers",
};

const SOLUTIONS = [
  ["01", "Bulk Manpower Recruitment", "Sourcing for large industrial, construction and facility projects."],
  ["02", "Recruitment Process Outsourcing", "We run your hiring pipeline end to end, on your timeline."],
  ["03", "Candidate Screening", "Verification and shortlisting against your exact requirements."],
  ["04", "Interview Coordination", "We schedule and coordinate interviews with shortlisted candidates."],
  ["05", "HR & Recruitment Support", "Ongoing support for onboarding and workforce management."],
  ["06", "Compliance & Documentation", "Contracts, MOFA and immigration handled to local requirements."],
];

const WHY_US = [
  ["Verified Talent Pool", "Every candidate is screened before shortlisting."],
  ["Fast Turnaround", "Profiles moved through the pipeline without delay."],
  ["Compliance-First", "Documentation handled to Gulf regulatory standards."],
  ["Dedicated Support", "A single point of contact through the process."],
];

export default function EmployersPage() {
  return (
    <>
      <section className="page-hero">
        <div className="container">
          <div className="eyebrow" style={{ color: "var(--gold)" }}>For Employers</div>
          <h1>Qualified, job-ready manpower — sourced and verified</h1>
          <p>From single hires to bulk manpower recruitment, we manage sourcing, screening and compliance so you receive candidates ready to deploy.</p>
          <Link href="/services#inquiry" className="btn btn-gold" style={{ marginTop: 20 }}>Request Manpower</Link>
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
            <div className="eyebrow">Why Employers Choose Go Gulf</div>
            <h2>A recruitment partner, not just a supplier</h2>
            <p>We manage the full recruitment journey — job inquiry, screening, interviews, offer, documentation, visa processing and deployment — so your team only sees candidates who are ready to join.</p>
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
        </div>
      </section>
    </>
  );
}
