import { describe, expect, it } from "vitest";
import {
  LOGIN_PATHS,
  protectedAreaFor,
  routeDecision,
  sessionKind,
  type AccessTokenClaims,
} from "./route-guard";

const staffClaims: AccessTokenClaims = {
  sub: "u-staff",
  role: "authenticated",
  amr: [{ method: "oauth", timestamp: 1 }],
  app_metadata: { provider: "google", providers: ["google"] },
  app_staff_id: "s-1",
  app_role: "HR_MANAGER",
  app_branch: "b-lko",
};

// The shape a real Google sign-in actually produces for a pre-created staff
// member, observed on Mumbai staging 16 Sep 2026 for hello@gogulf.co.
//
// It differs from staffClaims in a way that matters: because onboarding creates
// the auth.users row first (confirmed email, no password) and Google links to it
// afterwards, `provider` stays "email" and Google only joins the `providers`
// array. A guard that read `provider` alone would reject every real staff member
// while passing the fixture above.
const linkedGoogleStaffClaims: AccessTokenClaims = {
  sub: "u-linked",
  role: "authenticated",
  amr: [{ method: "oauth", timestamp: 1758029861 }],
  app_metadata: { provider: "email", providers: ["email", "google"] },
  app_staff_id: "s-linked",
  app_role: "SUPER_ADMIN",
  app_branch: "b-lko",
};

const customerClaims: AccessTokenClaims = {
  sub: "u-customer",
  role: "authenticated",
  amr: [{ method: "otp", timestamp: 1 }],
  app_metadata: { provider: "phone", providers: ["phone"] },
};

describe("protectedAreaFor", () => {
  it("gates the staff CRM and the customer portal, including nested pages", () => {
    expect(protectedAreaFor("/admin")).toBe("/admin");
    expect(protectedAreaFor("/admin/users")).toBe("/admin");
    expect(protectedAreaFor("/admin/cases/123")).toBe("/admin");
    expect(protectedAreaFor("/portal")).toBe("/portal");
    expect(protectedAreaFor("/portal/cases")).toBe("/portal");
  });

  it("never gates the login pages — gating them would redirect login to itself forever", () => {
    expect(protectedAreaFor(LOGIN_PATHS["/admin"])).toBeNull();
    expect(protectedAreaFor(LOGIN_PATHS["/portal"])).toBeNull();
    expect(protectedAreaFor("/admin/login/")).toBeNull();
  });

  it("still gates pages nested under a login path", () => {
    expect(protectedAreaFor("/admin/login/anything")).toBe("/admin");
  });

  it("does not gate look-alike or public paths", () => {
    expect(protectedAreaFor("/administrator")).toBeNull();
    expect(protectedAreaFor("/portals")).toBeNull();
    expect(protectedAreaFor("/")).toBeNull();
    expect(protectedAreaFor("/jobs/apply")).toBeNull();
  });

  it("treats a trailing slash like the bare path", () => {
    expect(protectedAreaFor("/admin/")).toBe("/admin");
    expect(protectedAreaFor("/portal/")).toBe("/portal");
  });
});

