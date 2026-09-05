// ===== GO GULF — SEO constants & helpers =====
// Central source of truth for site-wide SEO facts (URL, brand, contact, social).
// Used by app/layout.js, app/robots.js, app/sitemap.js, app/manifest.js and
// every page's `metadata` export + JSON-LD structured data.
//
// To point the site at a different domain (staging, a rebrand, etc.), set
// NEXT_PUBLIC_SITE_URL in .env.local — everything below picks it up at build
// time. No env var is required for production; it falls back to gogulf.co.

import { LEGAL_ENTITY, REGISTERED_ADDRESS } from "@/lib/legal";

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.gogulf.co").replace(/\/+$/, "");
export const SITE_NAME = "Go Gulf";
export const SITE_TAGLINE = "Go Gulf. Get Hired.";
export const DEFAULT_DESCRIPTION =
  "Go Gulf is a modern overseas recruitment platform connecting talented professionals with verified Gulf employers across Saudi Arabia, UAE, Qatar, Oman, Kuwait and Bahrain.";

export const OG_IMAGE = { url: "/assets/og-image.jpg", width: 1200, height: 630 };

export const CONTACT = {
  whatsappApply: "+91 99363 09015",
  whatsappApplyHref: "https://wa.me/919936309015",
  inquiryPhone: "+91 99363 09015",
  inquiryPhoneHref: "tel:+919936309015",
  jobsEmail: "careers@gogulf.co",
  businessEmail: "business@gogulf.co",
};

export const SAME_AS = [
  "https://facebook.com/gogulf8866",
  "https://instagram.com/gogulf8866",
  "https://x.com/gogulf8866",
  "https://linkedin.com/company/gogulf8866",
  "https://tiktok.com/@gogulf8866",
  "https://www.youtube.com/@GoGulf8866",
  "https://whatsapp.com/channel/0029Vaa7XJ4FSAt7ri2W4W2J",
];

// ISO 3166-1 alpha-2 codes for the six Gulf countries Go Gulf places candidates into.
export const GULF_COUNTRIES = {
  "Saudi Arabia": "SA",
  "United Arab Emirates": "AE",
  "Qatar": "QA",
  "Oman": "OM",
  "Kuwait": "KW",
  "Bahrain": "BH",
};

// Go Gulf operates from one location: the operating company's GST-registered
// principal place of business (see lib/legal.js) — the same address shown on
// Contact, in the footer and on every legal page, so structured data and page
// text agree. Do not add offices here that the company is not registered at.
export const ORG_OFFICES = [
  {
    name: "Registered Office",
    street: REGISTERED_ADDRESS.lines.join(", "),
    locality: REGISTERED_ADDRESS.locality,
    region: REGISTERED_ADDRESS.region,
    postalCode: REGISTERED_ADDRESS.postalCode,
    country: REGISTERED_ADDRESS.countryCode,
  },
];

/** schema.org PostalAddress for the registered office. */
export function registeredPostalAddress() {
  return {
    "@type": "PostalAddress",
    streetAddress: REGISTERED_ADDRESS.lines.join(", "),
    addressLocality: REGISTERED_ADDRESS.locality,
    addressRegion: REGISTERED_ADDRESS.region,
    postalCode: REGISTERED_ADDRESS.postalCode,
    addressCountry: REGISTERED_ADDRESS.countryCode,
  };
}

/** Resolve a site-relative path to a fully-qualified https://www.gogulf.co/... URL. */
export function absoluteUrl(path = "/") {
  return new URL(path, SITE_URL + "/").toString();
}

/**
 * Build a page's `metadata` export: title, description, canonical, Open Graph
 * and Twitter card — all consistent, all derived from the same two inputs.
 * Page-level opengraph/twitter blocks fully replace (not merge with) the
 * layout's, so every indexable page calls this rather than only setting `title`.
 */
export function pageMetadata({ title, description, path, noIndex = false }) {
  const desc = description || DEFAULT_DESCRIPTION;
  const ogTitle = title ? `${title} — ${SITE_NAME}` : `${SITE_NAME} — ${SITE_TAGLINE}`;

  return {
    // Omit the key entirely (rather than passing `undefined`) when no title is
    // given, so the page falls through to the layout's `title.default`.
    ...(title ? { title } : {}),
    description: desc,
    alternates: { canonical: path },
    openGraph: {
      title: ogTitle,
      description: desc,
      url: path,
      siteName: SITE_NAME,
      type: "website",
      locale: "en_US",
      images: [{ ...OG_IMAGE, alt: `${SITE_NAME} — ${SITE_TAGLINE}` }],
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description: desc,
      images: [OG_IMAGE.url],
    },
    ...(noIndex ? { robots: { index: false, follow: true } } : {}),
  };
}

/** JSON-LD for a simple Home > ... breadcrumb trail. `items` excludes Home. */
export function breadcrumbJsonLd(items) {
  const trail = [{ name: "Home", path: "/" }, ...items];
  return {
    "@type": "BreadcrumbList",
    itemListElement: trail.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

// Sitewide entity graph — injected once in the root layout so every page
// carries the same Organization + WebSite identity for search engines and AI
// answer engines (ChatGPT, Perplexity, Gemini, etc.) to key off of.
export function siteJsonLdGraph() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "EmploymentAgency",
        "@id": `${SITE_URL}/#organization`,
        name: SITE_NAME,
        alternateName: "Go Gulf Recruitment",
        // The operating company behind the Go Gulf brand — stated so the
        // entity a customer transacts with is machine-readable too, not only
        // rendered in the footer and the legal pages.
        legalName: LEGAL_ENTITY.name,
        taxID: LEGAL_ENTITY.gstin,
        vatID: LEGAL_ENTITY.gstin,
        description: DEFAULT_DESCRIPTION,
        slogan: SITE_TAGLINE,
        url: SITE_URL,
        logo: absoluteUrl("/assets/go-gulf-logo.png"),
        image: absoluteUrl(OG_IMAGE.url),
        foundingDate: "2008",
        sameAs: SAME_AS,
        email: [CONTACT.jobsEmail, CONTACT.businessEmail],
        telephone: CONTACT.inquiryPhone,
        address: registeredPostalAddress(),
        areaServed: Object.entries(GULF_COUNTRIES).map(([name, code]) => ({
          "@type": "Country",
          name,
          identifier: code,
        })),
        location: ORG_OFFICES.map((office) => ({
          "@type": "Place",
          name: office.name,
          address: {
            "@type": "PostalAddress",
            ...(office.street ? { streetAddress: office.street } : {}),
            ...(office.locality ? { addressLocality: office.locality } : {}),
            ...(office.region ? { addressRegion: office.region } : {}),
            ...(office.postalCode ? { postalCode: office.postalCode } : {}),
            addressCountry: office.country,
          },
        })),
        contactPoint: [
          {
            "@type": "ContactPoint",
            contactType: "candidate applications",
            telephone: CONTACT.whatsappApply,
            email: CONTACT.jobsEmail,
            areaServed: Object.values(GULF_COUNTRIES),
            availableLanguage: ["en"],
          },
          {
            "@type": "ContactPoint",
            contactType: "sales",
            telephone: CONTACT.inquiryPhone,
            email: CONTACT.businessEmail,
            areaServed: Object.values(GULF_COUNTRIES),
            availableLanguage: ["en"],
          },
        ],
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: SITE_NAME,
        description: DEFAULT_DESCRIPTION,
        publisher: { "@id": `${SITE_URL}/#organization` },
        inLanguage: "en",
      },
    ],
  };
}
