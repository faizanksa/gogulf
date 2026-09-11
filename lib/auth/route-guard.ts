/**
 * Which paths the proxy gates behind a session, and where it sends people who
 * have none. Kept free of Next.js and Supabase imports so it can be unit-tested.
 *
 * This is the coarse gate only ("is there a session?"). Which KIND of session
 * may see a page is decided downstream, and RLS is the real boundary.
 */

/** Routes that require a session. */
export const PROTECTED_PREFIXES = ["/admin", "/portal"] as const;

/**
 * Where a signed-out visitor is sent. These pages must themselves stay reachable
 * without a session — gating them would redirect the login page to itself,
 * forever, and nobody could ever sign in.
 */
export const LOGIN_PATHS = { "/admin": "/admin/login", "/portal": "/portal/login" } as const;

const PUBLIC_UNDER_PROTECTED = new Set<string>(Object.values(LOGIN_PATHS));

/** The protected area a path belongs to, or null when it needs no session. */
export function protectedAreaFor(pathname: string): keyof typeof LOGIN_PATHS | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (PUBLIC_UNDER_PROTECTED.has(path)) return null;
  for (const prefix of PROTECTED_PREFIXES) {
    if (path === prefix || path.startsWith(`${prefix}/`)) return prefix;
  }
  return null;
}
