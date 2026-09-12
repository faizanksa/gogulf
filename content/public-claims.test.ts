import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ADDRESS_LINES, ADDRESS_ONE_LINE, REGISTERED_ADDRESS } from "@/lib/legal";
import { organizationJsonLd, postalAddress } from "@/lib/seo";

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

/** Wording that claims or implies recruiting-agent status, or a claim the register has not cleared. */
const FORBIDDEN: RegExp[] = [
  /recruit(ment|ing)[\s-]+agen(t|cy|cies)/i,
  /(registered|licen[cs]ed)\s+(overseas\s+)?(recruit|manpower|placement|employment)/i,
  /recruit(ment|ing)\s+licen[cs]e/i,
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
  /eMigrate|Protector\s+(General\s+)?of\s+Emigrants/i,
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
