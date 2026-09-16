/**
 * Apply migrations to — and run the SQL suites against — the STAGING Supabase
 * project, and nothing else.
 *
 *   npm run db:staging -- push --dry-run    # list migrations staging has not applied
 *   npm run db:staging -- push              # apply supabase/migrations to staging
 *   npm run db:staging -- test              # run supabase/tests/*.sql on staging (each rolls back)
 *   npm run db:staging -- run <file.sql>    # run one SQL file on staging and print its output
 *
 * Credentials come from .env.staging.local (gitignored; Next.js never loads it):
 *   STAGING_SUPABASE_REF, STAGING_DB_HOST (session pooler), STAGING_DB_PASSWORD
 *
 * Production cannot be reached from here:
 *   - the production ref is hard-coded and refused;
 *   - the pooler routes on the user name `postgres.<ref>`, so a connection built
 *     from the staging ref can only ever land on the staging project;
 *   - the password travels in the child's environment, never in output.
 *
 * psql is borrowed from the local Supabase container (`npx supabase start`), so no
 * Postgres client needs installing. The connection itself goes to staging.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Every project that is, or is about to become, production. Both are listed for
// the duration of the Tokyo -> Mumbai migration: once Mumbai holds live data a
// one-ref guard would wave it through as if it were staging. Keep this in step
// with PRODUCTION_PROJECT_REFS in scripts/check-staging-isolation.mjs.
const PRODUCTION_REFS = ["julbqkeyvzwluayokcdi", "exsnksrmkycloxiajwmx"];
const ENV_FILE = ".env.staging.local";
const CONTAINER = "supabase_db_go-gulf";
const TEST_DIR = "supabase/tests";

const fail = (msg) => {
  console.error(`db:staging — ${msg}`);
  process.exit(1);
};

if (!existsSync(ENV_FILE)) fail(`${ENV_FILE} not found. See docs/STAGING.md.`);
const env = Object.fromEntries(
  readFileSync(ENV_FILE, "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);
const ref = env.STAGING_SUPABASE_REF ?? "";
const host = env.STAGING_DB_HOST ?? "";
const password = env.STAGING_DB_PASSWORD ?? "";

if (!/^[a-z]{20}$/.test(ref)) fail("STAGING_SUPABASE_REF is missing or malformed.");
for (const prodRef of PRODUCTION_REFS) {
  if (ref === prodRef || host.includes(prodRef)) fail(`the configured target is PRODUCTION (${prodRef}). Refusing.`);
}
if (!/^aws-\d+-[a-z0-9-]+\.pooler\.supabase\.com$/.test(host)) fail("STAGING_DB_HOST must be a Supabase session-pooler host.");
if (!password) fail("STAGING_DB_PASSWORD is missing.");

const user = `postgres.${ref}`;
const scrub = (s) => s.replaceAll(password, "[REDACTED]").replaceAll(encodeURIComponent(password), "[REDACTED]");
const [command, ...args] = process.argv.slice(2);
console.log(`Target: STAGING ${ref} (${host})`);

function psql(sql) {
  const ps = spawnSync("docker", ["ps", "--filter", `name=^${CONTAINER}$`, "--format", "{{.Names}}"], { encoding: "utf8" });
  if (ps.status !== 0 || !ps.stdout.includes(CONTAINER)) fail(`psql comes from the local ${CONTAINER} container — run: npx supabase start`);
  return spawnSync(
    "docker",
    ["exec", "-i", "-e", "PGPASSWORD", "-e", "PGSSLMODE", CONTAINER,
      "psql", "-h", host, "-p", "5432", "-U", user, "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-X"],
    {
      input: sql,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
      env: { ...process.env, PGPASSWORD: password, PGSSLMODE: "require" },
    },
  );
}

if (command === "push") {
  const url = `postgresql://${user}:${encodeURIComponent(password)}@${host}:5432/postgres`;
  const r = spawnSync("npx", ["supabase", "db", "push", "--db-url", url, "--yes", ...args.filter((a) => a === "--dry-run")], {
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  console.log(scrub(`${r.stdout ?? ""}${r.stderr ?? ""}`).trim());
  process.exit(r.status ?? 1);
}

if (command === "run") {
  if (!args[0] || !existsSync(args[0])) fail("usage: npm run db:staging -- run <file.sql>");
  const r = psql(readFileSync(args[0], "utf8"));
  console.log(scrub(`${r.stdout ?? ""}${r.stderr ?? ""}`).trim());
  process.exit(r.status ?? 1);
}

if (command === "test") {
  const files = readdirSync(TEST_DIR).filter((f) => f.endsWith(".sql")).sort();
  let totalPass = 0;
  let failedFiles = 0;
  for (const file of files) {
    const r = psql(`\\set QUIET on\n${readFileSync(join(TEST_DIR, file), "utf8")}`);
    const lines = scrub(`${r.stdout ?? ""}\n${r.stderr ?? ""}`).split(/\r?\n/);
    const passes = lines.filter((l) => /NOTICE:\s+PASS/.test(l)).map((l) => l.replace(/^.*NOTICE:\s+PASS\s+/, ""));
    const errors = lines.filter((l) => /(ERROR|FATAL|CONTEXT):/.test(l)).map((l) => l.replace(/^.*(ERROR|FATAL):\s+/, ""));
    console.log(`\n=== ${file} ===`);
    for (const p of passes) console.log(`  PASS  ${p}`);
    totalPass += passes.length;
    if (r.status !== 0 || errors.length) {
      failedFiles++;
      for (const e of errors) console.log(`  FAIL  ${e}`);
      if (!errors.length) console.log(`  FAIL  psql exited ${r.status}`);
    }
  }
  console.log(`\n${totalPass} assertion(s) passed across ${files.length} file(s) on STAGING.`);
  if (failedFiles) {
    console.log(`${failedFiles} file(s) FAILED — a failing file stops at its first failed assertion.`);
    process.exit(1);
  }
  console.log("ALL SQL SUITES PASSED ON STAGING");
  process.exit(0);
}

fail("usage: npm run db:staging -- push [--dry-run] | test | run <file.sql>");
