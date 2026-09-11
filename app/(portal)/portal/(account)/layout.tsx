import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { currentContactId } from "@/lib/auth/permissions";
import { sessionKind, type AccessTokenClaims } from "@/lib/auth/route-guard";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Layer 2 for /portal (layer 1 is proxy.ts, layer 3 is RLS: own records only).
 *
 * Re-classifies the verified session, then asks the database which contact this person
 * is. A customer session with no linked contact is not let in — it needs linking first.
 */
export const dynamic = "force-dynamic";

export default async function CustomerGuard({ children }: { children: ReactNode }) {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getClaims();
  const session = sessionKind((data?.claims as AccessTokenClaims | undefined) ?? null);

  if (session.kind === "staff") redirect("/admin");
  if (session.kind !== "customer") redirect("/portal/login?reason=customer-sign-in-required");
  if (!(await currentContactId())) redirect("/portal/login?reason=account-not-linked");

  return <>{children}</>;
}
