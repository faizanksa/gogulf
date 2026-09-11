import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import { COMPANY } from "@/content/company";
import { breadcrumbJsonLd, pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("/about");

const BREADCRUMB = breadcrumbJsonLd([{ name: "About", path: "/about" }]);

const CORE_VALUES = [
  "Integrity", "Transparency", "Professionalism", "Trust", "Commitment",
  "Excellence", "Customer First", "Compliance", "Innovation", "Long-Term Relationships",
];

// Interim About page (Phase 2B): unverified claims removed — heritage year, placement
// numbers, "direct approval / MOFA compliant", "verified employer network", "fast
// processing", "global reach". Rebuilt on the design system in 2C-3.
export default function AboutPage() {
  return (
    <>
      <JsonLd data={BREADCRUMB} />
      <section className="page-hero">
        <div className="container">
          <div className="eyebrow" style={{ color: "var(--gold)" }}>About Go Gulf</div>
          <h1>Simplifying international recruitment, one honest placement at a time</h1>
          <p>
            Go Gulf is a brand of {COMPANY.legalName}, a company registered in India with its office in{" "}
            {COMPANY.address.locality}, {COMPANY.address.region}.
          </p>
        </div>
      </section>

      <section>
        <div className="container two-col">
          <div>
            <div className="eyebrow">Our Mission</div>
            <h2>Transparent recruitment, at every step</h2>
            <p>To connect talented professionals with Gulf employers through ethical, transparent, and technology-driven recruitment services — building successful careers and long-term business relationships.</p>
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
            <div className="eyebrow">How we work</div>
            <h2>A recruitment process built for confidence, not confusion</h2>
          </div>
          <div className="grid-3">
            <div className="card"><span className="num">01</span><h3>End-to-End Support</h3><p>From registration to post-joining, one team stays accountable for the outcome.</p></div>
            <div className="card"><span className="num">02</span><h3>Technology-Driven</h3><p>Structured, trackable recruitment — not paperwork lost between offices.</p></div>
            <div className="card"><span className="num">03</span><h3>Documentation Support</h3><p>Help with MOFA, embassy and immigration paperwork.</p></div>
          </div>
        </div>
      </section>

      <section className="section-sand">
        <div className="container">
          <div className="section-head">
            <div className="eyebrow">The company</div>
            <h2>Registered, and checkable</h2>
          </div>
          <div className="grid-3">
            <div className="card"><h3>Registered company</h3><p>{COMPANY.legalName}, CIN {COMPANY.cin}, incorporated {COMPANY.incorporationDate}.</p></div>
            <div className="card"><h3>One office, one team</h3><p>Registered office — {COMPANY.address.locality}, {COMPANY.address.region}, India.</p></div>
            <div className="card"><h3>Fees quoted in writing</h3><p>Every fee is quoted to you in writing before you pay. See <Link href="/pricing">Pricing &amp; fees</Link>.</p></div>
          </div>
          <p style={{ marginTop: 24 }}>
            <Link href="/verify">How to check you are dealing with Go Gulf</Link>
          </p>
        </div>
      </section>

      <section className="section-ink">
        <div className="container" style={{ maxWidth: 760 }}>
          <div className="eyebrow" style={{ color: "var(--gold)" }}>Our Promise</div>
          <h2>Every candidate deserves a genuine opportunity. Every employer deserves the right talent.</h2>
          <p style={{ color: "rgba(255,255,255,.72)" }}>We are committed to making overseas recruitment simpler and more transparent through professional service, ethical practices, and continuous support — from the first job inquiry to departure.</p>
          <Link href="/contact" className="btn btn-outline-light" style={{ marginTop: 12 }}>Get In Touch</Link>
        </div>
      </section>
    </>
  );
}
