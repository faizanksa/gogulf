/**
 * Load the STAGING TEST jobs into the LOCAL Supabase database — for the end-to-end suite
 * and local QA. Talks to the local container over `docker exec`, with no URL or
 * credential, so it cannot reach a hosted project.
 *
 *   npx supabase start
 *   npm run db:seed:local
 */

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const CONTAINER = "supabase_db_go-gulf";
const ps = spawnSync("docker", ["ps", "--filter", `name=^${CONTAINER}$`, "--format", "{{.Names}}"], { encoding: "utf8" });
if (ps.status !== 0 || !ps.stdout.includes(CONTAINER)) {
  console.error(`Local Supabase is not running (no ${CONTAINER} container). Run: npx supabase start`);
  process.exit(1);
}

const sql = `set app.seed_target = 'staging';
${readFileSync("supabase/seeds/staging-jobs.sql", "utf8")}`;
const run = spawnSync("docker", ["exec", "-i", CONTAINER, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-q", "-X"], {
  input: sql,
  encoding: "utf8",
});
process.stdout.write(run.stdout ?? "");
process.stderr.write(run.stderr ?? "");
process.exit(run.status ?? 1);
