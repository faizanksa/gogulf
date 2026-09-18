/**
 * Team notes on a contact, read through the caller's own session — RLS applies the note
 * channel's permission and the contact's scope (0009). Never the service-role client.
 */

import "server-only";

import { createServerSupabase } from "@/lib/supabase/server";

export interface StaffNote {
  id: string;
  body: string;
  created_at: string;
  case_id: string | null;
  author: { full_name: string } | null;
}

export async function listNotes(contactId: string, limit = 30): Promise<StaffNote[]> {
  if (!/^[0-9a-f-]{36}$/i.test(contactId)) return [];
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("notes")
    .select("id,body,created_at,case_id,author:staff_users!notes_author_id_fkey(full_name)")
    .eq("contact_id", contactId)
    .eq("visibility", "team")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as unknown as StaffNote[];
}
