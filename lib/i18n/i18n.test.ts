import { existsSync } from "node:fs";
import path from "node:path";
import { IntlMessageFormat } from "intl-messageformat";
import { describe, expect, it } from "vitest";
import { FOOTER_GROUPS, LEGAL_LINKS, NAV_ITEMS, PRIMARY_CTA } from "@/content/navigation";
import { PAGES } from "@/content/pages";
import { contactSchema, toFieldErrors } from "@/lib/forms/schemas";
import { CATALOGS, catalogKeys, catalogMeta, isCatalogPublished, lookup } from "./catalogs";
import { countryName, formatDate, salaryText } from "./format";
import { activeLocales, hreflangAlternates, LOCALES, localizedPath, prefixedLocales, splitLocale, type LocaleCode } from "./locales";
import { hrefIn, jobText, multilingualPaths, pageText, pathLocales } from "./pages";
import { pseudoLocalize } from "./pseudo";
import { DEFAULT_LOCALE, LOCALE_CODES, PSEUDO_LOCALE_CODES } from "./routing.mjs";
import { createTranslator } from "./translator";

const RLO = "‮";
const EN_KEYS = catalogKeys(CATALOGS.en);
const OTHER = (LOCALE_CODES as LocaleCode[]).filter((c) => c !== "en");
const ROOT = path.resolve(__dirname, "../..");

/** The argument and tag names an ICU message uses — must match between languages. */
function signature(message: string): string[] {
  const out = new Set<string>();
  type Node = { type: number; value?: string; options?: Record<string, { value: Node[] }>; children?: Node[] };
  const walk = (nodes: Node[]) => {
    for (const node of nodes) {
      // 0 = literal, 7 = the # in a plural; everything else names an argument or a tag.
      if (node.type !== 0 && node.type !== 7 && typeof node.value === "string") out.add(node.type === 8 ? `<${node.value}>` : node.value);
      if (node.options) for (const option of Object.values(node.options)) walk(option.value);
      if (node.children) walk(node.children);
    }
  };
  walk(new IntlMessageFormat(message, "en").getAst() as unknown as Node[]);
  return [...out].sort();
}

describe("locale registry", () => {
  it("routing.mjs (read by next.config) and locales.ts list the same languages", () => {
    expect(Object.keys(LOCALES).sort()).toEqual([...LOCALE_CODES, ...PSEUDO_LOCALE_CODES].sort());
    expect(DEFAULT_LOCALE).toBe("en");
    expect(LOCALES.en.tier).toBe("source");
  });

  it("marks exactly Arabic and its pseudo-locale right-to-left", () => {
    expect(Object.values(LOCALES).filter((l) => l.dir === "rtl").map((l) => l.code).sort()).toEqual(["ar", "ar-XB"]);
  });

  it("has a catalogue for every language, naming itself", () => {
    for (const code of LOCALE_CODES as LocaleCode[]) expect(catalogMeta(code).locale).toBe(code);
  });

  it("never builds a pseudo-locale or an unpublished language in production", () => {
    const production = activeLocales("production");
    for (const code of PSEUDO_LOCALE_CODES) expect(production).not.toContain(code);
    for (const code of OTHER) if (!isCatalogPublished(code)) expect(production).not.toContain(code);
    expect(prefixedLocales("production")).not.toContain("en");
  });

  it("builds the pseudo-locales outside production", () => {
    expect(activeLocales("staging")).toEqual(expect.arrayContaining(["en", "en-XA", "ar-XB"]));
  });
});

