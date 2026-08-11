import ServiceInquiryForm from "@/components/ServiceInquiryForm";
import JsonLd from "@/components/JsonLd";
import { pageMetadata, breadcrumbJsonLd } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Services",
  path: "/services",
  description:
    "Overseas recruitment, bulk manpower sourcing, RPO, visa & MOFA documentation, medical coordination and pre-departure support — 14 recruitment services, end to end.",
});

const BREADCRUMB = breadcrumbJsonLd([{ name: "Services", path: "/services" }]);

const SERVICES = [
  ["01", "Overseas Recruitment", "Full-cycle recruitment for candidates seeking verified Gulf employment."],
  ["02", "Gulf Job Placement", "Matching candidate profiles to genuine, screened job openings."],
  ["03", "Employer Hiring Solutions", "Tailored hiring support for companies sourcing Gulf-based talent."],
  ["04", "Bulk Manpower Recruitment", "Large-scale workforce sourcing for construction, industrial and facility projects."],
  ["05", "Recruitment Process Outsourcing", "End-to-end RPO so your internal team stays focused on operations."],
  ["06", "Interview Coordination", "Scheduling and coordinating candidate–employer interviews."],
  ["07", "Candidate Screening", "Verification and shortlisting against employer requirements."],
  ["08", "HR & Recruitment Support", "Ongoing HR assistance for placed candidates and partner employers."],
  ["09", "Visa & Documentation", "Guidance and processing support for all required paperwork."],
  ["10", "Medical Coordination", "Scheduling and coordination of pre-employment medical exams."],
  ["11", "MOFA & Embassy Processing", "Attestation and embassy formalities handled on your behalf."],
  ["12", "Immigration Support", "Clearance and compliance guidance through to departure."],
  ["13", "Air Ticket & Travel", "Travel arrangements coordinated for a smooth departure."],
  ["14", "Pre-Departure Orientation", "Briefing candidates on what to expect before they fly."],
];

export default function ServicesPage() {
  return (
    <>
      <JsonLd data={BREADCRUMB} />
      <section className="page-hero">
        <div className="container">
          <div className="eyebrow" style={{ color: "var(--gold)" }}>Our Services</div>
          <h1>Recruitment support, chosen by exactly what you need</h1>
          <p>Select a service below and submit an inquiry — your request is routed straight to the right desk.</p>
        </div>
      </section>

      <section>
        <div className="container">
          <div className="grid-3">
            {SERVICES.map(([num, title, desc]) => (
              <div className="card" key={num}>
                <span className="num">{num}</span>
                <h3>{title}</h3>
                <p>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-sand" id="inquiry">
        <div className="container">
          <div className="section-head center">
            <div className="eyebrow">Service Inquiry</div>
            <h2>Tell us what you&apos;re looking for</h2>
            <p>Select your service, share a few details, and our team will follow up. Your inquiry reaches us by email as soon as you submit.</p>
          </div>
          <ServiceInquiryForm />
        </div>
      </section>
    </>
  );
}
