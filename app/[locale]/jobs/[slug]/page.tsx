import { isActiveLocale } from "@/lib/i18n/locales";
import { jobSlugsIn } from "@/lib/i18n/pages";

/**
 * /<locale>/jobs/<slug> — a job page in another language. One implementation, in
 * app/(marketing)/jobs/[slug]/page.tsx. Built only for jobs with a reviewed translation
 * into this language (content/jobs.ts), and for every job in the pseudo-locales.
 */
export { default, generateMetadata } from "@/app/(marketing)/jobs/[slug]/page";

export const dynamicParams = false;
export const revalidate = 3600;

/**
 * The language comes from the parent's params (a plain object), not the next/root-params
 * getter. In production no language is published, so the [locale] layout generates no
 * params, and Next still calls this once without one: the getter throws there and fails
 * the build (found by `npm run build:production-stage`, 12 Sep 2026).
 */
export function generateStaticParams({ params }: { params?: { locale?: string } }) {
  const value = params?.locale;
  return isActiveLocale(value) ? jobSlugsIn(value).map((slug) => ({ slug })) : [];
}
