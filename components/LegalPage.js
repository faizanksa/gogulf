import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import { breadcrumbJsonLd, CONTACT } from "@/lib/seo";
import {
  LEGAL_ENTITY,
  ADDRESS_LINES,
  LEGAL_PAGES,
  POLICY_EFFECTIVE_DATE,
  POLICY_EFFECTIVE_ISO,
} from "@/lib/legal";

// Shared shell for the four policy pages (/privacy-policy,
// /terms-and-conditions, /cancellation-and-refunds, /shipping-policy) so they
// share one layout, one numbering scheme, one contact block and one
// cross-link bar — and so a new policy page is just an array of sections.
//
// Each entry in `sections` is { id, heading, body }. `body` is JSX; `id`
// becomes the anchor used by the sticky table of contents, which is generated
// from the same array so it can never drift out of sync with the headings.
const CONTACT_SECTION = {
  id: "contact-details",
  heading: "How to contact us about this policy",
};

export default function LegalPage({ title, eyebrow, path, intro, sections }) {
  const breadcrumb = breadcrumbJsonLd([{ name: title, path }]);
  const otherPages = LEGAL_PAGES.filter((p) => p.path !== path);
  // The contact block is rendered by this component rather than passed in, so
  // it has to be added to the contents list explicitly or it would be the one
  // numbered section nobody can jump to.
  const tocEntries = [...sections, CONTACT_SECTION];

  return (
    <>
      <JsonLd data={breadcrumb} />

      <section className="page-hero">
        <div className="container">
          <div className="eyebrow" style={{ color: "var(--gold)" }}>{eyebrow || "Legal"}</div>
          <h1>{title}</h1>
          {intro && <p>{intro}</p>}
          <div className="legal-hero-meta">
            <span>
              Last updated:{" "}
              <strong>
                <time dateTime={POLICY_EFFECTIVE_ISO}>{POLICY_EFFECTIVE_DATE}</time>
              </strong>
            </span>
            <span>Operated by <strong>{LEGAL_ENTITY.name}</strong></span>
            <span>GSTIN <strong>{LEGAL_ENTITY.gstin}</strong></span>
          </div>
        </div>
      </section>

      <section>
        <div className="container">
          <div className="legal-wrap">
            <nav className="legal-toc" aria-label="On this page">
              <h2>On this page</h2>
              <ol>
                {tocEntries.map((s) => (
                  <li key={s.id}>
                    <a href={`#${s.id}`}>{s.heading}</a>
                  </li>
                ))}
              </ol>
            </nav>

            <div className="legal-prose">
              {sections.map((s, i) => (
                <section key={s.id} id={s.id} className="legal-section">
                  <h2>
                    <span className="legal-num" aria-hidden="true">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span>{s.heading}</span>
                  </h2>
                  {s.body}
                </section>
              ))}

              <section id="contact-details" className="legal-section">
                <h2>
                  <span className="legal-num" aria-hidden="true">
                    {String(sections.length + 1).padStart(2, "0")}
                  </span>
                  <span>How to contact us about this policy</span>
                </h2>
                <p>
                  If you have a question, a correction or a grievance relating to this policy,
                  contact us using any of the details below and we will respond.
                </p>
                <dl className="legal-dl">
                  <div>
                    <dt>Legal entity</dt>
                    <dd>{LEGAL_ENTITY.name} ({LEGAL_ENTITY.constitution})</dd>
                  </div>
                  <div>
                    <dt>Brand / website</dt>
                    <dd>{LEGAL_ENTITY.brand} — www.gogulf.co</dd>
                  </div>
                  <div>
                    <dt>GSTIN</dt>
                    <dd>{LEGAL_ENTITY.gstin}</dd>
                  </div>
                  <div>
                    <dt>Registered address</dt>
                    <dd>
                      <address className="legal-address">
                        {ADDRESS_LINES.map((line) => (
                          <span key={line}>{line}</span>
                        ))}
                      </address>
                    </dd>
                  </div>
                  <div>
                    <dt>Candidate queries</dt>
                    <dd><a href={`mailto:${CONTACT.jobsEmail}`}>{CONTACT.jobsEmail}</a></dd>
                  </div>
                  <div>
                    <dt>Business, billing &amp; grievances</dt>
                    <dd><a href={`mailto:${CONTACT.businessEmail}`}>{CONTACT.businessEmail}</a></dd>
                  </div>
                  <div>
                    <dt>Inquiry desk</dt>
                    <dd><a href={CONTACT.inquiryPhoneHref}>{CONTACT.inquiryPhone}</a></dd>
                  </div>
                  <div>
                    <dt>WhatsApp</dt>
                    <dd>
                      <a href={CONTACT.whatsappApplyHref} target="_blank" rel="noopener">
                        {CONTACT.whatsappApply}
                      </a>
                    </dd>
                  </div>
                </dl>
                <p>
                  You can also use the form on our{" "}
                  <Link href="/contact">Contact page</Link>.
                </p>
              </section>

              <nav className="legal-footer-nav" aria-label="Other policies">
                <span className="legal-footer-nav-label">Also read:</span>
                {otherPages.map((p) => (
                  <Link key={p.path} href={p.path}>{p.label}</Link>
                ))}
              </nav>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
