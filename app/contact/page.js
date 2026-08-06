import Link from "next/link";
import ContactForm from "@/components/ContactForm";

export const metadata = {
  title: "Contact",
};

export default function ContactPage() {
  return (
    <>
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
                WhatsApp: <a href="https://wa.me/919517108866" target="_blank" rel="noopener" style={{ color: "var(--teal)", fontWeight: 600 }}>+91 95171 08866</a>
                <br />
                Email: <a href="mailto:jobs@gogulf.co" style={{ color: "var(--teal)", fontWeight: 600 }}>jobs@gogulf.co</a>
              </p>
            </div>
            <div className="card" style={{ marginBottom: 16 }}>
              <h3>Inquiry Desk</h3>
              <p>Call: <a href="tel:+919935309015" style={{ color: "var(--teal)", fontWeight: 600 }}>+91 99353 09015</a></p>
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
            <div className="card">
              <h3>Website</h3>
              <p>www.gogulf.co</p>
            </div>
            <p style={{ marginTop: 24 }}>
              Looking for a specific service?{" "}
              <Link href="/services#inquiry" style={{ color: "var(--teal)", fontWeight: 600 }}>Use the Service Inquiry form →</Link>
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
