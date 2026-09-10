/**
 * Refuse to let any non-production environment point at the production database.
 *
 *   LOCAL      -> local Supabase        (supabase start)
 *   STAGING    -> staging Supabase      (never production)
 *   PREVIEW    -> no production access
 *   PRODUCTION -> production Supabase   (the only place it is allowed)
 *
 * The failure this prevents is quiet and expensive: an environment configured
 * with the production Supabase URL reads — and eventually writes — real
 * candidate records and passport scans, while everyone believes they are using
 * synthetic data. On 6 Sep 2026 this repository's own .env.local was found to be
 * doing exactly that; see docs/LEGACY-DATA-INSPECTION.md §15.
 *
 * Wired into predev / prebuild / prebuild:server / prestart, so it runs before
 * every local server or build and before every Vercel build.
 *
 *   node scripts/check-staging-isolation.mjs                 # as `next build` sees env
 *   node scripts/check-staging-isolation.mjs --mode=development   # as `next dev` sees env
 *
 * Exit 0 = isolated (or a genuine production deploy). Exit 1 = production is
 * reachable from somewhere it must not be.
 */

// The live production project. Hard-coded on purpose: this guard must not be
// defeatable by editing an environment variable.
const PRODUCTION_PROJECT_REF = "julbqkeyvzwluayokcdi";

const mode = (process.argv.find((a) => a.startsWith("--mode=")) ?? "--mode=production").split("=")[1];

// Locally, read env exactly as Next.js will — same files, same precedence
// (.env.<mode>.local > .env.local > .env.<mode> > .env, never overriding a
// variable already set in the shell). Checking raw process.env alone would miss
// the production values sitting in .env.local, which is the whole point.
// On Vercel the platform injects env directly and there are no env files.
if (!process.env.VERCEL) {
  // @next/env is CommonJS: under ESM dynamic import its exports sit on `default`.
  const nextEnv = await import("@next/env");
  const loadEnvConfig = nextEnv.loadEnvConfig ?? nextEnv.default?.loadEnvConfig;
  const { loadedEnvFiles } = loadEnvConfig(process.cwd(), mode === "development", {
    info: () => {},
    error: () => {},
  });
  const files = loadedEnvFiles.map((f) => f.path).join(", ") || "none";
  console.log(`Env files (as next ${mode === "development" ? "dev" : "build/start"} loads them): ${files}`);
}

const appEnv = process.env.APP_ENV ?? "";
const vercelEnv = process.env.VERCEL_ENV ?? "";
const isProductionDeploy = vercelEnv === "production" && appEnv !== "staging";

const label = appEnv || vercelEnv || "local";
console.log(`Environment: ${label}`);

if (isProductionDeploy) {
  console.log("Production deploy — the production database is expected here. Skipping.");
  process.exit(0);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const dbUrl = process.env.SUPABASE_DB_URL ?? "";
const failures = [];

function refOf(value) {
  // https://<ref>.supabase.co   or   postgres://…@db.<ref>.supabase.co:5432/…
  const match = value.match(/(?:https?:\/\/|@db\.)([a-z0-9]{20})\.supabase\./i);
  return match?.[1] ?? null;
}

function describe(url) {
  if (!url) return "not configured";
  if (/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/i.test(url)) return "LOCAL Supabase";
  const ref = refOf(url);
  if (ref === PRODUCTION_PROJECT_REF) return `PRODUCTION (${ref})`;
  if (ref) return `project ${ref}`;
  return "non-Supabase value (storage disabled)";
}

console.log(`Supabase API: ${describe(supabaseUrl)}`);
if (dbUrl) console.log(`Supabase DB:  ${describe(dbUrl.replace(/:[^:@/]+@/, ":***@"))}`);

if (refOf(supabaseUrl) === PRODUCTION_PROJECT_REF) {
  failures.push("NEXT_PUBLIC_SUPABASE_URL points at the PRODUCTION Supabase project.");
}
if (refOf(dbUrl) === PRODUCTION_PROJECT_REF) {
  failures.push("SUPABASE_DB_URL points at the PRODUCTION Supabase project.");
}

// A production key pasted in by another route is the same failure. Supabase
// legacy keys are JWTs carrying the project ref; only `ref` is decoded — nothing
// else from the token is read, logged or kept.
for (const [name, value] of Object.entries({
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
})) {
  if (!value) continue;
  try {
    const payload = JSON.parse(
      Buffer.from(String(value).split(".")[1] ?? "", "base64url").toString("utf8"),
    );
    if (payload?.ref === PRODUCTION_PROJECT_REF) failures.push(`${name} is a PRODUCTION key.`);
  } catch {
    // Not a decodable JWT (newer publishable key format). The URL check is the
    // primary guard; this is a secondary one.
  }
}

if (failures.length === 0) {
  console.log("PASS — this environment cannot reach the production database.");
  process.exit(0);
}

console.error(`\nFAIL — ${label} is configured against PRODUCTION:\n`);
for (const f of failures) console.error(`  ${f}`);
console.error(
  label === "local"
    ? "\nLocal development must use local Supabase. Run:\n\n" +
        "  npx supabase start\n  npm run env:local\n\n" +
        "That writes .env.development.local and .env.production.local, which Next.js\n" +
        "loads ahead of .env.local. Your .env.local is left untouched.\n"
    : "\nPoint this environment at its own Supabase project, or leave Supabase\n" +
        "unset so document storage is disabled. Production holds real candidate\n" +
        "records and passport scans.\n",
);
process.exit(1);
