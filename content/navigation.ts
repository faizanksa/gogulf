import type { MessageKey } from "@/lib/i18n/translator";
import { LEGAL_PAGES } from "@/lib/legal";
import { TRAVEL_PUBLISHED } from "./travel";

/**
 * Site navigation. Labels are catalogue keys (messages/en.json), translated by the
 * header and footer; hrefs are English paths, pointed at the reader's language where the
 * page exists in it (lib/i18n/pages.ts hrefIn).
 */
export interface NavItem {
  href: string;
  label: MessageKey;
}

/** Primary navigation. Travel appears only once a confirmed travel service exists. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/jobs", label: "nav.jobs" },
  { href: "/candidates", label: "nav.jobSeekers" },
  { href: "/employers", label: "nav.employers" },
  ...(TRAVEL_PUBLISHED ? [{ href: "/travel", label: "nav.travel" } satisfies NavItem] : []),
  { href: "/about", label: "nav.about" },
  { href: "/contact", label: "nav.contact" },
];

/** The one primary action in the header. */
export const PRIMARY_CTA: NavItem = { href: "/jobs", label: "nav.findAJob" };

export const FOOTER_GROUPS: { heading: MessageKey; links: NavItem[] }[] = [
  {
    heading: "footer.groups.jobSeekers",
    links: [
      { href: "/jobs", label: "footer.links.currentJobs" },
      { href: "/candidates", label: "footer.links.howItWorks" },
      { href: "/jobs/apply", label: "footer.links.applyOnline" },
      { href: "/pricing", label: "footer.links.pricing" },
    ],
  },
  {
    heading: "footer.groups.employers",
    links: [
      { href: "/employers", label: "footer.links.hireFromIndia" },
      { href: "/services", label: "footer.links.allServices" },
    ],
  },
  {
    heading: "footer.groups.company",
    links: [
      { href: "/about", label: "footer.links.aboutGoGulf" },
      { href: "/verify", label: "footer.links.verify" },
      { href: "/contact", label: "footer.links.contact" },
    ],
  },
];

const LEGAL_LABELS: Record<string, MessageKey> = {
  "/privacy-policy": "footer.links.privacyPolicy",
  "/terms-and-conditions": "footer.links.terms",
  "/pricing": "footer.links.pricingFees",
  "/cancellation-and-refunds": "footer.links.refunds",
  "/shipping-policy": "footer.links.shipping",
};

/** The policy pages, in lib/legal.js order. A unit test checks every one has a label. */
export const LEGAL_LINKS: NavItem[] = (LEGAL_PAGES as { path: string }[]).map((p) => ({
  href: p.path,
  label: LEGAL_LABELS[p.path] as MessageKey,
}));
