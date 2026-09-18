/**
 * Is each secret PRESENT, in the right FILE, and of the right SHAPE — without ever
 * printing a value.
 *
 *   node scripts/check-secret-config.mjs
 *
 * This answers the questions a reviewer actually has before a cutover ("is the
 * service-role key there, is it the right project, is the Razorpay key a test key,
 * is anything secret exposed to the browser") from the files themselves, so nobody
 * has to open an env file, paste a value into a chat, or trust a dashboard
 * screenshot. Every check prints a verdict, a length, or a non-secret prefix —
 * never a key.
 *
 * What is safe to print, and why:
 *   - variable names, and whether a file defines them;
 *   - value lengths, and a hash prefix used only to say "these two files agree";
 *   - a Supabase project ref and URL host (public: they are in every page);
 *   - a Razorpay key MODE (`rzp_test_` / `rzp_live_`), never the key itself.
 */

import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const read = (file) => {
  if (!existsSync(file)) return null;
  const out = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
};

/** A stable, non-reversible tag: enough to say "same value in both places", useless to an attacker. */
const tag = (v) => (v ? createHash("sha256").update(v).digest("hex").slice(0, 8) : "-");
const refOf = (url) => (url ?? "").match(/https:\/\/([a-z0-9]{20})\.supabase\./i)?.[1] ?? null;

const PROJECTS = {
  julbqkeyvzwluayokcdi: "Tokyo PRODUCTION (live)",
  wxolbnhyzktfjdvcnixc: "Tokyo staging (retired)",
  noxireidrbeqcvsirjec: "Mumbai staging",
  exsnksrmkycloxiajwmx: "Mumbai production (not live yet)",
};

let failed = false;
const line = (ok, text) => {
  console.log(`${ok === null ? "NOTE" : ok ? "PASS" : "FAIL"}  ${text}`);
  if (ok === false) failed = true;
};

const envFiles = readdirSync(".").filter((f) => f.startsWith(".env"));
console.log(`Env files present: ${envFiles.join(", ")}\n`);

// ---------------------------------------------------------------- Supabase
console.log("Supabase");
for (const file of [".env.local", ".env.development.local", ".env.production.local", ".env.prod-supabase.local"]) {
  const env = read(file);
  if (!env) continue;
  const ref = refOf(env.NEXT_PUBLIC_SUPABASE_URL);
  const project = ref ? (PROJECTS[ref] ?? "UNKNOWN project") : "no Supabase URL";
  const svc = env.SUPABASE_SERVICE_ROLE_KEY;
  console.log(
    `  ${file.padEnd(28)} → ${project}${ref ? ` (${ref})` : ""}` +
      `${svc ? `, service-role key present (len ${svc.length}, tag ${tag(svc)})` : ", no service-role key"}`,
  );
}

const local = read(".env.local") ?? {};
line(
  !Object.keys(local).some((k) => k.startsWith("NEXT_PUBLIC_") && /SERVICE_ROLE|SECRET|PASSWORD|TOKEN/.test(k)),
  "no NEXT_PUBLIC_* variable in .env.local carries a secret-shaped name",
);

// ---------------------------------------------------------------- Razorpay
console.log("\nRazorpay");
const RZP = ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET"];
for (const file of envFiles) {
  const env = read(file) ?? {};
  const found = RZP.filter((k) => env[k]);
  if (found.length === 0) continue;
  const mode = env.RAZORPAY_KEY_ID?.startsWith("rzp_live_")
    ? "LIVE mode"
    : env.RAZORPAY_KEY_ID?.startsWith("rzp_test_")
      ? "test mode"
      : env.RAZORPAY_KEY_ID
        ? "unrecognised key-id prefix"
        : "no key id";
  console.log(`  ${file.padEnd(28)} → ${found.join(", ")} (${mode})`);
  for (const k of found) console.log(`      ${k.padEnd(24)} len ${env[k].length}, tag ${tag(env[k])}`);
}

