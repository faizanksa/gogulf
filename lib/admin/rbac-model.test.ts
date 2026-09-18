import { describe, expect, it } from "vitest";
import { describePlan, isEmptyPlan, planPermissionChanges, RESERVED_PERMISSIONS, wouldLeaveNoSuperAdmin } from "./rbac-model";

const KNOWN = ["jobs.manage", "jobs.view", "invoices.issue", "users.manage", "roles.manage", "permissions.manage", "audit.view"];

describe("planPermissionChanges", () => {
  it("plans exactly the differences: added, widened or narrowed, and removed", () => {
    const plan = planPermissionChanges(
      { "jobs.manage": "all", "jobs.view": "branch", "audit.view": "all" },
      { "jobs.manage": "all", "jobs.view": "all", "audit.view": "", "invoices.issue": "branch" },
      KNOWN,
    );
    expect(plan).toEqual({
      insert: [{ key: "invoices.issue", scope: "branch" }],
      update: [{ key: "jobs.view", scope: "all" }],
      remove: ["audit.view"],
      reserved: [],
    });
    expect(describePlan(plan)).toBe("1 added, 1 changed, 1 removed");
  });

  it("is empty when nothing changed, so a save that changes nothing writes nothing", () => {
    const plan = planPermissionChanges({ "jobs.manage": "all" }, { "jobs.manage": "all", "jobs.view": "" }, KNOWN);
    expect(isEmptyPlan(plan)).toBe(true);
    expect(describePlan(plan)).toBe("no changes");
  });

  it("ignores permission names that do not exist and scopes that are not scopes", () => {
    const plan = planPermissionChanges({}, { "made.up": "all", "jobs.manage": "everything", "jobs.view": "own" }, KNOWN);
    expect(plan.insert).toEqual([{ key: "jobs.view", scope: "own" }]);
    expect(isEmptyPlan(planPermissionChanges({}, { "jobs.manage": "root" }, KNOWN))).toBe(true);
  });

  it("refuses to grant or revoke the permissions that define the boundary itself", () => {
    expect(RESERVED_PERMISSIONS).toEqual(["roles.manage", "permissions.manage"]);
    const grant = planPermissionChanges({}, { "roles.manage": "all", "permissions.manage": "all", "jobs.view": "all" }, KNOWN);
    expect(grant.reserved.sort()).toEqual(["permissions.manage", "roles.manage"]);
    expect(grant.insert).toEqual([{ key: "jobs.view", scope: "all" }]); // the rest is still planned; the caller refuses the save
    const revoke = planPermissionChanges({ "roles.manage": "all" }, { "roles.manage": "" }, KNOWN);
    expect(revoke.reserved).toEqual(["roles.manage"]);
  });

  it("does not treat an unchanged reserved permission as a change", () => {
    expect(planPermissionChanges({ "roles.manage": "all" }, { "roles.manage": "all" }, KNOWN).reserved).toEqual([]);
  });
});

describe("wouldLeaveNoSuperAdmin", () => {
  const staff = [
    { id: "a", role_key: "SUPER_ADMIN", is_active: true },
    { id: "b", role_key: "SUPER_ADMIN", is_active: true },
    { id: "c", role_key: "ADMIN", is_active: true },
    { id: "d", role_key: "SUPER_ADMIN", is_active: false },
  ];
  it("allows removing one of two active SUPER_ADMINs", () => {
    expect(wouldLeaveNoSuperAdmin(staff, "a")).toBe(false);
  });
  it("refuses removing the last active one, and ignores a deactivated SUPER_ADMIN", () => {
    expect(wouldLeaveNoSuperAdmin(staff.filter((s) => s.id !== "b"), "a")).toBe(true);
  });
  it("is unaffected by removing someone who is not a SUPER_ADMIN", () => {
    expect(wouldLeaveNoSuperAdmin(staff, "c")).toBe(false);
  });
});
