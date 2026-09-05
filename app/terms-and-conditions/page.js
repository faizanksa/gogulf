import Link from "next/link";
import LegalPage from "@/components/LegalPage";
import { pageMetadata, CONTACT } from "@/lib/seo";
import {
  LEGAL_ENTITY,
  ADDRESS_ONE_LINE,
  JURISDICTION_CITY,
  POLICY_EFFECTIVE_DATE,
} from "@/lib/legal";

export const metadata = pageMetadata({
  title: "Terms & Conditions",
  path: "/terms-and-conditions",
  description:
    "The terms on which Chaudhary Gulf Travels Private Limited provides the Go Gulf website and its overseas recruitment services to candidates and employers.",
});

// Written against what Go Gulf actually does — recruitment and mobilisation
// support, not employment. Deliberately carries no guarantee of selection,
// visa issuance or joining, because the site makes no such promise either.
const SECTIONS = [
  {
    id: "introduction",
    heading: "Introduction and acceptance",
    body: (
      <>
        <p>
          These Terms &amp; Conditions govern your use of the website{" "}
          <strong>www.gogulf.co</strong> and of the recruitment and related services offered
          through it. Please read them before you use the website or submit anything to us.
        </p>
        <p>
          By browsing this website, submitting a form, sending us your CV or documents, or engaging
          us for a service, you confirm that you have read, understood and accepted these terms. If
          you do not accept them, please do not use the website or our services.
        </p>
        <p>
          These terms apply alongside our{" "}
          <Link href="/privacy-policy">Privacy Policy</Link>,{" "}
          <Link href="/cancellation-and-refunds">Cancellation &amp; Refunds Policy</Link> and{" "}
          <Link href="/shipping-policy">Shipping &amp; Delivery Policy</Link>, which form part of
          them. Where you and we have signed a separate written agreement for a specific service or
          engagement, that agreement prevails over these terms to the extent of any conflict.
        </p>
      </>
    ),
  },
  {
    id: "who-we-are",
    heading: "Who you are contracting with",
    body: (
      <>
        <p>
          This website and the <strong>{LEGAL_ENTITY.brand}</strong> brand are operated by{" "}
          <strong>{LEGAL_ENTITY.name}</strong>, a {LEGAL_ENTITY.constitution.toLowerCase()}{" "}
          incorporated in India, with its principal place of business at {ADDRESS_ONE_LINE} and
          GSTIN <strong>{LEGAL_ENTITY.gstin}</strong>.
        </p>
        <p>
          In these terms, “we”, “us”, “our” and “{LEGAL_ENTITY.brand}” mean {LEGAL_ENTITY.name}, and
          “you” means the person or organisation using this website or our services.
        </p>
      </>
    ),
  },
  {
    id: "purpose",
    heading: "What this website is for",
    body: (
      <>
        <p>
          This website presents our recruitment services, publishes job openings with Gulf-based
          employers, and lets candidates and employers reach us. It is an information and inquiry
          platform.
        </p>
        <p>
          We are a recruitment services provider. We are <strong>not</strong> the employer for any
          role advertised on this website, we are not a party to the employment contract you may
          eventually sign, and we are not a government or immigration authority. The employer named
          in a placement is your employer; we introduce, screen, coordinate and support the process
          around that relationship.
        </p>
      </>
    ),
  },
  {
    id: "eligibility",
    heading: "Eligibility",
    body: (
      <>
        <p>To use this website and our services, you must:</p>
        <ul>
          <li>be at least 18 years old and legally able to enter into a binding contract;</li>
          <li>
            provide information about yourself that is true, accurate, current and complete, and
            keep it updated;
          </li>
          <li>
            hold, or be able to obtain, the documents and clearances that the role and destination
            country require — including a valid passport;
          </li>
          <li>
            use the website and our services only for lawful purposes and in line with these terms.
          </li>
        </ul>
        <p>
          If you are using the website on behalf of a company or other organisation, you confirm
          that you are authorised to accept these terms on its behalf.
        </p>
      </>
    ),
  },
  {
    id: "candidate-use",
    heading: "Using the website as a candidate",
    body: (
      <>
        <p>As a candidate you may browse job openings, submit an application, and contact us. When you do:</p>
        <ul>
          <li>you may submit an application only for yourself, and only with your own documents;</li>
          <li>
            you authorise us to review your profile, assess your suitability, and share your profile
            and supporting documents with employers and authorised recruitment partners for the
            purpose of a hiring process, as described in our{" "}
            <Link href="/privacy-policy">Privacy Policy</Link>;
          </li>
          <li>
            you are responsible for responding to interview invitations, document requests and
            medical or travel schedules within the timelines communicated to you;
          </li>
          <li>
            you understand that submitting an application does not create any employment
            relationship with us or with any employer, and does not entitle you to be shortlisted,
            interviewed or selected.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "employer-use",
    heading: "Using the website as an employer or business client",
    body: (
      <>
        <p>
          If you contact us as an employer, client or partner, you confirm that the vacancy you
          describe is genuine, that you are authorised to recruit for it, and that the role, terms,
          wages, benefits, working conditions and accommodation you describe are accurate and comply
          with the labour and immigration law of the country where the work will be performed.
        </p>
        <p>
          You are responsible for your own selection decisions, for the employment contract you
          issue, and for meeting your obligations to the people you hire. You must not use candidate
          information we share with you for any purpose other than the specific hiring process it
          was shared for, must keep it confidential, and must not pass it to anyone else without our
          written consent and the candidate&apos;s.
        </p>
        <p>
          The commercial terms of an employer engagement — scope, fees, timelines and any
          replacement or refund arrangement — are set out in the written agreement, proposal or
          purchase order between us, not on this website. Our{" "}
          <Link href="/pricing">Pricing &amp; Fees</Link> page explains how employer-side
          engagements are quoted.
        </p>
      </>
    ),
  },
  {
    id: "job-listings",
    heading: "Job listings and the accuracy of job information",
    body: (
      <>
        <p>
          Job openings published on this website are based on requirements shared with us by
          employers and their authorised representatives. We take reasonable care in presenting
          them, and we screen employers before listing roles.
        </p>
        <p>However, please understand that:</p>
        <ul>
          <li>
            details such as salary, benefits, accommodation, working hours, contract duration, start
            date and headcount originate with the employer and can change or be withdrawn at any
            time;
          </li>
          <li>
            a listing is an invitation to apply. It is not an offer of employment and does not bind
            us or the employer;
          </li>
          <li>
            a role may be filled, put on hold or cancelled by the employer before or after you
            apply, including after you have been interviewed;
          </li>
          <li>
            the definitive terms of your employment are the ones in the employment contract you
            sign with the employer — not the ones in a listing, an advertisement, a WhatsApp message
            or a conversation.
          </li>
        </ul>
        <p>
          Read your employment contract carefully before signing it, and ask us if anything in it
          does not match what you were told.
        </p>
      </>
    ),
  },
  {
    id: "recruitment-process",
    heading: "The recruitment process",
    body: (
      <>
        <p>
          A typical process runs: registration and profile submission, screening and verification,
          shortlisting against the employer&apos;s requirement, employer interview, selection
          decision, offer and contract, documentation and attestation, medical examination, visa
          processing, travel arrangements, pre-departure briefing, and post-joining support.
        </p>
        <p>
          Not every stage applies to every role, and stages can be reordered, repeated or dropped by
          the employer or by the authorities involved. Timelines at every stage depend on employers,
          embassies, ministries, medical centres, airlines and government processing, and are
          therefore indicative rather than promised.
        </p>
      </>
    ),
  },
  {
    id: "your-information",
    heading: "Your responsibility for the information and documents you provide",
    body: (
      <>
        <p>
          Everything you tell us and every document you give us must be true, genuine, unaltered and
          yours. You are responsible for the accuracy of your CV, passport, certificates, experience
          letters, qualifications and any other document you submit, and for telling us promptly if
          anything changes — including your contact details, your availability, or a change in your
          passport or personal status.
        </p>
        <p>
          Employers, embassies, attestation bodies and immigration authorities verify what is
          submitted to them. If information or a document you provided turns out to be false,
          forged, altered or misleading, the consequences fall on you: the application may be
          rejected, an offer or visa may be withdrawn or cancelled, you may be refused entry or
          deported, and you may face action under the law of India or of the destination country. We
          will stop representing you, and we are not liable for any resulting loss, cost or
          consequence.
        </p>
      </>
    ),
  },
  {
    id: "screening",
    heading: "Screening, verification, interviews and selection",
    body: (
      <>
        <p>
          We screen and verify candidate profiles against the employer&apos;s stated requirements,
          and we coordinate interviews between candidates and employers. Interview format, schedule,
          assessment criteria and outcome are decided by the employer.
        </p>
        <p>
          Shortlisting, selection, rejection and any offer are the employer&apos;s decisions alone.
          We do not control them, we cannot commit an employer to a decision, and we are not
          obliged to give reasons on an employer&apos;s behalf. We may decline to represent a
          candidate or accept a requirement, at our discretion, where we consider it unsuitable,
          non-compliant or inconsistent with these terms.
        </p>
      </>
    ),
  },
  {
    id: "offers-employment",
    heading: "Offers, employment and the employment relationship",
    body: (
      <>
        <p>
          An offer of employment comes from the employer. Your employment contract, wages, benefits,
          working hours, leave, accommodation, transport, insurance, disciplinary matters,
          termination and end-of-service entitlements are governed by that contract and by the law
          of the country where you work.
        </p>
        <p>
          We are not your employer and are not responsible for the employer&apos;s performance of
          the employment contract, for payment of your wages, or for the working or living
          conditions provided to you. If a problem arises after you join, tell us — we provide
          post-joining support and will assist and escalate where we reasonably can — but the legal
          responsibility rests with the employer.
        </p>
      </>
    ),
  },
  {
    id: "visa-documentation",
    heading: "Visa, documentation, medical and immigration support",
    body: (
      <>
        <p>
          Where you engage us for it, we assist with attestation, MOFA and embassy formalities, visa
          processing, medical examination coordination, immigration formalities and travel
          arrangements. Our role is to guide, prepare, coordinate and submit — accurately and on
          time.
        </p>
        <p>
          The decisions belong to others. Visa approval or rejection, medical fitness or unfitness,
          attestation, emigration clearance, entry permission and deportation are determined by
          embassies, consulates, ministries, approved medical centres and immigration authorities
          applying their own criteria. Their fees, requirements, processing times and outcomes can
          change without notice and are outside our control. A rejection, delay or change in
          requirement by any of these bodies is not a failure of our service.
        </p>
      </>
    ),
  },
  {
    id: "no-guarantee",
    heading: "No guarantee of selection, employment, visa or joining",
    body: (
      <>
        <div className="legal-callout">
          <p>
            <strong>
              We do not guarantee that you will be shortlisted, interviewed, selected, offered a
              job, issued a visa, permitted to travel, or able to join — and we never promise a
              specific salary, employer, country or start date.
            </strong>{" "}
            Any statement to the contrary, from any person, is not authorised by us and is not
            binding on us.
          </p>
        </div>
        <p>
          What we commit to is the service itself: presenting genuine, screened opportunities,
          handling your profile professionally, coordinating each stage properly, and being
          transparent with you about where your application stands.
        </p>
        <p>
          Where we have expressly agreed something specific with you in writing — a defined scope, a
          defined deliverable or a replacement arrangement with an employer client — that written
          commitment stands. Nothing else does.
        </p>
      </>
    ),
  },
  {
    id: "third-parties",
    heading: "Third-party employers, authorities and service providers",
    body: (
      <>
        <p>
          Delivering these services involves parties we do not control: employers and their
          representatives, recruitment and sourcing partners, embassies, consulates, ministries and
          attestation bodies, immigration and emigration authorities, approved medical centres,
          airlines and travel providers, banks and payment providers, and the technology providers
          listed in our <Link href="/privacy-policy">Privacy Policy</Link>.
        </p>
        <p>
          We select and coordinate with these parties in good faith, but we are not responsible for
          their acts, omissions, decisions, delays, fees or policies. This website may also link to
          external sites and platforms; those links are provided for convenience, and we do not
          endorse or take responsibility for their content.
        </p>
      </>
    ),
  },
  {
    id: "communications",
    heading: "Communications with you",
    body: (
      <>
        <p>
          By giving us your email address, phone number or WhatsApp number, you agree that we may
          contact you on them about your inquiry, your application, a role you may suit, and the
          progress of a service you have engaged us for. We may send you service-related messages by
          email, phone, SMS or WhatsApp.
        </p>
        <p>
          You can ask us to stop sending you job updates at any time by replying to us or emailing{" "}
          <a href={`mailto:${CONTACT.businessEmail}`}>{CONTACT.businessEmail}</a>. We may still need
          to send you messages that are necessary for a service already in progress.
        </p>
        <p>
          Our official channels are the email addresses, phone numbers and WhatsApp numbers
          published on this website and on our{" "}
          <Link href="/contact">Contact page</Link>. Communications from any other account,
          number, page or person claiming to represent us are not ours.
        </p>
      </>
    ),
  },
  {
    id: "fees",
    heading: "Fees and payments",
    body: (
      <>
        <p>
          Applicable fees depend on the service, the engagement and the written commercial terms for
          it. <strong>Candidate-side services and employer-side services may have separate pricing
          arrangements</strong>, and the terms of one do not apply to the other.
        </p>
        <p>
          Where a service we provide to you carries a fee, that fee, what it covers and when it is
          payable will be set out to you in writing — in a quotation, invoice, service agreement,
          proposal or purchase order — before you are asked to pay. Any applicable fees, inclusions,
          exclusions, taxes and refund terms are communicated to you before payment, or agreed in
          the relevant written service agreement. There are no hidden charges: if it has not been
          stated to you in writing, it is not payable to us. Our{" "}
          <Link href="/pricing">Pricing &amp; Fees</Link> page explains how this works in full.
        </p>
        <p>
          Charges levied by third parties — such as statutory and government fees, embassy and
          attestation charges, medical examination fees, insurance and air fares — are payable to or
          through the relevant provider and are not our service fee, even where we coordinate the
          payment for you. Taxes, including GST, apply as required by law.
        </p>
        <p>
          Any fee charged in connection with overseas recruitment or emigration services is subject
          to the limits and conditions imposed by applicable Indian law and by the law of the
          destination country, and nothing in these terms permits a charge that the law does not.
        </p>
        <p>
          Payments must be made only to the account or payment link we confirm to you in writing.
          Where an online payment is taken, it is processed by a regulated third-party payment
          gateway; we do not store your card, UPI or bank credentials. What happens if you cancel,
          or if a refund is due, is set out in our{" "}
          <Link href="/cancellation-and-refunds">Cancellation &amp; Refunds Policy</Link>.
        </p>
      </>
    ),
  },
  {
    id: "fraud",
    heading: "Fraud, impersonation and misrepresentation",
    body: (
      <>
        <p>
          Overseas recruitment attracts impersonators. Protect yourself: verify any communication
          claiming to be from {LEGAL_ENTITY.brand} against the contact details published on this
          website before you act on it or pay anything.
        </p>
        <p>
          We will never ask you for an OTP, a PIN, a password or your card CVV, and we will never
          ask you to pay into the personal account of an individual. If someone does, it is not us —
          report it to us at{" "}
          <a href={`mailto:${CONTACT.businessEmail}`}>{CONTACT.businessEmail}</a> or on{" "}
          <a href={CONTACT.inquiryPhoneHref}>{CONTACT.inquiryPhone}</a>.
        </p>
        <p>
          Equally, submitting forged or altered documents, impersonating another person, or
          misrepresenting your identity, qualifications or experience to us, to an employer or to an
          authority is a serious matter. We will terminate your engagement, inform the employer and
          any authority as required, and take any action available to us in law.
        </p>
      </>
    ),
  },
  {
    id: "acceptable-use",
    heading: "Acceptable use and prohibited activities",
    body: (
      <>
        <p>You must not:</p>
        <ul>
          <li>use this website for any unlawful, fraudulent or deceptive purpose;</li>
          <li>submit false, forged, altered or misleading information or documents;</li>
          <li>apply on behalf of another person without their authority, or impersonate anyone;</li>
          <li>
            post or transmit anything unlawful, defamatory, obscene, abusive, discriminatory,
            harassing or infringing of anyone&apos;s rights;
          </li>
          <li>
            scrape, harvest, index, copy or extract job listings, candidate information or other
            content from this website by automated means, or reproduce it for a competing service;
          </li>
          <li>
            attempt to gain unauthorised access to this website, its forms, its storage or any
            connected system, or probe, scan or test its security;
          </li>
          <li>
            introduce malware, or interfere with or disrupt the operation of the website or its
            infrastructure;
          </li>
          <li>
            upload files that contain malicious code, or files that are not genuinely part of your
            application;
          </li>
          <li>
            use our name, brand or content to solicit money or documents from others, or otherwise
            hold yourself out as representing us.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "intellectual-property",
    heading: "Website content and intellectual property",
    body: (
      <>
        <p>
          The {LEGAL_ENTITY.brand} name and logo, the “{"Go Gulf. Get Hired."}” tagline, and the
          text, design, layout, graphics, images and code of this website belong to us or to our
          licensors and are protected by intellectual property law.
        </p>
        <p>
          You may view, download and print pages of this website for your own personal or internal
          business use in connection with our services. You may not otherwise copy, reproduce,
          republish, distribute, adapt or commercially exploit any part of it without our prior
          written permission.
        </p>
        <p>
          Documents and information you submit remain yours. By submitting them, you grant us
          permission to use, store, process and share them for the purposes described in these terms
          and in our <Link href="/privacy-policy">Privacy Policy</Link>, and you confirm you have
          the right to give us that permission.
        </p>
      </>
    ),
  },
  {
    id: "privacy",
    heading: "Privacy",
    body: (
      <p>
        Our <Link href="/privacy-policy">Privacy Policy</Link> explains what personal information we
        collect, how we use it, who we share it with, how long we keep it and what you can ask us to
        do with it. It forms part of these terms, and by using this website or our services you
        accept it.
      </p>
    ),
  },
  {
    id: "disclaimers",
    heading: "Disclaimers and service limitations",
    body: (
      <>
        <p>
          This website and its content are provided on an “as is” and “as available” basis. We take
          reasonable care to keep the information on it accurate and current, but we do not warrant
          that it is complete, error-free or up to date at every moment, or that the website will be
          uninterrupted, secure or free of faults.
        </p>
        <p>
          Job listings, timelines, industry information and country information are indicative and
          can change without notice. We are not responsible for outcomes determined by employers,
          embassies, ministries, medical centres, airlines, immigration authorities or other third
          parties, or for events beyond our reasonable control — including changes in law or
          immigration policy, visa quotas or bans, strikes, natural events, network or hosting
          failures, and public health measures.
        </p>
      </>
    ),
  },
  {
    id: "liability",
    heading: "Limitation of liability",
    body: (
      <>
        <p>
          Nothing in these terms excludes or limits any liability that cannot lawfully be excluded
          or limited, including liability for fraud or for death or personal injury caused by
          negligence.
        </p>
        <p>Subject to that, to the fullest extent permitted by law:</p>
        <ul>
          <li>
            we are not liable for indirect, incidental, special, punitive or consequential loss, or
            for loss of employment, loss of earnings or expected earnings, loss of opportunity, loss
            of profit, loss of data, or loss of reputation;
          </li>
          <li>
            we are not liable for any act, omission, decision, delay or default of an employer, a
            government or statutory authority, or any other third party;
          </li>
          <li>
            our total aggregate liability to you in connection with the website and our services is
            limited to the total amount of service fees you have actually paid to us for the
            specific service giving rise to the claim.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "indemnity",
    heading: "Indemnity",
    body: (
      <p>
        You agree to indemnify and hold us, our directors, employees and authorised representatives
        harmless from any claim, demand, loss, liability, cost or expense (including reasonable
        legal fees) arising out of your breach of these terms or of any applicable law, your misuse
        of this website, or any false, forged, altered or misleading information or document you
        provide to us, to an employer or to an authority.
      </p>
    ),
  },
  {
    id: "termination",
    heading: "Suspension and termination",
    body: (
      <>
        <p>
          We may suspend or withdraw your access to this website, decline or discontinue a service,
          or stop representing you as a candidate, where we reasonably believe you have breached
          these terms, provided false or forged information, acted unlawfully or fraudulently, or
          acted abusively towards our team, an employer or another candidate.
        </p>
        <p>
          You may stop using the website at any time, and may withdraw an application or a service
          request by telling us in writing — see our{" "}
          <Link href="/cancellation-and-refunds">Cancellation &amp; Refunds Policy</Link> for what
          happens to fees in that case. Sections that by their nature should survive — including
          those on intellectual property, disclaimers, limitation of liability, indemnity and
          governing law — continue to apply after your use ends.
        </p>
      </>
    ),
  },
  {
    id: "changes",
    heading: "Changes to the website and to these terms",
    body: (
      <>
        <p>
          We may change, add to, suspend or remove parts of this website, including job listings and
          services, at any time. We may also update these terms as our services or the law change.
        </p>
        <p>
          The version published on this page is the one that applies, and the “last updated” date at
          the top of this page tells you when it last changed. The current version took effect on{" "}
          <strong>{POLICY_EFFECTIVE_DATE}</strong>. Continuing to use the website or our services
          after a change is published means you accept the updated terms.
        </p>
      </>
    ),
  },
  {
    id: "governing-law",
    heading: "Governing law and jurisdiction",
    body: (
      <>
        <p>
          These terms, and any dispute or claim arising out of or in connection with them, this
          website or our services, are governed by the laws of <strong>India</strong>.
        </p>
        <p>
          We have chosen the courts at <strong>{JURISDICTION_CITY}, India</strong> — the seat of the
          company — as the exclusive forum for any such dispute or claim, and by accepting these
          terms you agree to that. Before starting proceedings, please raise the matter with us
          first using the contact details below; most issues are resolved faster that way.
        </p>
      </>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms & Conditions"
      eyebrow="Legal"
      path="/terms-and-conditions"
      intro="The terms on which we provide this website and our recruitment services — what we do, what we do not promise, and what we each remain responsible for."
      sections={SECTIONS}
    />
  );
}
