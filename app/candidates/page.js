import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import { pageMetadata, breadcrumbJsonLd } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "For Candidates",
  path: "/candidates",
  description:
    "Genuine Gulf job opportunities with end-to-end support — interview coordination, documentation, visa assistance, travel arrangements and post-joining care.",
});

const BREADCRUMB = breadcrumbJsonLd([{ name: "For Candidates", path: "/candidates" }]);

const SUPPORT = [
  ["01", "Genuine Opportunities", "Every employer in our network is verified before a role is offered to you."],
  ["02", "Interview Coordination", "We schedule and prepare you for employer interviews."],
  ["03", "Documentation Support", "Guidance on paperwork, medical exams and MOFA/embassy formalities."],
  ["04", "Visa Assistance", "We coordinate visa processing so nothing is missed."],
  ["05", "Travel Arrangements", "Air ticket and travel assistance ahead of your departure."],
  ["06", "Post-Joining Support", "We stay in touch after you join, not just until you sign."],
];

const INDUSTRIES = [
  "Construction", "Oil & Gas", "Engineering", "Manufacturing", "Hospitality", "Healthcare",
  "Retail", "Logistics", "Warehousing", "Facility Management", "Security Services",
  "IT & Technical", "Transportation", "Domestic & Housekeeping",
];

export default function CandidatesPage() {
  return (
    <>
      <JsonLd data={BREADCRUMB} />
      <section className="page-hero">
        <div className="container">
          <div className="eyebrow" style={{ color: "var(--gold)" }}>For Candidates</div>
          <h1>Your overseas career, guided end to end</h1>
          <p>From registration to post-joining support, every step of your journey to a Gulf job is managed by our team — with no guesswork.</p>
          <div className="hero-actions">
            <Link href="/jobs" className="btn btn-gold">View Open Jobs</Link>
            <a href="https://wa.me/919936309015" target="_blank" rel="noopener" className="btn btn-outline-light">Apply on WhatsApp</a>
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

      <section className="section-sand">
        <div className="container">
          <div className="section-head">
            <div className="eyebrow">Industries With Open Roles</div>
            <h2>Where our candidates are placed</h2>
          </div>
          <div className="tag-list">
            {INDUSTRIES.map((i) => <span key={i} className="tag">{i}</span>)}
          </div>
        </div>
      </section>

      <section className="section-ink">
        <div className="container" style={{ maxWidth: 700 }}>
          <div className="eyebrow" style={{ color: "var(--gold)" }}>Ready to Apply</div>
          <h2>Registration takes a few minutes</h2>
          <p style={{ color: "rgba(255,255,255,.72)" }}>
            Select &quot;Overseas Recruitment&quot; or &quot;Gulf Job Placement&quot; as your service type in the inquiry
            form, and a recruiter will reach out to guide you through registration. Or apply directly via
            WhatsApp or email.
          </p>
          <div className="hero-actions" style={{ marginTop: 8 }}>
            <a href="https://wa.me/919936309015" target="_blank" rel="noopener" className="btn btn-gold">Apply on WhatsApp</a>
            <a href="mailto:careers@gogulf.co" className="btn btn-outline-light">Email careers@gogulf.co</a>
          </div>
          <p style={{ marginTop: 20 }}>
            <a href="https://whatsapp.com/channel/0029Vaa7XJ4FSAt7ri2W4W2J" target="_blank" rel="noopener" style={{ color: "var(--gold)", fontWeight: 600 }}>Join our WhatsApp Channel</a> for
            the latest Gulf job updates, or watch our{" "}
            <a href="https://www.youtube.com/@GoGulf8866" target="_blank" rel="noopener" style={{ color: "var(--gold)", fontWeight: 600 }}>full video guide on YouTube</a>.
          </p>
        </div>
      </section>
    </>
  );
}
