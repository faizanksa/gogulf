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
 * A production deploy is checked too, for the opposite failure: that it carries
 * the Supabase configuration and server mode it needs. See the isProductionDeploy
 * branch — a production build missing NEXT_PUBLIC_SUPABASE_* ships a site that
 * loses every job application without logging anything. It must also name a
 * project that carries the platform schema (not Tokyo, which has 0001 only), and
 * its URL, anon key and service-role key must all belong to that one project.
 *
 * Exit 0 = isolated, and correctly configured if this is production. Exit 1 =
 * production is reachable from somewhere it must not be, or a production build
 * is missing configuration it cannot work without.
 */

// The live production projects. Hard-coded on purpose: this guard must not be
// defeatable by editing an environment variable. Both refs are listed for the
// duration of the Tokyo -> Mumbai migration, so neither can leak into a
// non-production environment while the two run side by side. Drop the Tokyo ref
// when it is decommissioned.
const PRODUCTION_PROJECT_REFS = new Map([
  ["julbqkeyvzwluayokcdi", "PRODUCTION Tokyo, ap-northeast-1"],
  ["exsnksrmkycloxiajwmx", "PRODUCTION Mumbai, ap-south-1"],
]);

const isProductionRef = (ref) => ref !== null && PRODUCTION_PROJECT_REFS.has(ref);

// Tokyo production carries migration 0001 only. This build is the server-mode
// platform: public job pages read `jobs` (0012), the apply form writes `job_id`
// (0013) and /admin needs 0002–0014. A production build against Tokyo cannot work,
// so it is refused by name until the cutover moves the Supabase URL, anon key and
// service-role key to Mumbai together. Drop this with the Tokyo ref above.
const PRE_PLATFORM_PRODUCTION_REF = "julbqkeyvzwluayokcdi";

const mode = (process.argv.find((a) => a.startsWith("--mode=")) ?? "--mode=production").split("=")[1];

// Locally, read env exactly as Next.js will — same files, same precedence
// (.env.<mode>.local > .env.local > .env.<mode> > .env, never overriding a
// variable already set in the shell). Checking raw process.env alone would miss
// production values sitting in an env file, which is the whole point.
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
  console.log("Production deploy — the production database is expected here.");

  // Skipping the isolation check is not the same as skipping every check. The
  // likelier production failure is the opposite one, and it is silent: a build
  // with no Supabase configuration at all.
  //
  // NEXT_PUBLIC_* values are frozen into the browser bundle by `next build` and
  // never re-read afterwards, so a missing variable here is not a runtime
  // warning — it ships. `lib/supabase.js` then reports isSupabaseConfigured
  // false, submitJobApplication throws before uploading, and ApplyForm returns
  // from its catch *before* the Resend call. The applicant sees an upload error
  // and the application is lost whole: no row, no document, no notification,
  // and nothing server-side to alert anyone.
  //
  // On 16 Sep 2026 production was in exactly this state and kept working only
  // because the deployed artifact still carried keys from an earlier build.
  const required = {
    NEXT_PUBLIC_SUPABASE_URL: "the applications database and document storage",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "the applications database and document storage",
    PLATFORM_MODE: "server mode — without it the build falls back to a static export",
  };
  const missing = Object.entries(required).filter(([name]) => !process.env[name]);

  if (missing.length > 0) {
    console.error("\nFAIL — production build is missing required configuration:\n");
    for (const [name, why] of missing) console.error(`  ${name} — ${why}`);
    console.error(
      "\nSet these in the Vercel Production environment before deploying:\n\n" +
        "  npx vercel env add <NAME> production\n\n" +
        "A production build without them deploys a site that silently loses every\n" +
        "job application. Environment changes only affect *future* builds, so the\n" +
        "variables must exist before the build, not after it.\n",
    );
    process.exit(1);
  }

  if (process.env.PLATFORM_MODE !== "server") {
    console.error(
      `\nFAIL — PLATFORM_MODE is "${process.env.PLATFORM_MODE}", not "server".\n\n` +
        "A static export drops /admin, /portal and every /api/forms route.\n",
    );
    process.exit(1);
  }

  const productionUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const urlRef = refOf(productionUrl);
  console.log(`Supabase API: ${describe(productionUrl)}`);
  console.log(`Razorpay: ${razorpayMode()} key`);

  if (urlRef === PRE_PLATFORM_PRODUCTION_REF) {
    console.error(
      `\nFAIL — NEXT_PUBLIC_SUPABASE_URL names Tokyo production (${urlRef}), which has migration 0001 only.\n\n` +
        "This build reads jobs from the database and writes job_id on every application,\n" +
        "so against Tokyo the job pages fail and applications are lost. It deploys only\n" +
        "after the cutover switches NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY\n" +
        "and SUPABASE_SERVICE_ROLE_KEY to Mumbai production together.\n" +
        "See docs/MAIN-RELEASE-READINESS.md. The live deployment is unaffected by this failure.\n",
    );
    process.exit(1);
  }

  // The URL and both keys must name one project. A key from another project is
  // refused by PostgREST (PGRST301) on every call that uses it — for the service-role
  // key, on every webhook delivery. Only the `ref` claim is read, never printed beyond it.
  const mismatched = ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"]
    .map((name) => [name, jwtRef(process.env[name])])
    .filter(([, ref]) => ref !== null && urlRef !== null && ref !== urlRef);
  if (mismatched.length > 0) {
    console.error(`\nFAIL — the Supabase keys do not belong to the project in NEXT_PUBLIC_SUPABASE_URL (${urlRef}):\n`);
    for (const [name, ref] of mismatched) console.error(`  ${name} belongs to ${ref}`);
    console.error("\nSwitch the URL, the anon key and the service-role key together, in one change.\n");
    process.exit(1);
  }

  console.log("PASS — production build carries its required configuration.");
  process.exit(0);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const dbUrl = process.env.SUPABASE_DB_URL ?? "";
