import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { isStaff } from "@/lib/auth/permissions";
import { sessionKind, type AccessTokenClaims } from "@/lib/auth/route-guard";
import { getStaffContext } from "@/lib/auth/staff";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Layer 2 for /admin (layer 1 is proxy.ts, layer 3 is RLS).
 *
 * Re-classifies the verified session, then asks the database whether this person is an
 * ACTIVE staff member right now. The token's claims can be up to an hour old; is_staff()
 * is not — so a deactivated employee is stopped here even before their token refreshes.
 *
 * Route Handlers under this segment (document links) are not wrapped by layouts, and
 * repeat these checks themselves.
 */
export const dynamic = "force-dynamic";

export default async function StaffGuard({ children }: { children: ReactNode }) {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getClaims();
  const session = sessionKind((data?.claims as AccessTokenClaims | undefined) ?? null);

  if (session.kind !== "staff") redirect("/admin/login?reason=staff-sign-in-required");
  if (!(await isStaff())) redirect("/admin/login?reason=inactive");
  const staff = await getStaffContext();
  if (!staff) redirect("/admin/login?reason=inactive");

  return <AdminShell staff={staff}>{children}</AdminShell>;
}
