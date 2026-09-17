/**
 * Create the Go Gulf staff identities on a named Supabase project.
 *
 *   npm run bootstrap:admins -- --target=mumbai-staging
 *   npm run bootstrap:admins -- --target=mumbai-staging --report
 *
 * For each person on the STAFF roster below:
 *   - an auth.users row, email confirmed, WITH NO PASSWORD
 *   - a staff_users row with their catalogue role, Lucknow branch, active
 *
 * WHY NO PASSWORD
 *
 * Staff sign in with Google Workspace. An account with no password cannot be
 * authenticated by password at all, so the only way in is the intended one —
 * there is no second, weaker door to forget about. The first Google sign-in
 * links the identity to this row automatically, matching on the confirmed email
 * address; that is why email_confirm is set here and not left for later.
 * Supabase refuses to auto-link onto an unverified address, and doing so would
 * be a pre-account-takeover primitive. See docs/SECURITY-MODEL.md section 3.
 *
 * Every person is an independent identity. There is no shared administrator
 * account and no one is a fallback for anyone else: each is created, claimed and
 * tested separately, because one working login proves nothing about the others.
 * The script fails outright if two people ever resolve to the same record.
 *
 * WHAT THIS DOES NOT DO
 *
 * It grants nothing directly. Authority comes from the staff_users row, which
 * the JWT hook reads to populate app_role, and from there RLS and has_perm()
 * decide everything. This script cannot widen a permission or weaken a policy —
 * it can only state which catalogue role a person holds and let the existing
 * architecture draw the consequences. Roles come from the seeded catalogue; a
 * role that is not already in public.roles is refused rather than created, so
 * nobody gets a bespoke role shaped around what they happened to need.
 *
 * SAFETY
 *
 *   - Each target pins the one project ref it may touch; anything else is
 *     refused by name before a request is made.
 *   - Idempotent: an existing auth user or staff row is adopted, never
 *     duplicated and never silently overwritten with different values.
 *   - Secrets are read from gitignored files and never printed.
 */

import { existsSync, readFileSync } from "node:fs";

const TARGETS = {
  "mumbai-staging": {
    label: "MUMBAI STAGING (rehearsal)",
    envFile: ".env.mumbai-staging.local",
    expectRef: "noxireidrbeqcvsirjec",
    vars: { url: "MUMBAI_STAGING_URL", key: "MUMBAI_STAGING_SERVICE_ROLE_KEY" },
  },
  "mumbai-production": {
    label: "MUMBAI PRODUCTION",
    envFile: ".env.prod-supabase.local",
    expectRef: "exsnksrmkycloxiajwmx",
    vars: { url: "NEXT_PUBLIC_SUPABASE_URL", key: "SUPABASE_SERVICE_ROLE_KEY" },
    requiresConfirmation: "--yes-bootstrap-production-admins",
  },
};

// The staff roster, with each person's role stated next to them. Roles are keys
// from the seeded RBAC catalogue — never invented here, and never a bespoke role
// created to fit one person. If a role does not exist in public.roles the script
// refuses rather than falling back to something broader.
const STAFF = [
  { email: "admin@gogulf.co", full_name: "Go Gulf Administrator", role: "SUPER_ADMIN" },
  { email: "hello@gogulf.co", full_name: "Go Gulf Operations", role: "SUPER_ADMIN" },
  { email: "careers@gogulf.co", full_name: "Go Gulf Careers", role: "ADMIN" },
];

const BRANCH = "Lucknow";

const argv = process.argv.slice(2);
const targetName = (argv.find((a) => a.startsWith("--target=")) ?? "--target=").split("=")[1];

const fail = (msg) => {
  console.error(`\nFAIL - ${msg}\n`);
  process.exit(1);
};

const target = TARGETS[targetName];
if (!target) fail(`--target is required. Known: ${Object.keys(TARGETS).join(", ")}.`);
if (target.requiresConfirmation && !argv.includes(target.requiresConfirmation)) {
  fail(`"${targetName}" is production. Re-run with ${target.requiresConfirmation} if that is what you mean.`);
}
if (!existsSync(target.envFile)) fail(`${target.envFile} not found.`);

