import { z } from "zod";
import type { LocaleCode } from "@/lib/i18n/paths";
import { LOCALE_CODES } from "@/lib/i18n/routing.mjs";
import { isoDate, validate } from "./schema";

/**
 * The page registry: one place for every public page's title, description, breadcrumb
 * label, content date and sitemap entry. Metadata (lib/seo.ts), breadcrumbs and
 * sitemap.xml all read it, so they cannot drift apart.
 *
 * `updatedOn` is the date the page's VISIBLE CONTENT last changed — never the build
 * date. Update it when you change what a reader sees.
 *
 * Copy rule: titles and descriptions state only verified facts (content/company.ts).
 *
 * Languages (docs/I18N.md): the text here is the English source. `localizable` means the
 * page also has a route under app/[locale] and takes its interface words from the
 * catalogues; `locales` lists the languages whose version of the page has been reviewed —
 * English always, any other only once a native reviewer has signed it off. A translated
 * page's title, description and breadcrumb live in messages/<locale>.json under pages.<id>.
 */

const localeCode = z.custom<LocaleCode>((v) => typeof v === "string" && (LOCALE_CODES as string[]).includes(v), "Unknown locale code");

const page = z
  .object({
    /** Stable key for this page's translations (pages.<id> in the catalogues). */
    id: z.string().regex(/^[a-z0-9-]+$/),
    path: z.string().startsWith("/"),
    /** Page topic; the layout appends " — Go Gulf". Keep it short. */
    title: z.string().min(2).max(50),
    /** Replaces the whole <title> (home page only). */
    absoluteTitle: z.string().max(60).optional(),
    description: z.string().min(90).max(165),
    breadcrumb: z.string().min(2),
    updatedOn: isoDate,
    index: z.boolean(),
    sitemap: z.object({
      changeFrequency: z.enum(["daily", "weekly", "monthly", "yearly"]),
      priority: z.number().min(0).max(1),
    }).nullable(),
    localizable: z.boolean().default(false),
    locales: z.array(localeCode).default(["en"]),
  })
  .superRefine((p, ctx) => {
    if (!p.locales.includes("en")) ctx.addIssue({ code: "custom", message: "English is the source language, so locales must include en", path: ["locales"] });
    if (!p.localizable && p.locales.length > 1) ctx.addIssue({ code: "custom", message: "Only a localizable page can list other languages", path: ["locales"] });
  });

export type PageEntry = z.infer<typeof page>;

