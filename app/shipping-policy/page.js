import Link from "next/link";
import LegalPage from "@/components/LegalPage";
import { pageMetadata, CONTACT } from "@/lib/seo";
import { LEGAL_ENTITY, POLICY_EFFECTIVE_DATE, HAS_LEGAL_ENTITY } from "@/lib/legal";

export const metadata = pageMetadata({
  title: "Shipping & Delivery Policy",
  path: "/shipping-policy",
  description:
    "Go Gulf sells no physical products and ships no goods. This policy explains how our recruitment services are delivered, when delivery begins, and what to expect on timelines.",
});

// A "Shipping Policy" is on the standard merchant-website checklist, but Go
// Gulf ships nothing — so rather than inventing courier terms, this page says
// plainly that no goods are sold or shipped and documents how the services are
// actually delivered (email, WhatsApp, phone, in-person coordination) instead.
const SECTIONS = [
  {
    id: "no-goods",
    heading: "We do not sell or ship any physical products",
    body: (
      <>
        <div className="legal-callout">
          <p>
            <strong>
              {HAS_LEGAL_ENTITY ? (
                <>{LEGAL_ENTITY.name} (trading as {LEGAL_ENTITY.brand})</>
              ) : (
                LEGAL_ENTITY.brand
              )}{" "}
              is a recruitment services company. We sell no goods, we operate no online store, and
              we ship nothing.
            </strong>{" "}
            There is therefore no shipping charge, no courier partner, no dispatch or tracking
            process and no delivery address to provide.
          </p>
        </div>
        <p>
          This page exists because “shipping and delivery” is a standard disclosure on commercial
          websites. Since nothing is shipped, it sets out instead how our services — which are
          professional and largely digital — are actually delivered to you.
        </p>
      </>
    ),
  },
  {
    id: "what-we-deliver",
    heading: "What we deliver instead",
    body: (
      <>
        <p>
          What you receive from us is recruitment and mobilisation work performed by our team,
          delivered as communications, coordination and documentation support. Depending on the
          service, that includes:
        </p>
        <ul>
          <li>registration of your profile and assessment against live vacancies;</li>
          <li>screening, verification and shortlisting against an employer&apos;s requirement;</li>
          <li>interview scheduling, coordination and employer feedback;</li>
          <li>guidance and processing support for documentation and attestation;</li>
          <li>coordination of MOFA and embassy formalities and of visa processing;</li>
          <li>coordination of pre-employment medical appointments;</li>
          <li>immigration guidance and travel and ticketing coordination;</li>
          <li>pre-departure orientation and post-joining support;</li>
          <li>
            for employers: sourcing, bulk manpower recruitment, recruitment process outsourcing,
            screening reports, candidate shortlists and hiring coordination.
          </li>
        </ul>
        <p>
          The full list of services is on our <Link href="/services">Services</Link> page.
        </p>
      </>
    ),
  },
  {
    id: "how-delivered",
    heading: "How services are delivered to you",
    body: (
      <>
        <p>Delivery happens through the channels you already use to reach us:</p>
        <ul>
          <li>
            <strong>Email</strong> — from our {LEGAL_ENTITY.brand} addresses,{" "}
            {CONTACT.jobsEmail} for candidate matters and {CONTACT.businessEmail} for business and
            billing matters;
          </li>
          <li>
            <strong>WhatsApp and phone</strong> — on the numbers published on our{" "}
            <Link href="/contact">Contact</Link> page, for updates and coordination;
          </li>
          <li>
            <strong>Scheduled appointments</strong> — interviews, medical examinations, embassy or
            attestation appointments and briefings, coordinated by us and attended by you;
          </li>
          <li>
            <strong>Documents</strong> — shared electronically, or submitted by us on your behalf to
            the employer, embassy, ministry or authority concerned.
          </li>
        </ul>
        <p>
          Nothing is delivered through this website itself: the website is where you find
          information and reach us. Please make sure the email address and phone number you give us
          are correct and monitored, and check your spam folder — a missed message is the most
          common cause of a delay.
        </p>
      </>
    ),
  },
  {
    id: "when-delivery-starts",
    heading: "When delivery begins",
    body: (
      <>
        <p>
          We respond to inquiries and applications submitted through this website within{" "}
          <strong>1–2 business days</strong>, which is the response time stated on our inquiry and
          application forms.
        </p>
        <p>
          Where a service carries a fee, we begin the engaged work once the service has been
          confirmed with you in writing and any payment due at that stage has been received and
          cleared. Where a service carries no fee, work begins once we have what we need from you to
          start — typically your completed profile and required documents.
        </p>
      </>
    ),
  },
  {
    id: "timelines",
    heading: "Timelines, and why we do not promise dates",
    body: (
      <>
        <p>
          We work to the timelines we agree with you and keep you informed of progress. But
          recruitment for overseas employment moves at the pace of parties we do not control:
          employers deciding on shortlists and interviews, embassies and consulates issuing visas,
          ministries and attestation authorities processing documents, approved medical centres
          scheduling examinations, and airlines and immigration authorities handling travel.
        </p>
        <p>
          Any duration we give you is an estimate based on how the process normally runs, not a
          guaranteed delivery date. Public holidays in India and in the destination country, changes
          in immigration policy, and events outside our reasonable control can extend it. As set out
          in our <Link href="/terms-and-conditions">Terms &amp; Conditions</Link>, we do not
          guarantee selection, visa issuance, travel or joining.
        </p>
      </>
    ),
  },
  {
    id: "physical-documents",
    heading: "Physical documents",
    body: (
      <>
        <p>
          Some stages of overseas recruitment involve original physical documents — a passport for
          visa stamping, or attested originals returned by an authority, for example.
        </p>
        <p>
          Where an original document of yours needs to be collected from you or returned to you, we
          will agree the arrangement with you in advance and confirm it in writing, and we will
          confirm the handover when it is done. This is document handling within a service you have
          engaged us for. It is not a sale, and it is not shipping: we make no charge for delivery
          as such, and any actual courier or postage cost, where one is genuinely incurred at your
          request, is told to you before it is incurred.
        </p>
      </>
    ),
  },
  {
    id: "charges",
    heading: "Delivery and shipping charges",
    body: (
      <p>
        <strong>There are no shipping charges, delivery charges or handling charges.</strong> The
        only amounts payable to us are the service fees set out to you in writing before you pay,
        plus applicable taxes, as described in our{" "}
        <Link href="/cancellation-and-refunds">Cancellation &amp; Refunds Policy</Link> and{" "}
        <Link href="/terms-and-conditions">Terms &amp; Conditions</Link>. Third-party charges such
        as government, embassy, attestation, medical, insurance and air-travel costs are separate
        and are identified to you as such.
      </p>
    ),
  },
  {
    id: "international",
    heading: "International service delivery",
    body: (
      <p>
        Our services relate to employment in Saudi Arabia, the United Arab Emirates, Qatar, Oman,
        Kuwait and Bahrain, and we work with candidates and employers in different countries. Because
        delivery is by email, phone, WhatsApp and coordinated appointments rather than by shipment,
        it is not restricted by geography, and no customs, import duty or cross-border shipping
        consideration arises.
      </p>
    ),
  },
  {
    id: "problems",
    heading: "If something has not reached you",
    body: (
      <>
        <p>
          If you were expecting an update, a document or a call and it has not arrived, tell us
          rather than waiting. Email{" "}
          <a href={`mailto:${CONTACT.jobsEmail}`}>{CONTACT.jobsEmail}</a> for anything relating to a
          job application, or{" "}
          <a href={`mailto:${CONTACT.businessEmail}`}>{CONTACT.businessEmail}</a> for a business or
          billing matter, or call our inquiry desk on{" "}
          <a href={CONTACT.inquiryPhoneHref}>{CONTACT.inquiryPhone}</a>. Include your name, the role
          or service concerned, and any reference number you have, and we will trace it and come
          back to you.
        </p>
      </>
    ),
  },
  {
    id: "changes",
    heading: "Changes to this policy",
    body: (
      <p>
        We may update this policy from time to time. The version published on this page is the one
        that applies, and the “last updated” date at the top of this page tells you when it last
        changed. The current version took effect on <strong>{POLICY_EFFECTIVE_DATE}</strong>.
      </p>
    ),
  },
];

export default function ShippingPolicyPage() {
  return (
    <LegalPage
      title="Shipping & Delivery Policy"
      eyebrow="Legal"
      path="/shipping-policy"
      intro="We sell no products and ship no goods. This page explains how our recruitment services are delivered, when delivery begins, and what to expect on timelines."
      sections={SECTIONS}
    />
  );
}
