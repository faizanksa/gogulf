/**
 * Staff onboarding — the procedure in docs/SECURITY-MODEL.md §3, offered on /admin/staff/new.
 *
 *   1. a staff_users row, written through the CALLER's session: RLS decides whether this
 *      person may create it (users.manage; a SUPER_ADMIN row needs roles.manage — 0009),
 *      and the audit trigger records it against the caller;
 *   2. only then, a sign-in account for that address: confirmed email, NO password
 *      (lib/admin/staff-login.ts, the one privileged step);
 *   3. the account is linked to the row, again through the caller's session.
 *
 * The person's first Google Workspace sign-in then links their Google identity to that
 * account. Nothing is emailed: whoever adds them tells them to sign in.
 *
 * Kept free of Next.js and Supabase so every rule is unit-tested with fakes. Re-running
 * with the same address resumes a half-finished invitation instead of duplicating it,
 * the same convergence `npm run bootstrap:admins` has.
 */

import type { ActionState } from "./action-state";

export const STAFF_DOMAIN = "gogulf.co";

const EMAIL = /^[a-z0-9](?:[a-z0-9._+-]{0,62}[a-z0-9])?@gogulf\.co$/;
const ROLE = /^[A-Z_]{3,40}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface StaffInvite {
  fullName: string;
  email: string;
  role: string;
  branchId: string;
}

export type Parsed<T> = { ok: true; value: T } | { ok: false; fieldErrors: Record<string, string> };

/** Read and normalise the form. Nothing here trusts the browser's own validation. */
export function parseStaffInvite(input: Record<string, unknown>): Parsed<StaffInvite> {
  const text = (k: string) => (typeof input[k] === "string" ? (input[k] as string) : "");
  const fullName = text("full_name").trim().replace(/\s+/g, " ");
  const email = text("email").trim().toLowerCase();
  const role = text("role").trim();
  const branchId = text("branch_id").trim();

  const fieldErrors: Record<string, string> = {};
  if (fullName.length < 2 || fullName.length > 100) fieldErrors.full_name = "Enter their full name (2 to 100 characters).";
  else if (/[<>{}]|\p{Cc}/u.test(fullName)) fieldErrors.full_name = "Use letters, spaces and ordinary punctuation only.";
  if (!email) fieldErrors.email = `Enter their @${STAFF_DOMAIN} address.`;
  else if (!email.endsWith(`@${STAFF_DOMAIN}`)) fieldErrors.email = `Staff sign in with Google Workspace, so the address must end in @${STAFF_DOMAIN}.`;
  else if (!EMAIL.test(email)) fieldErrors.email = `That is not a valid @${STAFF_DOMAIN} address.`;
  if (!ROLE.test(role)) fieldErrors.role = "Choose a role.";
  if (!UUID.test(branchId)) fieldErrors.branch_id = "Choose a branch.";

  return Object.keys(fieldErrors).length ? { ok: false, fieldErrors } : { ok: true, value: { fullName, email, role, branchId } };
}

/** What the database says about an address already on the staff list. */
export interface ExistingStaff {
  id: string;
  authUserId: string | null;
  isActive: boolean;
  role: string;
}

export type LoginResult =
  | { ok: true; authUserId: string; created: boolean }
  | { ok: false; reason: "unconfirmed" | "not-staff-shaped" | "failed" };

/** Everything onboarding touches, injected so the rules can be tested without a database. */
export interface OnboardingPorts {
  /** The caller also holds roles.manage — required to create a SUPER_ADMIN. */
  canCreateSuperAdmin: boolean;
  roleExists(key: string): Promise<boolean>;
  branchExists(id: string): Promise<boolean>;
  findStaff(email: string): Promise<ExistingStaff | null>;
  /** Through the caller's session. `conflict` = the address is already taken. */
  insertStaff(invite: StaffInvite): Promise<{ ok: true; id: string } | { ok: false; conflict: boolean }>;
  /** The privileged step. Called only after the row exists. */
  ensureLogin(email: string): Promise<LoginResult>;
  /**
   * Through the caller's session, only while the row has no login. `conflict` = that account
   * already belongs to another row. `linkedTo` = the row already had a login (the account id
   * it holds), e.g. another administrator finished the same invitation a moment earlier.
   */
  linkLogin(staffId: string, authUserId: string): Promise<{ ok: true } | { ok: false; conflict: boolean; linkedTo?: string | null }>;
}

export type OnboardingResult = NonNullable<ActionState> & { staffId?: string };

