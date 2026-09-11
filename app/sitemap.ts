import type { MetadataRoute } from "next";
import { openJobs } from "@/content/jobs";
import { PAGES } from "@/content/pages";
import { absoluteUrl } from "@/lib/seo";

/**
 * sitemap.xml from the page registry and the job listings.
 *
 * `lastModified` is each page's content date (content/pages.ts) — never the build date,
 * which claimed every page changed on every deploy. Only indexable pages are listed;
 * only confirmed, open jobs get a URL. Regenerated hourly so closed jobs drop out on
 * their closing date without a deploy.
 */
export const revalidate = 3600;

export default function sitemap(): MetadataRoute.Sitemap {
  const jobs = openJobs().filter((j) => j.verification === "confirmed");
  const newestJob = jobs.map((j) => j.updatedOn).sort().pop();

  const pages = PAGES.filter((p) => p.index && p.sitemap).map((p) => ({
    url: absoluteUrl(p.path),
    lastModified: p.path === "/jobs" && newestJob && newestJob > p.updatedOn ? newestJob : p.updatedOn,
    changeFrequency: p.sitemap!.changeFrequency,
    priority: p.sitemap!.priority,
  }));

  const jobPages = jobs.map((j) => ({
    url: absoluteUrl(`/jobs/${j.slug}`),
    lastModified: j.updatedOn,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  return [...pages, ...jobPages];
}