const env = Object.fromEntries(
  readFileSync(target.envFile, "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);
const url = (env[target.vars.url] ?? "").replace(/\/+$/, "");
const key = env[target.vars.key] ?? "";
if (!url || !key) fail(`${target.vars.url} or ${target.vars.key} missing from ${target.envFile}.`);

const ref = url.match(/https:\/\/([a-z0-9]{20})\.supabase\./i)?.[1] ?? null;
if (ref !== target.expectRef) {
  fail(`${target.envFile} resolves to ${ref}, but "${targetName}" may only touch ${target.expectRef}. Refusing.`);
}

const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

async function api(path, init = {}) {
  const res = await fetch(`${url}${path}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) } });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { ok: res.ok, status: res.status, body };
}

console.log(`Target : ${target.label} ${ref}`);
console.log(`Branch : ${BRANCH}`);
console.log(`Roster : ${STAFF.map((p) => `${p.email}=${p.role}`).join(", ")}`);
console.log("");

// The branch must already exist — it is seeded by migration, not invented here.
const branches = await api(`/rest/v1/branches?select=id,name&name=eq.${encodeURIComponent(BRANCH)}`);
if (!branches.ok || !Array.isArray(branches.body) || branches.body.length !== 1) {
  fail(`expected exactly one branch named ${BRANCH}; found ${Array.isArray(branches.body) ? branches.body.length : "none"}. Is the schema provisioned?`);
}
const branchId = branches.body[0].id;

// Every role on the roster must already exist in the seeded catalogue.
const wanted = [...new Set(STAFF.map((p) => p.role))];
const roles = await api(`/rest/v1/roles?select=key,is_super&key=in.(${wanted.join(",")})`);
if (!roles.ok) fail(`could not read roles: HTTP ${roles.status}`);
const known = new Map((roles.body ?? []).map((r) => [r.key, r.is_super]));
for (const roleKey of wanted) {
  if (!known.has(roleKey)) fail(`role ${roleKey} is not in the RBAC catalogue. Is the seed applied? Roles are never created here.`);
}

const results = [];

for (const admin of STAFF) {
  const line = { email: admin.email, role: admin.role, auth: null, staff: null, authUserId: null, staffId: null };

  // --- auth.users -----------------------------------------------------------
  // Adopt an existing user rather than failing or replacing it: re-running this
  // after a partial run must converge, not collide.
  const existing = await api(`/auth/v1/admin/users?per_page=1000`);
  if (!existing.ok) fail(`could not list auth users: HTTP ${existing.status}`);
  const found = (existing.body?.users ?? []).find((u) => (u.email ?? "").toLowerCase() === admin.email);

  if (found) {
    line.authUserId = found.id;
    line.auth = found.email_confirmed_at ? "existing (confirmed)" : "existing (UNCONFIRMED)";
    if (!found.email_confirmed_at) {
      const fix = await api(`/auth/v1/admin/users/${found.id}`, {
        method: "PUT",
        body: JSON.stringify({ email_confirm: true }),
      });
      line.auth = fix.ok ? "existing (confirmed now)" : `existing (COULD NOT CONFIRM: ${fix.status})`;
    }
  } else {
    // No password: Google is the only way in. email_confirm is what makes the
    // first Google sign-in link to this row instead of being refused.
    const made = await api(`/auth/v1/admin/users`, {
      method: "POST",
      body: JSON.stringify({ email: admin.email, email_confirm: true }),
    });
    if (!made.ok) fail(`could not create ${admin.email}: HTTP ${made.status} ${JSON.stringify(made.body).slice(0, 200)}`);
    line.authUserId = made.body.id;
    line.auth = "created (no password, confirmed)";
  }

  // --- staff_users ----------------------------------------------------------
  const staff = await api(`/rest/v1/staff_users?select=id,role_key,branch_id,is_active,auth_user_id&auth_user_id=eq.${line.authUserId}`);
  if (!staff.ok) fail(`could not read staff_users: HTTP ${staff.status} ${JSON.stringify(staff.body).slice(0, 200)}`);

  if (staff.body.length > 0) {
    const row = staff.body[0];
    line.staffId = row.id;
    const correct = row.role_key === admin.role && row.branch_id === branchId && row.is_active === true;
    if (correct) {
      line.staff = "existing (correct)";
    } else {
      // Converge rather than leave a half-right record, and say so.
      const upd = await api(`/rest/v1/staff_users?id=eq.${row.id}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ role_key: admin.role, branch_id: branchId, is_active: true }),
      });
      line.staff = upd.ok
        ? `existing (corrected from role=${row.role_key} active=${row.is_active})`
        : `existing (COULD NOT CORRECT: ${upd.status})`;
    }
  } else {
    const ins = await api(`/rest/v1/staff_users`, {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        auth_user_id: line.authUserId,
        email: admin.email,
        full_name: admin.full_name,
        role_key: admin.role,
        branch_id: branchId,
        is_active: true,
      }),
    });
    if (!ins.ok) fail(`could not create staff_users for ${admin.email}: HTTP ${ins.status} ${JSON.stringify(ins.body).slice(0, 300)}`);
    line.staffId = ins.body[0].id;
    line.staff = "created";
  }

  results.push(line);
}

// --- what happened ----------------------------------------------------------
console.log("Result:\n");
for (const r of results) {
  console.log(`  ${r.email}`);
  console.log(`    auth.users  : ${r.auth}`);
  console.log(`    staff_users : ${r.staff} — ${r.role}`);
  console.log(`    ids         : auth=${r.authUserId}  staff=${r.staffId}`);
}

const distinctAuth = new Set(results.map((r) => r.authUserId));
const distinctStaff = new Set(results.map((r) => r.staffId));
console.log("");
if (distinctAuth.size !== STAFF.length || distinctStaff.size !== STAFF.length) {
  fail("staff members do not have independent identities. They must never share a record.");
}
console.log(`PASS - ${STAFF.length} independent staff identities on ${ref}.`);
console.log("Anyone newly created cannot sign in yet: no password exists by design, and their first Google sign-in must link the identity.");
