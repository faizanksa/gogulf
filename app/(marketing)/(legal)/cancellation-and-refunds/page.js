import Link from "next/link";
import LegalPage from "@/components/LegalPage";
import { pageMetadata, CONTACT } from "@/lib/seo";
import { LEGAL_ENTITY, REFUND_BANK_CREDIT_WINDOW, POLICY_EFFECTIVE_DATE } from "@/lib/legal";

export const metadata = pageMetadata("/cancellation-and-refunds");

// States a process, not invented commercial terms: Go Gulf's fees are
// engagement-specific and set out in each written quotation/agreement, and the
// company publishes no internal review SLA, so neither appears here. The one
// duration quoted is the post-initiation banking window from lib/legal.js,
// which describes the payment rail rather than a promise by Go Gulf.
const SECTIONS = [
  {
    id: "scope",
    heading: "What this policy covers",
    body: (
      <>
        <p>
          This policy explains how to cancel a service request made to{" "}
          <strong>{LEGAL_ENTITY.name}</strong> (trading as {LEGAL_ENTITY.brand}), when a refund may
          be available, how to ask for one, and how long an approved refund takes to reach you.
        </p>
        <p>
          It applies to service fees you pay to us, whether you engage us as a candidate or as an
          employer or client company. Where an employer engagement has its own written cancellation,
          replacement or refund terms, those terms govern that engagement and this policy fills the
          gaps.
        </p>
        <p>
          It does not apply to your salary, benefits or any payment arising under an employment
          contract with an employer — those are between you and that employer. It should be read
          together with our <Link href="/terms-and-conditions">Terms &amp; Conditions</Link> and our{" "}
          <Link href="/pricing">Pricing &amp; Fees</Link> page.
        </p>
      </>
    ),
  },
  {
    id: "nature-of-services",
    heading: "The nature of what we provide",
    body: (
      <>
        <p>
          We provide professional recruitment and mobilisation services — sourcing, screening,
          interview coordination, documentation and attestation support, medical and visa
          coordination, travel coordination and post-joining support. We do not sell goods.
        </p>
        <p>
          These services are performed in stages over time, and much of the work is done before an
          outcome is known. That matters for refunds: once a stage has genuinely been performed, or
          a payment has been made onward to a third party such as an embassy, an attestation
          authority, a medical centre or an airline, that part of the cost has already been
          incurred and cannot simply be reversed.
        </p>
      </>
    ),
  },
  {
    id: "fees",
    heading: "Fees, and where you will find them",
    body: (
      <>
        <p>
          Our fees are not fixed on this website, because what is required differs from one service
          and one engagement to the next. Applicable fees depend on the service, the engagement and
          the written commercial terms for it, and{" "}
          <strong>candidate-side services and employer-side services may have separate pricing
          arrangements</strong>. Where a service carries a fee, the amount, exactly what it covers,
          when it is payable and any conditions attached to it are set out to you{" "}
          <strong>in writing before you pay</strong> — in a quotation, invoice, service agreement,
          proposal or purchase order. Our <Link href="/pricing">Pricing &amp; Fees</Link> page
          explains the structure in full.
        </p>
        <p>
          That written document, together with this policy and our{" "}
          <Link href="/terms-and-conditions">Terms &amp; Conditions</Link>, determines what you owe
          and what may be refunded. If a written document and this page conflict, the written
          document you accepted prevails. If a charge was never stated to you in writing, it is not
          payable to us.
        </p>
        <p>
          Statutory, government, embassy, attestation, medical, insurance and travel charges are
          third-party costs, not our service fee, even where we arrange payment on your behalf.
          Applicable taxes, including GST, are charged as required by law.
        </p>
      </>
    ),
  },
  {
    id: "cancelling",
    heading: "Cancelling a service request",
    body: (
      <>
        <p>
          You can cancel a service request or withdraw an application at any time. Tell us in
          writing — email{" "}
          <a href={`mailto:${CONTACT.businessEmail}`}>{CONTACT.businessEmail}</a> (or{" "}
          <a href={`mailto:${CONTACT.jobsEmail}`}>{CONTACT.jobsEmail}</a> for a job application) —
          rather than by phone alone, so there is a clear record of the date and time.
        </p>
        <p>
          A cancellation takes effect when we receive your written notice. What you are entitled to
          back depends on how much of the service had already been performed at that point, and on
          how much had already been paid onward to third parties. Submitting an inquiry or an
          application through this website costs nothing and can be withdrawn at any time.
        </p>
        <p>
          We may also cancel or discontinue a service — for example where a requirement is withdrawn
          by an employer, where the service cannot lawfully be provided, or in the circumstances set
          out in our <Link href="/terms-and-conditions">Terms &amp; Conditions</Link>. If we cancel
          for a reason that is not your breach of those terms, we refund the fees you have paid for
          the part of the service we have not performed.
        </p>
      </>
    ),
  },
  {
    id: "refund-eligible",
    heading: "When a refund is normally available",
    body: (
      <>
        <p>Subject to your written service agreement, we will normally refund you where:</p>
        <ul>
          <li>you were charged twice for the same service, or a payment was duplicated;</li>
          <li>
            you were charged an incorrect amount, or an amount was collected in error or without
            authorisation;
          </li>
          <li>
            your payment was debited but the transaction failed or was not completed at our end;
          </li>
          <li>
            you cancel before we have started work on the service, and nothing has been paid onward
            on your behalf;
          </li>
          <li>
            we are unable to provide the service you paid for, and we cancel it for a reason that is
            not your breach of our terms;
          </li>
          <li>
            a written agreement between us expressly provides for a refund in the circumstances that
            have occurred.
          </li>
        </ul>
        <p>
          Where only part of the service remains unperformed, the refund covers that unperformed
          part on a proportionate basis.
        </p>
      </>
    ),
  },
  {
    id: "refund-not-available",
    heading: "When a refund is normally not available",
    body: (
      <>
        <p>
          Equally, and again subject to your written agreement and to applicable law, a refund is
          normally not available for:
        </p>
        <ul>
          <li>
            work already properly performed — screening, profile preparation, interview
            coordination, documentation work and similar, up to the point of cancellation;
          </li>
          <li>
            amounts already paid to third parties on your behalf — statutory and government fees,
            embassy and attestation charges, medical examination fees, insurance premiums and air
            fares — to the extent those third parties do not refund them to us. Where a third party
            does refund an amount to us, we pass it on to you;
          </li>
          <li>
            an outcome decided by someone other than us: an employer choosing another candidate,
            withdrawing or putting a role on hold; a visa refusal; a medical result of unfit; a
            refusal of emigration clearance or entry. As set out in our{" "}
            <Link href="/terms-and-conditions">Terms &amp; Conditions</Link>, we do not guarantee
            selection, visa issuance or joining, and these outcomes are not a failure of our
            service;
          </li>
          <li>
            your own decision not to proceed after work has been performed — for example declining
            an offer, not attending an interview or medical appointment, or becoming unavailable;
          </li>
          <li>
            a situation caused by information or documents you provided that were inaccurate,
            incomplete, forged or altered.
          </li>
        </ul>
        <div className="legal-callout">
          <p>
            None of this affects any right you may have under Indian law that cannot be excluded by
            agreement. If you believe a charge is unfair, raise it with us — we will look at it on
            its facts.
          </p>
        </div>
      </>
    ),
  },
  {
    id: "how-to-request",
    heading: "How to request a cancellation or refund",
    body: (
      <>
        <p>
          Email <a href={`mailto:${CONTACT.businessEmail}`}>{CONTACT.businessEmail}</a> with the
          subject line “Cancellation / refund request”, from the email address you used with us, and
          include:
        </p>
        <ul>
          <li>your full name and the phone or WhatsApp number registered with us;</li>
          <li>the service, role or engagement the request relates to;</li>
          <li>
            the payment details on our side — invoice or receipt number, the transaction or order
            reference, the amount and the date of payment;
          </li>
          <li>what you would like us to do, and why.</li>
        </ul>
        <p>
          You can also call our inquiry desk on{" "}
          <a href={CONTACT.inquiryPhoneHref}>{CONTACT.inquiryPhone}</a> to discuss it first, but
          please follow up in writing so the request is recorded.
        </p>
      </>
    ),
  },
  {
    id: "how-we-handle",
    heading: "How we handle your request",
    body: (
      <>
        <p>
          We review every cancellation and refund request on its own facts — against your written
          service agreement, the stage the service had actually reached when you cancelled, and any
          amounts already paid onward on your behalf. We do not apply a blanket rule.
        </p>
        <ul>
          <li>
            We confirm receipt of your request and, if we need anything more from you — a receipt, a
            transaction reference, proof of payment — we ask for it straight away.
          </li>
          <li>
            We come back to you with a decision as quickly as we reasonably can, and we tell you in
            writing what we have decided.
          </li>
          <li>
            If we decline a refund, we tell you the reason in writing, and you can escalate it as
            described below.
          </li>
          <li>
            Where the written service agreement between us sets out specific timelines for
            cancellation or refund, those timelines apply.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "how-refunds-are-paid",
    heading: "How approved refunds are paid",
    body: (
      <>
        <p>
          Approved refunds are returned to the <strong>original payment method</strong> — the same
          card, bank account, UPI ID or wallet the payment came from. We do not refund to a
          different person&apos;s account, and we do not refund in cash.
        </p>
        <p>
          Once a refund is approved, it is initiated to that payment method. How long the money then
          takes to reach you is determined by the payment gateway, your bank and your card issuer,
          not by us — a refund is typically credited within{" "}
          <strong>{REFUND_BANK_CREDIT_WINDOW}</strong> of being initiated, and sometimes longer for
          international cards. That final step is outside our control.
        </p>
        <p>
          Refunds are made in the currency of the original payment. Any bank charges, payment
          gateway fees or foreign exchange differences applied by your bank or card issuer are not
          within our control and may reduce the amount you receive. Where we hold your money for
          onward payment to a third party and that party has not yet been paid, we return it in the
          same way.
        </p>
      </>
    ),
  },
  {
    id: "failed-payments",
    heading: "Failed, duplicate and disputed payments",
    body: (
      <>
        <p>
          If an amount is debited from your account but you do not receive a confirmation from us,
          do not pay again. Contact us with the transaction reference, date and amount, and we will
          trace it. Failed transactions are usually reversed automatically by the payment gateway or
          your bank within their normal settlement cycle; where they are not, we will follow it up
          with the gateway on your behalf.
        </p>
        <p>
          If you are considering raising a chargeback or a dispute with your bank or card issuer,
          please contact us first. It is almost always faster to resolve directly, and we would
          rather understand and fix the problem than have it decided at a distance.
        </p>
      </>
    ),
  },
  {
    id: "grievance",
    heading: "If you are not satisfied with our decision",
    body: (
      <>
        <p>
          Reply to our decision email explaining why you disagree, or write to{" "}
          <a href={`mailto:${CONTACT.businessEmail}`}>{CONTACT.businessEmail}</a> with the subject
          line “Escalation — refund”. A senior member of our team who was not involved in the
          original decision will review it and respond.
        </p>
        <p>
          You can also reach us on{" "}
          <a href={CONTACT.inquiryPhoneHref}>{CONTACT.inquiryPhone}</a> or by post at the address
          below. Nothing in this policy limits any remedy available to you under Indian law.
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
        changed. The current version took effect on <strong>{POLICY_EFFECTIVE_DATE}</strong>. A
        change does not alter the terms of a service agreement you had already entered into before
        the change was published.
      </p>
    ),
  },
];

export default function CancellationAndRefundsPage() {
  return (
    <LegalPage
      title="Cancellation & Refunds Policy"
      eyebrow="Legal"
      path="/cancellation-and-refunds"
      intro="How to cancel a service request, when a refund is available, how to ask for one, and how long an approved refund takes to reach you."
      sections={SECTIONS}
    />
  );
}
