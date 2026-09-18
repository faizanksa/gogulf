/**
 * Who is using the staff workspace, for display and for deciding which controls to show.
 *
 * This is NOT an authorization layer. Hiding a button is usability; every mutation still
 * calls requirePermission() on the server and meets RLS underneath (lib/auth/permissions.ts).
 * The permissions here are asked of the database with has_perm(), live, once per request.
 */

import "server-only";

import { cache } from "react";
import { hasPermission, type Permission } from "@/lib/auth/permissions";
import { sessionKind, type AccessTokenClaims } from "@/lib/auth/route-guard";
import { createServerSupabase } from "@/lib/supabase/server";

const UI_PERMISSIONS = [
  "jobs.view",
  "jobs.manage",
  "applications.screen",
  "contacts.view",
  "cases.view",
  "invoices.view",
  "invoices.issue",
  "invoices.void",
  "payments.view",
  "audit.view",
  "roles.manage",
  "documents.view.identity",
  "documents.view.employment",
] as const satisfies readonly Permission[];

export type UiPermission = (typeof UI_PERMISSIONS)[number];

export interface StaffContext {
  staffId: string;
  email: string;
  fullName: string;
  role: string;
  roleLabel: string;
  branch: string | null;
  /** Held at any scope. The database still applies the scope to every row. */
  can: Record<UiPermission, boolean>;
}

export const getStaffContext = cache(async (): Promise<StaffContext | null> => {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getClaims();
  const session = sessionKind((data?.claims as AccessTokenClaims | undefined) ?? null);
  if (session.kind !== "staff") return null;

  const [{ data: me }, checks] = await Promise.all([
    supabase
      .from("staff_users")
      .select("id, email, full_name, role_key, is_active, role:roles(label), branch:branches(name)")
      .eq("id", session.staffId)
      .maybeSingle(),
    Promise.all(UI_PERMISSIONS.map((p) => hasPermission(p, "own"))),
  ]);
  if (!me || !me.is_active) return null;

  const row = me as unknown as {
    id: string;
    email: string;
    full_name: string;
    role_key: string;
    role: { label: string } | null;
    branch: { name: string } | null;
  };
  return {
    staffId: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role_key,
    roleLabel: row.role?.label ?? row.role_key,
    branch: row.branch?.name ?? null,
    can: Object.fromEntries(UI_PERMISSIONS.map((p, i) => [p, checks[i] === true])) as Record<UiPermission, boolean>,
  };
});

/** The Supabase project this deployment talks to — shown to staff outside production. */
export function supabaseProjectRef(): string | null {
  return process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/^https:\/\/([a-z0-9]{20})\.supabase\.co/)?.[1] ?? null;
}
