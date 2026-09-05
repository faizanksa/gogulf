import Link from "next/link";
import ContactForm from "@/components/ContactForm";
import JsonLd from "@/components/JsonLd";
import { pageMetadata, breadcrumbJsonLd } from "@/lib/seo";
import { LEGAL_ENTITY, ADDRESS_LINES } from "@/lib/legal";

export const metadata = pageMetadata({
  title: "Contact",
  path: "/contact",
  description:
    "Reach Go Gulf's recruitment team directly by WhatsApp, phone or email, or submit a service inquiry for a specific job or hiring request. Registered office: Lucknow, Uttar Pradesh, India.",
});

const BREADCRUMB = breadcrumbJsonLd([{ name: "Contact", path: "/contact" }]);

export default function ContactPage() {
  return (
    <>
      <JsonLd data={BREADCRUMB} />
      <section className="page-hero">
        <div className="container">
          <div className="eyebrow" style={{ color: "var(--gold)" }}>Contact</div>
          <h1>Let&apos;s talk about your next hire, or your next role</h1>
          <p>Reach our team directly, or submit a detailed service inquiry for a specific request.</p>
        </div>
      </section>

      <section>
        <div className="container two-col">
          <div>
            <div className="eyebrow">Reach Us</div>
            <h2>Direct contact details</h2>
            <div className="card" style={{ marginBottom: 16 }}>
              <h3>Apply for a Job</h3>
              <p>
                WhatsApp: <a href="https://wa.me/919936309015" target="_blank" rel="noopener" style={{ color: "var(--teal)", fontWeight: 600 }}>+91 99363 09015</a>
                <br />
                Email: <a href="mailto:careers@gogulf.co" style={{ color: "var(--teal)", fontWeight: 600 }}>careers@gogulf.co</a>
              </p>
            </div>
            <div className="card" style={{ marginBottom: 16 }}>
              <h3>Inquiry Desk</h3>
              <p>Call: <a href="tel:+919936309015" style={{ color: "var(--teal)", fontWeight: 600 }}>+91 99363 09015</a></p>
            </div>
            <div className="card" style={{ marginBottom: 16 }}>
              <h3>Business / B2B Department</h3>
              <p>Email: <a href="mailto:business@gogulf.co" style={{ color: "var(--teal)", fontWeight: 600 }}>business@gogulf.co</a></p>
            </div>
            <div className="card" style={{ marginBottom: 16 }}>
              <h3>Stay Updated</h3>
              <p>
                <a href="https://whatsapp.com/channel/0029Vaa7XJ4FSAt7ri2W4W2J" target="_blank" rel="noopener" style={{ color: "var(--teal)", fontWeight: 600 }}>Join our WhatsApp Channel</a> — Latest Update Gulf Careers
                <br />
                <a href="https://www.youtube.com/@GoGulf8866" target="_blank" rel="noopener" style={{ color: "var(--teal)", fontWeight: 600 }}>Watch our full video guide on YouTube</a>
              </p>
            </div>
            <div className="card" style={{ marginBottom: 16 }}>
              <h3>Registered Office</h3>
              {/* <address> is flow content and must not sit inside a <p> — the
                  parser would close the <p> and break hydration. */}
              <p style={{ marginBottom: 6 }}><strong>{LEGAL_ENTITY.name}</strong></p>
              <address className="legal-address card-address">
                {ADDRESS_LINES.map((line) => <span key={line}>{line}</span>)}
              </address>
              <p style={{ marginTop: 10 }}>GSTIN: {LEGAL_ENTITY.gstin}</p>
            </div>
            <div className="card">
              <h3>Website</h3>
              <p>www.gogulf.co</p>
            </div>
            <p style={{ marginTop: 24 }}>
              Looking for a specific service?{" "}
              <Link href="/services#inquiry" style={{ color: "var(--teal)", fontWeight: 600 }}>Use the Service Inquiry form →</Link>
            </p>
            <p style={{ marginTop: 12, fontSize: ".9rem" }}>
              Before you submit anything, it is worth reading our{" "}
              <Link href="/privacy-policy" style={{ color: "var(--teal)", fontWeight: 600 }}>Privacy Policy</Link>{" "}
              and{" "}
              <Link href="/terms-and-conditions" style={{ color: "var(--teal)", fontWeight: 600 }}>Terms &amp; Conditions</Link>.
            </p>
          </div>

          <div>
            <div className="eyebrow">Quick Message</div>
            <h2>Send us a note</h2>
            <ContactForm />
          </div>
        </div>
      </section>
    </>
  );
}
