// Fails the build if a server-only secret reached the browser bundle.
//
// ESLint cannot do this — it sees variable names, not values. This reads the
// real secret values and searches the compiled client output for them. If a
// secret is found there, it has been shipped to every visitor and must be
// rotated, not just removed.
//
// Which values: the union of
//   1. the environment exactly as `next build` sees it — @next/env in production
//      mode, so .env.production.local wins over .env.local just as it does in the
//      build (on Vercel, the platform environment); and
//   2. every server-only value found in ANY local .env* file, loaded or not
//      (.env.staging.local, .env.prod-supabase.local, …) — a secret is caught
//      whichever file it lives in.
// An earlier version read only .env.local, so once .env.production.local
// overrode the Supabase keys it was checking values the build never saw.
//
// Usage:  npm run check:secrets        (after a build)
// Exit 0 = clean, exit 1 = a secret is in the bundle.

import { readdir, readFile } from "node:fs/promises";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Every variable whose value must never appear in client-side output.
// Add to this list whenever a new server-only secret is introduced.
const SERVER_ONLY = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_DB_URL",
  "STAGING_SERVICE_ROLE_KEY",
  "STAGING_DB_PASSWORD",
  "RAZORPAY_KEY_SECRET",
  "RAZORPAY_WEBHOOK_SECRET",
  "RESEND_API_KEY",
  "RESEND_WEBHOOK_SECRET",
  "CRON_SECRET",
  "SENTRY_AUTH_TOKEN",
  "FIREBASE_PRIVATE_KEY",
  "MSG91_AUTH_KEY",
  "TWILIO_AUTH_TOKEN",
  "WHATSAPP_ACCESS_TOKEN",
  "WHATSAPP_APP_SECRET",
  "WHATSAPP_VERIFY_TOKEN",
  "TELEPHONY_API_SECRET",
  "TELEPHONY_WEBHOOK_SECRET",
  "GOOGLE_OAUTH_CLIENT_SECRET",
];

// Directories that ship to the browser. `out/` for the static export,
// `.next/static/` for the server build.
const CLIENT_DIRS = ["out", ".next/static"].filter((d) => existsSync(d));

if (CLIENT_DIRS.length === 0) {
  console.error("No build output found. Run `npm run build` first.");
  process.exit(1);
}

// 1. The build's own view of the environment. Never overrides a value already
//    in process.env, so on Vercel the platform's values stand.
if (!process.env.VERCEL) {
  const nextEnv = await import("@next/env");
  const loadEnvConfig = nextEnv.loadEnvConfig ?? nextEnv.default?.loadEnvConfig;
  loadEnvConfig(process.cwd(), false, { info: () => {}, error: console.error });
}

/** value -> set of labels (variable name, and the file it came from). */
const values = new Map();
const add = (value, label) => {
  // Only real secrets — an empty or tiny value would match everywhere.
  if (!value || value.length < 12) return;
  if (!values.has(value)) values.set(value, new Set());
  values.get(value).add(label);
};
for (const name of SERVER_ONLY) add(process.env[name], name);

// 2. Every local env file, whether or not the build loads it.
for (const file of readdirSync(".").filter((f) => f.startsWith(".env") && !f.endsWith(".example"))) {
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m || !SERVER_ONLY.includes(m[1])) continue;
    add(m[2].trim().replace(/^(['"])(.*)\1$/, "$2"), `${m[1]} (${file})`);
  }
}

if (values.size === 0) {
  console.log("No server-only secrets present in this environment — nothing to check.");
  process.exit(0);
}

console.log(`Scanning ${CLIENT_DIRS.join(", ")} for ${values.size} distinct server-only secret value(s)…`);

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else yield path;
  }
}

const TEXTUAL = /\.(js|mjs|cjs|json|html|txt|css|map|rsc)$/i;
const findings = [];
let scanned = 0;

for (const dir of CLIENT_DIRS) {
  for await (const file of walk(dir)) {
    if (!TEXTUAL.test(file)) continue;
    scanned++;
    const content = await readFile(file, "utf8");
    for (const [value, labels] of values) {
      if (content.includes(value)) findings.push({ file, name: [...labels].join(", ") });
    }
  }
}

console.log(`Scanned ${scanned} files.`);

if (findings.length === 0) {
  console.log("PASS — no server-only secret found in client output.");
  process.exit(0);
}

console.error("\nFAIL — server-only secrets found in the client bundle:\n");
for (const f of findings) {
  // Report the variable NAME and the file. Never the value.
  console.error(`  ${f.name}  ->  ${f.file}`);
}
console.error(
  "\nThese values have shipped to the browser. Remove them from client code AND" +
  "\nROTATE each one — removal alone does not undo the disclosure.\n"
);
process.exit(1);
