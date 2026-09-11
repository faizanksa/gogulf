import { describe, expect, it } from "vitest";
import { LOGIN_PATHS, protectedAreaFor } from "./route-guard";

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