describe("catalogues", () => {
  it("every English message is valid ICU MessageFormat", () => {
    for (const key of EN_KEYS) expect(() => new IntlMessageFormat(lookup(CATALOGS.en, key)!, LOCALES.en.tag), key).not.toThrow();
  });

  it("other catalogues use English's keys, with the same arguments and tags", () => {
    for (const code of OTHER) {
      const catalog = CATALOGS[code];
      for (const key of catalogKeys(catalog)) {
        if (key.startsWith("pages.")) continue; // checked below
        expect(EN_KEYS, `${code}: ${key} is not in messages/en.json`).toContain(key);
        const message = lookup(catalog, key)!;
        expect(() => new IntlMessageFormat(message, LOCALES[code].tag), `${code}: ${key}`).not.toThrow();
        expect(signature(message), `${code}: ${key}`).toEqual(signature(lookup(CATALOGS.en, key)!));
      }
    }
  });

  it("translated page text belongs to a registered page", () => {
    const ids = new Set(PAGES.map((p) => p.id));
    for (const code of OTHER) {
      for (const key of catalogKeys(CATALOGS[code]).filter((k) => k.startsWith("pages."))) {
        const [, id, field] = key.split(".");
        expect(ids.has(id!), `${code}: ${key}`).toBe(true);
        expect(["title", "description", "breadcrumb", "absoluteTitle"], `${code}: ${key}`).toContain(field);
      }
    }
  });

  it("a published catalogue is complete and records who reviewed it", () => {
    for (const code of OTHER.filter(isCatalogPublished)) {
      const meta = catalogMeta(code);
      expect(meta.status).toBe("reviewed");
      expect(meta.reviewedBy && meta.reviewedOn).toBeTruthy();
      for (const key of EN_KEYS) expect(lookup(CATALOGS[code], key), `${code}: ${key}`).toBeDefined();
    }
  });

  it("a page lists a language only once that language is published, with its page text", () => {
    for (const page of PAGES) {
      for (const code of page.locales) {
        expect(isCatalogPublished(code), `${page.path} lists ${code}`).toBe(true);
        expect(() => pageText(page, code)).not.toThrow();
      }
    }
  });

  it("a review status is recorded only as reviewed, with a reviewer and date", () => {
    for (const code of OTHER) {
      const meta = catalogMeta(code);
      expect(["not-started", "in-translation", "in-review", "reviewed"]).toContain(meta.status);
      if (meta.status !== "reviewed") expect(isCatalogPublished(code)).toBe(false);
    }
  });
});

describe("translator", () => {
  const en = createTranslator("en");

  it("reproduces the English the site showed before the catalogues", () => {
    expect(en("forms.contact.sentNoCopy")).toBe(
      "Message received — our team will contact you. We could not email you a copy, but your message did reach us.",
    );
    expect(en("footer.rights", { year: "2026", legalName: "X Pvt Ltd" })).toBe("© 2026 X Pvt Ltd. All rights reserved.");
    expect(en("jobs.metaTitle", { title: "Site Supervisor", where: "Saudi Arabia" })).toBe("Site Supervisor in Saudi Arabia");
  });

  it("recognises its own keys", () => {
    expect(en.has("nav.jobs")).toBe(true);
    expect(en.has("Name is required.")).toBe(false);
  });

  it("pseudo-localises: en-XA accented and longer, ar-XB in a right-to-left override", () => {
    expect(createTranslator("en-XA")("nav.jobs")).toBe("[Ĵöƀš ~]");
    expect(createTranslator("ar-XB")("nav.jobs")).toBe(`${RLO}Jobs‬`);
    expect(pseudoLocalize("", "en-XA")).toBe("");
  });

  it("an unpublished language falls back to English, never to a key", () => {
    expect(createTranslator("hi")("nav.jobs")).toBe("Jobs");
  });
});

