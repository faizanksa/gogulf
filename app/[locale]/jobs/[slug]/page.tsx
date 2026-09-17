import { isActiveLocale } from "@/lib/i18n/locales";
import { jobLocales } from "@/lib/i18n/pages";
import { listOpenJobs } from "@/lib/jobs/public-data";

/**
 * /<locale>/jobs/<slug> — a job page in another language. One implementation, in
 * app/(marketing)/jobs/[slug]/page.tsx. Jobs are written in English and have no reviewed
 * translations yet, so only the pseudo-locales (outside production) have job pages.
 */
export { default, generateMetadata } from "@/app/(marketing)/jobs/[slug]/page";

export const revalidate = 600;

/**
 * app/[locale]/layout.tsx sets dynamicParams = false, and that wins over this segment: a
 * slug not listed here is a 404 (found by the e2e suite, 17 Sep 2026). So the open jobs
 * are listed at build, for the languages that have job pages. A job published after the
 * build gets its pseudo-locale page at the next deploy; its English page, which is what
 * the public uses, is generated on request at once.
 *
 * The language comes from the parent's params (a plain object), not the next/root-params
 * getter, which throws when Next calls this without one.
 */
export async function generateStaticParams({ params }: { params?: { locale?: string } }) {
  const value = params?.locale;
  if (!isActiveLocale(value) || !jobLocales().includes(value)) return [];
  return (await listOpenJobs()).map((job) => ({ slug: job.slug }));
}
