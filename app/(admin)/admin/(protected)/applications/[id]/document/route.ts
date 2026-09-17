/**
 * GET /admin/applications/<id>/document?kind=cv|passport|other&n=<index>
 *
 * Opens one applicant document through a signed link that lives for 60 seconds.
 *
 * Route Handlers are not wrapped by the (protected) layout, so this repeats the checks:
 *   1. a verified staff session (proxy.ts has already classified it);
 *   2. record_document_access() — the database re-checks applications.screen and the
 *      document permission for this application's scope, and writes the audit entry
 *      BEFORE anything is issued; false means no link;
 *   3. Storage signs the link only if the staff read policy (0013) allows the object.
 * The path comes from the application row the staff member can read, never from the URL.
 */

import { NextResponse, type NextRequest } from "next/server";
import { sessionKind, type AccessTokenClaims } from "@/lib/auth/route-guard";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const BUCKET = "job-applications";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const kind = request.nextUrl.searchParams.get("kind");
  const n = Number(request.nextUrl.searchParams.get("n") ?? "0");
  const denied = () => new NextResponse("Not available.", { status: 404, headers: { "Cache-Control": "no-store" } });

  const supabase = await createServerSupabase();
  const { data: claims } = await supabase.auth.getClaims();
  if (sessionKind((claims?.claims as AccessTokenClaims | undefined) ?? null).kind !== "staff") return denied();
  if (!/^[0-9a-f-]{36}$/i.test(id) || !["cv", "passport", "other"].includes(kind ?? "") || !Number.isInteger(n) || n < 0) return denied();

  const { data: app } = await supabase.from("job_applications").select("cv_path, passport_path, other_paths").eq("id", id).maybeSingle();
  if (!app) return denied();
  const path = kind === "cv" ? app.cv_path : kind === "passport" ? app.passport_path : app.other_paths?.[n];
  if (!path) return denied();

  const { data: granted } = await supabase.rpc("record_document_access", { p_path: path });
  if (granted !== true) return denied();

  const { data: signed, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60);
  if (error || !signed?.signedUrl) return denied();

  return NextResponse.redirect(signed.signedUrl, { status: 303, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}