describe("sessionKind", () => {
  it("is anonymous without verified claims", () => {
    expect(sessionKind(null)).toEqual({ kind: "anonymous" });
    expect(sessionKind(undefined)).toEqual({ kind: "anonymous" });
    expect(sessionKind({ role: "anon" })).toEqual({ kind: "anonymous" });
    expect(sessionKind({ sub: "", role: "authenticated" })).toEqual({ kind: "anonymous" });
  });

  it("recognises an active staff member signed in with the staff method", () => {
    expect(sessionKind(staffClaims)).toEqual({
      kind: "staff",
      userId: "u-staff",
      staffId: "s-1",
      role: "HR_MANAGER",
      branchId: "b-lko",
    });
  });

  it("recognises a pre-created staff member whose Google identity was linked later", () => {
    // The onboarding path in scripts/bootstrap-super-admins.mjs: the account
    // exists before its first sign-in, so "email" remains the primary provider
    // and "google" is added alongside it.
    expect(sessionKind(linkedGoogleStaffClaims)).toEqual({
      kind: "staff",
      userId: "u-linked",
      staffId: "s-linked",
      role: "SUPER_ADMIN",
      branchId: "b-lko",
    });
  });

  it("still blocks that account if it signs in by a non-Google route", () => {
    // Same linked account, arriving by email instead. Having once linked Google
    // must not make every later session acceptable.
    const viaEmail = {
      ...linkedGoogleStaffClaims,
      amr: [{ method: "password", timestamp: 1758029861 }],
    };
    expect(sessionKind(viaEmail)).toMatchObject({
      kind: "blocked",
      reason: "staff-claims-without-staff-sign-in",
    });
  });

  it("blocks staff claims obtained through any other sign-in method", () => {
    const viaPassword = { ...staffClaims, amr: [{ method: "password" }], app_metadata: { provider: "email", providers: ["email"] } };
    expect(sessionKind(viaPassword)).toMatchObject({ kind: "blocked", reason: "staff-claims-without-staff-sign-in" });
    // An OAuth sign-in through a provider that is not the staff provider does not count.
    const viaOtherOAuth = { ...staffClaims, app_metadata: { provider: "github", providers: ["github"] } };
    expect(sessionKind(viaOtherOAuth)).toMatchObject({ kind: "blocked", reason: "staff-claims-without-staff-sign-in" });
  });

  it("blocks a staff-method session with no staff record (e.g. deactivated staff after refresh)", () => {
    const deactivated = { ...staffClaims, app_staff_id: undefined, app_role: undefined, app_branch: undefined };
    expect(sessionKind(deactivated)).toMatchObject({ kind: "blocked", reason: "staff-sign-in-without-staff-record" });
  });

  it("recognises a customer signed in with the customer method", () => {
    expect(sessionKind(customerClaims)).toEqual({ kind: "customer", userId: "u-customer" });
  });

  it("never treats a customer-method session carrying staff claims as a customer", () => {
    expect(sessionKind({ ...customerClaims, app_staff_id: "s-9" })).toMatchObject({
      kind: "blocked",
      reason: "staff-claims-without-staff-sign-in",
    });
  });

  it("blocks sessions from unrecognised methods rather than guessing", () => {
    const password = { sub: "u", role: "authenticated", amr: [{ method: "password" }], app_metadata: { provider: "email", providers: ["email"] } };
    expect(sessionKind(password)).toMatchObject({ kind: "blocked", reason: "unrecognised-sign-in-method" });
    expect(sessionKind({ sub: "u", role: "authenticated" })).toMatchObject({ kind: "blocked", reason: "unrecognised-sign-in-method" });
  });

  it("blocks anonymous-auth users", () => {
    expect(sessionKind({ ...customerClaims, is_anonymous: true })).toMatchObject({ kind: "blocked", reason: "anonymous-sign-in" });
  });

  it("accepts the older string form of amr", () => {
    expect(sessionKind({ ...customerClaims, amr: ["otp"] })).toEqual({ kind: "customer", userId: "u-customer" });
  });
});

describe("routeDecision", () => {
  const anon = sessionKind(null);
  const staff = sessionKind(staffClaims);
  const customer = sessionKind(customerClaims);
  const blocked = sessionKind({ ...staffClaims, app_staff_id: undefined });

  it("admits only staff to /admin", () => {
    expect(routeDecision("/admin", staff, "/admin")).toEqual({ action: "allow" });
    expect(routeDecision("/admin", anon, "/admin/users")).toEqual({ action: "redirect", to: "/admin/login?next=%2Fadmin%2Fusers" });
    expect(routeDecision("/admin", customer, "/admin")).toEqual({ action: "not-found" });
    expect(routeDecision("/admin", blocked, "/admin")).toEqual({
      action: "redirect",
      to: "/admin/login?next=%2Fadmin&reason=staff-sign-in-required",
    });
  });

  it("admits only customers to /portal", () => {
    expect(routeDecision("/portal", customer, "/portal")).toEqual({ action: "allow" });
    expect(routeDecision("/portal", anon, "/portal/cases")).toEqual({ action: "redirect", to: "/portal/login?next=%2Fportal%2Fcases" });
    expect(routeDecision("/portal", staff, "/portal")).toEqual({ action: "redirect", to: "/admin" });
    expect(routeDecision("/portal", blocked, "/portal")).toEqual({
      action: "redirect",
      to: "/portal/login?next=%2Fportal&reason=customer-sign-in-required",
    });
  });

  it("only ever redirects to relative paths", () => {
    for (const s of [anon, staff, customer, blocked]) {
      for (const area of ["/admin", "/portal"] as const) {
        const d = routeDecision(area, s, `${area}//evil.example`);
        if (d.action === "redirect") expect(d.to.startsWith("/") && !d.to.startsWith("//")).toBe(true);
      }
    }
  });
});
