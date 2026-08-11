import Link from "next/link";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  path: "/",
  description:
    "A modern recruitment platform connecting talented professionals with genuine, verified employment opportunities across Saudi Arabia, UAE, Qatar, Oman, Kuwait and Bahrain — from first inquiry to final deployment.",
});

export default function HomePage() {
  return (
    <>
      <section className="hero">
        <div className="container hero-inner">
          <div className="eyebrow">Overseas Recruitment · Est. Gulf Region Network</div>
          <h1>Go Gulf. Get Hired.</h1>
          <p className="lead">
            A modern recruitment platform connecting talented professionals with genuine, verified
            employment opportunities across Saudi Arabia, UAE, Qatar, Oman, Kuwait and Bahrain —
            from first inquiry to final deployment.
          </p>
          <div className="hero-actions">
            <a href="https://wa.me/919517108866" target="_blank" rel="noopener" className="btn btn-gold">
              Apply for Job on WhatsApp
            </a>
            <Link href="/employers" className="btn btn-outline-light">Hire Manpower</Link>
          </div>
          <div className="hero-stats">
            <div><strong>2008</strong><span>Group Heritage</span></div>
            <div><strong>06</strong><span>Gulf Countries Served</span></div>
            <div><strong>14</strong><span>Step Managed Process</span></div>
            <div><strong>End-to-End</strong><span>Deployment Support</span></div>
          </div>
        </div>
      </section>

      <div className="trust-bar">
        <div className="container trust-row">
          <div className="trust-item"><span className="dot"></span><div><strong>20+ Years of Trust</strong><span>Since 2008</span></div></div>
          <div className="trust-item"><span className="dot"></span><div><strong>Thousands of Placements</strong><span>Every Year</span></div></div>
          <div className="trust-item"><span className="dot"></span><div><strong>No Hidden Charges</strong><span>100% Transparent</span></div></div>
          <div className="trust-item"><span className="dot"></span><div><strong>Direct Approval, MOFA Compliant</strong><span>Genuine &amp; Legal</span></div></div>
          <div className="trust-item"><span className="dot"></span><div><strong>Global Reach</strong><span>Local Support, Always With You</span></div></div>
        </div>
      </div>

      <section className="section-sand">
        <div className="container">
          <div className="section-head center" style={{ marginLeft: "auto", marginRight: "auto" }}>
            <div className="eyebrow">Jobs Available</div>
            <h2>Every opening we post — in one place</h2>
            <p>Whenever a new vacancy goes out on WhatsApp or social media, it&apos;s listed here too. Browse current openings and apply directly online.</p>
          </div>
          <div style={{ textAlign: "center" }}>
            <Link href="/jobs" className="btn btn-gold">View Open Jobs</Link>
          </div>
        </div>
      </section>

      <section>
        <div className="container">
          <div className="section-head">
            <div className="eyebrow">The Journey</div>
            <h2>From inquiry to overseas joining — one managed route</h2>
            <p>Every candidate and employer moves through the same transparent, structured process. Scroll to follow the route.</p>
          </div>
          <div className="route">
            <div className="route-track">
              <div className="route-stop"><span className="route-dot"></span><span className="route-code">Step 01</span><span className="route-title">Job Inquiry</span><span className="route-desc">Candidate or employer submits a service inquiry.</span></div>
              <div className="route-stop"><span className="route-dot"></span><span className="route-code">Step 02</span><span className="route-title">Registration</span><span className="route-desc">Candidate profile and documents are registered.</span></div>
              <div className="route-stop"><span className="route-dot"></span><span className="route-code">Step 03</span><span className="route-title">Consultation</span><span className="route-desc">Recruiter reviews fit, role and destination.</span></div>
              <div className="route-stop"><span className="route-dot"></span><span className="route-code">Step 04</span><span className="route-title">Shortlisting</span><span className="route-desc">Profile matched and shortlisted for employer.</span></div>
              <div className="route-stop"><span className="route-dot"></span><span className="route-code">Step 05</span><span className="route-title">Employer Interview</span><span className="route-desc">Interview coordinated between both parties.</span></div>
              <div className="route-stop"><span className="route-dot"></span><span className="route-code">Step 06</span><span className="route-title">Selection &amp; Offer</span><span className="route-desc">Offer letter issued upon selection.</span></div>
              <div className="route-stop"><span className="route-dot"></span><span className="route-code">Step 07</span><span className="route-title">Medical &amp; Docs</span><span className="route-desc">Medical exam and documentation verified.</span></div>
              <div className="route-stop"><span className="route-dot"></span><span className="route-code">Step 08</span><span className="route-title">Visa &amp; MOFA</span><span className="route-desc">Agreement, compliance and visa processing.</span></div>
              <div className="route-stop"><span className="route-dot"></span><span className="route-code">Step 09</span><span className="route-title">Departure</span><span className="route-desc">Immigration clearance and flight ticket.</span></div>
              <div className="route-stop"><span className="route-dot"></span><span className="route-code">Step 10</span><span className="route-title">Joining &amp; Support</span><span className="route-desc">Overseas joining with post-joining support.</span></div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-sand">
        <div className="container">
          <div className="section-head">
            <div className="eyebrow">What We Do</div>
            <h2>Complete recruitment, handled end to end</h2>
          </div>
          <div className="grid-3">
            <div className="card"><span className="num">01</span><h3>For Candidates</h3><p>Genuine job placement, interview coordination, visa and pre-departure support, so you can pursue an overseas career with confidence.</p></div>
            <div className="card"><span className="num">02</span><h3>For Employers</h3><p>Bulk manpower recruitment, candidate screening and recruitment process outsourcing, backed by a verified talent network.</p></div>
            <div className="card"><span className="num">03</span><h3>Documentation &amp; Compliance</h3><p>MOFA, embassy processing, immigration support and agreement compliance managed by an experienced team.</p></div>
          </div>
        </div>
      </section>

      <section className="section-ink">
        <div className="container two-col">
          <div>
            <div className="eyebrow">Industries We Serve</div>
            <h2>Skilled and job-ready manpower, across every sector</h2>
            <p style={{ color: "rgba(255,255,255,.72)" }}>We place candidates across construction, oil &amp; gas, engineering, manufacturing, hospitality, healthcare, logistics, security, IT and more.</p>
            <Link href="/services" className="btn btn-outline-light" style={{ marginTop: 8 }}>View All Services</Link>
          </div>
          <div className="tag-list">
            {["Construction", "Oil & Gas", "Engineering", "Manufacturing", "Hospitality", "Healthcare", "Retail", "Logistics", "Warehousing", "Facility Mgmt", "Security", "IT & Technical", "Transportation", "Housekeeping"].map((tag) => (
              <span key={tag} className="tag" style={{ background: "transparent", color: "#fff", borderColor: "rgba(255,255,255,.25)" }}>{tag}</span>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="container">
          <div className="section-head center" style={{ marginLeft: "auto", marginRight: "auto" }}>
            <div className="eyebrow">Ready When You Are</div>
            <h2>Tell us what you need — the right team picks it up from there</h2>
            <p>Submit a service inquiry and select exactly what you&apos;re looking for. Your request reaches the right desk automatically.</p>
          </div>
          <div style={{ textAlign: "center" }}>
            <Link href="/services#inquiry" className="btn btn-gold">Submit a Service Inquiry</Link>
          </div>
        </div>
      </section>
    </>
  );
}
