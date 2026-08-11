import { jobs } from "@/lib/jobs-data";
import { absoluteUrl } from "@/lib/seo";

// Static export ⇒ this runs once at build time and is written to
// out/sitemap.xml — no server, no per-request cost.
// Note: unlike page `metadata`, sitemap.js is NOT affected by metadataBase —
// every <loc> must be built into a fully-qualified URL by hand.
const STATIC_ROUTES = [
  { url: "/", changeFrequency: "weekly", priority: 1.0 },
  { url: "/about", changeFrequency: "monthly", priority: 0.6 },
  { url: "/services", changeFrequency: "monthly", priority: 0.7 },
  { url: "/jobs", changeFrequency: "daily", priority: 0.9 },
  { url: "/jobs/apply", changeFrequency: "monthly", priority: 0.4 },
  { url: "/candidates", changeFrequency: "monthly", priority: 0.7 },
  { url: "/employers", changeFrequency: "monthly", priority: 0.7 },
  { url: "/contact", changeFrequency: "monthly", priority: 0.5 },
];

// Required for `output: 'export'` — without this Next.js can't tell the route
// is static and the build fails.
export const dynamic = "force-static";

function latestJobPostedDate() {
  const dates = jobs.map((j) => new Date(j.posted)).filter((d) => !Number.isNaN(d.getTime()));
  return dates.length ? new Date(Math.max(...dates)) : new Date();
}

export default function sitemap() {
  const buildDate = new Date();
  const jobsLastMod = latestJobPostedDate();

  return STATIC_ROUTES.map((route) => ({
    url: absoluteUrl(route.url),
    lastModified: route.url === "/jobs" ? jobsLastMod : buildDate,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
