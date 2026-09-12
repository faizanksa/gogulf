import type { MetadataRoute } from "next";
import { openJobs } from "@/content/jobs";
import { PAGES } from "@/content/pages";
import { hreflangAlternates, isPseudo, localizedPath, type AnyLocale } from "@/lib/i18n/locales";
import { jobLocales, pageLocales } from "@/lib/i18n/pages";
import { absoluteUrl } from "@/lib/seo";

/**
 * sitemap.xml from the page registry and the job listings.
 *
 * `lastModified` is each page's content date (content/pages.ts) — never the build date,
 * which claimed every page changed on every deploy. Only indexable pages are listed;
 * only confirmed, open jobs get a URL. Regenerated hourly so closed jobs drop out on
 * their closing date without a deploy.
 *
 * Languages: a page available in several languages gets one entry per language, each
 * listing all of them as hreflang alternates (x-default: English). Pseudo-locales never
 * appear. While English is the only published language this adds nothing.
 */
export const revalidate = 3600;

type Entry = Omit<MetadataRoute.Sitemap[number], "url" | "alternates">;

function entries(path: string, locales: AnyLocale[], entry: Entry): MetadataRoute.Sitemap {
  const real = locales.filter((l) => !isPseudo(l));
  const languages = hreflangAlternates(path, real);
  const alternates = languages
    ? { alternates: { languages: Object.fromEntries(Object.entries(languages).map(([tag, href]) => [tag, absoluteUrl(href)])) } }
    : {};
  return real.map((l) => ({ url: absoluteUrl(localizedPath(path, l)), ...entry, ...alternates }));
}

export default function sitemap(): MetadataRoute.Sitemap {
  const jobs = openJobs().filter((j) => j.verification === "confirmed");
  const newestJob = jobs.map((j) => j.updatedOn).sort().pop();

  const pages = PAGES.filter((p) => p.index && p.sitemap).flatMap((p) =>
    entries(p.path, pageLocales(p), {
      lastModified: p.path === "/jobs" && newestJob && newestJob > p.updatedOn ? newestJob : p.updatedOn,
      changeFrequency: p.sitemap!.changeFrequency,
      priority: p.sitemap!.priority,
    }),
  );

  const jobPages = jobs.flatMap((j) =>
    entries(`/jobs/${j.slug}`, jobLocales(j), { lastModified: j.updatedOn, changeFrequency: "weekly", priority: 0.8 }),
  );

  return [...pages, ...jobPages];
}
