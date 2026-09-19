/**
 * Import a verified Tokyo backup (scripts/backup-production.mjs) into MUMBAI PRODUCTION.
 *
 *   node scripts/import-to-production.mjs <backup-dir>                                   # dry run: plan only
 *   node scripts/import-to-production.mjs <backup-dir> --execute \
 *        --yes-import-real-applicants-to-mumbai-production                               # writes
 *
 * This is the "separate, deliberate, approved operation" that restore-backup.mjs refuses to be. It exists only
 * for the cutover, moves real applicant data (names, phones, CVs, passport scans), and is built to be unable to
 * damage what is already there:
 *
 *   * The target is pinned to Mumbai production. The credential file's URL AND the service-role key's own `ref`
 *     claim must both name it, or nothing is sent. Tokyo credentials are never read: this script cannot write to
 *     the source, and cannot even reach it.
 *   * The backup is re-verified BEFORE anything leaves this machine: every document is re-hashed and compared
 *     with the manifest, every path a row points at must be a document in the backup.
 *   * It never overwrites. An object already at the target must be byte-identical (then it is skipped) or the
 *     run aborts; a row already at the target must equal the backup's row or the run aborts. That makes it safe
 *     to run again with a NEWER backup for the final delta — it adds only what is missing.
 *   * Dry run by default. Writing needs both --execute and the long confirmation flag.
 *   * After writing, everything is read back from the target and compared: every row, column by column, and
 *     every document re-downloaded and re-hashed. Anything short of exact is a failure.
 *   * Nothing personal is printed — counts, ids and verdicts only.
 *
 * What it does NOT do: it does not create contacts, cases or jobs (Tokyo has none; applications arrive as
 * `new`, unassigned, unlinked), it writes no audit rows (the audit trigger is on UPDATE only), and it never
 * touches Razorpay, invoices or payments — those tables are not mentioned here.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const TARGET_REF = "exsnksrmkycloxiajwmx"; // Mumbai production
const SOURCE_REF = "julbqkeyvzwluayokcdi"; // Tokyo — only ever the label on a backup, never contacted
const ENV_FILE = ".env.prod-supabase.local";
const BUCKET = "job-applications";
const TABLE = "job_applications";
const CONFIRM = "--yes-import-real-applicants-to-mumbai-production";
const COLUMNS = ["id", "created_at", "job_title", "job_country", "full_name", "email", "phone", "experience", "message", "cv_path", "passport_path", "other_paths", "page_source"];

const argv = process.argv.slice(2);
const dir = argv.find((a) => !a.startsWith("--"));
const execute = argv.includes("--execute");

const fail = (msg) => {
  console.error(`\nFAIL — ${msg}\n`);
  process.exit(1);
};
if (!dir) fail("usage: node scripts/import-to-production.mjs <backup-dir> [--execute --yes-import-real-applicants-to-mumbai-production]");
if (execute && !argv.includes(CONFIRM)) fail(`--execute writes real applicant data to PRODUCTION. Re-run with ${CONFIRM} if that is what you mean.`);

// ---------------------------------------------------------------------------------------------- target
if (!existsSync(ENV_FILE)) fail(`${ENV_FILE} not found.`);
const env = Object.fromEntries(
  readFileSync(ENV_FILE, "utf8").split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);
const url = (env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
const key = env.SUPABASE_SERVICE_ROLE_KEY ?? "";
if (url !== `https://${TARGET_REF}.supabase.co`) fail(`${ENV_FILE} does not name Mumbai production (${TARGET_REF}). Refusing.`);
let claims;
try {
  claims = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString());
} catch {
  fail("the service-role key is not a readable JWT; cannot confirm which project it belongs to. Refusing.");
}
if (claims.ref !== TARGET_REF || claims.role !== "service_role") fail(`the key's own claims are ref=${claims.ref} role=${claims.role}, not Mumbai production's service role. Refusing.`);

const headers = { apikey: key, Authorization: `Bearer ${key}` };
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");
const enc = (p) => p.split("/").map(encodeURIComponent).join("/");
const rest = (path, init = {}) => fetch(`${url}/rest/v1/${path}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) } });
const object = (path, init = {}) => fetch(`${url}/storage/v1/object/${BUCKET}/${enc(path)}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) } });

// ---------------------------------------------------------------------------------------------- backup
const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
const rows = JSON.parse(readFileSync(join(dir, `${TABLE}.json`), "utf8"));
if (manifest.project_ref !== SOURCE_REF) fail(`the backup is of ${manifest.project_ref}, not the Tokyo production project.`);
if (rows.length !== manifest.row_count) fail(`the backup lists ${manifest.row_count} rows but the file holds ${rows.length}.`);
if (manifest.documents.length !== manifest.object_count) fail("the backup's document list does not match its object count.");
if ((manifest.missing_referenced_paths ?? []).length) fail("the backup itself recorded row references with no document.");

console.log(`Backup  : ${dir}`);
console.log(`          taken ${manifest.taken_at}; ${rows.length} applications, ${manifest.documents.length} documents`);
console.log(`Target  : MUMBAI PRODUCTION ${TARGET_REF}   Mode: ${execute ? "EXECUTE" : "DRY RUN (nothing is written)"}\n`);

console.log("1. Re-verifying the backup on this machine, before anything is sent");
const bytesByPath = new Map();
let badLocal = 0;
for (const d of manifest.documents) {
  const file = join(dir, d.file);
  if (!existsSync(file)) { badLocal++; continue; }
  const buf = readFileSync(file);
  if (buf.length !== d.bytes || sha256(buf) !== d.sha256) badLocal++;
  else bytesByPath.set(d.path, buf);
}
if (badLocal) fail(`${badLocal} document(s) in the backup are missing or do not match their recorded SHA-256. Nothing was sent.`);
console.log(`   ${manifest.documents.length}/${manifest.documents.length} documents match their SHA-256 and byte count`);

const known = new Set(manifest.documents.map((d) => d.path));
const dangling = rows.flatMap((r) => [r.cv_path, r.passport_path, ...(r.other_paths ?? [])].filter(Boolean)).filter((p) => !known.has(p));
if (dangling.length) fail(`${dangling.length} row reference(s) point at a document that is not in the backup.`);
const referenced = new Set(rows.flatMap((r) => [r.cv_path, r.passport_path, ...(r.other_paths ?? [])].filter(Boolean)));
const unreferenced = manifest.documents.filter((d) => !referenced.has(d.path));
console.log(`   every row reference resolves; ${unreferenced.length} document(s) are in the bucket but referenced by no row (they are imported too — nothing is dropped)`);
for (const r of rows) for (const c of COLUMNS) if (!(c in r)) fail(`a backup row has no "${c}" column.`);
if (new Set(rows.map((r) => r.id)).size !== rows.length) fail("the backup contains a duplicate application id.");

// ---------------------------------------------------------------------------------------------- target pre-flight
console.log("\n2. Target pre-flight (read-only)");
const bucket = await (await fetch(`${url}/storage/v1/bucket/${BUCKET}`, { headers })).json();
if (bucket.public !== false) fail(`bucket "${BUCKET}" is missing or PUBLIC on the target. Refusing to put applicant documents in it.`);
const limit = bucket.file_size_limit ?? Infinity;
const tooBig = manifest.documents.filter((d) => d.bytes > limit);
if (tooBig.length) fail(`${tooBig.length} document(s) exceed the bucket's ${limit}-byte limit; raise it deliberately first.`);
if (bucket.allowed_mime_types?.length) {
  const refused = manifest.documents.filter((d) => !bucket.allowed_mime_types.includes(d.mimetype));
  if (refused.length) fail(`${refused.length} document(s) have a MIME type the bucket does not allow.`);
}
console.log(`   bucket "${BUCKET}": private, size limit ${limit === Infinity ? "none" : limit + " bytes"}; all documents fit`);

const existingRows = await rest(`${TABLE}?select=${COLUMNS.join(",")}&order=created_at.asc`);
if (!existingRows.ok) fail(`could not read the target's ${TABLE}: HTTP ${existingRows.status}`);
const onTarget = new Map((await existingRows.json()).map((r) => [r.id, r]));
console.log(`   ${TABLE} on the target: ${onTarget.size} row(s) before this run`);

const same = (a, b) => {
  for (const c of COLUMNS) {
    if (c === "created_at") { if (Date.parse(a[c]) !== Date.parse(b[c])) return false; }
    else if (JSON.stringify(a[c] ?? null) !== JSON.stringify(b[c] ?? null)) return false;
  }
  return true;
};
const rowsToInsert = [];
let rowsIdentical = 0;
for (const r of rows) {
  const there = onTarget.get(r.id);
  if (!there) rowsToInsert.push(r);
  else if (same(r, there)) rowsIdentical++;
  else fail(`an application with the same id already exists on the target with DIFFERENT content. It will not be overwritten. (id ${r.id})`);
}

const docsToUpload = [];
let docsIdentical = 0;
for (const d of manifest.documents) {
  const got = await object(d.path);
  if (got.status === 200) {
    if (sha256(Buffer.from(await got.arrayBuffer())) === d.sha256) docsIdentical++;
    else fail(`an object already at the target path differs from the backup. It will not be overwritten. (${d.path.split("/")[0]}/…)`);
  } else docsToUpload.push(d);
}
console.log(`\n3. Plan`);
console.log(`   applications: insert ${rowsToInsert.length}, already present and identical ${rowsIdentical}`);
console.log(`   documents   : upload ${docsToUpload.length}, already present and identical ${docsIdentical}`);
if (!execute) {
  console.log("\nDRY RUN complete. Nothing was written. Re-run with --execute and the confirmation flag to import.");
  process.exit(0);
}

// ---------------------------------------------------------------------------------------------- write
console.log("\n4. Writing (documents first, then rows, so no row ever points at a missing document)");
let uploaded = 0;
for (const d of docsToUpload) {
  const res = await object(d.path, { method: "POST", headers: { "Content-Type": d.mimetype ?? "application/octet-stream", "x-upsert": "false" }, body: bytesByPath.get(d.path) });
  if (!res.ok) fail(`upload failed (HTTP ${res.status}) after ${uploaded} document(s); the run stops here. Re-running is safe: it skips what already landed.`);
  uploaded++;
}
console.log(`   ${uploaded} document(s) uploaded`);
if (rowsToInsert.length) {
  const res = await rest(TABLE, {
    method: "POST",
    headers: { "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify(rowsToInsert.map((r) => Object.fromEntries(COLUMNS.map((c) => [c, r[c]])))),
  });
  if (!res.ok) fail(`row insert failed: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
}
console.log(`   ${rowsToInsert.length} application(s) inserted`);

// ---------------------------------------------------------------------------------------------- verify
console.log("\n5. Verifying by reading everything back from the target");
const back = await rest(`${TABLE}?select=${COLUMNS.join(",")},status,job_id,contact_id,case_id,assignee_id&order=created_at.asc`);
if (!back.ok) fail(`read-back failed: HTTP ${back.status}`);
const live = new Map((await back.json()).map((r) => [r.id, r]));
const missing = rows.filter((r) => !live.has(r.id));
const differ = rows.filter((r) => live.has(r.id) && !same(r, live.get(r.id)));
const imported = rows.map((r) => live.get(r.id)).filter(Boolean);
const notDefault = imported.filter((r) => r.status !== "new" || r.job_id || r.contact_id || r.case_id || r.assignee_id);
console.log(`   applications: ${rows.length - missing.length}/${rows.length} present; ${rows.length - missing.length - differ.length}/${rows.length} equal to the backup, column by column`);
console.log(`   arrived as: status "new", no job, no contact, no case, unassigned — ${imported.length - notDefault.length}/${imported.length}`);

let docBad = 0;
for (const d of manifest.documents) {
  const got = await object(d.path);
  if (got.status !== 200) { docBad++; continue; }
  const buf = Buffer.from(await got.arrayBuffer());
  if (buf.length !== d.bytes || sha256(buf) !== d.sha256) docBad++;
}
console.log(`   documents   : ${manifest.documents.length - docBad}/${manifest.documents.length} downloaded and re-hashed: SHA-256 and byte count match`);
const unresolved = imported.flatMap((r) => [r.cv_path, r.passport_path, ...(r.other_paths ?? [])].filter(Boolean)).filter((p) => !known.has(p));
console.log(`   references : ${unresolved.length === 0 ? "every cv/passport/other path resolves to an object that is there" : unresolved.length + " DANGLING"}`);
console.log(`   target total: ${live.size} application(s) now on the target`);

if (missing.length || differ.length || notDefault.length || docBad || unresolved.length) fail("the target does not reproduce the backup exactly.");
console.log(`\nPASS — ${rows.length} applications and ${manifest.documents.length} documents are on Mumbai production and verified exactly.`);
