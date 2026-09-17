/**
 * URL-driven lists in the staff workspace: search, filters and pagination live in the
 * query string, so a filtered list is a link that can be shared, reloaded and
 * bookmarked, and the back button works. Pure functions, unit-tested.
 *
 * Every value from the URL is untrusted. Filters outside their vocabulary are ignored
 * rather than passed to a query, and free text is trimmed, bounded and stripped of the
 * characters PostgREST's filter grammar gives meaning to.
 */

export const PAGE_SIZE = 25;

export type SearchParams = Record<string, string | string[] | undefined>;

export function first(params: SearchParams, key: string): string {
  const value = params[key];
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

/** A 1-based page number; anything else is page 1. */
export function pageOf(params: SearchParams): number {
  const n = Number(first(params, "page"));
  return Number.isInteger(n) && n >= 1 && n <= 10_000 ? n : 1;
}

/** Inclusive row range for PostgREST's range(from, to). */
export function rangeOf(page: number, size: number = PAGE_SIZE): { from: number; to: number } {
  const from = (page - 1) * size;
  return { from, to: from + size - 1 };
}

export function pageCount(total: number, size: number = PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / size));
}

/** One of `allowed`, or "" when the URL says anything else. */
export function oneOf<T extends string>(params: SearchParams, key: string, allowed: readonly T[]): T | "" {
  const value = first(params, key);
  return (allowed as readonly string[]).includes(value) ? (value as T) : "";
}

export function uuidParam(params: SearchParams, key: string): string {
  const value = first(params, key);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) ? value.toLowerCase() : "";
}

/**
 * Search text safe to place inside a PostgREST `or=(…ilike.*x*…)` filter: commas,
 * parentheses, dots used as operators, quotes, backslashes and the wildcard characters
 * are removed rather than escaped, since nobody searches for them.
 */
export function searchText(params: SearchParams, key = "q"): string {
  return first(params, key)
    .replace(/[,()*%_\\"'.:]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

/** A link to the same list with some parameters changed. Empty values are dropped. */
export function hrefWith(path: string, current: Record<string, string>, changes: Record<string, string | number | null>): string {
  const next = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...current, ...changes })) {
    if (v === null || v === "" || (k === "page" && Number(v) === 1)) continue;
    next.set(k, String(v));
  }
  const query = next.toString();
  return query ? `${path}?${query}` : path;
}

/**
 * Where to go after signing in. Only a path inside the staff workspace — never an
 * absolute URL, a protocol-relative "//host", or a backslash trick — so the sign-in link
 * cannot be turned into an open redirect.
 */
export function safeStaffNext(value: string | null | undefined): string {
  if (!value || typeof value !== "string") return "/admin";
  if (!value.startsWith("/admin") || value.startsWith("//") || /[\\\r\n\t]/.test(value)) return "/admin";
  if (value.startsWith("/admin/login")) return "/admin";
  try {
    const url = new URL(value, "https://staff.invalid");
    if (url.origin !== "https://staff.invalid") return "/admin";
    return `${url.pathname}${url.search}`;
  } catch {
    return "/admin";
  }
}
