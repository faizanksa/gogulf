import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import { CAREERS_EMAIL, whatsappLink } from "@/content/channels";
import { breadcrumbJsonLd, pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("/candidates");

const BREADCRUMB = breadcrumbJsonLd([{ name: "Job seekers", path: "/candidates" }]);

const SUPPORT = [
  ["01", "Interview Coordination", "We schedule and prepare you for employer interviews."],
  ["02", "Documentation Support", "Guidance on paperwork, medical exams and MOFA/embassy formalities."],
  ["03", "Visa Assistance", "We coordinate visa processing so nothing is missed."],
  ["04", "Travel Arrangements", "Air ticket and travel assistance ahead of your departure."],
  ["05", "Post-Joining Support", "We stay in touch after you join, not just until you sign."],
];

// Interim job-seeker page (Phase 2B): unverified claims removed — "every employer is
// verified", the sector list, and links to social profiles not yet confirmed as Go
// Gulf's. Rebuilt on the design system in 2C-2.
export default function CandidatesPage() {
  return (
    <>
      <JsonLd data={BREADCRUMB} />
      <section className="page-hero">
        <div className="container">
          <div className="eyebrow" style={{ color: "var(--gold)" }}>For job seekers</div>
          <h1>Your overseas career, guided end to end</h1>
          <p>From registration to post-joining support, every step of your journey to a Gulf job is managed by our team — with no guesswork.</p>
          <div className="hero-actions">
            <Link href="/jobs" className="btn btn-gold">View open jobs</Link>
            <a href={whatsappLink("Hello Go Gulf, I would like to apply for a job.")} target="_blank" rel="noopener noreferrer" className="btn btn-outline-light">
              Apply on WhatsApp<span className="visually-hidden"> (opens WhatsApp)</span>
            </a>
          </div>
        </div>
      </section>

      <section>
        <div className="container">
          <div className="section-head">
            <div className="eyebrow">What You Get</div>
            <h2>Support at every stage of the process</h2>
          </div>
          <div className="grid-3">
            {SUPPORT.map(([num, title, desc]) => (
              <div className="card" key={num}>
                <span className="num">{num}</span>
                <h3>{title}</h3>
                <p>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-ink">
        <div className="container" style={{ maxWidth: 700 }}>
          <div className="eyebrow" style={{ color: "var(--gold)" }}>Ready to Apply</div>
          <h2>Registration takes a few minutes</h2>
          <p style={{ color: "rgba(255,255,255,.72)" }}>
            Apply for a listed job online, or choose &quot;Overseas Recruitment&quot; or &quot;Gulf Job Placement&quot; in the
            service inquiry form and a recruiter will guide you through registration. Every fee is quoted to you in writing
            before you pay.
          </p>
          <div className="hero-actions" style={{ marginTop: 8 }}>
            <Link href="/jobs/apply" className="btn btn-gold">Apply online</Link>
            <a href={CAREERS_EMAIL.href} className="btn btn-outline-light">Email {CAREERS_EMAIL.value}</a>
          </div>
        </div>
      </section>
    </>
  );
}