const LOGIN_FAILED: Record<Exclude<LoginResult, { ok: true }>["reason"], string> = {
  unconfirmed:
    "An unconfirmed sign-in account already exists for this address. It was not adopted, because confirming an account someone else created would hand it their access. Ask a developer to check it.",
  "not-staff-shaped":
    "A sign-in account already exists for this address with a customer sign-in method. Staff and customer accounts are kept separate, so it was not adopted. Ask a developer to check it.",
  failed: "The staff record is saved, but the sign-in account could not be created. Add the same address again to finish; nothing will be duplicated.",
};

export async function onboardStaff(input: Record<string, unknown>, ports: OnboardingPorts): Promise<OnboardingResult> {
  const parsed = parseStaffInvite(input);
  if (!parsed.ok) return { ok: false, message: "Some fields need attention.", fieldErrors: parsed.fieldErrors };
  const invite = parsed.value;

  if (invite.role === "SUPER_ADMIN" && !ports.canCreateSuperAdmin) {
    return { ok: false, message: "Only a super administrator can add another super administrator.", fieldErrors: { role: "You cannot give this role." } };
  }
  const [roleOk, branchOk] = await Promise.all([ports.roleExists(invite.role), ports.branchExists(invite.branchId)]);
  if (!roleOk || !branchOk) {
    const fieldErrors: Record<string, string> = {};
    if (!roleOk) fieldErrors.role = "That role does not exist.";
    if (!branchOk) fieldErrors.branch_id = "That branch does not exist.";
    return { ok: false, message: "Some fields need attention.", fieldErrors };
  }

  // 1. The staff record — or the one an earlier attempt left without a sign-in account.
  let staffId: string;
  let resumed = false;
  const existing = await ports.findStaff(invite.email);
  if (existing && !existing.isActive) {
    return {
      ok: false,
      message: "This address belongs to a deactivated staff member. Reactivate them on the Staff page instead.",
      fieldErrors: { email: "Already a staff member." },
    };
  }
  if (existing?.authUserId) {
    return { ok: false, message: "This address is already on the staff list.", fieldErrors: { email: "Already a staff member." } };
  }
  if (existing) {
    // Resuming writes nothing new before the privileged step, so apply here the rule the
    // database will apply to the link (0009): only roles.manage may touch a SUPER_ADMIN row.
    // Without this, a refused link would leave a login behind for nobody.
    if (existing.role === "SUPER_ADMIN" && !ports.canCreateSuperAdmin) {
      return { ok: false, message: "Only a super administrator can finish adding another super administrator." };
    }
    staffId = existing.id;
    resumed = true;
  } else {
    const inserted = await ports.insertStaff(invite);
    if (!inserted.ok) {
      return inserted.conflict
        ? { ok: false, message: "This address is already on the staff list.", fieldErrors: { email: "Already a staff member." } }
        : { ok: false, message: "The database refused to add this person. You may not have permission." };
    }
    staffId = inserted.id;
  }

  // 2. The sign-in account: confirmed, no password.
  const login = await ports.ensureLogin(invite.email);
  if (!login.ok) return { ok: false, message: LOGIN_FAILED[login.reason], staffId };

  // 3. Link them.
  const linked = await ports.linkLogin(staffId, login.authUserId);
  if (!linked.ok && linked.linkedTo === login.authUserId) {
    // Someone else linked this very account a moment ago: the person is onboarded.
    return { ok: true, staffId, message: "Staff member added." };
  }
  if (!linked.ok) {
    return {
      ok: false,
      staffId,
      message: linked.conflict
        ? "That sign-in account already belongs to another staff record. Nothing was changed on it."
        : "The staff record and sign-in account exist but could not be linked. Add the same address again to finish.",
    };
  }

  return {
    ok: true,
    staffId,
    message: resumed ? "Finished an earlier, incomplete invitation." : "Staff member added.",
  };
}

// ---------------------------------------------------------------------------
// Where each person is in onboarding — for the Staff screen
// ---------------------------------------------------------------------------

export interface SignInStatus {
  staff_id: string;
  has_login: boolean;
  email_confirmed: boolean;
  google_linked: boolean;
  google_last_sign_in: string | null;
}

export type OnboardingState = "signed-in" | "awaiting-sign-in" | "no-login" | "unconfirmed" | "unknown";

export function onboardingState(status: SignInStatus | undefined): OnboardingState {
  if (!status) return "unknown";
  if (!status.has_login) return "no-login";
  if (!status.email_confirmed) return "unconfirmed";
  return status.google_linked ? "signed-in" : "awaiting-sign-in";
}

export const ONBOARDING_LABELS: Record<OnboardingState, string> = {
  "signed-in": "Signed in with Google",
  "awaiting-sign-in": "Awaiting first sign-in",
  "no-login": "Invitation incomplete",
  unconfirmed: "Account needs checking",
  unknown: "Unknown",
};