export const PAGES: PageEntry[] = validate(
  z.array(page).superRefine((list, ctx) => {
    const paths = new Set<string>();
    const ids = new Set<string>();
    list.forEach((p, i) => {
      if (paths.has(p.path)) ctx.addIssue({ code: "custom", message: `Duplicate path ${p.path}`, path: [i, "path"] });
      if (ids.has(p.id)) ctx.addIssue({ code: "custom", message: `Duplicate id ${p.id}`, path: [i, "id"] });
      paths.add(p.path);
      ids.add(p.id);
    });
  }),
  [
    {
      id: "home", path: "/", title: "Home", absoluteTitle: "Gulf Jobs from India — Go Gulf",
      description: "Explore Gulf jobs from India. Go Gulf counsels job seekers, helps prepare documents and refers them to registered recruiting agents. Lucknow, India.",
      breadcrumb: "Home", updatedOn: "2026-10-06", index: true, sitemap: { changeFrequency: "weekly", priority: 1 },
      localizable: true,
    },
    {
      id: "jobs", path: "/jobs", title: "Gulf job openings",
      description: "Current Gulf job openings listed by Go Gulf. Read what each role involves and apply online: applications go to the registered recruiting agent handling it.",
      breadcrumb: "Jobs", updatedOn: "2026-10-06", index: true, sitemap: { changeFrequency: "daily", priority: 0.9 },
      localizable: true,
    },
    {
      id: "apply", path: "/jobs/apply", title: "Apply for a Gulf job",
      description: "Apply online for a Gulf job with your CV and passport copy. Go Gulf passes suitable applications to the registered recruiting agent handling the job.",
      breadcrumb: "Apply", updatedOn: "2026-10-06", index: true, sitemap: { changeFrequency: "monthly", priority: 0.5 },
      localizable: true,
    },
    {
      id: "candidates", path: "/candidates", title: "For job seekers",
      description: "How Go Gulf helps you prepare for a Gulf job, what a registered recruiting agent does, the documents you need, and how fees are quoted.",
      breadcrumb: "Job seekers", updatedOn: "2026-10-06", index: true, sitemap: { changeFrequency: "monthly", priority: 0.7 },
      localizable: true,
    },
    {
      id: "employers", path: "/employers", title: "For employers",
      description: "Hiring from India for a Gulf operation? Go Gulf introduces your requirement to registered recruiting agents it works with. Tell us what you need.",
      breadcrumb: "Employers", updatedOn: "2026-10-06", index: true, sitemap: { changeFrequency: "monthly", priority: 0.7 },
      localizable: true,
    },
    {
      id: "services", path: "/services", title: "Services",
      description: "Counselling, profile and document preparation for Gulf job seekers, and introductions to registered recruiting agents for employers hiring from India.",
      breadcrumb: "Services", updatedOn: "2026-10-06", index: true, sitemap: { changeFrequency: "monthly", priority: 0.6 },
      localizable: true,
    },
    {
      id: "about", path: "/about", title: "About Go Gulf",
      description: "Who runs Go Gulf: Faizan Chaudhary Gulf Travels Private Limited, a private limited company incorporated in India, with its registered office in Lucknow.",
      breadcrumb: "About", updatedOn: "2026-10-06", index: true, sitemap: { changeFrequency: "monthly", priority: 0.6 },
      localizable: true,
    },
    {
      id: "contact", path: "/contact", title: "Contact Go Gulf",
      description: "Phone, WhatsApp and email for Go Gulf: one route for job seekers and one for employers, with a contact form that reaches the right team.",
      breadcrumb: "Contact", updatedOn: "2026-10-06", index: true, sitemap: { changeFrequency: "monthly", priority: 0.5 },
      localizable: true,
    },
    {
      id: "verify", path: "/verify", title: "Verify Go Gulf",
      description: "How to check you are dealing with Go Gulf: company registration, official contacts, payment rules and how we work with registered recruiting agents.",
      breadcrumb: "Verify Go Gulf", updatedOn: "2026-10-06", index: true, sitemap: { changeFrequency: "monthly", priority: 0.5 },
      localizable: true,
    },
    {
      id: "pricing", path: "/pricing", title: "Pricing & fees",
      description: "How any Go Gulf fee is quoted in writing before you pay, what it covers, and how a registered recruiting agent's statutory service charge is paid.",
      breadcrumb: "Pricing & fees", updatedOn: "2026-10-06", index: true, sitemap: { changeFrequency: "yearly", priority: 0.4 },
    },
    {
      id: "privacy-policy", path: "/privacy-policy", title: "Privacy policy",
      description: "What personal information Go Gulf collects, how it is used, when it is shared with registered recruiting agents and employers, and your rights.",
      breadcrumb: "Privacy policy", updatedOn: "2026-10-06", index: true, sitemap: { changeFrequency: "yearly", priority: 0.3 },
    },
    {
      id: "terms-and-conditions", path: "/terms-and-conditions", title: "Terms & conditions",
      description: "The terms for using Go Gulf's website and services: counselling, preparation and referral to registered recruiting agents, with no outcome promised.",
      breadcrumb: "Terms & conditions", updatedOn: "2026-10-06", index: true, sitemap: { changeFrequency: "yearly", priority: 0.3 },
    },
    {
      id: "cancellation-and-refunds", path: "/cancellation-and-refunds", title: "Cancellation & refunds",
      description: "How to cancel a Go Gulf service request, when a refund is normally available and when it is not, and how approved refunds are paid.",
      breadcrumb: "Cancellation & refunds", updatedOn: "2026-10-06", index: true, sitemap: { changeFrequency: "yearly", priority: 0.3 },
    },
    {
      id: "shipping-policy", path: "/shipping-policy", title: "Shipping & delivery",
      description: "Go Gulf sells no physical goods. How its services are delivered to you instead, and how any physical documents are handled.",
      breadcrumb: "Shipping & delivery", updatedOn: "2026-10-06", index: true, sitemap: { changeFrequency: "yearly", priority: 0.3 },
    },
  ],
  "content/pages.ts",
);

export function pageEntry(path: string): PageEntry {
  const entry = PAGES.find((p) => p.path === path);
  if (!entry) throw new Error(`No page registry entry for ${path} (content/pages.ts)`);
  return entry;
}
