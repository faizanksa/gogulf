import type { Metadata } from "next";
import { BUSINESS_EMAIL, CAREERS_EMAIL, CONFIRMED_SOCIAL, PHONE, WHATSAPP } from "@/content/channels";
import { COMPANY } from "@/content/company";
import { pageEntry } from "@/content/pages";
import { TRAVEL_PUBLISHED } from "@/content/travel";
import { DEFAULT, hreflangAlternates, isPseudo, localizedPath, LOCALES, type AnyLocale } from "@/lib/i18n/locales";
import { pageLocales, pageText } from "@/lib/i18n/pages";

/**
 * SEO: metadata and structured data, derived from the content layer.
 *
 * Structured-data rule (docs/REDESIGN-PLAN.md §12): every claim must match visible,
 * verified information. So the Organization node carries the MCA facts and confirmed
 * contact points only — no GSTIN (certificate pending, D8), no social profiles until
 * confirmed, no countries served, no heritage date. foundingDate is the incorporation
 * date. TravelAgency is added only when a confirmed travel service is published.
 */

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.gogulf.co").replace(/\/+$/, "");
export const SITE_NAME = "Go Gulf";
export const SITE_TAGLINE = COMPANY.tagline;
export const DEFAULT_DESCRIPTION =
  "Go Gulf, a brand of Faizan Chaudhary Gulf Travels Private Limited in Lucknow, lists Gulf job openings and takes enquiries from job seekers and employers.";
export const LOGO_PATH = "/brand/logo-512.png";

/** Contact details in the shape older components read; derived from content/channels.ts. */
export const CONTACT = {
  whatsappApply: WHATSAPP.value,
  whatsappApplyHref: WHATSAPP.href,
  inquiryPhone: PHONE.value,
  inquiryPhoneHref: PHONE.href,
  jobsEmail: CAREERS_EMAIL.value,
  businessEmail: BUSINESS_EMAIL.value,
};

export function absoluteUrl(path = "/"): string {
  return new URL(path, `${SITE_URL}/`).toString();
}

interface MetadataInput {
  /** The page's English path ("/jobs/<slug>"); the canonical URL adds the language prefix. */
  path: string;
  title: string;
  description: string;
  /** Replaces the whole <title> instead of using the "%s — Go Gulf" template. */
  absoluteTitle?: string;
  noIndex?: boolean;
  locale?: AnyLocale;
  /** hreflang alternates (lib/i18n/locales.ts hreflangAlternates); omitted for single-language pages. */
  languages?: Record<string, string>;
}

/**
 * The share images rendered by app/opengraph-image.tsx and app/twitter-image.tsx. Keep
 * the alt text and size in step with the `alt` and `size` those files export.
 */
const SHARE_IMAGE = {
  alt: `${SITE_NAME} — a brand of ${COMPANY.legalName}, Lucknow, India`,
  width: 1200,
  height: 630,
};
const OG_IMAGES = [{ url: "/opengraph-image", ...SHARE_IMAGE }];
const TWITTER_IMAGES = [{ url: "/twitter-image", ...SHARE_IMAGE }];

/**
 * Title, description, canonical, Open Graph and X card from one set of inputs.
 *
 * The share images are named here on purpose. Next merges metadata shallowly: a page
 * that sets its own `openGraph` or `twitter` object replaces the parent's whole object,
 * including the images the app/opengraph-image file convention would have supplied.
 */
export function buildMetadata({ path, title, description, absoluteTitle, noIndex = false, locale = DEFAULT, languages }: MetadataInput): Metadata {
  const socialTitle = absoluteTitle ?? `${title} — ${SITE_NAME}`;
  const url = localizedPath(path, locale);
  return {
    title: absoluteTitle ? { absolute: absoluteTitle } : title,
    description,
    alternates: { canonical: url, ...(languages ? { languages } : {}) },
    openGraph: { title: socialTitle, description, url, siteName: SITE_NAME, type: "website", locale: LOCALES[locale].ogLocale, images: OG_IMAGES },
    twitter: { card: "summary_large_image", title: socialTitle, description, images: TWITTER_IMAGES },
    // Pseudo-locales exist only outside production, but are never indexable anywhere.
    ...(noIndex || isPseudo(locale) ? { robots: { index: false, follow: true } } : {}),
  };
}

/** Metadata for a registered page (content/pages.ts) in `locale` — English by default. */
export function pageMetadata(path: string, locale: AnyLocale = DEFAULT): Metadata {
  const entry = pageEntry(path);
  const text = pageText(entry, locale);
  return buildMetadata({
    path: entry.path,
    title: text.title,
    description: text.description,
    absoluteTitle: text.absoluteTitle,
    noIndex: !entry.index,
    locale,
    languages: hreflangAlternates(entry.path, pageLocales(entry)),
  });
}

// ---------------------------------------------------------------------------
// Structured data
// ---------------------------------------------------------------------------

export interface Crumb {
  name: string;
  path: string;
}

/**
 * BreadcrumbList for Home › …; `items` excludes Home. Rendered by components/ui/Breadcrumbs,
 * which passes the translated Home crumb and the paths each link actually points to.
 */
export function breadcrumbJsonLd(items: Crumb[], home: Crumb = { name: "Home", path: "/" }) {
  const trail = [home, ...items];
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function postalAddress() {
  return {
    "@type": "PostalAddress",
    streetAddress: COMPANY.address.lines.join(", "),
    addressLocality: COMPANY.address.locality,
    addressRegion: COMPANY.address.region,
    postalCode: COMPANY.address.postalCode,
    addressCountry: COMPANY.address.countryCode,
  };
}

export function organizationJsonLd() {
  const sameAs = CONFIRMED_SOCIAL.map((c) => c.href);
  return {
    "@type": TRAVEL_PUBLISHED ? ["EmploymentAgency", "TravelAgency"] : "EmploymentAgency",
    "@id": `${SITE_URL}/#organization`,
    name: SITE_NAME,
    legalName: COMPANY.legalName,
    url: SITE_URL,
    logo: { "@type": "ImageObject", url: absoluteUrl(LOGO_PATH), width: 512, height: 512 },
    image: absoluteUrl("/opengraph-image"),
    slogan: SITE_TAGLINE,
    description: DEFAULT_DESCRIPTION,
    identifier: { "@type": "PropertyValue", propertyID: "CIN", value: COMPANY.cin },
    foundingDate: COMPANY.incorporationISO,
    address: postalAddress(),
    telephone: PHONE.value,
    email: [CAREERS_EMAIL.value, BUSINESS_EMAIL.value],
    contactPoint: [
      { "@type": "ContactPoint", contactType: "job seekers", telephone: WHATSAPP.value, email: CAREERS_EMAIL.value },
      { "@type": "ContactPoint", contactType: "employers", telephone: PHONE.value, email: BUSINESS_EMAIL.value },
    ],
    ...(sameAs.length ? { sameAs } : {}),
  };
}

export function websiteJsonLd() {
  return {
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    url: SITE_URL,
    name: SITE_NAME,
    publisher: { "@id": `${SITE_URL}/#organization` },
    inLanguage: "en-IN",
  };
}

/** The sitewide graph, rendered once by the marketing layout. */
export function siteJsonLdGraph() {
  return { "@context": "https://schema.org", "@graph": [organizationJsonLd(), websiteJsonLd()] };
}
