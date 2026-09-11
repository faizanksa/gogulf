/**
 * The Vercel automation-bypass secret for the private staging deployment.
 *
 * Read at run time from the Vercel CLI's own login (or VERCEL_AUTOMATION_BYPASS_SECRET),
 * held in memory, never printed and never written to disk. Callers must scope it to
 * requests bound for staging only — see staging-proxy.mjs and tests/e2e/fixtures.ts.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const STAGING_ORIGIN = "https://staging.gogulf.co";

let cached;

export async function getStagingBypass() {
  if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET) return process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  if (cached) return cached;

  const authPath = [
    join(process.env.APPDATA ?? "", "com.vercel.cli", "Data", "auth.json"),
    join(process.env.APPDATA ?? "", "xdg.data", "com.vercel.cli", "auth.json"),
    join(process.env.LOCALAPPDATA ?? "", "com.vercel.cli", "Data", "auth.json"),
    join(process.env.HOME ?? "", ".local", "share", "com.vercel.cli", "auth.json"),
  ].find((p) => existsSync(p));
  if (!authPath) throw new Error("Vercel CLI login not found. Run `npx vercel login`.");

  const { token } = JSON.parse(readFileSync(authPath, "utf8"));
  const api = async (path) =>
    (await fetch(`https://api.vercel.com${path}`, { headers: { Authorization: `Bearer ${token}` } })).json();

  const team = (await api("/v2/teams")).teams?.find((t) => t.slug === "faizan-chaudhary");
  if (!team) throw new Error("Vercel team not reachable — the CLI token may have expired. `npx vercel whoami` refreshes it.");
  const project = await api(`/v9/projects/gogulf?teamId=${team.id}`);
  const secret = Object.entries(project.protectionBypass ?? {}).find(([, v]) => v?.scope === "automation-bypass")?.[0];
  if (!secret) throw new Error("No automation bypass is configured on the project.");

  cached = secret;
  return secret;
}
