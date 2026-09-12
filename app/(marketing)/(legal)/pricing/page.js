import Link from "next/link";
import LegalPage from "@/components/LegalPage";
import { pageMetadata, CONTACT } from "@/lib/seo";
import { LEGAL_ENTITY, POLICY_EFFECTIVE_DATE } from "@/lib/legal";

export const metadata = pageMetadata("/pricing");

// Satisfies the "Pricing details" item on a merchant-website checklist without
// publishing a price list the business does not have, and without asserting a
// commercial model the codebase does not evidence (see the note in lib/legal.js
// where a fee-payer constant deliberately does not exist).
//
// It discloses the STRUCTURE — that candidate-side and employer-side services
// are separate engagements on separate written terms, what a fee covers, what
// is a third-party pass-through, how a quotation is issued — and states no
// amount and no claim that either side is or is not charged. If a standard rate
// card or a settled fee model ever exists, add it here.
const SECTIONS = [
  {
    id: "how-we-price",
    heading: "How our services are priced",
    body: (
      <>
        <p>
          {LEGAL_ENTITY.brand} serves two distinct audiences —{" "}
          <strong>candidates</strong> seeking overseas employment, and{" "}
          <strong>employers and client companies</strong> that need manpower sourced and hired.
          These are separate engagements, and{" "}
          <strong>candidate-side and employer-side services may have separate pricing arrangements</strong>.
          What applies to one tells you nothing about the other.
        </p>
        <div className="legal-callout">
          <p>
            <strong>
              Applicable fees depend on the service, the engagement and the written commercial terms
              for it. Any applicable fees, inclusions, exclusions, taxes and refund terms are
              communicated to you before payment, or agreed in the relevant written service
              agreement.
            </strong>
          </p>
        </div>
        <p>
          We do not publish a rate card, because there is no single figure that would be honest.
          What an engagement costs depends on what is actually involved — which services are
          engaged, the roles and destination countries, the scale of the requirement, which
          documentation, attestation, medical and visa steps that country requires, and how much of
          the process is handled for you. A headline number here would not apply to most people who
          read it. We price each engagement on its facts instead, and put the figure in writing
          before anyone commits to anything.
        </p>
      </>
    ),
  },
  {
    id: "whats-free",
    heading: "What costs nothing",
    body: (
      <p>
        Browsing this website, viewing job openings, submitting a contact or service inquiry, and
        submitting a job application are <strong>free</strong>. This website takes no payment from
        anyone: there is no checkout on it, and no fee arises simply from applying for a role or
        sending us a requirement. A fee, where one applies at all, arises only from a service you go
        on to engage us for, on terms given to you in writing first.
      </p>
    ),
  },
  {
    id: "candidate-side",
    heading: "Candidate-side services",
    body: (
      <>
        <p>
          These are the services a candidate may engage us for — registration and profile
          preparation, job-application and job-matching support, documentation and attestation guidance, MOFA and
          embassy processing, medical coordination, immigration support, travel and ticketing
          coordination, and pre-departure orientation.
        </p>
        <p>
          Where a candidate-side service carries a fee, that fee, what it covers and when it is
          payable is set out to you in writing before you are asked to pay, and it is subject to the
          limits described under <a href="#legal-limits">Limits imposed by law</a> below.
          Third-party costs such as government, embassy, medical, insurance and travel charges are
          separate from any service fee — see{" "}
          <a href="#third-party-costs">Third-party costs</a>.
        </p>
      </>
    ),
  },
  {
    id: "employer-side",
    heading: "Employer-side services",
    body: (
      <>
        <p>
          Employer hiring solutions, bulk candidate sourcing, recruitment support, candidate
          screening, interview coordination and HR support are business-to-business engagements. They are quoted commercially and separately from
          anything on the candidate side.
        </p>
        <p>
          Pricing for an employer engagement is agreed against the specific requirement, and depends
          on factors such as the roles and volumes involved, the destination countries, the scope of
          work handed to us, the duration of the engagement and the service levels agreed. The
          commercial terms — fee basis, payment schedule, taxes, what is and is not included, and
          any replacement or refund arrangement — are set out in the written proposal, service
          agreement or purchase order between us, and those terms govern the engagement.
        </p>
        <p>
          To request commercial terms for a requirement, contact{" "}
          <a href={`mailto:${CONTACT.businessEmail}`}>{CONTACT.businessEmail}</a> or submit a
          requirement through the <Link href="/employers">For Employers</Link> page. There is no
          charge for requesting a quotation.
        </p>
      </>
    ),
  },
  {
    id: "how-you-are-told",
    heading: "How you are told the price",
    body: (
      <>
        <div className="legal-callout">
          <p>
            <strong>
              You will always be told the fee in writing, in advance. If a charge has not been
              stated to you in writing, it is not payable to us.
            </strong>
          </p>
        </div>
        <p>
          Before you pay anything, we give you a written quotation, invoice, service agreement,
          proposal or purchase order — whichever suits the engagement — that sets out:
        </p>
        <ul>
          <li>the exact amount payable, and the currency;</li>
          <li>precisely which services that amount covers;</li>
          <li>what is <em>not</em> included, and what you should expect to pay separately;</li>
          <li>when it is payable, and in how many instalments if it is staged;</li>
          <li>applicable taxes;</li>
          <li>the cancellation and refund position that applies to it.</li>
        </ul>
        <p>
          Ask for that document, and keep it. If anything you were told verbally or over WhatsApp
          differs from it, tell us before you pay — the written document is what governs.
        </p>
      </>
    ),
  },
  {
    id: "what-a-fee-covers",
    heading: "What a Go Gulf service fee covers",
    body: (
      <>
        <p>
          A service fee, where one applies, covers the professional work our team performs under
          that engagement — the work described on our <Link href="/services">Services</Link> page.
          On the candidate side that is registration and profile preparation, matching against live
          vacancies, interview coordination, documentation and attestation support, MOFA and embassy
          processing, medical and visa coordination, travel coordination, pre-departure orientation
          and post-joining support. On the employer side it is sourcing, screening and verification,
          shortlisting, interview coordination, sourcing at volume, recruitment support and HR
          support, to the scope agreed in your commercial terms.
        </p>
        <p>
          It is a fee for that service and that effort. It is{" "}
          <strong>not</strong> a payment for a job, an offer, a visa or a guaranteed outcome — as
          our <Link href="/terms-and-conditions">Terms &amp; Conditions</Link> set out plainly, none
          of those can be guaranteed by anyone, and we do not sell them.
        </p>
      </>
    ),
  },
  {
    id: "third-party-costs",
    heading: "Third-party costs, which are not our fee",
    body: (
      <>
        <p>
          Overseas employment involves payments to organisations that are not us. These are separate
          from our service fee, even where we arrange or coordinate the payment on your behalf:
        </p>
        <ul>
          <li>government and statutory fees, including emigration-related charges where applicable;</li>
          <li>embassy, consulate, attestation and MOFA charges;</li>
          <li>visa and immigration processing charges levied by the authority concerned;</li>
          <li>pre-employment medical examination fees charged by approved medical centres;</li>
          <li>insurance premiums;</li>
          <li>air fares and travel costs;</li>
          <li>passport and document charges payable to the issuing authority.</li>
        </ul>
        <p>
          These amounts are set by those third parties, not by us, and they can change without
          notice. Where you ask us to pay one on your behalf, it is passed on to you at actual cost
          and identified separately on your quotation or invoice. Because that money leaves us for
          the third party, its recoverability is limited — see our{" "}
          <Link href="/cancellation-and-refunds">Cancellation &amp; Refunds Policy</Link>.
        </p>
      </>
    ),
  },
  {
    id: "taxes",
    heading: "Taxes",
    body: (
      <p>
        Goods and Services Tax (GST) and any other applicable tax is charged as required by Indian
        law and shown separately on your invoice. {LEGAL_ENTITY.name} is registered under GST with
        GSTIN <strong>{LEGAL_ENTITY.gstin}</strong>. If you need a GST invoice for your records, ask
        us and we will issue one.
      </p>
    ),
  },
  {
    id: "legal-limits",
    heading: "Limits imposed by law",
    body: (
      <p>
        Any fee we charge for a service is subject to
        the limits and conditions imposed by applicable Indian law and by the law of the destination
        country. We do not charge, and will not ask you for, anything that the law does not permit
        us to charge. If you believe a charge you have been asked for exceeds what is permitted,
        raise it with us at{" "}
        <a href={`mailto:${CONTACT.businessEmail}`}>{CONTACT.businessEmail}</a> before you pay.
      </p>
    ),
  },
  {
    id: "how-to-pay",
    heading: "How to pay, and how to pay safely",
    body: (
      <>
        <p>
          Pay only against a written quotation or invoice from us, and only into the account or
          payment link that we have confirmed to you in writing. Ask for a receipt for every payment
          you make, and keep it — you will need the reference if you ever raise a refund request.
        </p>
        <p>
          Where a payment is taken online, it is processed by a regulated third-party payment
          gateway. You enter your card, UPI or bank details on the gateway&apos;s own secure page;
          we do not see or store them.
        </p>
        <div className="legal-callout">
          <p>
            <strong>
              We will never ask you for an OTP, a PIN, a password or your card CVV, and we will
              never ask you to pay into the personal account of an individual.
            </strong>{" "}
            If anyone claiming to represent {LEGAL_ENTITY.brand} does, do not pay. Verify it with us
            first on <a href={CONTACT.inquiryPhoneHref}>{CONTACT.inquiryPhone}</a> or{" "}
            <a href={`mailto:${CONTACT.businessEmail}`}>{CONTACT.businessEmail}</a>.
          </p>
        </div>
      </>
    ),
  },
  {
    id: "cancellation",
    heading: "If you cancel, or want a refund",
    body: (
      <p>
        You can cancel a service request at any time by telling us in writing. What you get back
        depends on how much of the service had been performed and how much had already been paid
        onward to third parties. Where an employer engagement has its own written cancellation,
        replacement or refund terms, those terms govern that engagement. The general position — when
        a refund is available, when it is not, how to request one and how an approved refund reaches
        you — is in our{" "}
        <Link href="/cancellation-and-refunds">Cancellation &amp; Refunds Policy</Link>.
      </p>
    ),
  },
  {
    id: "changes",
    heading: "Changes to our fees and to this page",
    body: (
      <p>
        We may change our fees and update this page from time to time. A change never applies
        retrospectively to a quotation you have already accepted or a service agreement already in
        place — those remain on their agreed terms. The version published on this page is the one
        that applies, and the “last updated” date at the top tells you when it last changed. The
        current version took effect on <strong>{POLICY_EFFECTIVE_DATE}</strong>.
      </p>
    ),
  },
];

export default function PricingPage() {
  return (
    <LegalPage
      title="Pricing & Fees"
      eyebrow="Legal"
      path="/pricing"
      intro="Who pays, what a service fee covers, what is a third-party cost, and why every fee is put in writing before you are asked to pay anything."
      sections={SECTIONS}
    />
  );
}
