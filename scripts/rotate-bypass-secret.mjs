/**
 * Rotate the Vercel automation-bypass secret for the `gogulf` project, and prove the
 * old one is dead.
 *
 *   node scripts/rotate-bypass-secret.mjs --status      # read only: when was it created
 *   node scripts/rotate-bypass-secret.mjs --rotate      # revoke + regenerate, then verify
 *
 * WHY THIS EXISTS
 *
 * The bypass secret is the one credential that turns the private staging site public to
 * anyone holding it. It leaks the way all header credentials leak — a failing HTTP client
 * prints its request headers into a log. When that happens the only real fix is rotation,
 * and rotation has to be easy enough that it actually gets done.
 *
 * WHAT IT TOUCHES
 *
 * Only deployment protection on the `gogulf` project: who may bypass the password wall on
 * PREVIEW deployments. It does not touch production traffic, environment variables, DNS,
 * or any database. Scripts read the current secret from the API at call time
 * (scripts/perf/vercel-bypass.mjs), so they keep working across a rotation with no edit.
 *
 * SAFETY
 *
 *   - Neither the old nor the new secret is printed, logged or written to disk. The
 *     verification below reports only HTTP status codes.
 *   - --rotate is required; the default is a read-only status report.
 *   - The team and project are pinned by name.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const TEAM_SLUG = "faizan-chaudhary";
const PROJECT = "gogulf";
const STAGING_ORIGIN = "https://staging.gogulf.co";

const rotate = process.argv.includes("--rotate");

const authPath = [
  join(process.env.APPDATA ?? "", "com.vercel.cli", "Data", "auth.json"),
  join(process.env.APPDATA ?? "", "xdg.data", "com.vercel.cli", "auth.json"),
  join(process.env.LOCALAPPDATA ?? "", "com.vercel.cli", "Data", "auth.json"),
  join(process.env.HOME ?? "", ".local", "share", "com.vercel.cli", "auth.json"),
].find((p) => existsSync(p));
if (!authPath) {
  console.error("Vercel CLI login not found. Run `npx vercel login`.");
  process.exit(1);
}
const { token } = JSON.parse(readFileSync(authPath, "utf8"));

const api = async (path, init = {}) => {
  const res = await fetch(`https://api.vercel.com${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Vercel error bodies carry a code and message, never the secret itself.
    throw new Error(`${init.method ?? "GET"} ${path} → ${res.status} ${body?.error?.code ?? ""} ${body?.error?.message ?? ""}`);
  }
  return body;
};

const bypassOf = (project) =>
  Object.entries(project.protectionBypass ?? {})
    .filter(([, v]) => v?.scope === "automation-bypass")
    .map(([secret, v]) => ({ secret, createdAt: v.createdAt ? new Date(v.createdAt).toISOString() : null }));

/** Does this secret still open the private staging site? Reports a status code, nothing else. */
const opens = async (secret) => {
  const res = await fetch(STAGING_ORIGIN, {
    headers: secret ? { "x-vercel-protection-bypass": secret } : {},
    redirect: "manual",
  });
  return res.status;
};

/**
 * A rotation reaches the edge a few seconds after the API returns, so an immediate probe
 * can still see the old secret working and the new one not. Poll until both agree with
 * the new state, rather than reporting the race as a failure.
 */
const settle = async (check, attempts = 12, waitMs = 5000) => {
  for (let i = 0; i < attempts; i++) {
    if (await check()) return true;
    await new Promise((r) => setTimeout(r, waitMs));
  }
  return false;
};

const team = (await api("/v2/teams")).teams?.find((t) => t.slug === TEAM_SLUG);
if (!team) throw new Error(`team ${TEAM_SLUG} not reachable — the CLI token may have expired (\`npx vercel whoami\`).`);
const project = await api(`/v9/projects/${PROJECT}?teamId=${team.id}`);
const before = bypassOf(project);

console.log(`Project        : ${PROJECT} (team ${TEAM_SLUG})`);
console.log(`Bypass secrets : ${before.length}`);
for (const b of before) console.log(`  created ${b.createdAt}`);

if (!rotate) {
  console.log("\nRead-only status. Re-run with --rotate to revoke and regenerate.");
  process.exit(0);
}

if (before.length === 0) {
  console.log("\nNothing to rotate: no automation-bypass secret is configured.");
  process.exit(0);
}

const old = before[0];
const oldStatusBefore = await opens(old.secret);
console.log(`\nBefore rotation: the current secret opens staging with HTTP ${oldStatusBefore}`);

// revoke + regenerate in one call, so the project is never left without a secret.
await api(`/v1/projects/${project.id}/protection-bypass?teamId=${team.id}`, {
  method: "PATCH",
  body: JSON.stringify({ revoke: { secret: old.secret, regenerate: true } }),
});

const after = bypassOf(await api(`/v9/projects/${PROJECT}?teamId=${team.id}`));
const fresh = after.filter((b) => b.secret !== old.secret);
console.log(`After rotation : ${after.length} secret(s); ${fresh.length} new`);
for (const b of after) console.log(`  created ${b.createdAt}`);

const registered = fresh.length === 1 && !after.some((b) => b.secret === old.secret);
console.log(`\nRegistered     : ${registered ? "the old secret is gone, one new secret in its place" : "UNEXPECTED — check the dashboard"}`);

console.log("Waiting for the edge to pick the rotation up…");
const dead = await settle(async () => (await opens(old.secret)) !== 200);
const alive = await settle(async () => (await opens(fresh[0]?.secret)) === 200);
const noSecret = await opens(null);

console.log(`Old secret     : ${dead ? "refused" : "STILL OPENS STAGING"}`);
console.log(`New secret     : ${alive ? "opens staging" : "DOES NOT OPEN STAGING"}`);
console.log(`No secret      : HTTP ${noSecret} (302 to the SSO wall (or 401) means staging is still private)`);

const ok = registered && dead && alive && noSecret !== 200;
console.log(ok ? "\nPASS — rotated: the old secret no longer opens staging, the new one does." : "\nFAIL — check the project's Deployment Protection settings.");
process.exit(ok ? 0 : 1);
