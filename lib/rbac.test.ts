import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Grant-matrix tests.
 *
 * These read the seed migration and assert the properties that must hold no
 * matter how the matrix is edited. They cannot prove RLS behaviour — that needs
 * a live database and is covered by the SQL suites (supabase/tests/) — but they do
 * catch the mistake this system is most exposed to: someone adding a grant that
 * quietly hands passports or refund approval to the wrong role.
 *
 * The seed (0008) is not the whole story: later migrations retire grants, roles and
 * permissions. The matrix asserted here is the EFFECTIVE one — the seed minus every
 * retirement listed in RETIRED, and each retirement is checked against the migration
 * that performs it, so this list cannot drift from the database unnoticed.
 */

const read = (file: string) => readFileSync(join(process.cwd(), "supabase/migrations", file), "utf8");
const seed = read("0008_seed_rbac.sql");

/** What later migrations removed from the 0008 seed. */
const RETIRED = {
  // 0016: ADMIN is operational staff; SUPER_ADMIN alone administers the platform.
  grants: [
    { role: "ADMIN", permission: "users.manage", migration: "0016_admin_operational_model.sql" },
    { role: "ADMIN", permission: "settings.manage", migration: "0016_admin_operational_model.sql" },
  ],
  // 0019: Go Gulf is not a travel agency. The two travel-agency roles go. The travel,
  // booking and supplier permissions stay — relabelled for candidate deployment (a placed
  // candidate's travel and flights) — so no permission is retired.
  roles: [
    { role: "TRAVEL_MANAGER", migration: "0019_retire_travel_services.sql" },
    { role: "TRAVEL_AGENT", migration: "0019_retire_travel_services.sql" },
  ],
};
const retiredRoles = new Set(RETIRED.roles.map((r) => r.role));

/** Grants are ['ROLE','permission','scope'] triples in the seed array, minus retirements. */
function grantsFor(role: string): Array<{ permission: string; scope: string }> {
  if (retiredRoles.has(role)) return [];
  const re = new RegExp(`\\['${role}','([^']+)','([^']+)'\\]`, "g");
  const out: Array<{ permission: string; scope: string }> = [];
  for (const m of seed.matchAll(re)) {
    const permission = m[1] as string;
    if (RETIRED.grants.some((g) => g.role === role && g.permission === permission)) continue;
    out.push({ permission, scope: m[2] as string });
  }
  return out;
}

function has(role: string, permission: string): boolean {
  return grantsFor(role).some((g) => g.permission === permission);
}

const ALL_ROLES = [
  "ADMIN", "HR_MANAGER", "RECRUITER",
  "FINANCE_MANAGER", "ACCOUNTS", "OPERATIONS_MANAGER", "SUPPORT_AGENT",
  "MARKETING_MANAGER", "VIEW_ONLY",
];

