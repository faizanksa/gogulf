import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ADDRESS_LINES, ADDRESS_ONE_LINE, REGISTERED_ADDRESS } from "@/lib/legal";
import { organizationJsonLd, postalAddress } from "@/lib/seo";
import { PARTNERS } from "./partners";

/**
 * Guards for the two corrections of 12 Sep 2026, over everything that renders public text:
 * pages, components, the content layer, every catalogue, structured data, the share image,
 * the form copy and the email templates.
 *
 *   1. The company is not registered or licensed as a recruiting agent. No public string
 *      may claim or imply it (content/company.ts CLAIMS.recruitingAgentRegistration).
 *   2. The public address omits the MCA record's care-of line (the plot number stays).
 *
 * Code comments are stripped first — they explain the rules and are never rendered.
 * content/company.ts (the claims register) and lib/legal.js (the record) are the
 * sources the rules are written in, so they are not scanned; the address assertions
 * below check what lib/legal.js exports for display.
 */

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });

const PUBLIC_SOURCES = [
  ...walk("app"),
  ...walk("components"),
  ...walk("content"),
  ...walk("messages"),
  ...walk("lib/email/templates"),
  "lib/seo.ts",
  "lib/share-image.tsx",
  "lib/i18n/forms.ts",
  "lib/forms/service-options.ts",
].filter((p) => /\.(tsx?|jsx?|json)$/.test(p) && !/\.test\.[tj]sx?$/.test(p) && !/content[\\/]company\.ts$/.test(p));

const withoutComments = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

// Whitespace collapsed, so a phrase wrapped across source lines ("we do not\n guarantee")
// reads as it renders.
const read = (path: string) => withoutComments(readFileSync(path, "utf8")).replace(/\s+/g, " ");

/**
 * Wording that claims or implies recruiting-agent status, direct placement, or a claim the
 * register has not cleared.
 *
 * Since 6 Oct 2026 (D13) the site DESCRIBES registered recruiting agents — the partners Go
 * Gulf refers candidates to — so the phrase "recruiting agent" and the official eMigrate
 * link are allowed. What stays forbidden is any wording that makes Go Gulf itself a
 * registered, licensed or authorised agent, or that has Go Gulf placing, selecting or
 * hiring people, or arranging their visas, offers or travel.
 */
