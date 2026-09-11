/**
 * Route protection for /admin (staff) and /portal (customers) — the pure logic.
 *
 * Kept free of Next.js and Supabase imports so every rule is unit-tested. Used by
 * three layers (docs/REDESIGN-PLAN.md §19):
 *
 *   1. proxy.ts           verified claims → sessionKind → routeDecision   (fast, coarse)
 *   2. area layouts        sessionKind again + a live database check       (authoritative)
 *                          admin: is_staff() · portal: current_contact_id()
 *   3. Postgres RLS        permission + scope (staff) · own records (customers)
 *
 * "A session exists" is never enough. A staff session is an active staff record
 * (the JWT hook's app_staff_id) signed in with the staff method; a customer session
 * carries no staff claims and was signed in with the customer method. Anything else
 * is blocked, including a deactivated staff member whose refreshed token lost its
 * staff claims.
 */

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

/** Routes that require a session. */
export const PROTECTED_PREFIXES = ["/admin", "/portal"] as const;
export type ProtectedArea = (typeof PROTECTED_PREFIXES)[number];

/**
 * Where a visitor without the right session is sent. These pages must themselves stay
 * reachable without a session — gating them would redirect login to itself forever.
 */
export const LOGIN_PATHS = { "/admin": "/admin/login", "/portal": "/portal/login" } as const;

const PUBLIC_UNDER_PROTECTED = new Set<string>(Object.values(LOGIN_PATHS));

/** The protected area a path belongs to, or null when it needs no session. */
export function protectedAreaFor(pathname: string): ProtectedArea | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (PUBLIC_UNDER_PROTECTED.has(path)) return null;
  for (const prefix of PROTECTED_PREFIXES) {
    if (path === prefix || path.startsWith(`${prefix}/`)) return prefix;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Session kinds
// ---------------------------------------------------------------------------

/**
 * Sign-in methods per audience (the `amr` claim) and the identity provider that must
 * back them (`app_metadata.providers`).
 *
 * Staff: Google Workspace SSO restricted to gogulf.co — docs/ARCHITECTURE.md, decision
 * D10. Adding email + password as a break-glass path is a one-line change here, made
 * deliberately, never by accident.
 * Customers: phone OTP (Phase 3). Revisit if the OTP provider changes the claim shape.
 */
export const STAFF_SIGN_IN = { methods: ["oauth"], providers: ["google"] } as const;
export const CUSTOMER_SIGN_IN = { methods: ["otp"], providers: ["phone"] } as const;

export interface AccessTokenClaims {
  sub?: string;
  role?: string;
  is_anonymous?: boolean;
  amr?: ReadonlyArray<{ method?: string; timestamp?: number } | string>;
  app_metadata?: { provider?: string; providers?: readonly string[] };
  app_staff_id?: string;
  app_role?: string;
  app_branch?: string | null;
}

export type BlockReason =
  | "anonymous-sign-in"
  | "staff-claims-without-staff-sign-in"
  | "staff-sign-in-without-staff-record"
  | "unrecognised-sign-in-method";

export type SessionKind =
  | { kind: "anonymous" }
  | { kind: "staff"; userId: string; staffId: string; role: string | null; branchId: string | null }
  | { kind: "customer"; userId: string }
  | { kind: "blocked"; userId: string; reason: BlockReason };

function methodsOf(claims: AccessTokenClaims): string[] {
  return (claims.amr ?? [])
    .map((entry) => (typeof entry === "string" ? entry : entry?.method))
    .filter((m): m is string => typeof m === "string");
}

function providersOf(claims: AccessTokenClaims): string[] {
  const meta = claims.app_metadata;
  if (!meta) return [];
  const list = [...(meta.providers ?? [])];
  if (meta.provider && !list.includes(meta.provider)) list.push(meta.provider);
  return list;
}

function signedInWith(
  claims: AccessTokenClaims,
  rule: { readonly methods: readonly string[]; readonly providers: readonly string[] },
): boolean {
  const methods = methodsOf(claims);
  const providers = providersOf(claims);
  return methods.some((m) => rule.methods.includes(m)) && providers.some((p) => rule.providers.includes(p));
}

/**
 * Classify verified access-token claims. Callers MUST pass claims that were verified
 * (Supabase `auth.getClaims()`), never decoded from a cookie by hand.
 */
export function sessionKind(claims: AccessTokenClaims | null | undefined): SessionKind {
  if (!claims || typeof claims.sub !== "string" || claims.sub === "" || claims.role !== "authenticated") {
    return { kind: "anonymous" };
  }
  const userId = claims.sub;
  if (claims.is_anonymous) return { kind: "blocked", userId, reason: "anonymous-sign-in" };

  const staffSignIn = signedInWith(claims, STAFF_SIGN_IN);
  const hasStaffClaims = typeof claims.app_staff_id === "string" && claims.app_staff_id !== "";

  if (hasStaffClaims) {
    if (!staffSignIn) return { kind: "blocked", userId, reason: "staff-claims-without-staff-sign-in" };
    return {
      kind: "staff",
      userId,
      staffId: claims.app_staff_id as string,
      role: claims.app_role ?? null,
      branchId: claims.app_branch ?? null,
    };
  }

  // Signed in the staff way but no staff record behind it — e.g. a deactivated
  // employee whose refreshed token no longer carries staff claims.
  if (staffSignIn) return { kind: "blocked", userId, reason: "staff-sign-in-without-staff-record" };

  if (signedInWith(claims, CUSTOMER_SIGN_IN)) return { kind: "customer", userId };

  return { kind: "blocked", userId, reason: "unrecognised-sign-in-method" };
}

// ---------------------------------------------------------------------------
// Decisions
// ---------------------------------------------------------------------------

export type RouteDecision =
  | { action: "allow" }
  | { action: "redirect"; to: string }
  | { action: "not-found" };

function loginRedirect(area: ProtectedArea, pathname: string, reason?: string): RouteDecision {
  const params = new URLSearchParams({ next: pathname });
  if (reason) params.set("reason", reason);
  return { action: "redirect", to: `${LOGIN_PATHS[area]}?${params.toString()}` };
}

/**
 * What the proxy does with a request to a protected area. `pathname` is echoed back
 * only as a relative `next` parameter — never an absolute URL (open-redirect guard).
 */
export function routeDecision(area: ProtectedArea, session: SessionKind, pathname: string): RouteDecision {
  if (area === "/admin") {
    switch (session.kind) {
      case "staff":
        return { action: "allow" };
      case "anonymous":
        return loginRedirect(area, pathname);
      case "customer":
        // A customer has no business in the staff area; do not advertise it.
        return { action: "not-found" };
      case "blocked":
        return loginRedirect(area, pathname, "staff-sign-in-required");
    }
  }

  switch (session.kind) {
    case "customer":
      return { action: "allow" };
    case "anonymous":
      return loginRedirect(area, pathname);
    case "staff":
      // Staff use the staff workspace, not the customer portal.
      return { action: "redirect", to: "/admin" };
    case "blocked":
      return loginRedirect(area, pathname, "customer-sign-in-required");
  }
}
