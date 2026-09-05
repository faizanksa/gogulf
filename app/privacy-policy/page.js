import Link from "next/link";
import LegalPage from "@/components/LegalPage";
import { pageMetadata, CONTACT } from "@/lib/seo";
import { LEGAL_ENTITY, ADDRESS_ONE_LINE, POLICY_EFFECTIVE_DATE } from "@/lib/legal";

export const metadata = pageMetadata({
  title: "Privacy Policy",
  path: "/privacy-policy",
  description:
    `How Go Gulf, operated by ${LEGAL_ENTITY.name}, collects, uses, shares, stores and protects the personal information of website visitors, job candidates and employers.`,
});

// Every service named below is one that is actually wired into this site —
// Resend (lib/email/*, via the /api/forms/* routes), Supabase (lib/supabase.js),
// Google Fonts (app/globals.css @import) and Google Workspace (the @gogulf.co
// inboxes). The site runs no analytics, no advertising pixels and sets no
// cookies of its own; the policy says so rather than reciting boilerplate.
//
// DEPLOY TOGETHER: this section names Resend, so it must not reach production
// ahead of NEXT_PUBLIC_EMAIL_PROVIDER=resend. Until that switch is live, email
// is still delivered by EmailJS and this list would misname the processor. The
// list is prefaced "There are no others", so it has to be exactly right.
const SECTIONS = [
  {
    id: "who-we-are",
    heading: "Who we are",
    body: (
      <>
        <p>
          This website, <strong>www.gogulf.co</strong>, trades under the brand{" "}
          <strong>{LEGAL_ENTITY.brand}</strong> and is operated by{" "}
          <strong>{LEGAL_ENTITY.name}</strong>, a {LEGAL_ENTITY.constitution.toLowerCase()}{" "}
          incorporated in India, with its principal place of business at {ADDRESS_ONE_LINE}. Our
          GSTIN is <strong>{LEGAL_ENTITY.gstin}</strong>.
        </p>
        <p>
          In this policy, “we”, “us” and “our” mean {LEGAL_ENTITY.name}. “You” means anyone who
          visits this website, contacts us through it, applies for a job through it, or engages us
          as an employer or business client. We decide why and how your personal information is
          handled in connection with this website and our recruitment services, and we are
          responsible for it.
        </p>
      </>
    ),
  },
  {
    id: "scope",
    heading: "What this policy covers",
    body: (
      <>
        <p>
          This policy explains what personal information we collect through this website and our
          recruitment services, why we collect it, who we share it with, how long we keep it, how
          we protect it, and what you can ask us to do with it.
        </p>
        <p>It applies to:</p>
        <ul>
          <li>visitors who simply browse this website;</li>
          <li>candidates who submit a job application, service inquiry or contact form;</li>
          <li>employers, partners and business clients who contact us about hiring;</li>
          <li>
            people who reach us through the email addresses, phone numbers and WhatsApp numbers
            published on this website.
          </li>
        </ul>
        <p>
          It does <strong>not</strong> cover websites, platforms or social media pages operated by
          other organisations that we link to — including WhatsApp, YouTube, LinkedIn, Facebook,
          Instagram, X and TikTok. Once you leave this website, the privacy policy of that
          platform applies.
        </p>
      </>
    ),
  },
  {
    id: "what-we-collect",
    heading: "Information we collect",
    body: (
      <>
        <p>
          We only collect information that you choose to give us, plus a small amount of technical
          information that any website receives automatically. We do not buy personal data, and we
          do not build profiles of you from third-party sources.
        </p>

        <h3>Information you give us directly</h3>
        <ul>
          <li>
            <strong>Contact form</strong> (on the <Link href="/contact">Contact</Link> page) — your
            name, email address, phone or WhatsApp number, and your message.
          </li>
          <li>
            <strong>Service inquiry form</strong> (on the <Link href="/services">Services</Link>{" "}
            page) — the service you are interested in, your name, email address, phone or WhatsApp
            number, your preferred Gulf country, and your message.
          </li>
          <li>
            <strong>Job application form</strong> (on the{" "}
            <Link href="/jobs/apply">Apply</Link> page) — the role and country you are applying
            for, your name, email address, phone or WhatsApp number, your years of experience, any
            message you add, and the documents you upload: your CV or résumé, a copy of your
            passport, and any optional supporting documents such as certificates or experience
            letters.
          </li>
          <li>
            <strong>Direct contact</strong> — anything you send us by email, WhatsApp, phone or
            through our social channels, including documents you share during the recruitment
            process.
          </li>
        </ul>

        <h3>Information collected automatically</h3>
        <p>
          This website has no user accounts and no login. When you load a page, our hosting
          provider and the third-party services listed in section 10 receive standard technical
          information — such as your IP address, browser type and version, device and operating
          system, the page requested, and the date and time of the request. This is used to serve
          the site, keep it secure and diagnose faults. We do not use it to identify you.
        </p>

        <h3>Information from employers and partners</h3>
        <p>
          During a live recruitment process, an employer, an authorised recruitment partner, a
          medical centre or a visa processing agent may share information about your application
          with us — for example interview feedback, a shortlisting or selection decision, medical
          fitness status, or visa or document processing status.
        </p>
      </>
    ),
  },
  {
    id: "candidate-information",
    heading: "Candidate and recruitment information",
    body: (
      <>
        <p>
          Recruitment naturally involves more information than a general website inquiry. Where you
          proceed as a candidate, the information we handle may include:
        </p>
        <ul>
          <li>
            <strong>Identity and contact details</strong> — name, date of birth, nationality,
            passport number and passport copy, photograph, home address, email, phone and WhatsApp
            number.
          </li>
          <li>
            <strong>Professional information</strong> — CV or résumé, work history, years of
            experience, skills, trade or job category, qualifications, certificates, experience
            letters and references.
          </li>
          <li>
            <strong>Application information</strong> — the roles and countries you applied for,
            shortlisting and interview records, employer feedback, offer status, and joining or
            deployment status.
          </li>
          <li>
            <strong>Documentation and mobilisation information</strong> — information needed for
            visa, attestation, MOFA and embassy formalities, emigration clearance where applicable,
            and travel and ticketing arrangements.
          </li>
          <li>
            <strong>Health-related information</strong> — where a role requires a pre-employment
            medical examination, we may handle the fact of your medical appointment and your
            fitness result. We do not seek detailed medical records beyond what the employer or the
            destination country requires.
          </li>
        </ul>
        <div className="legal-callout">
          <p>
            Please do not send us information we have not asked for, and in particular do not send
            us bank account numbers, card details, PINs, OTPs or passwords through a form, email or
            WhatsApp. We will never ask you for those.
          </p>
        </div>
      </>
    ),
  },
  {
    id: "employer-information",
    heading: "Employer and business information",
    body: (
      <>
        <p>
          Where you contact us as an employer, client or partner, we handle the business contact
          details you give us — the name and job title of your representative, company name, email
          address, phone number and country — together with the details of your requirement, such
          as roles, headcount, job descriptions, salary and benefit ranges, timelines and any
          contractual or commercial correspondence between us.
        </p>
        <p>
          Information about a company is not personal information, but information about the
          individuals who work there is, and we treat it under this policy.
        </p>
      </>
    ),
  },
  {
    id: "how-we-use",
    heading: "How we use your information",
    body: (
      <>
        <p>We use the information described above to:</p>
        <ul>
          <li>respond to your inquiry, message or call-back request;</li>
          <li>
            register you as a candidate, assess your profile against live vacancies, and shortlist
            you for roles you may be suitable for;
          </li>
          <li>
            share your profile with employers and authorised recruitment partners for the purpose
            of a specific hiring process (see section 8);
          </li>
          <li>coordinate screening, interviews, employer feedback and selection outcomes;</li>
          <li>
            support the documentation stage — visa, attestation, MOFA and embassy formalities,
            medical coordination, immigration and travel arrangements — where you have engaged us
            for those services;
          </li>
          <li>keep you updated on the progress of your application or requirement;</li>
          <li>provide post-joining support and respond to any issue you raise afterwards;</li>
          <li>
            handle an employer or business requirement, prepare proposals and manage the commercial
            relationship;
          </li>
          <li>issue invoices, record payments and maintain accounting and tax records;</li>
          <li>
            verify the accuracy of information and documents, and detect or prevent fraud,
            impersonation and document forgery;
          </li>
          <li>
            maintain our internal records, resolve disputes and enforce our{" "}
            <Link href="/terms-and-conditions">Terms &amp; Conditions</Link>;
          </li>
          <li>meet our legal, regulatory, tax and record-keeping obligations;</li>
          <li>improve the content and reliability of this website and our services.</li>
        </ul>
        <p>
          We do not sell your personal information. We do not rent or trade candidate databases,
          and we do not use your information for third-party advertising.
        </p>
      </>
    ),
  },
  {
    id: "legal-grounds",
    heading: "The grounds on which we process your information",
    body: (
      <>
        <p>
          Under Indian law we handle personal information on the following grounds, depending on
          what the information is for:
        </p>
        <ul>
          <li>
            <strong>Your consent.</strong> When you submit a form, upload a document, or send us
            your CV, you are asking us to act on it — for example to consider you for a role and to
            put your profile in front of employers. You can withdraw that consent at any time (see
            section 17).
          </li>
          <li>
            <strong>Performing a service you asked for.</strong> Where you or your organisation has
            engaged us, we process the information needed to actually deliver that service.
          </li>
          <li>
            <strong>Complying with the law.</strong> Some processing is required of us — for
            example maintaining tax and accounting records, or responding to a lawful request from
            a government authority or court.
          </li>
          <li>
            <strong>Establishing, exercising or defending legal claims,</strong> and preventing
            fraud or misuse of our services.
          </li>
        </ul>
        <p>
          The <strong>Digital Personal Data Protection Act, 2023</strong> and the{" "}
          <strong>Digital Personal Data Protection Rules, 2025</strong> are being brought into force
          in stages. We have written this policy and shaped our practices with those requirements
          in view, alongside the <strong>Information Technology Act, 2000</strong> and the rules
          made under it, and we will update this policy as the remaining provisions and compliance
          timelines take effect.
        </p>
      </>
    ),
  },
  {
    id: "sharing",
    heading: "Who we share your information with",
    body: (
      <>
        <p>
          Recruitment does not work unless your profile reaches an employer, so sharing is part of
          the service you are asking us for. We share only what is needed, only with the categories
          below, and only for the purposes described.
        </p>
        <ul>
          <li>
            <strong>Employers and their authorised representatives.</strong> Where you apply for a
            role or ask us to represent you, we share your profile and supporting documents with
            the employer concerned and with the people at that employer handling the hiring. Once
            an employer receives your information, that employer handles it under its own policies
            and the law of its country.
          </li>
          <li>
            <strong>Recruitment and sourcing partners</strong> who are working with us on a
            specific requirement.
          </li>
          <li>
            <strong>Service providers acting on our instructions</strong> — the technology
            providers listed in section 10, and, where you have engaged us for those services,
            medical centres, attestation and visa processing agents, travel and ticketing agents,
            and professional advisers such as accountants and lawyers.
          </li>
          <li>
            <strong>Government, embassy, immigration and regulatory bodies</strong> — see section
            9.
          </li>
          <li>
            <strong>Where the law requires it</strong> — in response to a lawful order, notice or
            request from a court, law enforcement or a government authority, or where disclosure is
            necessary to protect our rights, our staff, or the safety of others.
          </li>
          <li>
            <strong>In a corporate transaction</strong> — if our business or part of it is ever
            reorganised, merged or transferred, information may pass to the acquiring entity, which
            would remain bound by commitments equivalent to those in this policy.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "government-processing",
    heading: "Visa, medical, embassy and government processing",
    body: (
      <>
        <p>
          Overseas employment is a regulated process. Where you have engaged us for visa,
          documentation, medical or immigration support, we submit or present the information and
          documents that the relevant body requires. Depending on the role and destination country,
          this can include embassies and consulates of Gulf countries, ministries of foreign affairs
          and attestation authorities (including MOFA), approved medical examination centres,
          immigration and emigration authorities in India and in the destination country, and
          airlines or travel providers for ticketing.
        </p>
        <p>
          These bodies decide their own requirements, formats, timelines and outcomes. We cannot
          control what they ask for, and we cannot control or reverse their decisions. Once
          information is submitted to a government or statutory body, that body handles it under the
          law that applies to it, not under this policy.
        </p>
      </>
    ),
  },
  {
    id: "third-parties",
    heading: "Third-party services this website uses",
    body: (
      <>
        <p>
          This is the complete list of third-party services involved in running this website and
          handling what you submit through it. There are no others.
        </p>
        <dl className="legal-dl">
          <div>
            <dt>Resend</dt>
            <dd>
              Delivers the contents of the contact, service inquiry and job application forms to our
              inboxes as an email, and sends you a confirmation. The details you type into a form
              pass through Resend in order to be delivered. Documents you upload are not attached to
              those emails.
            </dd>
          </div>
          <div>
            <dt>Supabase</dt>
            <dd>
              Stores job applications and the documents you upload (CV, passport copy and any other
              documents) in a private, access-controlled database and file store. Uploaded documents
              are not publicly accessible and are not linkable from this website; they are retrieved
              only by our authorised team.
            </dd>
          </div>
          <div>
            <dt>Google Workspace</dt>
            <dd>
              Hosts our {LEGAL_ENTITY.brand} email accounts, including {CONTACT.jobsEmail} and{" "}
              {CONTACT.businessEmail}. Anything you email us, and any email we send you, is stored
              in that mail service.
            </dd>
          </div>
          <div>
            <dt>Google Fonts</dt>
            <dd>
              Serves the typefaces used on this website. Your browser requests the font files
              directly from Google, which means Google receives your IP address and basic browser
              information as part of that request. No content you type into a form is involved.
            </dd>
          </div>
          <div>
            <dt>WhatsApp (Meta)</dt>
            <dd>
              We publish WhatsApp numbers and a WhatsApp channel. If you choose to message us on
              WhatsApp, your number and the conversation are handled by WhatsApp under Meta&apos;s
              own privacy policy, in addition to our own records of the conversation.
            </dd>
          </div>
          <div>
            <dt>Web hosting provider</dt>
            <dd>
              Serves the pages of this website. Standard server logs (IP address, request, time,
              user agent) are generated for delivery, security and fault diagnosis.
            </dd>
          </div>
        </dl>
        <p>
          We ask our service providers to handle information only for the purposes we specify and
          to keep it secure. Each of them also operates under its own privacy policy, which you can
          read on its website.
        </p>
      </>
    ),
  },
  {
    id: "payments",
    heading: "Payment information",
    body: (
      <>
        <p>
          <strong>
            We do not store your card number, CVV, expiry date, UPI PIN, net-banking credentials or
            bank passwords,
          </strong>{" "}
          and no page on this website asks you to type them in.
        </p>
        <p>
          Where a payment for a service is to be made online, it is collected through a regulated
          third-party payment gateway. You enter your payment details on the gateway&apos;s own
          secure page, and the gateway — not this website — handles those details under the
          applicable card network and Reserve Bank of India requirements. What comes back to us is
          limited to the information we need to identify and account for the payment: a transaction
          or order reference, the amount, the status, the payment method type, the date, and the
          name and contact details you gave.
        </p>
        <p>
          We keep transaction records for as long as tax, accounting and audit law requires. If you
          are ever asked to make a payment to an account or a person that we have not confirmed to
          you in writing, stop and contact us on the details at the end of this page before paying.
          What you can and cannot be refunded is set out in our{" "}
          <Link href="/cancellation-and-refunds">Cancellation &amp; Refunds Policy</Link>.
        </p>
      </>
    ),
  },
  {
    id: "cookies",
    heading: "Cookies, analytics and tracking",
    body: (
      <>
        <p>
          <strong>This website does not set cookies of its own,</strong> and it does not run any
          analytics, advertising, remarketing or social-media tracking script. There is no Google
          Analytics, no Google Tag Manager, no Meta Pixel, no advertising tag and no session-replay
          tool on this site. We do not track you across other websites, and we do not need a cookie
          banner because we are not placing tracking cookies on your device.
        </p>
        <p>
          There is no login and no user account, so nothing about you is stored in your browser to
          identify you on a later visit. The technology that runs the application form may use your
          browser&apos;s local storage briefly while a submission is in progress; it is technical
          only and is not used to profile you.
        </p>
        <p>
          If we ever introduce analytics or any other tracking technology, we will update this
          section before doing so and, where the law requires it, ask for your consent first.
        </p>
      </>
    ),
  },
  {
    id: "international-transfers",
    heading: "International transfers",
    body: (
      <>
        <p>
          Our business is overseas recruitment, so your information will in many cases leave India —
          that is inherent in what you are asking us to do.
        </p>
        <ul>
          <li>
            <strong>To employers and authorities abroad.</strong> Where you apply for a role in
            Saudi Arabia, the United Arab Emirates, Qatar, Oman, Kuwait or Bahrain, your profile and
            documents are shared with the employer and, where required, with embassies, attestation
            authorities, medical centres and immigration bodies in India and in that country.
          </li>
          <li>
            <strong>To our technology providers.</strong> The services listed in section 10 are
            operated by companies that may store or process data on servers outside India.
          </li>
        </ul>
        <p>
          Data protection law varies between countries and may not always give the same protections
          as Indian law. Where information is transferred, we share only what the purpose requires,
          and we transfer it subject to any restrictions that apply under Indian law, including any
          restrictions notified under the Digital Personal Data Protection Act, 2023.
        </p>
      </>
    ),
  },
  {
    id: "retention",
    heading: "How long we keep your information",
    body: (
      <>
        <p>
          We keep personal information only for as long as there is a reason to, and then delete it
          or stop being able to identify you from it. In practice:
        </p>
        <ul>
          <li>
            <strong>General inquiries</strong> are kept while we deal with them and for a reasonable
            period afterwards, in case you come back to us on the same matter.
          </li>
          <li>
            <strong>Candidate profiles and documents</strong> are kept for as long as you remain an
            active candidate with us, and afterwards for as long as is useful for matching you to
            future roles — unless you ask us to delete them, in which case we act on your request
            (see section 17).
          </li>
          <li>
            <strong>Records of a completed placement</strong> are kept for longer, because they may
            be needed to answer a query from you, the employer or an authority, or to defend a
            claim.
          </li>
          <li>
            <strong>Invoices, payment records and tax documents</strong> are kept for the period
            that Indian tax, company and accounting law requires.
          </li>
        </ul>
        <p>
          Where we are required by law to keep something, we keep it for that period even if you ask
          us to delete it, and we tell you when that is the case.
        </p>
      </>
    ),
  },
  {
    id: "security",
    heading: "How we protect your information",
    body: (
      <>
        <p>
          We take reasonable security measures appropriate to the information we hold. This website
          is served over HTTPS, so what you submit is encrypted in transit. Uploaded CVs, passport
          copies and other documents are stored in a private file store that is not publicly
          readable and is not linkable from this website — the storage rules permit submissions to
          be written but not read back by the public — and access is limited to authorised members
          of our team who need it for a live recruitment process. Our email accounts are on a
          managed business email platform.
        </p>
        <p>
          No method of transmission or storage is completely secure, and we cannot guarantee
          absolute security — no one honestly can. If a personal data breach affecting you occurs,
          we will act on it and notify you and the relevant authority where the law requires us to.
        </p>
        <p>
          Please help us keep your information safe: send documents only to the email addresses and
          numbers published on this website, and treat any message that asks you to pay into an
          unfamiliar account, or that asks for an OTP or password, as fraudulent until you have
          verified it with us directly.
        </p>
      </>
    ),
  },
  {
    id: "your-rights",
    heading: "Your rights over your information",
    body: (
      <>
        <p>
          Subject to the law that applies and to the exceptions in it, you can ask us to do the
          following with the personal information we hold about you:
        </p>
        <ul>
          <li>
            <strong>Access</strong> — obtain a summary of the personal information we hold about
            you, what we are doing with it, and who we have shared it with.
          </li>
          <li>
            <strong>Correction and completion</strong> — have inaccurate or misleading information
            corrected, and incomplete information completed or updated.
          </li>
          <li>
            <strong>Erasure</strong> — have your personal information deleted, where we are not
            required to keep it for a legal purpose or for the establishment or defence of a legal
            claim.
          </li>
          <li>
            <strong>Withdraw consent</strong> — tell us to stop processing that was based on your
            consent (see section 17).
          </li>
          <li>
            <strong>Grievance redressal</strong> — raise a complaint with us about how your
            information has been handled (see section 19).
          </li>
          <li>
            <strong>Nomination</strong> — nominate another individual to exercise these rights on
            your behalf if you die or become incapable of doing so.
          </li>
        </ul>
        <p>
          These rights are not absolute, and information already lawfully shared with an employer or
          submitted to a government or statutory authority may need to be pursued with that body as
          well as with us. We will always tell you what we can and cannot do, and why.
        </p>
      </>
    ),
  },
  {
    id: "withdraw-consent",
    heading: "Withdrawing consent, correcting or deleting your information",
    body: (
      <>
        <p>
          To make any of the requests above, email us at{" "}
          <a href={`mailto:${CONTACT.businessEmail}`}>{CONTACT.businessEmail}</a> (or{" "}
          <a href={`mailto:${CONTACT.jobsEmail}`}>{CONTACT.jobsEmail}</a> if it concerns a job
          application) from the email address you used with us, or write to us at the address at
          the end of this page. Please tell us clearly what you would like us to do and include
          enough detail for us to find your records — for example the role you applied for and the
          approximate date.
        </p>
        <p>
          We may need to verify your identity before we act, particularly for a deletion request, so
          that we do not act on an impersonated request. We will acknowledge your request and
          respond within a reasonable period.
        </p>
        <p>
          Withdrawing your consent stops future processing that relied on it; it does not undo
          anything already lawfully done, and it does not oblige an employer or authority that has
          already received your information to delete it. If you withdraw consent or ask us to
          delete your candidate profile while an application is live, we may no longer be able to
          progress that application or provide the related services.
        </p>
      </>
    ),
  },
  {
    id: "children",
    heading: "Children and minors",
    body: (
      <>
        <p>
          This website and our services are intended for adults seeking or offering employment. We
          do not knowingly collect personal information from anyone under 18 years of age, and
          candidates must be at least 18 to register with us.
        </p>
        <p>
          If you believe a person under 18 has submitted information to us, contact us at{" "}
          <a href={`mailto:${CONTACT.businessEmail}`}>{CONTACT.businessEmail}</a> and we will delete
          it.
        </p>
      </>
    ),
  },
  {
    id: "grievance",
    heading: "Grievance redressal",
    body: (
      <>
        <p>
          If you are unhappy with how we have handled your personal information, tell us first — we
          would rather fix it. Email{" "}
          <a href={`mailto:${CONTACT.businessEmail}`}>{CONTACT.businessEmail}</a> with the subject
          line “Privacy grievance”, describe what happened, and include any reference details you
          have. You can also call our inquiry desk on{" "}
          <a href={CONTACT.inquiryPhoneHref}>{CONTACT.inquiryPhone}</a> or write to us at the
          address in the next section.
        </p>
        <p>
          We will acknowledge your grievance, look into it, and tell you the outcome. If you remain
          dissatisfied, you may pursue the remedies available to you under applicable Indian law,
          including any recourse available under the Digital Personal Data Protection Act, 2023 once
          the relevant provisions are in force.
        </p>
      </>
    ),
  },
  {
    id: "changes",
    heading: "Changes to this policy",
    body: (
      <>
        <p>
          We may update this policy as our services, our technology providers or the law change. The
          version published on this page is the one that applies, and the “last updated” date at the
          top of this page tells you when it last changed. The current version took effect on{" "}
          <strong>{POLICY_EFFECTIVE_DATE}</strong>.
        </p>
        <p>
          Where a change materially affects how we handle your personal information, we will take
          reasonable steps to bring it to your attention. Continuing to use this website after a
          change is published means the updated policy applies to your use of it.
        </p>
      </>
    ),
  },
];

export default function PrivacyPolicyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      eyebrow="Legal"
      path="/privacy-policy"
      intro="What we collect, why we collect it, who we share it with, and the control you have over it — written for how this website and our recruitment services actually work."
      sections={SECTIONS}
    />
  );
}