const FORBIDDEN: RegExp[] = [
  /recruitment[\s-]+agenc(y|ies)/i,
  /\b(go gulf|we|our company|the company)\s+(is|are)\s+(an?\s+)?(registered|licen[cs]ed|authori[sz]ed|approved)\b/i,
  /\b(our|go gulf'?s)\s+(RA|recruiting|recruitment|emigration)[\s-]+(licen[cs]e|registration)/i,
  /\b(we|go gulf)\s+(place|places|deploy|deploys|recruit|recruits|select|selects|hire|hires|shortlist|shortlists)\b/i,
  /\b(we|go gulf)\s+(arrange|arranges|process|processes|book|books|issue|issues)\s+(your\s+|the\s+)?(visas?|flights?|travel|tickets?|offers?)\b/i,
  /get hired|hire from india|bulk\s+(candidate\s+)?sourcing/i,
  /licen[cs]ed\s+(overseas\s+)?(recruit|manpower|placement|employment)/i,
  /registered\s+(overseas\s+)?(manpower|placement|employment)/i,
  // Negated uses ("…is not a recruiting licence") are the point of the round-3 notice.
  /(?<!\bnot\s+an?\s+|\bno\s+)recruit(ment|ing)\s+licen[cs]e/i,
  /\bRA\s+licen[cs]e/i,
  /emigration\s+licen[cs]e/i,
  /MOFA[\s-]+(approv|complian|authori[sz]ed|registered)/i,
  /government[\s-]+(approved|authori[sz]ed)/i,
  /direct[\s-]+approval/i,
  /EmploymentAgency/,
  /no hidden charges/i,
  /\b\d+\s*[–-]\s*\d+\s+business days/i,
  /verified employer/i,
  /genuine,?\s+screened/i,
  /\b\d{2}\s*\+\s*years/i,
  /thousands\s+of\s+(placements|candidates|workers)/i,
  /\b\d[\d,]*\s*\+?\s*(placements|candidates placed|workers placed|people placed|successful placements)/i,
  /\b\d+\s*\+?\s*(countries|nations|sectors|industries)\b/i,
  /\bwithin\s+\d+\s*(hours?|days?|business days?|working days?)/i,
  /(employer|partner)s?\s+network|network\s+of\s+(verified\s+|trusted\s+)?employers/i,
  /(?<!not\s|never\s|no\s)guarantee[ds]?\s+(you\s+)?(a\s+)?(job|jobs|employment|visa|placement|selection|joining)\b/i,
  /Protector\s+(General\s+)?of\s+Emigrants/i,
  /authori[sz]ed\s+recruit/i,
  /\bsince\s+(19|20)\d{2}\b/i,
];

/** Years-of-experience claims about the company; job listings legitimately state requirements. */
const COMPANY_EXPERIENCE = /\b\d+\s*\+?\s*years?\s+(of\s+)?(experience|expertise|in\s+(the\s+)?(industry|business|recruitment|gulf))/i;

describe("public copy", () => {
  it("scans a meaningful set of files", () => {
    expect(PUBLIC_SOURCES.length).toBeGreaterThan(80);
  });

  it("never claims or implies recruiting-agent registration, or an uncleared claim", () => {
    const hits = PUBLIC_SOURCES.flatMap((path) => {
      const text = read(path);
      return FORBIDDEN.filter((re) => re.test(text)).map((re) => `${path}: ${re}`);
    });
    expect(hits).toEqual([]);
  });

  it("claims no years of company experience (job requirements aside)", () => {
    const hits = PUBLIC_SOURCES.filter((path) => !/content[\\/]jobs\.ts$/.test(path) && COMPANY_EXPERIENCE.test(read(path)));
    expect(hits).toEqual([]);
  });

  it("never shows the registered office's care-of line", () => {
    const hits = PUBLIC_SOURCES.filter((path) => /Asha\s+Yadav|\bC\/o\b/i.test(read(path)));
    expect(hits).toEqual([]);
  });

  it("says plainly where it describes recruiting agents that Go Gulf is not one (D13)", () => {
    const en = read("messages/en.json");
    expect(en).toMatch(/"lead": "Go Gulf is not registered as a recruiting agent\./);
    expect(en).toMatch(/"q7": "Is Go Gulf a recruiting agent\?", "a7": "No\. Go Gulf is not registered as a recruiting agent/);
    expect(read("app/(marketing)/(legal)/terms-and-conditions/page.js")).toMatch(/We are <strong>not registered as a recruiting agent<\/strong>/);
    expect(read("app/llms.txt/route.ts")).toMatch(/Go Gulf is not registered as a recruiting agent\./);
  });

  it("promises a candidate the agent's identity in writing before referral and before any payment", () => {
    const en = read("messages/en.json");
    expect(en).toContain("Before we pass on your profile, and before you pay anything, we give you in writing the agent's name, registration number, and who is responsible for what.");
    expect(read("app/(marketing)/(legal)/terms-and-conditions/page.js")).toMatch(
      /Before we pass your profile to a recruiting agent, and before you pay anything<\/strong> in connection with a role, we tell you in writing the name and registration number/,
    );
  });

  it("puts the written disclosure BEFORE the referral wherever the steps or the sharing are described (round 3)", () => {
    const en = JSON.parse(readFileSync("messages/en.json", "utf8"));
    const p = en.home.process;
    // Step 4 is the disclosure, step 5 the referral, and ProcessSteps renders them in that order.
    expect(p.s4.title).toBe("Written disclosure");
    expect(p.s4.body).toMatch(/^Before we pass on your profile, and before you pay anything, we give you in writing the agent's name and registration number/);
    expect(p.s5.title).toMatch(/^Referral/);
    expect(p.s5.body).toBe("We pass your profile on only after you have the agent's details in writing and have agreed.");
    const steps = readFileSync("components/site/ProcessSteps.tsx", "utf8");
    expect(steps.indexOf('"home.process.s4.title"')).toBeLessThan(steps.indexOf('"home.process.s5.title"'));
    // The consent box agrees to keeping documents; sharing waits for the disclosure and a further agreement.
    for (const kind of ["application", "enquiry"]) {
      expect(en.forms.consent[kind], kind).toMatch(/Before sharing them with a registered recruiting agent, Go Gulf will give me the agent's name and registration number in writing and ask for my agreement\.$/);
    }
    expect(read("app/(marketing)/(legal)/privacy-policy/page.js")).toMatch(/we first tell you in writing which recruiting agent, registered under the Emigration Act, 1983, handles the role, and its registration number\. Only then, and only with your agreement, do we share/);
    expect(read("app/llms.txt/route.ts")).toMatch(/Before passing a candidate's profile to a recruiting agent, and before the candidate pays anything/);
    // No copy may describe passing a profile on "with your agreement" without the disclosure first.
    const hits = PUBLIC_SOURCES.filter((path) => /with your agreement, we pass your profile|we pass your profile to a registered recruiting agent we work with/i.test(read(path)));
    expect(hits).toEqual([]);
  });
});

describe("the claims guard itself", () => {
  const caught = (text: string) => FORBIDDEN.filter((re) => re.test(text)).length > 0;

  // Placement, licence and outcome claims: each must fail the build if it ever appears.
  it.each([
    "Go Gulf is a licensed recruiting agent.",
    "We are registered with the Protector General of Emigrants.",
    "Go Gulf is authorised to recruit for Saudi Arabia.",
    "Our RA licence number is on request.",
    "Go Gulf's recruitment licence",
    "We hold a recruiting licence.",
    "We place candidates with Gulf employers.",
    "Go Gulf selects the best candidates.",
    "We shortlist candidates for the employer.",
    "We arrange your visa and flights.",
    "Go Gulf issues the offer letter.",
    "Go Gulf. Get Hired.",
    "Hire from India",
    "Bulk candidate sourcing",
    "a leading recruitment agency",
    "licensed manpower supplier",
    "We guarantee you a job.",
    "Guaranteed visa",
  ])("forbids %s", (text) => {
    expect(caught(text)).toBe(true);
  });

  // The referral model's own wording must stay writable.
  it.each([
    "Go Gulf is not registered as a recruiting agent.",
    "We refer candidates to registered recruiting agents.",
    "The recruiting agent processes the visa and the emigration formalities.",
    "We do not guarantee selection, employment, a visa or a joining date.",
    "Check any agent on the eMigrate portal.",
    "Company registration is not a recruiting licence.",
    "Before you pay anything, we give you in writing the agent's name, registration number, and who is responsible for what.",
  ])("allows %s", (text) => {
    expect(caught(text)).toBe(false);
  });
});

describe("partner details in public output", () => {
  const isPartnerConfig = (path: string) => /content[\\/]partners\.ts$/.test(path);

  it("reads partners only through publicPartners() / publicPartnerForJob(), which honour the hidden setting", () => {
    const hits = PUBLIC_SOURCES.filter((path) => !isPartnerConfig(path) && /\b(PARTNERS|publishedPartners|partnerForJob)\b/.test(read(path)));
    expect(hits).toEqual([]);
  });

  it("never hard-codes a partner's name, number or website in a public file", () => {
    const values = PARTNERS.flatMap((p) => [p.name, p.raRegistrationNumber, p.website].filter((v): v is string => Boolean(v)));
    const leaks = values.flatMap((v) => PUBLIC_SOURCES.filter((path) => !isPartnerConfig(path) && read(path).includes(v)).map((path) => `${path}: ${v}`));
    expect(leaks).toEqual([]);
  });
});

describe("public address", () => {
  const publicForms = [ADDRESS_LINES.join("\n"), ADDRESS_ONE_LINE, JSON.stringify(postalAddress()), JSON.stringify(organizationJsonLd())];

  it("keeps the full record, but never displays the care-of line", () => {
    expect(REGISTERED_ADDRESS.careOf).toBe("C/o Asha Yadav");
    for (const text of publicForms) {
      expect(text).not.toContain(REGISTERED_ADDRESS.careOf);
      expect(text).not.toMatch(/Asha|C\/o/i);
    }
  });

  it("shows the approved public address, plot number included", () => {
    expect(ADDRESS_LINES).toEqual(["G No-364, Mishrapur", "Kursi Road, Jankipuram", "Lucknow, Uttar Pradesh – 226021", "India"]);
    expect(ADDRESS_ONE_LINE).toBe("G No-364, Mishrapur, Kursi Road, Jankipuram, Lucknow, Uttar Pradesh – 226021, India");
    expect(postalAddress()).toMatchObject({ streetAddress: "G No-364, Mishrapur, Kursi Road, Jankipuram", addressLocality: "Lucknow", postalCode: "226021", addressCountry: "IN" });
  });
});

/**
 * Round 3 (client decision, 6 Oct 2026): the legal name and the registered office are shown
 * ONCE — the footer (compact), /verify, /about, the policy pages and email footers — plus the
 * Organization structured data and llms.txt that describe the same company. The brand is
 * the face of the site; the CIN and the contact routes stay everywhere they were.
 */
describe("legal name and registered office: shown once, not everywhere", () => {
  const ALLOWED = [
    /components[\\/]site[\\/]SiteFooter\.tsx$/,
    /app[\\/]\(marketing\)[\\/]verify[\\/]page\.tsx$/,
    /app[\\/]\(marketing\)[\\/]about[\\/]page\.tsx$/,
    /app[\\/]\(marketing\)[\\/]\(legal\)[\\/]/,
    /components[\\/]LegalPage\.tsx$/,
    /lib[\\/]email[\\/]templates[\\/]layout\.ts$/,
    /lib[\\/]seo\.ts$/, // the Organization node, consistent with the footer
    /app[\\/]llms\.txt[\\/]route\.ts$/,
    /content[\\/]pages\.ts$/, // only /about's description; checked below
  ];
  const USES = /COMPANY\.(legalName|shortName|addressLines|address\.lines)|LEGAL_ENTITY\.(name|shortName|tradeName)|ADDRESS_LINES|ADDRESS_ONE_LINE|postalAddress\(|Faizan Chaudhary|Mishrapur|Jankipuram|Kursi Road/;

  it("appears only in the allowed files", () => {
    const hits = PUBLIC_SOURCES.filter((path) => !ALLOWED.some((re) => re.test(path)) && USES.test(read(path)));
    expect(hits).toEqual([]);
  });

  it("is named in one page description only, /about's", () => {
    const pages = readFileSync("content/pages.ts", "utf8");
    expect(pages.match(/Faizan Chaudhary/g)).toHaveLength(1);
    expect(pages).toMatch(/id: "about"[^}]*Faizan Chaudhary/);
  });

  it("is passed to the catalogue only by the footer's 'brand of' line, /about and /verify", () => {
    const en = readFileSync("messages/en.json", "utf8");
    const keys = [...en.matchAll(/"(\w+)": "[^"]*\{legalName\}/g)].map((m) => m[1]);
    expect(keys.sort()).toEqual(["body", "brandOf", "lead"]);
    expect(en).toMatch(/"rights": "© \{year\} \{brand\}\. All rights reserved\."/);
  });

  it("is shown once in the footer, which also carries the registered office", () => {
    const footer = read("components/site/SiteFooter.tsx");
    expect(footer.match(/COMPANY\.legalName/g)).toHaveLength(1);
    expect(footer).toMatch(/footer\.record\.office/);
    expect(footer).toMatch(/COMPANY\.addressLines\.join/);
  });

  it("keeps the CIN in the top bar and footer, and every contact route", () => {
    expect(read("components/site/SiteHeader.tsx")).toMatch(/COMPANY\.cin/);
    expect(read("components/site/SiteHeader.tsx")).not.toMatch(/COMPANY\.(shortName|legalName)/);
    const footer = read("components/site/SiteFooter.tsx");
    expect(footer).toMatch(/COMPANY\.cin/);
    expect(footer).toMatch(/<OfficialChannels/);
    const channels = read("components/site/OfficialChannels.tsx");
    for (const c of ["PHONE", "WHATSAPP", "CAREERS_EMAIL", "BUSINESS_EMAIL"]) expect(channels, c).toMatch(new RegExp(`${c}\\.href`));
    expect(read("app/(marketing)/contact/page.tsx")).toMatch(/<OfficialChannels/);
  });

  it("keeps the Organization node accurate: legal name, CIN and registered office, no GSTIN", () => {
    const org = organizationJsonLd() as Record<string, unknown>;
    expect(org.legalName).toBe("Faizan Chaudhary Gulf Travels Private Limited");
    expect(org.identifier).toMatchObject({ propertyID: "CIN", value: "U52291UP2024PTC198095" });
    expect(org.address).toMatchObject({ addressLocality: "Lucknow", postalCode: "226021" });
    expect(JSON.stringify(org)).not.toMatch(/GSTIN|09AALCC6656L1ZY|taxID/);
    expect(String(org.description)).not.toMatch(/Faizan Chaudhary/);
  });
});

describe("company registration is not presented as a recruiting licence (round 3)", () => {
  const NOT_LICENCE = "Company registration is not a recruiting licence. Your recruiting agent's registration number is given to you in writing before you pay.";

  it("says so beside the company facts on home, /verify, /about and the facts band", () => {
    expect(JSON.parse(readFileSync("messages/en.json", "utf8")).companyFacts.notLicence).toBe(NOT_LICENCE);
    for (const path of ["app/(marketing)/page.tsx", "app/(marketing)/verify/page.tsx", "components/site/CompanyFacts.tsx"]) {
      expect(read(path), path).toMatch(/companyFacts\.notLicence/);
    }
    // /about and /employers show it through the company-facts band.
    for (const path of ["app/(marketing)/about/page.tsx", "app/(marketing)/employers/page.tsx"]) expect(read(path), path).toMatch(/<CompanyFacts /);
  });

  it("never calls the company 'registered' or 'verified' in a way that reads as a licence", () => {
    const hits = PUBLIC_SOURCES.filter((path) => /registered compan(y|ies)|compan(y|ies) registered in India|verified compan|licensed compan|approved compan|authori[sz]ed compan/i.test(read(path)));
    expect(hits).toEqual([]);
  });
});

