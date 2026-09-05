// Fails the build if a server-only secret reached the browser bundle.
//
// ESLint cannot do this — it sees variable names, not values. This reads the
// real secret values from the environment and searches the compiled client
// output for them. If a secret is found there, it has been shipped to every
// visitor and must be rotated, not just removed.
//
// Usage:  node --env-file=.env.local scripts/check-client-secrets.mjs
// Exit 0 = clean, exit 1 = a secret is in the bundle.

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";

// Every variable whose value must never appear in client-side output.
// Add to this list whenever a new server-only secret is introduced.
const SERVER_ONLY = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_DB_URL",
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

// Directories that ship to the browser. `out/` for the current static export,
// `.next/static/` once the app moves to server rendering.
const CLIENT_DIRS = ["out", ".next/static"].filter((d) => existsSync(d));

if (CLIENT_DIRS.length === 0) {
  console.error("No build output found. Run `npm run build` first.");
  process.exit(1);
}

// Only check secrets that are actually set — an unset variable cannot leak,
// and matching on an empty string would flag every file.
const secrets = SERVER_ONLY
  .map((name) => ({ name, value: process.env[name] }))
  .filter((s) => s.value && s.value.length >= 12);

if (secrets.length === 0) {
  console.log("No server-only secrets present in this environment — nothing to check.");
  process.exit(0);
}

console.log(`Scanning ${CLIENT_DIRS.join(", ")} for ${secrets.length} server-only secret(s)…`);

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
    for (const { name, value } of secrets) {
      if (content.includes(value)) findings.push({ file, name });
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