describe("paths, hreflang and availability", () => {
  it("prefixes every language but English", () => {
    expect(localizedPath("/jobs", "en")).toBe("/jobs");
    expect(localizedPath("/", "hi")).toBe("/hi");
    expect(localizedPath("/verify", "ar")).toBe("/ar/verify");
  });

  it("splits a pathname back into its language and English path", () => {
    expect(splitLocale("/ar-XB/verify")).toEqual({ locale: "ar-XB", path: "/verify" });
    expect(splitLocale("/verify")).toEqual({ locale: "en", path: "/verify" });
    expect(splitLocale("/en-XA")).toEqual({ locale: "en-XA", path: "/" });
    expect(splitLocale("/hindi")).toEqual({ locale: "en", path: "/hindi" });
    for (const code of Object.keys(LOCALES) as (keyof typeof LOCALES)[]) {
      expect(splitLocale(localizedPath("/jobs/x", code))).toEqual({ locale: code, path: "/jobs/x" });
    }
  });

  it("emits hreflang only for real languages, only when there are two or more, with x-default English", () => {
    expect(hreflangAlternates("/verify", ["en"])).toBeUndefined();
    expect(hreflangAlternates("/verify", ["en", "en-XA", "ar-XB"])).toBeUndefined();
    expect(hreflangAlternates("/verify", ["en", "hi", "ar"])).toEqual({
      "en-IN": "/verify",
      "hi-IN": "/hi/verify",
      ar: "/ar/verify",
      "x-default": "/verify",
    });
  });

  it("gives exactly the localizable pages a route under app/[locale]", () => {
    for (const page of PAGES) {
      const file = path.join(ROOT, "app", "[locale]", ...page.path.split("/").filter(Boolean), "page.tsx");
      expect(existsSync(file), `${page.path}: localizable=${page.localizable}`).toBe(page.localizable);
    }
  });

  it("serves localizable pages in the pseudo-locales, and links elsewhere to English", () => {
    expect(pathLocales("/verify")).toEqual(["en", "en-XA", "ar-XB"]);
    // The policies stay English-only until a legal review signs off a translation.
    expect(pathLocales("/pricing")).toEqual(["en"]);
    expect(hrefIn("/verify", "ar-XB")).toBe("/ar-XB/verify");
    expect(hrefIn("/verify#top", "ar-XB")).toBe("/ar-XB/verify#top");
    expect(hrefIn("/pricing", "ar-XB")).toBe("/pricing");
    expect(hrefIn("/pricing", "en")).toBe("/pricing");
    expect(multilingualPaths()["/verify"]).toEqual(["en", "en-XA", "ar-XB"]);
    expect(multilingualPaths()["/pricing"]).toBeUndefined();
  });

  it("refuses a real language for a page with no reviewed text in it", () => {
    expect(() => pageText(PAGES.find((p) => p.path === "/verify")!, "hi")).toThrow(/pages\.verify/);
  });
});

describe("interface text", () => {
  it("labels every navigation, footer and policy link", () => {
    const labels = [...NAV_ITEMS, PRIMARY_CTA, ...FOOTER_GROUPS.flatMap((g) => g.links), ...LEGAL_LINKS].map((l) => l.label);
    for (const label of [...labels, ...FOOTER_GROUPS.map((g) => g.heading)]) {
      expect(label, "a link without a catalogue label").toBeDefined();
      expect(lookup(CATALOGS.en, label)).toBeDefined();
    }
  });

  it("returns validation errors in the page's language", () => {
    const parsed = contactSchema.safeParse({});
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(toFieldErrors(parsed.error).from_name).toEqual(["Name is required."]);
    expect(toFieldErrors(parsed.error, createTranslator("ar-XB")).from_name?.[0]?.startsWith(RLO)).toBe(true);
    for (const issue of parsed.error.issues) expect(createTranslator("en").has(issue.message), issue.message).toBe(true);
  });
});

describe("language-neutral facts", () => {
  it("writes salaries with the currency code untranslated and grouped digits", () => {
    const en = createTranslator("en");
    expect(salaryText({ currency: "SAR", min: 3500, max: 4500, period: "month" }, en)).toBe("SAR 3,500 – 4,500 / month");
  });

  it("formats dates per language, with Western digits", () => {
    expect(formatDate("2026-08-01", "en")).toBe("1 Aug 2026");
    expect(formatDate("2026-08-01", "ar")).toMatch(/1.*2026/);
  });

  it("names countries from CLDR by ISO code, not a hand translation", () => {
    expect(countryName("QA", "en")).toBe("Qatar");
    expect(countryName("AE", "en")).toBe("United Arab Emirates");
    const hindi = countryName("SA", "hi");
    expect(hindi).not.toBe("Saudi Arabia");
    expect(hindi.length).toBeGreaterThan(0);
  });

  it("writes a job in English, pseudo-localised only in the pseudo-locales, and never machine-translated", () => {
    const job = {
      title: "Accountant", summary: "Keeps the ledgers.", category: { slug: "accountant", name: "Accountant" }, city: "Riyadh",
      experience: null, education: null, languages: null, responsibilities: ["Ledgers"], requirements: [], benefits: [], additionalInfo: null,
    } as unknown as Parameters<typeof jobText>[0];
    expect(jobText(job, "hi").title).toBe("Accountant");
    expect(jobText(job, "en-XA").title).not.toBe("Accountant");
    expect(jobText(job, "en-XA").experience).toBeNull();
    expect(pathLocales("/jobs/accountant-gg-job-2026-00001")).toEqual(["en", "en-XA", "ar-XB"]);
    expect(multilingualPaths()["/jobs/accountant-gg-job-2026-00001"]).toBeUndefined();
  });
});
