/**
 * Editing what a role may do — the pure half. The database is the authority (only
 * `roles.manage` can write role_permissions, 0007, and every change is audited); this
 * decides which rows a submitted form would change, and refuses the changes that must
 * never be made from a screen.
 */

export const SCOPES = ["own", "branch", "all"] as const;
export type Scope = (typeof SCOPES)[number];

export const SCOPE_LABELS: Record<Scope, string> = { own: "Own records", branch: "Own branch", all: "Everything" };

/**
 * Permissions that define the escalation boundary itself. Whoever holds them can change
 * who can do anything, so they belong to SUPER_ADMIN alone and are never grantable from
 * the role editor — changing that is a reviewed migration, not a click.
 */
export const RESERVED_PERMISSIONS: readonly string[] = ["roles.manage", "permissions.manage"];

export type Grants = Record<string, Scope>;

export interface PermissionPlan {
  insert: { key: string; scope: Scope }[];
  update: { key: string; scope: Scope }[];
  remove: string[];
  /** Permission keys the form asked to change that are reserved. Non-empty means refuse the whole save. */
  reserved: string[];
}

/**
 * Compare a role's current grants with what a form asks for. `requested` maps a permission
 * key to a scope, or to null/"" for "none". Keys not in `known` are ignored — a forged
 * field name cannot create a grant for a permission that does not exist.
 */
export function planPermissionChanges(current: Grants, requested: Record<string, string | null | undefined>, known: readonly string[]): PermissionPlan {
  const plan: PermissionPlan = { insert: [], update: [], remove: [], reserved: [] };
  const catalogue = new Set(known);

  for (const [key, raw] of Object.entries(requested)) {
    if (!catalogue.has(key)) continue;
    const want: Scope | null = (SCOPES as readonly string[]).includes(raw ?? "") ? (raw as Scope) : null;
    const have = current[key] ?? null;
    if (want === have) continue;

    if (RESERVED_PERMISSIONS.includes(key)) {
      plan.reserved.push(key);
      continue;
    }
    if (want === null) plan.remove.push(key);
    else if (have === null) plan.insert.push({ key, scope: want });
    else plan.update.push({ key, scope: want });
  }
  return plan;
}

export const isEmptyPlan = (plan: PermissionPlan) => plan.insert.length + plan.update.length + plan.remove.length === 0;

/** "3 added, 1 changed, 2 removed" — for the confirmation message after a save. */
export function describePlan(plan: PermissionPlan): string {
  const parts: string[] = [];
  if (plan.insert.length) parts.push(`${plan.insert.length} added`);
  if (plan.update.length) parts.push(`${plan.update.length} changed`);
  if (plan.remove.length) parts.push(`${plan.remove.length} removed`);
  return parts.join(", ") || "no changes";
}

/**
 * Whether deactivating or demoting `targetId` would leave no active SUPER_ADMIN — the one
 * state from which nobody could administer the platform again.
 */
export function wouldLeaveNoSuperAdmin(staff: readonly { id: string; role_key: string; is_active: boolean }[], targetId: string): boolean {
  const remaining = staff.filter((s) => s.id !== targetId && s.role_key === "SUPER_ADMIN" && s.is_active);
  return remaining.length === 0;
}
