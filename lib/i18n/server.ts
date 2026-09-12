import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { locale as rootLocale } from "next/root-params";
import { pageMetadata } from "@/lib/seo";
import { DEFAULT, isActiveLocale, type AnyLocale } from "./locales";
import { isAvailableIn } from "./pages";
import { createTranslator, type Translator } from "./translator";

/**
 * The current request's locale, for any Server Component or server utility — read from
 * the [locale] root segment with next/root-params, so nothing is passed down as props.
 *
 * The English site (app/(marketing)), /admin, /portal and the global 404 have no locale
 * segment: the getter returns undefined there, which means English.
 *
 * This never throws. It runs in root layouts and the site shell, where a notFound() has
 * no boundary to land in and would replace the page with Next's bare error document. An
 * unknown segment therefore reads as English here, and the page beneath it returns the
 * 404 (requireAvailable).
 */
export async function currentLocale(): Promise<AnyLocale> {
  const value = await rootLocale();
  return isActiveLocale(value) ? value : DEFAULT;
}

export async function getTranslator(): Promise<Translator> {
  return createTranslator(await currentLocale());
}

/** A registered page's metadata in the current language: canonical, hreflang, Open Graph locale. */
export async function localizedPageMetadata(path: string): Promise<Metadata> {
  return pageMetadata(path, await currentLocale());
}

/**
 * For a page served both in English and under app/[locale]: a 404 unless the language
 * segment is an active language and `path` exists in it. Returns that language. Call it
 * from the page, not a layout, so the 404 renders inside the site shell.
 */
export async function requireAvailable(path: string): Promise<AnyLocale> {
  const value = await rootLocale();
  if (value !== undefined && !isActiveLocale(value)) notFound();
  const locale = value === undefined ? DEFAULT : (value as AnyLocale);
  if (!isAvailableIn(path, locale)) notFound();
  return locale;
}
