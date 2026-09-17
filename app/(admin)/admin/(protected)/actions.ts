"use server";

import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";

/** End the staff session on this device and return to the sign-in page. */
export async function signOut() {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/admin/login?reason=signed-out");
}
