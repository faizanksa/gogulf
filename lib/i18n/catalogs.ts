import ar from "@/messages/ar.json";
import bn from "@/messages/bn.json";
import en from "@/messages/en.json";
import hi from "@/messages/hi.json";
import ml from "@/messages/ml.json";
import ta from "@/messages/ta.json";
import type { LocaleCode } from "./paths";

/**
 * The translation catalogues, one ICU MessageFormat JSON file per language in messages/.
 *
 * English is the source: every string is written there first, and its key set is the
 * contract every other catalogue follows. A catalogue is PUBLISHED — its routes built,
 * listed in hreflang and the sitemap — only once its `$meta.status` is "reviewed",
 * recording who reviewed it and when. Nothing is machine-translated at request time.
 *
 * Server-side only by convention: Client Components receive finished strings as props,
 * so no catalogue and no formatter reaches the browser.
 */

export type CatalogStatus = "source" | "not-started" | "in-translation" | "in-review" | "reviewed";

export interface CatalogMeta {
  locale: string;
  status: CatalogStatus;
  reviewedBy?: string | null;
  reviewedOn?: string | null;
  note?: string;
}

export type MessageTree = { [key: string]: string | MessageTree };
type RawCatalog = MessageTree & { $meta?: CatalogMeta };

export const CATALOGS: Record<LocaleCode, RawCatalog> = {
  en: en as unknown as RawCatalog,
  hi: hi as unknown as RawCatalog,
  ar: ar as unknown as RawCatalog,
  ml: ml as unknown as RawCatalog,
  ta: ta as unknown as RawCatalog,
  bn: bn as unknown as RawCatalog,
};

export function catalogMeta(locale: LocaleCode): CatalogMeta {
  const meta = CATALOGS[locale].$meta;
  if (!meta) throw new Error(`messages/${locale}.json has no $meta block`);
  return meta;
}

/** A language is published when its catalogue is the source or has a recorded review. */
export function isCatalogPublished(locale: LocaleCode): boolean {
  const { status, reviewedBy, reviewedOn } = catalogMeta(locale);
  return status === "source" || (status === "reviewed" && Boolean(reviewedBy) && Boolean(reviewedOn));
}

/** Every leaf key of a catalogue, as dotted paths ("nav.jobs"). `$meta` is not a key. */
export function catalogKeys(tree: MessageTree, prefix = ""): string[] {
  return Object.entries(tree).flatMap(([k, v]) => {
    if (k === "$meta") return [];
    const path = prefix ? `${prefix}.${k}` : k;
    return typeof v === "string" ? [path] : catalogKeys(v, path);
  });
}

export function lookup(tree: MessageTree, key: string): string | undefined {
  let node: string | MessageTree | undefined = tree;
  for (const part of key.split(".")) {
    if (typeof node !== "object" || node === null) return undefined;
    node = node[part];
  }
  return typeof node === "string" ? node : undefined;
}
