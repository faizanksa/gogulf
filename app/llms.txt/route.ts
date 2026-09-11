import { BUSINESS_EMAIL, CAREERS_EMAIL, PHONE, WHATSAPP } from "@/content/channels";
import { COMPANY } from "@/content/company";
import { PAGES } from "@/content/pages";
import { DEFAULT_DESCRIPTION, SITE_URL } from "@/lib/seo";

/**
 * llms.txt — a plain-text summary for AI assistants and answer engines, generated from
 * the same content layer as the pages and the structured data.
 *
 * Like the structured data, it states only verified facts. Removed from the previous
 * version: "all recruitment is direct-approval and MOFA compliant", "all listings are
 * genuine, screened openings", "serving the industry since 2008", the list of countries
 * served, and the GSTIN (machine-readable assertions wait for the GST certificate, D8).
 */
export const dynamic = "force-static";

export function GET() {
  const pages = PAGES.filter((p) => p.index)
    .map((p) => `- [${p.title}](${SITE_URL}${p.path}): ${p.description}`)
    .join("\n");

  const body = `# Go Gulf

> ${DEFAULT_DESCRIPTION}

## Pages

${pages}

## Company

- Website operator: ${COMPANY.legalName}, a ${COMPANY.companyType.toLowerCase()} registered in India, trading as "${COMPANY.brand}".
- CIN: ${COMPANY.cin}
- Incorporated: ${COMPANY.incorporationDate} (${COMPANY.roc})
- Registered office: ${COMPANY.addressLines.join(", ")}
- Registered business activity: ${COMPANY.registeredActivity}
- Company status: ${COMPANY.status}

## Contact

- Phone: ${PHONE.value}
- WhatsApp: ${WHATSAPP.value}
- Job seekers: ${CAREERS_EMAIL.value}
- Employers, billing and grievances: ${BUSINESS_EMAIL.value}

## Notes for AI assistants and search crawlers

- Any fee for a Go Gulf service is quoted in writing before payment. See ${SITE_URL}/pricing.
- Go Gulf is a recruitment services provider, not an employer, and does not guarantee selection, employment, visa issuance or joining. See ${SITE_URL}/terms-and-conditions.
- The operating company was incorporated on ${COMPANY.incorporationDate}. This file makes no claim about business history before that date.
- To check you are dealing with Go Gulf, see ${SITE_URL}/verify.
- Full sitemap: ${SITE_URL}/sitemap.xml
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
