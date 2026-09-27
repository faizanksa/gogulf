/**
 * The ONE privileged step of staff onboarding: a sign-in account for a new staff member.
 * AdminReason "staff-onboarding" — see lib/supabase/admin.ts, permitted use 6.
 *
 * Exactly what `npm run bootstrap:admins` does and docs/SECURITY-MODEL.md §3 requires:
 * an auth.users row with a CONFIRMED email and NO password. Confirmed, because Supabase
 * links a first Google sign-in only onto a verified address (anything else would be a
 * pre-account-takeover primitive). No password, because Google must be the only way in.
 *
 * It grants nothing. Authority comes from the staff_users row, which the caller has
 * already created through their own session (RLS decided), and which the JWT hook reads.
 *
 * Callers: app/(admin)/admin/(protected)/staff/actions.ts → inviteStaff, after
 * authorize("users.manage") and after the row insert. Asserted in actions-guard.test.ts.
 */

import "server-only";

import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { STAFF_DOMAIN, type LoginResult } from "./staff-onboarding";

/** Identity providers a staff account may already carry. Anything else is a customer's. */
const STAFF_PROVIDERS = new Set(["email", "google"]);
const PAGE = 1000;
const MAX_PAGES = 20;

export async function ensureStaffLogin(email: string): Promise<LoginResult> {
  if (!email.endsWith(`@${STAFF_DOMAIN}`)) return { ok: false, reason: "failed" };
  const admin = createAdminClient("staff-onboarding");

  // No password, no metadata, no role: the confirmed address is the whole account.
  const made = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (!made.error && made.data.user) return { ok: true, authUserId: made.data.user.id, created: true };
  if (made.error?.code !== "email_exists") {
    logger.warn("staff login creation failed", { code: made.error?.code ?? "no-user", status: made.error?.status });
    return { ok: false, reason: "failed" };
  }

  // An account already exists for this address — typically an earlier attempt that
  // stopped before linking. Adopt it only if it is exactly what we would have created.
  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PAGE });
    if (error) {
      logger.warn("staff login lookup failed", { code: error.code, status: error.status });
      return { ok: false, reason: "failed" };
    }
    const found = data.users.find((u) => (u.email ?? "").toLowerCase() === email);
    if (found) {
      if (!found.email_confirmed_at) return { ok: false, reason: "unconfirmed" };
      const providers = (found.identities ?? []).map((i) => i.provider);
      if (found.phone || providers.some((p) => !STAFF_PROVIDERS.has(p))) return { ok: false, reason: "not-staff-shaped" };
      return { ok: true, authUserId: found.id, created: false };
    }
    if (data.users.length < PAGE) break;
  }
  logger.warn("staff login reported existing but was not found");
  return { ok: false, reason: "failed" };
}
