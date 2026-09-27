import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The staff roster in scripts/bootstrap-super-admins.mjs is the source of truth for the three
 * Go Gulf accounts: the script converges each row to the role listed there on every run. So
 * a role decision is only real once it is in the roster — asserted here.
 *
 * Role mapping, 27 Sep 2026: hello@ Super Admin, admin@ Admin, careers@ HR Manager. All three
 * are existing catalogue roles; no role or permission was created for them.
 */

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const script = read("scripts/bootstrap-super-admins.mjs");
const seed = read("supabase/migrations/0008_seed_rbac.sql");

const roster = [...script.matchAll(/\{ email: "([^"]+)", full_name: "[^"]+", role: "([A-Z_]+)" \}/g)].map((m) => ({
  email: m[1] as string,
  role: m[2] as string,
}));
const grants = (role: string) => [...seed.matchAll(new RegExp(`\\['${role}','([^']+)','([^']+)'\\]`, "g"))].map((m) => m[1] as string);

describe("the staff roster", () => {
  it("holds the approved role mapping", () => {
    expect(roster).toEqual([
      { email: "hello@gogulf.co", role: "SUPER_ADMIN" },
      { email: "admin@gogulf.co", role: "ADMIN" },
      { email: "careers@gogulf.co", role: "HR_MANAGER" },
    ]);
  });

  it("uses only catalogue roles, labelled as the Staff screen shows them", () => {
    const labels: Record<string, string> = { SUPER_ADMIN: "Super Admin", ADMIN: "Admin", HR_MANAGER: "HR Manager" };
    for (const { role } of roster) expect(seed, role).toContain(`('${role}',${" ".repeat(Math.max(1, 19 - role.length))}'${labels[role]}'`);
  });

  it("always keeps someone who can administer the platform", () => {
    expect(roster.some((p) => p.role === "SUPER_ADMIN")).toBe(true);
    expect(script).toMatch(/if \(!STAFF\.some\(\(p\) => p\.role === "SUPER_ADMIN"\)\)/);
  });

  it("gives staff management to the Super Admin alone: HR Manager never manages staff, roles or settings", () => {
    const platform = ["users.manage", "roles.manage", "permissions.manage", "settings.manage", "integrations.manage"];
    // HR_MANAGER never held these; ADMIN lost users.manage and settings.manage in 0016.
    for (const permission of platform) expect(grants("HR_MANAGER"), permission).not.toContain(permission);
    expect(read("supabase/migrations/0016_admin_operational_model.sql")).toMatch(/and p\.key in \('users\.manage', 'settings\.manage'\)/);
  });

  it("gives the HR Manager the recruitment work it is for", () => {
    for (const permission of ["applications.screen", "jobs.manage", "contacts.view", "cases.view", "interviews.manage", "documents.verify", "documents.view.identity"]) {
      expect(grants("HR_MANAGER"), permission).toContain(permission);
    }
  });
});
