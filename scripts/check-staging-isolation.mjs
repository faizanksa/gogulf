/**
 * Refuse to let a non-production environment point at the production database.
 *
 * The failure this prevents is quiet and expensive: staging configured with a
 * production Supabase URL would read — and eventually write — real candidate
 * records and passport scans, while everyone believed they were using synthetic
 * data.
 *
 * Run in CI for staging and preview builds, and locally before pointing the app
 * at anything.
 *
 *   node --env-file=.env.local scripts/check-staging-isolation.mjs
 *   APP_ENV=staging node scripts/check-staging-isolation.mjs
 *
 * Exit 0 = isolated, exit 1 = staging is touching production.
 */

// The live production project. Hard-coded on purpose: this guard must not be
// defeatable by editing an environment variable.
const PRODUCTION_PROJECT_REF = "julbqkeyvzwluayokcdi";

const appEnv = process.env.APP_ENV ?? "";
const vercelEnv = process.env.VERCEL_ENV ?? "";
const isProductionDeploy = vercelEnv === "production" && appEnv !== "staging";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const dbUrl = process.env.SUPABASE_DB_URL ?? "";

const label = appEnv || vercelEnv || "local";
console.log(`Environment: ${label}`);

const failures = [];

function refOf(value) {
  // https://<ref>.supabase.co  or  postgres://…@db.<ref>.supabase.co:5432/…
  const match = value.match(/(?:https?:\/\/|@db\.)([a-z0-9]{20})\.supabase\./i);
  return match?.[1] ?? null;
}

const urlRef = refOf(supabaseUrl);
const dbRef = refOf(dbUrl);

if (urlRef) console.log(`Supabase project ref (API): ${urlRef}`);
if (dbRef) console.log(`Supabase project ref (DB):  ${dbRef}`);
if (!urlRef && !dbRef) console.log("No Supabase project configured.");

if (isProductionDeploy) {
  console.log("Production deploy — production database is expected here. Skipping.");
  process.exit(0);
}

// Non-production must not reference production.
if (urlRef === PRODUCTION_PROJECT_REF) {
  failures.push("NEXT_PUBLIC_SUPABASE_URL points at the PRODUCTION Supabase project.");
}
if (dbRef === PRODUCTION_PROJECT_REF) {
  failures.push("SUPABASE_DB_URL points at the PRODUCTION Supabase project.");
}

// A production key pasted into staging is the same failure by another route.
for (const [name, value] of Object.entries({
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
})) {
  if (!value) continue;
  // Supabase keys are JWTs whose payload carries the project ref. Decode only
  // the ref; nothing else from the token is read, logged or stored.
  try {
    const payload = JSON.parse(
      Buffer.from(String(value).split(".")[1] ?? "", "base64url").toString("utf8"),
    );
    if (payload?.ref === PRODUCTION_PROJECT_REF) {
      failures.push(`${name} is a PRODUCTION key.`);
    }
  } catch {
    // Not a decodable JWT (newer publishable key formats). The URL check above
    // is the primary guard; this is a secondary one.
  }
}

if (failures.length === 0) {
  console.log("PASS — this environment is isolated from the production database.");
  process.exit(0);
}

console.error("\nFAIL — staging/preview is configured against PRODUCTION:\n");
for (const f of failures) console.error(`  ${f}`);
console.error(
  "\nProduction holds real candidate records and passport scans. Point this" +
  "\nenvironment at its own Supabase project before continuing.\n",
);
process.exit(1);
