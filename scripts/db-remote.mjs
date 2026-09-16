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
// Tokyo production is live and is never a target of this script, whatever an
// env file says. It is not in TARGETS and it is refused again here, because the
// cost of the two checks is nothing and the cost of missing is the real one.
const NEVER_A_TARGET = ["julbqkeyvzwluayokcdi"];
const CONTAINER = "supabase_db_go-gulf";
const TEST_DIR = "supabase/tests";

// Each target names its own gitignored credentials file and the three variables
// read from it. Stated in full rather than derived from a prefix: the variable
// names already differ between files, and guessing them is how a target ends up
// silently half-configured.
const TARGETS = {
  staging: {
    label: "TOKYO STAGING",
    envFile: ".env.staging.local",
    expectRef: "wxolbnhyzktfjdvcnixc",
    vars: { ref: "STAGING_SUPABASE_REF", host: "STAGING_DB_HOST", password: "STAGING_DB_PASSWORD" },
  },
  "mumbai-staging": {
    label: "MUMBAI STAGING (rehearsal)",
    envFile: ".env.mumbai-staging.local",
    expectRef: "noxireidrbeqcvsirjec",
    vars: { ref: "MUMBAI_STAGING_REF", host: "MUMBAI_STAGING_DB_HOST", password: "MUMBAI_STAGING_DB_PASSWORD" },
  },
  "mumbai-production": {
    label: "MUMBAI PRODUCTION",
    envFile: ".env.prod-supabase.local",
    expectRef: "exsnksrmkycloxiajwmx",
    // Derived from the project URL in that file rather than stored twice.
    vars: { url: "NEXT_PUBLIC_SUPABASE_URL", host: null, password: "MUMBAI_DB_PASSWORD" },
    host: "aws-0-ap-south-1.pooler.supabase.com",
    // This project becomes production at cutover. After that, a push here is a
    // production schema change, which is not something a mistyped --target
    // should be able to start.
    requiresConfirmation: "--yes-i-am-provisioning-production",
  },
};

const targetName = (process.argv.find((a) => a.startsWith("--target=")) ?? "--target=staging").split("=")[1];

const fail = (msg) => {
  console.error(`db:${targetName} — ${msg}`);
  process.exit(1);
};

const target = TARGETS[targetName];
if (!target) fail(`unknown target "${targetName}". Known: ${Object.keys(TARGETS).join(", ")}.`);
if (target.requiresConfirmation && !process.argv.includes(target.requiresConfirmation)) {
  fail(`"${targetName}" is the project that becomes production. Re-run with ${target.requiresConfirmation} if that is what you mean.`);
}

if (!existsSync(target.envFile)) fail(`${target.envFile} not found. See docs/STAGING.md.`);
const env = Object.fromEntries(
  readFileSync(target.envFile, "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);
const ref = target.vars.ref
  ? env[target.vars.ref] ?? ""
  : (env[target.vars.url] ?? "").match(/https:\/\/([a-z0-9]{20})\.supabase\./i)?.[1] ?? "";
const host = target.host ?? env[target.vars.host] ?? "";
const password = env[target.vars.password] ?? "";

if (!/^[a-z]{20}$/.test(ref)) fail(`could not read a project ref for target "${targetName}" from ${target.envFile}.`);

// Pinned allow-list, not a block-list. Each target may reach exactly one project
// and no other, so a credentials file that has been swapped, edited or pointed
// somewhere new is refused by name rather than being caught only if it happens
// to match a known-production ref.
if (ref !== target.expectRef) {
  fail(`${target.envFile} resolves to ${ref}, but target "${targetName}" may only reach ${target.expectRef}. Refusing.`);
}
for (const banned of NEVER_A_TARGET) {
  if (ref === banned || host.includes(banned)) fail(`${banned} is live production and is never a target of this script. Refusing.`);
}
if (!/^aws-\d+-[a-z0-9-]+\.pooler\.supabase\.com$/.test(host)) fail(`the pooler host for "${targetName}" is missing or malformed.`);
if (!password) fail(`${target.vars.password} is missing from ${target.envFile}.`);


const user = `postgres.${ref}`;
const scrub = (s) => s.replaceAll(password, "[REDACTED]").replaceAll(encodeURIComponent(password), "[REDACTED]");
const [command, ...args] = process.argv.slice(2).filter((a) => !a.startsWith("--target=") && !a.startsWith("--yes-i-am"));
console.log(`Target: ${target.label} ${ref} (${host})`);

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
  const dryRun = args.includes("--dry-run");
  const r = spawnSync("npx", ["supabase", "db", "push", "--db-url", url, "--yes", ...(dryRun ? ["--dry-run"] : [])], {
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  console.log(scrub(`${r.stdout ?? ""}${r.stderr ?? ""}`).trim());

  // `supabase db push` cannot be trusted to report its own outcome. On this
  // machine its pgdelta step fails reading a CA certificate from inside its
  // container (`/workspace/supabase/.temp/pgdelta/pgdelta-target-ca.crt`) and
  // exits non-zero — AFTER the migrations have been applied and recorded.
  // Observed twice, on Tokyo staging and again on the empty Mumbai project.
  //
  // A migration tool that reports failure on success is worse than one that
  // fails outright: during a cutover the natural response to that error is to
  // re-run it, or to abandon and roll back something that in fact worked. So
  // the exit code is not passed through. The database is asked directly, and
  // what it says is what gets reported.
  if (dryRun) process.exit(r.status ?? 1);

  const check = psql("select version from supabase_migrations.schema_migrations order by version;");
  if (check.status !== 0) {
    console.error(scrub(`${check.stdout ?? ""}${check.stderr ?? ""}`).trim());
    fail("migrations may or may not have applied — could not read schema_migrations to find out. Check before retrying.");
  }
  const applied = (check.stdout ?? "").split(/\r?\n/).map((l) => l.trim()).filter((l) => /^\d{4}$/.test(l));
  const onDisk = readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql")).map((f) => f.slice(0, 4)).sort();
  const missing = onDisk.filter((v) => !applied.includes(v));

  console.log(`\nVerified against the database, not the exit code:`);
  console.log(`  applied  : ${applied.length ? applied.join(", ") : "(none)"}`);
  if (missing.length === 0) {
    if (r.status !== 0) console.log(`  note     : the CLI exited ${r.status}, but every migration on disk is applied.`);
    console.log("\nPASS - the target carries every migration in supabase/migrations.");
    process.exit(0);
  }
  console.error(`  MISSING  : ${missing.join(", ")}`);
  fail(`${missing.length} migration(s) on disk are not applied to ${ref}.`);
}

if (command === "run") {
  if (!args[0] || !existsSync(args[0])) fail(`usage: npm run db:${targetName} -- run <file.sql>`);
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
  console.log(`\n${totalPass} assertion(s) passed across ${files.length} file(s) on ${target.label}.`);
  if (failedFiles) {
    console.log(`${failedFiles} file(s) FAILED — a failing file stops at its first failed assertion.`);
    process.exit(1);
  }
  console.log(`ALL SQL SUITES PASSED ON ${target.label}`);
  process.exit(0);
}

fail(`usage: npm run db:${targetName} -- push [--dry-run] | test | run <file.sql>`);
