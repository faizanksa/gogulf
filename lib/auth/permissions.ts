/**
 * Server-side authorization.
 *
 * This is the SECOND of three layers. It is not the security boundary — RLS is.
 * But every mutation must pass through here anyway, because relying on RLS
 * alone means a missing policy becomes a silent hole rather than a loud error.
 *
 *   UI      — hides what the user cannot do          (usability)
 *   Server  — this file, re-checks every mutation    (correctness)
 *   RLS     — re-checks underneath                   (security)
 *
 * Hiding a button is not authorization.
 */

import "server-only";

import { createServerSupabase } from "@/lib/supabase/server";
import type { PermissionScope } from "@/types/database";

export type Permission =
  // CRM
  | "contacts.view" | "contacts.create" | "contacts.update" | "contacts.delete"
  | "contacts.merge" | "contacts.assign" | "contacts.export"
  | "notes.team.view" | "notes.team.create"
  | "notes.hr_private.view" | "notes.finance_private.view"
  | "tags.manage"
  // Cases
  | "cases.view" | "cases.create" | "cases.update" | "cases.stage.change"
  | "cases.assign" | "cases.close" | "cases.delete"
  // Recruitment
  | "jobs.view" | "jobs.manage" | "employers.view" | "employers.manage"
  | "applications.screen" | "interviews.manage" | "offers.manage"
  // Travel
  | "travel.manage" | "bookings.view" | "bookings.manage" | "suppliers.manage"
  // Documents — permissioned per category
  | "documents.view.identity" | "documents.view.employment"
  | "documents.view.financial" | "documents.view.travel" | "documents.view.medical"
  | "documents.upload" | "documents.verify" | "documents.download" | "documents.delete"
  // Money
  | "orders.view" | "orders.create" | "payments.view" | "payments.record"
  | "installments.manage" | "refunds.create" | "refunds.approve"
  | "invoices.view" | "invoices.issue" | "invoices.void" | "payments.reconcile"
  // Communications
  | "communications.view" | "communications.send" | "whatsapp.reply"
  | "calls.view" | "calls.log" | "templates.manage"
  | "campaigns.manage" | "lead_sources.manage"
  // Work
  | "tasks.view" | "tasks.manage" | "appointments.manage"
  // Reports
  | "reports.operational" | "reports.financial" | "reports.marketing"
  | "reports.staff_performance"
  // Platform
  | "imports.run" | "users.manage" | "roles.manage" | "permissions.manage"
  | "settings.manage" | "integrations.manage" | "audit.view";

/**
 * Asks the database, not a cached claim.
 *
 * The permission set is deliberately NOT baked into the JWT: claims are fixed
 * at token issue, so a revoked grant would keep working until the token
 * expired. `has_perm` is STABLE, so Postgres evaluates it once per statement.
 */
export async function hasPermission(
  permission: Permission,
  scope: PermissionScope = "all",
): Promise<boolean> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("has_perm", {
    perm: permission,
    required_scope: scope,
  });
  if (error) return false;
  return data === true;
}

export class AuthorizationError extends Error {
  readonly permission: Permission;
  readonly scope: PermissionScope;

  constructor(permission: Permission, scope: PermissionScope) {
    // Deliberately vague to the caller. A detailed message tells an attacker
    // which permission to go looking for; the specifics go to the audit log.
    super("You do not have permission to perform this action.");
    this.name = "AuthorizationError";
    this.permission = permission;
    this.scope = scope;
  }
}

/**
 * Throws unless the caller holds the permission. Use at the top of every
 * Server Action and mutating Route Handler.
 */
export async function requirePermission(
  permission: Permission,
  scope: PermissionScope = "all",
): Promise<void> {
  if (!(await hasPermission(permission, scope))) {
    throw new AuthorizationError(permission, scope);
  }
}

/** The current staff member's id, or null for customers and anonymous users. */
export async function currentStaffId(): Promise<string | null> {
  const supabase = await createServerSupabase();
  const { data } = await supabase.rpc("current_staff_id");
  return (data as string | null) ?? null;
}

/** The contact behind a customer session, or null. */
export async function currentContactId(): Promise<string | null> {
  const supabase = await createServerSupabase();
  const { data } = await supabase.rpc("current_contact_id");
  return (data as string | null) ?? null;
}

export async function isStaff(): Promise<boolean> {
  const supabase = await createServerSupabase();
  const { data } = await supabase.rpc("is_staff");
  return data === true;
}
