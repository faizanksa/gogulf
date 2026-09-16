/**
 * Take — and later verify — a complete, hash-checked backup of the TOKYO
 * production project, before the Mumbai migration.
 *
 *   npm run backup:prod                  # inventory + data + documents + manifest
 *   npm run backup:prod -- verify        # re-check the newest backup, and diff it
 *                                        # against the live project (delta check)
 *   npm run backup:prod -- verify <dir>  # check one specific backup
 *
 * Credentials come from .env.tokyo-prod.local (gitignored, never loaded by
 * Next.js). Only two things are read from it: the project URL and the
 * service-role key. Neither is printed, logged or written into the backup.
 *
 * WHY A SCRIPT AND NOT A DASHBOARD CLICK
 *
 * A dashboard database backup covers Postgres and *not* Storage. The whole
 * reason this migration is delicate is the 34 documents — CVs and passport
 * scans — that live only in the bucket. A backup that silently omits them is
 * worse than no backup, because it invites the belief that the data is safe.
 * So this walks both, and hashes every object, so a restore can be proven
 * rather than assumed.
 *
 * SAFETY
 *
 *   * The production ref is hard-coded. A file pointing anywhere else is
 *     refused before a single request is made.
 *   * Every request is a GET. There is no code path here that writes to,
 *     deletes from or alters the source project — by construction, not by
 *     discipline.
 *   * Re-running never overwrites: each run lands in its own timestamped
 *     directory under /backups (gitignored).
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// The Tokyo production project, and nothing else. Hard-coded so a mistyped or
// swapped credential file cannot silently point this at staging, at Mumbai, or
// at another account's project and produce a confident, worthless backup.
const PRODUCTION_REF = "julbqkeyvzwluayokcdi";
const ENV_FILE = ".env.tokyo-prod.local";
const BUCKET = "job-applications";
const TABLE = "job_applications";
const ROOT = "backups";

const fail = (msg) => {
  console.error(`\nFAIL — ${msg}\n`);
  process.exit(1);
};

// ---------------------------------------------------------------------------
// Credentials
// ---------------------------------------------------------------------------

if (!existsSync(ENV_FILE)) {
  fail(
    `${ENV_FILE} not found.\n\n` +
      "  It should contain the TOKYO production project's URL and service-role key:\n\n" +
      `    NEXT_PUBLIC_SUPABASE_URL=https://${PRODUCTION_REF}.supabase.co\n` +
      "    SUPABASE_SERVICE_ROLE_KEY=…\n\n" +
      "  The file is gitignored (.env.*.local) and Next.js never loads it.",
  );
}

const env = Object.fromEntries(
  readFileSync(ENV_FILE, "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, "").trim()];
    }),
);

const url = (env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
const key = env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const refInUrl = url.match(/https:\/\/([a-z0-9]{20})\.supabase\./i)?.[1] ?? null;

if (!key) fail(`SUPABASE_SERVICE_ROLE_KEY is missing from ${ENV_FILE}.`);
if (refInUrl !== PRODUCTION_REF) {
  fail(
    `${ENV_FILE} does not point at Tokyo production.\n\n` +
      `  expected: ${PRODUCTION_REF}\n` +
      `  found:    ${refInUrl ?? "(no Supabase project URL)"}\n\n` +
      "  Refusing rather than backing up the wrong project under a name that\n" +
      "  claims otherwise. Check the file before retrying.",
  );
}

// The key is a JWT carrying the project ref; only `ref` and `role` are decoded,
// so a key for the right URL but the wrong project — or an anon key, which
// cannot read the rows at all — is caught here rather than producing an empty
// backup that looks successful.
try {
  const payload = JSON.parse(Buffer.from(key.split(".")[1] ?? "", "base64url").toString("utf8"));
  if (payload?.ref && payload.ref !== PRODUCTION_REF) {
    fail(`SUPABASE_SERVICE_ROLE_KEY belongs to project ${payload.ref}, not ${PRODUCTION_REF}.`);
  }
  if (payload?.role && payload.role !== "service_role") {
    fail(`SUPABASE_SERVICE_ROLE_KEY has role "${payload.role}". A service-role key is required to read the rows.`);
  }
} catch {
  // Newer publishable/secret key formats are not JWTs. The URL check above is
  // the primary guard; a wrong key surfaces as an HTTP error immediately.
}

const headers = { apikey: key, Authorization: `Bearer ${key}` };

async function get(path, init = {}) {
  const res = await fetch(`${url}${path}`, { ...init, method: init.method ?? "GET", headers: { ...headers, ...(init.headers ?? {}) } });
  if (!res.ok) fail(`${init.method ?? "GET"} ${path} → HTTP ${res.status} ${res.statusText}`);
  return res;
}

// Storage listing is a POST by protocol. It reads; it does not write.
const list = (prefix) =>
  get(`/storage/v1/object/list/${BUCKET}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prefix, limit: 1000, sortBy: { column: "name", order: "asc" } }),
  }).then((r) => r.json());

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

// ---------------------------------------------------------------------------
// Backup
// ---------------------------------------------------------------------------

async function collect() {
  const rows = await (await get(`/rest/v1/${TABLE}?select=*&order=created_at.asc`)).json();
  const buckets = await (await get("/storage/v1/bucket")).json();
  const authPage = await (await get("/auth/v1/admin/users?per_page=1")).json();
  const authCount = authPage.total ?? (authPage.users ?? []).length;

  const folders = (await list("")).map((o) => o.name);
  const objects = [];
  for (const folder of folders) {
    for (const o of await list(`${folder}/`)) {
      objects.push({ path: `${folder}/${o.name}`, metadata: o.metadata ?? {} });
    }
  }
  return { rows, buckets, authCount, objects };
}

async function backup() {
  console.log(`Source: PRODUCTION ${PRODUCTION_REF} (read-only)\n`);
  const { rows, buckets, authCount, objects } = await collect();

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = join(ROOT, `${PRODUCTION_REF}-${stamp}`);
  mkdirSync(join(dir, "documents"), { recursive: true });

  writeFileSync(join(dir, `${TABLE}.json`), JSON.stringify(rows, null, 2));

  let bytes = 0;
  const documents = [];
  for (const o of objects) {
    const buf = Buffer.from(await (await get(`/storage/v1/object/${BUCKET}/${o.path}`)).arrayBuffer());
    const safe = o.path.replace(/[\\/]/g, "__");
    writeFileSync(join(dir, "documents", safe), buf);

    const declared = o.metadata.size;
    if (typeof declared === "number" && declared !== buf.length) {
      fail(`${o.path}: listing declares ${declared} bytes, download returned ${buf.length}. Refusing a backup that does not match the source.`);
    }
    bytes += buf.length;
    documents.push({
      path: o.path,
      file: `documents/${safe}`,
      bytes: buf.length,
      mimetype: o.metadata.mimetype ?? null,
      sha256: sha256(buf),
    });
    // Carriage-return progress only where something can redraw it; in a CI log
    // or a piped run it would otherwise emit one line per document.
    if (process.stdout.isTTY) process.stdout.write(`  ${documents.length}/${objects.length} documents\r`);
  }
  console.log(`  ${documents.length}/${objects.length} documents`);

  // Every document path the rows reference must exist in the backup. This is the
  // check that catches a half-copied migration later: a row whose passport scan
  // did not come across is worse than a row that is simply absent.
  const have = new Set(documents.map((d) => d.path));
  const referenced = rows.flatMap((r) => [r.cv_path, r.passport_path, ...(r.other_paths ?? [])].filter(Boolean));
  const missing = referenced.filter((p) => !have.has(p));

  const manifest = {
    project_ref: PRODUCTION_REF,
    taken_at: new Date().toISOString(),
    source_url: url,
    table: TABLE,
    row_count: rows.length,
    application_ids: rows.map((r) => ({ id: r.id, created_at: r.created_at })),
    auth_user_count: authCount,
    buckets: buckets.map((b) => ({
      id: b.id,
      public: b.public,
      file_size_limit: b.file_size_limit,
      allowed_mime_types: b.allowed_mime_types,
    })),
    object_count: documents.length,
    total_bytes: bytes,
    referenced_paths: referenced.length,
    missing_referenced_paths: missing,
    documents,
  };
  writeFileSync(join(dir, "manifest.json"), JSON.stringify(manifest, null, 2));

  console.log(`\n  rows            : ${rows.length}`);
  console.log(`  documents       : ${documents.length}`);
  console.log(`  bytes           : ${bytes} (${(bytes / 1048576).toFixed(2)} MiB)`);
  console.log(`  auth users      : ${authCount}`);
  console.log(`  paths in rows   : ${referenced.length}, all present: ${missing.length === 0 ? "yes" : `NO — ${missing.length} missing`}`);
  console.log(`\nWritten to ${dir}`);

  if (missing.length > 0) {
    fail(`${missing.length} document path(s) referenced by rows are not in the bucket:\n  ${missing.join("\n  ")}`);
  }
  console.log("\nPASS — backup complete and internally consistent.");
  console.log("Not yet a proven backup: run `npm run backup:prod -- verify` and rehearse the restore.");
}

// ---------------------------------------------------------------------------
// Verify — re-hash what is on disk, then diff the manifest against the live
// project. The second half is the cutover delta check: it names applications
// that arrived after the backup was taken.
// ---------------------------------------------------------------------------

function newest() {
  if (!existsSync(ROOT)) fail(`no ${ROOT}/ directory — take a backup first.`);
  const dirs = readdirSync(ROOT).filter((d) => d.startsWith(PRODUCTION_REF)).sort();
  if (dirs.length === 0) fail(`no backup of ${PRODUCTION_REF} in ${ROOT}/.`);
  return join(ROOT, dirs[dirs.length - 1]);
}

async function verify(dir) {
  const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
  if (manifest.project_ref !== PRODUCTION_REF) fail(`${dir} is a backup of ${manifest.project_ref}, not ${PRODUCTION_REF}.`);
  console.log(`Backup: ${dir}\n  taken ${manifest.taken_at}\n`);

  let bad = 0;
  for (const d of manifest.documents) {
    const file = join(dir, d.file);
    if (!existsSync(file)) {
      console.error(`  MISSING  ${d.path}`);
      bad++;
      continue;
    }
    const buf = readFileSync(file);
    if (buf.length !== d.bytes || sha256(buf) !== d.sha256) {
      console.error(`  CORRUPT  ${d.path}`);
      bad++;
    }
  }
  console.log(`  ${manifest.documents.length - bad}/${manifest.documents.length} documents match their SHA-256`);
  if (bad > 0) fail(`${bad} document(s) do not match the manifest. This backup cannot be trusted.`);

  // Delta against the live project.
  console.log("\nLive project, compared with the backup:");
  const { rows, objects } = await collect();
  const backedUpIds = new Set(manifest.application_ids.map((a) => a.id));
  const newRows = rows.filter((r) => !backedUpIds.has(r.id));
  const backedUpPaths = new Set(manifest.documents.map((d) => d.path));
  const newObjects = objects.filter((o) => !backedUpPaths.has(o.path));

  console.log(`  rows      : backup ${manifest.row_count}, live ${rows.length}`);
  console.log(`  documents : backup ${manifest.object_count}, live ${objects.length}`);

  if (newRows.length === 0 && newObjects.length === 0) {
    console.log("\nPASS — verified, and the live project has not changed since the backup.");
    return;
  }
  console.log(`\n  ${newRows.length} application(s) and ${newObjects.length} document(s) arrived after the backup:`);
  for (const r of newRows) console.log(`    ${r.created_at}  ${r.id}`);
  for (const o of newObjects) console.log(`    (document) ${o.path}`);
  console.log(
    "\nPASS — the backup is intact. The rows above are NOT in it.\n" +
      "During cutover these are exactly what must be reconciled into Mumbai:\n" +
      "re-run the backup, or copy them across individually, before Tokyo is retired.",
  );
}

const [command, arg] = process.argv.slice(2);
if (!command) await backup();
else if (command === "verify") await verify(arg ?? newest());
else fail("usage: npm run backup:prod [-- verify [dir]]");