const failures = [];

/** live / test / none — from the key id prefix; the key itself is never printed. */
function razorpayMode() {
  const id = process.env.RAZORPAY_KEY_ID ?? "";
  if (id.startsWith("rzp_live_")) return "live";
  if (id.startsWith("rzp_test_")) return "test";
  return id ? "unrecognised" : "no";
}

function refOf(value) {
  // https://<ref>.supabase.co   or   postgres://…@db.<ref>.supabase.co:5432/…
  const match = value.match(/(?:https?:\/\/|@db\.)([a-z0-9]{20})\.supabase\./i);
  return match?.[1] ?? null;
}

function describe(url) {
  if (!url) return "not configured";
  // Loopback in any URL form: http://127.0.0.1:54321 or postgresql://…@127.0.0.1:54322/…
  if (/(^[a-z]+:\/\/|@)(127\.0\.0\.1|localhost)(:\d+)?([/?]|$)/i.test(url)) return "LOCAL Supabase";
  const ref = refOf(url);
  if (isProductionRef(ref)) return `${PRODUCTION_PROJECT_REFS.get(ref)} (${ref})`;
  if (ref) return `project ${ref}`;
  return "non-Supabase value (storage disabled)";
}

console.log(`Supabase API: ${describe(supabaseUrl)}`);
if (dbUrl) console.log(`Supabase DB:  ${describe(dbUrl.replace(/:[^:@/]+@/, ":***@"))}`);

if (isProductionRef(refOf(supabaseUrl))) {
  failures.push("NEXT_PUBLIC_SUPABASE_URL points at the PRODUCTION Supabase project.");
}
if (isProductionRef(refOf(dbUrl))) {
  failures.push("SUPABASE_DB_URL points at the PRODUCTION Supabase project.");
}

/**
 * The project ref inside a Supabase legacy key (a JWT), or null. Only `ref` is
 * decoded — nothing else from the token is read, logged or kept. Newer
 * publishable/secret keys are not JWTs and return null: the URL check is the
 * primary guard, this is a secondary one.
 */
function jwtRef(value) {
  if (!value) return null;
  try {
    const payload = JSON.parse(Buffer.from(String(value).split(".")[1] ?? "", "base64url").toString("utf8"));
    return typeof payload?.ref === "string" ? payload.ref : null;
  } catch {
    return null;
  }
}

// A production key pasted in by another route is the same failure.
for (const name of ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"]) {
  if (isProductionRef(jwtRef(process.env[name]))) failures.push(`${name} is a PRODUCTION key.`);
}

// Razorpay keys carry their mode in the key id. A live key on a deployed
// non-production environment can take real money from a real card during a test,
// which is the payments equivalent of writing to the production database — so it
// fails this guard exactly as a production Supabase URL would.
//
// On a developer's own machine it is a warning, not a failure: live credentials do
// legitimately sit in .env.local, and lib/payments/razorpay.ts already refuses to
// create an order with them outside a production deployment. Breaking `npm run dev`
// would teach people to delete the guard.
console.log(`Razorpay: ${razorpayMode()} key`);
if (razorpayMode() === "live") {
  if (label === "local") {
    console.warn(
      "\nWARNING — a LIVE Razorpay key is in scope for this local run.\n" +
        "  Order creation is refused outside production (lib/payments/razorpay.ts),\n" +
        "  and the webhook route only verifies signatures. Use test keys for payment work.\n",
    );
  } else {
    failures.push("RAZORPAY_KEY_ID is a LIVE key. Only a production deploy may carry live payment credentials.");
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
