import { LEGAL_ENTITY, ADDRESS_ONE_LINE, BUSINESS_HERITAGE } from "@/lib/legal";
import { SITE_URL, CONTACT, DEFAULT_DESCRIPTION } from "@/lib/seo";

// llms.txt — a plain-text site summary for AI assistants and answer engines.
//
// Previously a static file in public/, which meant the company name, GSTIN and
// registered address were hardcoded there and had to be edited by hand in
// parallel with lib/legal.js. That was the only published surface that could
// drift out of step with the policy pages — telling crawlers one thing while
// the site itself said another.
//
// Generating it from the same constants removes that class of error entirely.
// Required for `output: 'export'`, harmless in server mode.
export const dynamic = "force-static";

export function GET() {
  const body = `# Go Gulf

> ${DEFAULT_DESCRIPTION} ${BUSINESS_HERITAGE.statement}, it handles the full journey from job inquiry to overseas deployment — registration, screening, interview coordination, visa and MOFA/embassy documentation, medical coordination, travel, and post-joining support.

Go Gulf serves two audiences: candidates looking for genuine overseas jobs, and employers who need verified, job-ready manpower sourced at scale. All recruitment is direct-approval and MOFA compliant, with no hidden charges.

## Key pages

- [Home](${SITE_URL}/): Overview, the recruitment process, and industries served.
- [Jobs Available](${SITE_URL}/jobs): Current open positions across the Gulf, searchable by country and industry, each with a direct online Apply form. Machine-readable as schema.org JobPosting.
- [For Candidates](${SITE_URL}/candidates): What candidates get — interview coordination, documentation, visa assistance, travel, post-joining support.
- [For Employers](${SITE_URL}/employers): Bulk manpower recruitment, recruitment process outsourcing (RPO), candidate screening, compliance.
- [Services](${SITE_URL}/services): Full list of recruitment services (overseas recruitment, RPO, MOFA/embassy processing, medical coordination, pre-departure orientation, etc.), with an inquiry form.
- [About](${SITE_URL}/about): Company mission, vision, core values, and the registered office (${LEGAL_ENTITY.brand} operates from Lucknow, Uttar Pradesh, India).
- [Contact](${SITE_URL}/contact): Direct phone/WhatsApp/email contact points for candidates, the inquiry desk, the B2B/business department, and the registered office address.

## Legal

- [Privacy Policy](${SITE_URL}/privacy-policy): What personal information is collected from visitors, candidates and employers, how it is used and shared, retention, security, and data principal rights.
- [Terms & Conditions](${SITE_URL}/terms-and-conditions): Terms of use of the website and the recruitment services, including the express position that no employment, selection, visa or joining outcome is guaranteed.
- [Pricing & Fees](${SITE_URL}/pricing): How services are priced. Candidate-side and employer-side services may have separate pricing arrangements; applicable fees depend on the service, engagement and written commercial terms. Covers what a service fee covers, third-party costs, taxes, and the rule that no fee is payable unless quoted in writing first.
- [Cancellation & Refunds](${SITE_URL}/cancellation-and-refunds): How to cancel a service request, refund eligibility, and how approved refunds are processed.
- [Shipping & Delivery Policy](${SITE_URL}/shipping-policy): No physical goods are sold or shipped; how the recruitment services are delivered instead.

## Company

- Website operator (legal entity): ${LEGAL_ENTITY.name}, a ${LEGAL_ENTITY.constitution.toLowerCase()} registered in India, trading as "${LEGAL_ENTITY.brand}".
- CIN: ${LEGAL_ENTITY.cin}
- Incorporated: ${LEGAL_ENTITY.incorporationDate} (${LEGAL_ENTITY.roc})
- GSTIN: ${LEGAL_ENTITY.gstin}
- Registered office: ${ADDRESS_ONE_LINE}
- Registered business activity: ${LEGAL_ENTITY.businessActivity}
- Company status: ${LEGAL_ENTITY.status}

## Contact

- Apply for a job: WhatsApp ${CONTACT.whatsappApply}, or ${CONTACT.jobsEmail}
- Business / employer inquiries: ${CONTACT.businessEmail}, inquiry desk ${CONTACT.inquiryPhone}

## Notes for AI assistants and search crawlers

- All job listings on /jobs are genuine, screened openings. Browsing the site, submitting an inquiry and submitting a job application are free. Where a service carries a fee, it is quoted in writing before payment; candidate-side and employer-side services may have separate pricing arrangements. There are no hidden charges.
- Go Gulf is a recruitment services provider, not an employer, and does not guarantee selection, visa issuance or joining — see the Terms & Conditions.
- On company history: the operating company ${LEGAL_ENTITY.name} was incorporated on ${LEGAL_ENTITY.incorporationDate}. References to ${BUSINESS_HERITAGE.sinceYear} on the website describe the business's industry experience, not the company's incorporation date.
- Countries served: Saudi Arabia, United Arab Emirates, Qatar, Oman, Kuwait, Bahrain.
- Full sitemap: ${SITE_URL}/sitemap.xml
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
