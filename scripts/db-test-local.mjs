/**
 * Run the SQL test suites against the LOCAL Supabase database — and only there.
 *
 * It talks to the local database container over `docker exec`. There is no URL,
 * no connection string and no credential involved, so it is structurally
 * incapable of reaching a hosted project, production included.
 *
 *   npx supabase start        # applies supabase/migrations to a fresh local DB
 *   npm run db:test
 *
 * Each file runs in its own transaction and rolls back, so the local database is
 * left as it was found. Exit 0 = every assertion passed.
 */

import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const CONTAINER = "supabase_db_go-gulf";
const TEST_DIR = "supabase/tests";

const ps = spawnSync("docker", ["ps", "--filter", `name=^${CONTAINER}$`, "--format", "{{.Names}}"], {
  encoding: "utf8",
});
if (ps.status !== 0 || !ps.stdout.includes(CONTAINER)) {
  console.error(`Local Supabase is not running (no ${CONTAINER} container). Run: npx supabase start`);
  process.exit(1);
}

const files = readdirSync(TEST_DIR).filter((f) => f.endsWith(".sql")).sort();
let totalPass = 0;
let failedFiles = 0;

for (const file of files) {
  const sql = readFileSync(join(TEST_DIR, file), "utf8");
  const run = spawnSync(
    "docker",
    ["exec", "-i", CONTAINER, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-q", "-X"],
    { input: sql, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
  );

  const lines = `${run.stdout ?? ""}\n${run.stderr ?? ""}`.split(/\r?\n/);
  const passes = lines.filter((l) => /NOTICE:\s+PASS/.test(l)).map((l) => l.replace(/^.*NOTICE:\s+PASS\s+/, ""));
  const errors = lines.filter((l) => /ERROR:/.test(l)).map((l) => l.replace(/^.*ERROR:\s+/, ""));

  console.log(`\n=== ${file} ===`);
  for (const p of passes) console.log(`  PASS  ${p}`);
  totalPass += passes.length;

  if (run.status !== 0 || errors.length) {
    failedFiles++;
    for (const e of errors) console.log(`  FAIL  ${e}`);
    if (!errors.length) console.log(`  FAIL  psql exited ${run.status}`);
  }
}

console.log(`\n${totalPass} assertion(s) passed across ${files.length} file(s).`);
if (failedFiles) {
  console.log(`${failedFiles} file(s) FAILED — a failing file stops at its first failed assertion.`);
  process.exit(1);
}
console.log("ALL SQL SUITES PASSED");
