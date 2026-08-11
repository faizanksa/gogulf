import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import { pageMetadata, breadcrumbJsonLd } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "About",
  path: "/about",
  description:
    "Go Gulf is a modern overseas recruitment platform connecting talented professionals with genuine, verified employers across the Gulf region. 20+ years of trust, since 2008.",
});

const BREADCRUMB = breadcrumbJsonLd([{ name: "About", path: "/about" }]);

const CORE_VALUES = [
  "Integrity", "Transparency", "Professionalism", "Trust", "Commitment",
  "Excellence", "Customer First", "Compliance", "Innovation", "Long-Term Relationships",
];

export default function AboutPage() {
  return (
    <>
      <JsonLd data={BREADCRUMB} />
      <section className="page-hero">
        <div className="container">
          <div className="eyebrow" style={{ color: "var(--gold)" }}>About Go Gulf</div>
          <h1>Simplifying international recruitment, one honest placement at a time</h1>
          <p>Go Gulf is a modern overseas recruitment platform dedicated to connecting talented professionals with genuine employment opportunities across the Gulf region.</p>
        </div>
      </section>

      <section>
        <div className="container two-col">
          <div>
            <div className="eyebrow">Our Mission</div>
            <h2>Transparent recruitment, at every step</h2>
            <p>To connect talented professionals with verified Gulf employers through ethical, transparent, and technology-driven recruitment services — building successful careers and long-term business relationships.</p>
          </div>
          <div>
            <div className="eyebrow">Our Vision</div>
            <h2>A recruitment brand you can recognise and trust</h2>
            <p>To become one of the most trusted and recognised Gulf recruitment brands, by delivering reliable hiring solutions, innovative recruitment technology, and exceptional customer service.</p>
          </div>
        </div>
      </section>

      <section className="section-sand">
        <div className="container">
          <div className="section-head">
            <div className="eyebrow">Core Values</div>
            <h2>What guides every placement we make</h2>
          </div>
          <div className="tag-list">
            {CORE_VALUES.map((v) => <span key={v} className="tag">{v}</span>)}
          </div>
        </div>
      </section>

      <section>
        <div className="container">
          <div className="section-head">
            <div className="eyebrow">Why Choose Go Gulf</div>
            <h2>A recruitment process built for confidence, not confusion</h2>
          </div>
          <div className="grid-3">
            <div className="card"><span className="num">01</span><h3>Verified Employer Network</h3><p>Genuine overseas opportunities, screened before they ever reach a candidate.</p></div>
            <div className="card"><span className="num">02</span><h3>End-to-End Support</h3><p>From registration to post-joining, one team stays accountable for the outcome.</p></div>
            <div className="card"><span className="num">03</span><h3>Technology-Driven</h3><p>Structured, trackable recruitment — not paperwork lost between offices.</p></div>
            <div className="card"><span className="num">04</span><h3>Experienced Team</h3><p>Recruiters who understand Gulf compliance, documentation and timelines.</p></div>
            <div className="card"><span className="num">05</span><h3>Fast Processing</h3><p>Candidate profiles moved through shortlisting without unnecessary delay.</p></div>
            <div className="card"><span className="num">06</span><h3>Reliable Documentation</h3><p>MOFA, embassy and immigration processing handled with compliance-first care.</p></div>
          </div>
        </div>
      </section>

      <section className="section-sand">
        <div className="container">
          <div className="section-head">
            <div className="eyebrow">Since 2008</div>
            <h2>Trusted across the Gulf, built on real numbers</h2>
          </div>
          <div className="grid-3" style={{ marginBottom: 26 }}>
            <div className="card"><h3>20+ Years of Trust</h3><p>Serving candidates and employers since 2008.</p></div>
            <div className="card"><h3>Thousands of Placements</h3><p>Every year, across every industry we serve.</p></div>
            <div className="card"><h3>No Hidden Charges</h3><p>100% transparent, every step of the way.</p></div>
          </div>
          <div className="grid-3">
            <div className="card"><h3>Direct Approval, MOFA Compliant</h3><p>Genuine and legal processing, always.</p></div>
            <div className="card"><h3>Global Reach, Local Support</h3><p>Always with you, wherever you are.</p></div>
            <div className="card"><h3>Three Offices, One Team</h3><p>Registered Office — India · Corporate Office — Sharjah, UAE · Marketing Office — Jeddah, Saudi Arabia.</p></div>
          </div>
        </div>
      </section>

      <section className="section-ink">
        <div className="container" style={{ maxWidth: 760 }}>
          <div className="eyebrow" style={{ color: "var(--gold)" }}>Our Promise</div>
          <h2>Every candidate deserves a genuine opportunity. Every employer deserves the right talent.</h2>
          <p style={{ color: "rgba(255,255,255,.72)" }}>We are committed to making overseas recruitment simpler, faster, and more transparent through professional service, ethical practices, and continuous support — from the first job inquiry to final deployment.</p>
          <Link href="/contact" className="btn btn-outline-light" style={{ marginTop: 12 }}>Get In Touch</Link>
        </div>
      </section>
    </>
  );
}
