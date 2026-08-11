// ===== GO GULF — SEO constants & helpers =====
// Central source of truth for site-wide SEO facts (URL, brand, contact, social).
// Used by app/layout.js, app/robots.js, app/sitemap.js, app/manifest.js and
// every page's `metadata` export + JSON-LD structured data.
//
// To point the site at a different domain (staging, a rebrand, etc.), set
// NEXT_PUBLIC_SITE_URL in .env.local — everything below picks it up at build
// time. No env var is required for production; it falls back to gogulf.co.

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.gogulf.co").replace(/\/+$/, "");
export const SITE_NAME = "Go Gulf";
export const SITE_TAGLINE = "Go Gulf. Get Hired.";
export const DEFAULT_DESCRIPTION =
  "Go Gulf is a modern overseas recruitment platform connecting talented professionals with verified Gulf employers across Saudi Arabia, UAE, Qatar, Oman, Kuwait and Bahrain.";

export const OG_IMAGE = { url: "/assets/og-image.jpg", width: 1200, height: 630 };

export const CONTACT = {
  whatsappApply: "+91 95171 08866",
  whatsappApplyHref: "https://wa.me/919517108866",
  inquiryPhone: "+91 99353 09015",
  inquiryPhoneHref: "tel:+919935309015",
  jobsEmail: "jobs@gogulf.co",
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

export const ORG_OFFICES = [
  { name: "Registered Office", locality: undefined, country: "IN" },
  { name: "Corporate Office", locality: "Sharjah", country: "AE" },
  { name: "Marketing Office", locality: "Jeddah", country: "SA" },
];

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
        description: DEFAULT_DESCRIPTION,
        slogan: SITE_TAGLINE,
        url: SITE_URL,
        logo: absoluteUrl("/assets/go-gulf-logo.png"),
        image: absoluteUrl(OG_IMAGE.url),
        foundingDate: "2008",
        sameAs: SAME_AS,
        email: [CONTACT.jobsEmail, CONTACT.businessEmail],
        telephone: CONTACT.inquiryPhone,
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
            ...(office.locality ? { addressLocality: office.locality } : {}),
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
