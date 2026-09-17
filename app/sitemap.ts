import type { MetadataRoute } from "next";
import { PAGES } from "@/content/pages";
import { hreflangAlternates, isPseudo, localizedPath, type AnyLocale } from "@/lib/i18n/locales";
import { jobLocales, pageLocales } from "@/lib/i18n/pages";
import { indianDateOf } from "@/lib/jobs/model";
import { listOpenJobs } from "@/lib/jobs/public-data";
import { absoluteUrl } from "@/lib/seo";

/**
 * sitemap.xml from the page registry and the job listings.
 *
 * `lastModified` is each page's content date (content/pages.ts) — never the build date,
 * which claimed every page changed on every deploy. Only indexable pages are listed;
 * only published jobs that are accepting applications get a URL — never a draft, a job
 * in review, a closed or archived job, or one past its closing date. Regenerated hourly,
 * and on every staff change to a job, so a closed job drops out without a deploy.
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

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const jobs = await listOpenJobs();
  const newestJob = jobs.map((j) => indianDateOf(j.updatedAt)).sort().pop();

  const pages = PAGES.filter((p) => p.index && p.sitemap).flatMap((p) =>
    entries(p.path, pageLocales(p), {
      lastModified: p.path === "/jobs" && newestJob && newestJob > p.updatedOn ? newestJob : p.updatedOn,
      changeFrequency: p.sitemap!.changeFrequency,
      priority: p.sitemap!.priority,
    }),
  );

  const jobPages = jobs.flatMap((j) =>
    entries(`/jobs/${j.slug}`, jobLocales(), { lastModified: indianDateOf(j.updatedAt), changeFrequency: "weekly", priority: 0.8 }),
  );

  return [...pages, ...jobPages];
}
