import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Hiding a button is not authorization. Every staff Server Action must call
 * requirePermission (directly, or through the file's authorize() wrapper) BEFORE it
 * creates a database client — so a forged request from a role that lacks the permission is
 * refused at layer 2 even before RLS (layer 3) would refuse it.
 *
 * Asserted on the source, so an action added later cannot skip it unnoticed.
 */

const ROOT = join(process.cwd(), "app/(admin)/admin/(protected)");
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

// The protected group's own actions.ts (sign out) is intentionally permission-free: signing
// out needs a session, not a permission.
const ACTION_FILES = walk(ROOT).filter((f) => /[\\/]actions\.ts$/.test(f) && !/protected\)[\\/]actions\.ts$/.test(f));

function actionsOf(source: string): { name: string; body: string }[] {
  const parts = source.split(/^export async function /m).slice(1);
  return parts.map((part) => ({ name: part.slice(0, part.indexOf("(")), body: part }));
}

describe("staff server actions", () => {
  it("covers every feature that mutates data", () => {
    const folders = ACTION_FILES.map((f) => f.replace(/\\/g, "/").split("/(protected)/")[1]);
    for (const expected of ["applications/actions.ts", "invoices/actions.ts", "jobs/actions.ts", "jobs/categories/actions.ts", "roles/actions.ts", "staff/actions.ts"]) {
      expect(folders, expected).toContain(expected);
    }
  });

  for (const file of ACTION_FILES) {
    const rel = file.replace(/\\/g, "/").split("/(protected)/")[1] ?? file;
    for (const { name, body } of actionsOf(readFileSync(file, "utf8"))) {
      it(`${rel} › ${name} checks permission before it creates a database client`, () => {
        const check = Math.min(...["requirePermission(", "authorize("].map((m) => body.indexOf(m)).filter((i) => i >= 0), Number.POSITIVE_INFINITY);
        const client = body.indexOf("createServerSupabase(");
        expect(check, `${name} never checks a permission`).toBeLessThan(Number.POSITIVE_INFINITY);
        if (client >= 0) expect(check, `${name} touches the database before checking`).toBeLessThan(client);
      });
    }
  }

  it("never reaches for the service-role client", () => {
    for (const file of ACTION_FILES) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(/createAdminClient|SUPABASE_SERVICE_ROLE_KEY|supabase\/admin/);
    }
  });
});

describe("the staff and role screens", () => {
  it("are guarded by the permission that matches what they change", () => {
    const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
    expect(read("staff/page.tsx")).toContain('can["users.manage"]');
    expect(read("roles/page.tsx")).toContain('can["roles.manage"]');
    expect(read("roles/[key]/page.tsx")).toContain('can["roles.manage"]');
    expect(read("settings/page.tsx")).toContain('can["settings.manage"]');
    expect(read("integrations/page.tsx")).toContain('can["integrations.manage"]');
    expect(read("audit/page.tsx")).toContain('can["audit.view"]');
    expect(read("payments/page.tsx")).toContain('can["payments.view"]');
    expect(read("staff/actions.ts")).toContain('authorize("roles.manage")'); // role changes are SUPER_ADMIN's
    expect(read("roles/actions.ts")).toContain('requirePermission("roles.manage")');
  });
});