const anyRzp = envFiles.map((f) => read(f) ?? {}).find((e) => e.RAZORPAY_KEY_ID || e.RAZORPAY_KEY_SECRET) ?? {};
line(Boolean(anyRzp.RAZORPAY_KEY_ID), "RAZORPAY_KEY_ID is configured locally");
line(Boolean(anyRzp.RAZORPAY_KEY_SECRET), "RAZORPAY_KEY_SECRET is configured locally");
line(
  Boolean(anyRzp.RAZORPAY_WEBHOOK_SECRET) ? true : null,
  anyRzp.RAZORPAY_WEBHOOK_SECRET
    ? "RAZORPAY_WEBHOOK_SECRET is configured locally"
    : "RAZORPAY_WEBHOOK_SECRET is NOT set — it is generated in the Razorpay dashboard when the webhook is created, not derived from the API keys. The webhook route stays disabled (503) until it exists",
);
line(
  !envFiles.some((f) => Object.keys(read(f) ?? {}).some((k) => k.startsWith("NEXT_PUBLIC_RAZORPAY_KEY_SECRET"))),
  "no NEXT_PUBLIC_RAZORPAY_KEY_SECRET anywhere",
);
if (anyRzp.RAZORPAY_KEY_ID?.startsWith("rzp_live_")) {
  line(
    null,
    "the local Razorpay key is a LIVE key. lib/payments/razorpay.ts refuses to create orders with a live key " +
      "outside a production deployment, and scripts/check-staging-isolation.mjs fails a staging build that carries one",
  );
}

// ---------------------------------------------------------------- git hygiene
console.log("\nGit hygiene");
const ignore = existsSync(".gitignore") ? readFileSync(".gitignore", "utf8") : "";
line(/^\.env\*?$|^\.env\*/m.test(ignore), ".gitignore covers .env* files");
line(/^backups\/?$/m.test(ignore) || /backups/.test(ignore), ".gitignore covers backups/");

// ---------------------------------------------------------------- exposure scan
//
// Every real secret value this machine holds, searched for across everything that
// is committed, published or written to disk as output. check-client-secrets.mjs
// covers the browser bundle; this covers source, docs, public assets and logs —
// the places a secret gets pasted rather than compiled.
console.log("\nExposure scan");

const SECRET_NAMES = [
  "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_DB_URL", "STAGING_DB_PASSWORD", "MUMBAI_DB_PASSWORD",
  "MUMBAI_STAGING_DB_PASSWORD", "STAGING_SERVICE_ROLE_KEY", "MUMBAI_STAGING_SERVICE_ROLE_KEY",
  "SUPABASE_ACCESS_TOKEN", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET", "RESEND_API_KEY",
  "RESEND_WEBHOOK_SECRET", "CRON_SECRET", "SENTRY_AUTH_TOKEN", "GOOGLE_OAUTH_CLIENT_SECRET",
  "VERCEL_AUTOMATION_BYPASS_SECRET",
];

const secrets = new Map(); // value -> the variable names it appears under
for (const file of envFiles) {
  const env = read(file) ?? {};
  for (const name of SECRET_NAMES) {
    const value = env[name];
    // Short values are placeholders ("changeme", "your-key"), not credentials.
    if (!value || value.length < 16) continue;
    secrets.set(value, (secrets.get(value) ?? new Set()).add(`${name} (${file})`));
  }
}
console.log(`  ${secrets.size} distinct secret value(s) to search for`);

const tracked = spawnSync("git", ["ls-files"], { encoding: "utf8" }).stdout.split(/\r?\n/).filter(Boolean);
const extras = ["out", ".next/static", "public", "docs", "test-results", "perf"].flatMap((dir) => {
  const walk = (d) => {
    if (!existsSync(d)) return [];
    return readdirSync(d, { withFileTypes: true }).flatMap((e) => {
      const p = `${d}/${e.name}`;
      return e.isDirectory() ? walk(p) : [p];
    });
  };
  return walk(dir);
});
const logs = readdirSync(".").filter((f) => f.endsWith(".log"));
const candidates = [...new Set([...tracked, ...extras, ...logs])].filter((f) => !f.startsWith(".env"));

const hits = [];
for (const file of candidates) {
  let content;
  try {
    content = readFileSync(file, "utf8");
  } catch {
    continue; // binary or unreadable — a secret pasted into one is not a realistic case
  }
  for (const [value, names] of secrets) {
    if (content.includes(value)) hits.push({ file, names: [...names].join(", ") });
  }
}

console.log(`  ${candidates.length} file(s) scanned (git-tracked, build output, docs, public assets, logs)`);
if (hits.length === 0) {
  line(true, "no secret value appears in any scanned file");
} else {
  for (const h of hits) line(false, `SECRET EXPOSED in ${h.file} — value of ${h.names}. Rotate it, then remove it.`);
}

console.log(failed ? "\nFAIL — see above." : "\nPASS — configuration checks complete (no value was printed).");
process.exit(failed ? 1 : 0);
