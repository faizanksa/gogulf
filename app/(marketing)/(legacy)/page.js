import Link from "next/link";
import { COMPANY } from "@/content/company";
import { whatsappLink } from "@/content/channels";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("/");

// Interim home page (Phase 2B): the pre-redesign layout with every unverified claim
// removed — no heritage year, no placement numbers, no "direct approval / MOFA
// compliant", no countries-served count, no sector list. Rebuilt on the design system
// in 2C-2.
export default function HomePage() {
  return (
    <>
      <section className="hero">
        <div className="container hero-inner">
          <div className="eyebrow">Go Gulf · Lucknow, India</div>
          <h1>Go Gulf. Get Hired.</h1>
          <p className="lead">
            We help job seekers from India apply for jobs in the Gulf, and help employers there hire from India —
            from the first enquiry to departure.
          </p>
          <div className="hero-actions">
            <Link href="/jobs" className="btn btn-gold">Browse current jobs</Link>
            <Link href="/employers" className="btn btn-outline-light">Hire from India</Link>
          </div>
          <p style={{ marginTop: 20 }}>
            <a href={whatsappLink("Hello Go Gulf, I would like to ask about a job.")} target="_blank" rel="noopener noreferrer">
              Or ask us on WhatsApp<span className="visually-hidden"> (opens WhatsApp)</span>
            </a>
          </p>
        </div>
      </section>

      <div className="trust-bar">
        <div className="container trust-row">
          <div className="trust-item"><span className="dot"></span><div><strong>Registered company</strong><span>CIN {COMPANY.cin}</span></div></div>
          <div className="trust-item"><span className="dot"></span><div><strong>Office in {COMPANY.address.locality}</strong><span>{COMPANY.address.region}, India</span></div></div>
          <div className="trust-item"><span className="dot"></span><div><strong>Fees quoted in writing</strong><span>Before you pay anything</span></div></div>
          <div className="trust-item"><span className="dot"></span><div><strong><Link href="/verify">Verify Go Gulf</Link></strong><span>Check who we are</span></div></div>
        </div>
      </div>

      <section className="section-sand">
        <div className="container">
          <div className="section-head center" style={{ marginLeft: "auto", marginRight: "auto" }}>
            <div className="eyebrow">Jobs available</div>
            <h2>Current openings, in one place</h2>
            <p>Browse the openings we are recruiting for and apply directly online.</p>
          </div>
          <div style={{ textAlign: "center" }}>
            <Link href="/jobs" className="btn btn-gold">View open jobs</Link>
          </div>
        </div>
      </section>

      <section>
        <div className="container">
          <div className="section-head">
            <div className="eyebrow">The journey</div>
            <h2>From enquiry to joining — one managed route</h2>
            <p>Every candidate and employer moves through the same structured process. Scroll to follow the route.</p>
          </div>
          <div className="route" tabIndex={0} role="region" aria-label="The 10-step process">
            <div className="route-track">
              <div className="route-stop"><span className="route-dot"></span><span className="route-code">Step 01</span><span className="route-title">Job Inquiry</span><span className="route-desc">Candidate or employer submits a service inquiry.</span></div>
              <div className="route-stop"><span className="route-dot"></span><span className="route-code">Step 02</span><span className="route-title">Registration</span><span className="route-desc">Candidate profile and documents are registered.</span></div>
              <div className="route-stop"><span className="route-dot"></span><span className="route-code">Step 03</span><span className="route-title">Consultation</span><span className="route-desc">Recruiter reviews fit, role and destination.</span></div>
              <div className="route-stop"><span className="route-dot"></span><span className="route-code">Step 04</span><span className="route-title">Shortlisting</span><span className="route-desc">Profile matched and shortlisted for employer.</span></div>
              <div className="route-stop"><span className="route-dot"></span><span className="route-code">Step 05</span><span className="route-title">Employer Interview</span><span className="route-desc">Interview coordinated between both parties.</span></div>
              <div className="route-stop"><span className="route-dot"></span><span className="route-code">Step 06</span><span className="route-title">Selection &amp; Offer</span><span className="route-desc">Offer letter issued upon selection.</span></div>
              <div className="route-stop"><span className="route-dot"></span><span className="route-code">Step 07</span><span className="route-title">Medical &amp; Docs</span><span className="route-desc">Medical exam and documentation checked.</span></div>
              <div className="route-stop"><span className="route-dot"></span><span className="route-code">Step 08</span><span className="route-title">Visa &amp; MOFA</span><span className="route-desc">Agreement, attestation and visa processing.</span></div>
              <div className="route-stop"><span className="route-dot"></span><span className="route-code">Step 09</span><span className="route-title">Departure</span><span className="route-desc">Immigration clearance and flight ticket.</span></div>
              <div className="route-stop"><span className="route-dot"></span><span className="route-code">Step 10</span><span className="route-title">Joining &amp; Support</span><span className="route-desc">Overseas joining with post-joining support.</span></div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-sand">
        <div className="container">
          <div className="section-head">
            <div className="eyebrow">What we do</div>
            <h2>Recruitment support, end to end</h2>
          </div>
          <div className="grid-3">
            <div className="card"><span className="num">01</span><h3>For job seekers</h3><p>Help applying for Gulf jobs, interview coordination, and visa and pre-departure support.</p></div>
            <div className="card"><span className="num">02</span><h3>For employers</h3><p>Bulk manpower recruitment, candidate screening and recruitment process outsourcing.</p></div>
            <div className="card"><span className="num">03</span><h3>Documents</h3><p>Help with MOFA attestation, embassy processing and immigration formalities.</p></div>
          </div>
        </div>
      </section>

      <section>
        <div className="container">
          <div className="section-head center" style={{ marginLeft: "auto", marginRight: "auto" }}>
            <div className="eyebrow">Ready when you are</div>
            <h2>Tell us what you need — the right team picks it up from there</h2>
            <p>Submit a service inquiry and choose what you are looking for. Your request reaches the right team.</p>
          </div>
          <div style={{ textAlign: "center" }}>
            <Link href="/services#inquiry" className="btn btn-gold">Submit a service inquiry</Link>
          </div>
        </div>
      </section>
    </>
  );
}