describe("RBAC seed integrity", () => {
  it("defines the ten roles Go Gulf uses", () => {
    for (const role of [...ALL_ROLES, "SUPER_ADMIN"]) {
      expect(seed).toContain(`('${role}',`);
    }
    expect(ALL_ROLES.length + 1).toBe(10);
  });

  it("performs every retirement it relies on, in the migration it names", () => {
    const retire = read("0019_retire_travel_services.sql");
    for (const r of RETIRED.roles) expect(read(r.migration)).toContain(`'${r.role}'`);
    expect(retire).toMatch(/delete from public\.roles where key in \('TRAVEL_MANAGER', 'TRAVEL_AGENT'\)/);
    // The deployment permissions are relabelled, never deleted.
    expect(retire).not.toMatch(/delete from public\.permissions/);
    const admin = read("0016_admin_operational_model.sql");
    expect(admin).toMatch(/rp\.role_key = 'ADMIN'\s+and p\.key in \('users\.manage', 'settings\.manage'\)/);
  });

  it("keeps candidate deployment with the recruitment and operations roles", () => {
    // A placed candidate's travel, flight bookings and deployment suppliers.
    for (const permission of ["travel.manage", "bookings.manage", "suppliers.manage"]) {
      expect(has("ADMIN", permission), `ADMIN ${permission}`).toBe(true);
      expect(has("OPERATIONS_MANAGER", permission), `OPERATIONS_MANAGER ${permission}`).toBe(true);
    }
    // The candidate's visa and ticket documents stay with the people who progress them.
    for (const role of ["RECRUITER", "HR_MANAGER", "OPERATIONS_MANAGER"]) {
      expect(has(role, "documents.view.travel"), role).toBe(true);
    }
  });

  it("grants every role at least one permission, except SUPER_ADMIN", () => {
    for (const role of ALL_ROLES) {
      expect(grantsFor(role).length, `${role} has no grants`).toBeGreaterThan(0);
    }
    // SUPER_ADMIN is intentionally absent: roles.is_super short-circuits
    // has_perm(), so explicit grants would risk drift between two mechanisms.
    expect(grantsFor("SUPER_ADMIN").length).toBe(0);
    expect(seed).toContain("'Unrestricted platform access");
  });

  it("uses only valid scopes", () => {
    for (const role of ALL_ROLES) {
      for (const g of grantsFor(role)) {
        expect(["all", "branch", "own"]).toContain(g.scope);
      }
    }
  });

  it("grants no permission that is not in the catalogue", () => {
    const catalogue = new Set(
      [...seed.matchAll(/\('([a-z_]+\.[a-z_.]+)',\s*'[a-z]+',\s*'/g)].map((m) => m[1] as string),
    );
    for (const role of ALL_ROLES) {
      for (const g of grantsFor(role)) {
        expect(catalogue.has(g.permission), `${role} granted unknown permission ${g.permission}`).toBe(true);
      }
    }
  });
});

describe("separation of duties", () => {
  it("keeps finance out of identity documents", () => {
    // Explicitly required: finance never needs to open a passport.
    expect(has("FINANCE_MANAGER", "documents.view.identity")).toBe(false);
    expect(has("ACCOUNTS", "documents.view.identity")).toBe(false);
  });

  it("keeps finance out of private HR notes", () => {
    expect(has("FINANCE_MANAGER", "notes.hr_private.view")).toBe(false);
    expect(has("ACCOUNTS", "notes.hr_private.view")).toBe(false);
  });

  it("keeps HR out of private finance notes", () => {
    expect(has("HR_MANAGER", "notes.finance_private.view")).toBe(false);
  });

  it("keeps marketing away from documents and payments entirely", () => {
    const marketing = grantsFor("MARKETING_MANAGER").map((g) => g.permission);
    expect(marketing.filter((p) => p.startsWith("documents."))).toEqual([]);
    expect(marketing.filter((p) => p.startsWith("payments."))).toEqual([]);
    expect(marketing.filter((p) => p.startsWith("refunds."))).toEqual([]);
    expect(marketing.filter((p) => p.startsWith("invoices."))).toEqual([]);
  });

  it("keeps support away from identity documents and financial writes", () => {
    expect(has("SUPPORT_AGENT", "documents.view.identity")).toBe(false);
    expect(has("SUPPORT_AGENT", "payments.record")).toBe(false);
    expect(has("SUPPORT_AGENT", "refunds.create")).toBe(false);
  });

  it("does not let a recruiter verify the documents they collect", () => {
    // Whoever progresses a candidate must not also approve their paperwork.
    expect(has("RECRUITER", "documents.verify")).toBe(false);
  });

  it("enforces the two-person refund rule", () => {
    // Accounts raises; only Finance Manager (or above) approves.
    expect(has("ACCOUNTS", "refunds.create")).toBe(true);
    expect(has("ACCOUNTS", "refunds.approve")).toBe(false);
    expect(has("FINANCE_MANAGER", "refunds.approve")).toBe(true);
  });
});

describe("privilege escalation guards", () => {
  it("does not let ADMIN administer the platform (0016)", () => {
    // ADMIN is operational staff; only SUPER_ADMIN manages staff, roles and settings.
    expect(has("ADMIN", "roles.manage")).toBe(false);
    expect(has("ADMIN", "permissions.manage")).toBe(false);
    expect(has("ADMIN", "integrations.manage")).toBe(false);
    expect(has("ADMIN", "users.manage")).toBe(false);
    expect(has("ADMIN", "settings.manage")).toBe(false);
  });

  it("grants roles.manage to nobody but SUPER_ADMIN", () => {
    for (const role of ALL_ROLES) {
      expect(has(role, "roles.manage"), `${role} must not manage roles`).toBe(false);
    }
  });

  it("restricts bulk contact export to admin roles only", () => {
    // Bulk PII extraction is the highest-impact insider risk.
    for (const role of ALL_ROLES.filter((r) => r !== "ADMIN")) {
      expect(has(role, "contacts.export"), `${role} must not export contacts`).toBe(false);
    }
  });

  it("restricts document deletion to admin roles only", () => {
    for (const role of ALL_ROLES.filter((r) => r !== "ADMIN")) {
      expect(has(role, "documents.delete"), `${role} must not delete documents`).toBe(false);
    }
  });
});

describe("VIEW_ONLY is genuinely read-only", () => {
  const WRITE_MARKERS = [
    ".create", ".update", ".delete", ".manage", ".assign", ".merge",
    ".verify", ".issue", ".void", ".record", ".approve", ".send",
    ".reply", ".log", ".screen", ".change", ".close", ".export", ".run",
    ".reconcile", ".download",
  ];

  it("holds no permission that writes, sends or downloads", () => {
    for (const g of grantsFor("VIEW_ONLY")) {
      for (const marker of WRITE_MARKERS) {
        expect(
          g.permission.includes(marker),
          `VIEW_ONLY must not hold ${g.permission}`,
        ).toBe(false);
      }
    }
  });

  it("has no document access at all", () => {
    expect(grantsFor("VIEW_ONLY").filter((g) => g.permission.startsWith("documents."))).toEqual([]);
  });

  it("never holds a grant at 'all' scope", () => {
    for (const g of grantsFor("VIEW_ONLY")) {
      // jobs.view is the one legitimate exception: job postings are public.
      if (g.permission === "jobs.view") continue;
      expect(g.scope, `VIEW_ONLY.${g.permission} should not be 'all'`).not.toBe("all");
    }
  });
});

describe("audit trail immutability", () => {
  it("defines a SELECT policy on audit_logs and no UPDATE or DELETE policy", () => {
    const policies = readFileSync(
      join(process.cwd(), "supabase/migrations/0007_rls_policies.sql"),
      "utf8",
    );
    expect(policies).toContain('create policy "audit.view reads audit" on public.audit_logs');
    expect(policies).not.toMatch(/on public\.audit_logs\s+for (update|delete)/i);
    expect(policies).not.toMatch(/on public\.audit_logs\s+for all/i);
  });

  it("grants audit.view to only a narrow set of roles", () => {
    const permitted = ALL_ROLES.filter((r) => has(r, "audit.view"));
    expect(permitted.sort()).toEqual(["ADMIN", "FINANCE_MANAGER"]);
  });
});
