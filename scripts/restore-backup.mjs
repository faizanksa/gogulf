/**
 * Restore a backup taken by backup-production.mjs into a NON-PRODUCTION target,
 * and prove the restore by re-downloading and re-hashing every object.
 *
 *   npm run restore -- --target=mumbai-staging --synthetic   # rehearsal
 *   npm run restore -- --target=mumbai-staging               # real bytes
 *   npm run restore -- --target=mumbai-staging --wipe        # clear target first
 *
 * WHY --synthetic EXISTS, AND WHY THE REHEARSAL USES IT
 *
 * docs/ENVIRONMENT-MATRIX.md: "Production PII never leaves production. Staging
 * is seeded with generated data — never a copy of the real contacts table. This
 * is a hard rule, not a preference: the legacy project holds passport scans."
 *
 * The Tokyo backup is 34 documents, and those documents *are* the PII — they are
 * passport and CV scans belonging to 14 real people. Restoring them into a
 * rehearsal project to prove a mechanism would put them in a second, lower-trust
 * place that then has to be securely wiped, and would do it for no gain: what
 * needs proving is that the restore procedure works, not that these particular
 * bytes survive a round trip.
 *
 * So --synthetic derives a same-shape dataset from the real manifest: identical
 * ids, timestamps, submission folders, byte counts and MIME types, with random
 * bytes in place of each document and generated values in place of each name,
 * email and phone. Every code path, size limit, path layout and content type is
 * exercised. No applicant's passport is copied anywhere.
 *
 * Filenames are generated too, and that is not a detail. Applicants name their
 * uploads after themselves: 12 of the 34 objects in the Tokyo backup carry a
 * real person's name in the filename. A first pass at this script preserved
 * paths verbatim and carefully synthesised the bytes — and moved the names
 * across regardless. Only the UUID folder, the label prefix and the extension
 * are kept.
 *
 * The real restore happens exactly once, into the real production target, at
 * cutover — where the hashes in the manifest are checked against what actually
 * landed.
 *
 * SAFETY
 *
 *   * Targets come from a table. Tokyo and Mumbai production are refused as
 *     targets outright; this script cannot write to either.
 *   * --wipe deletes from the TARGET only, and only a target that passed the
 *     production check above.
 */

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// Never a restore destination from this script. Tokyo is live; Mumbai becomes
// live at cutover, and the cutover restore is a separate, deliberate, approved
// operation rather than something reachable by passing a flag.
const PRODUCTION_REFS = ["julbqkeyvzwluayokcdi", "exsnksrmkycloxiajwmx"];

const TARGETS = {
  "mumbai-staging": {
    label: "MUMBAI STAGING (rehearsal)",
    envFile: ".env.mumbai-staging.local",
    vars: { url: "MUMBAI_STAGING_URL", key: "MUMBAI_STAGING_SERVICE_ROLE_KEY" },
  },
};

const BUCKET = "job-applications";
const TABLE = "job_applications";
const ROOT = "backups";

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const opt = (name, fallback) => (argv.find((a) => a.startsWith(`--${name}=`)) ?? `--${name}=${fallback}`).split("=")[1];

const targetName = opt("target", "");
const synthetic = flag("synthetic");

const fail = (msg) => {
  console.error(`\nFAIL — ${msg}\n`);
  process.exit(1);
};

const target = TARGETS[targetName];
if (!target) fail(`--target is required. Known: ${Object.keys(TARGETS).join(", ")}.`);
if (!existsSync(target.envFile)) fail(`${target.envFile} not found.`);

const env = Object.fromEntries(
  readFileSync(target.envFile, "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);
const url = (env[target.vars.url] ?? "").replace(/\/+$/, "");
const key = env[target.vars.key] ?? "";
if (!url || !key) fail(`${target.vars.url} or ${target.vars.key} missing from ${target.envFile}.`);

const ref = url.match(/https:\/\/([a-z0-9]{20})\.supabase\./i)?.[1] ?? null;
for (const prodRef of PRODUCTION_REFS) {
  if (ref === prodRef) fail(`the target resolves to PRODUCTION (${prodRef}). This script never writes to production.`);
}

const headers = { apikey: key, Authorization: `Bearer ${key}` };
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

async function call(path, init = {}) {
  const res = await fetch(`${url}${path}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) } });
  if (!res.ok && res.status !== 404) {
    fail(`${init.method ?? "GET"} ${path} → HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
  return res;
}

// ---------------------------------------------------------------------------

function newestBackup() {
  if (!existsSync(ROOT)) fail(`no ${ROOT}/ directory.`);
  const dirs = readdirSync(ROOT).filter((d) => existsSync(join(ROOT, d, "manifest.json"))).sort();
  if (!dirs.length) fail(`no backup found in ${ROOT}/.`);
  return join(ROOT, dirs[dirs.length - 1]);
}

const dir = argv.find((a) => !a.startsWith("--")) ?? newestBackup();
const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
const rows = JSON.parse(readFileSync(join(dir, `${TABLE}.json`), "utf8"));

console.log(`Backup : ${dir}  (${manifest.row_count} rows, ${manifest.object_count} documents)`);
console.log(`Target : ${target.label} ${ref}`);
console.log(`Mode   : ${synthetic ? "SYNTHETIC — same shape, generated bytes, no production PII" : "REAL BYTES"}\n`);

if (!synthetic) {
  console.log("  NOTE: restoring real applicant documents. docs/ENVIRONMENT-MATRIX.md forbids");
  console.log("        production PII in a non-production project. Use --synthetic unless this");
  console.log("        is the approved cutover restore.\n");
}

// ---------------------------------------------------------------------------

async function wipe() {
  console.log("Wiping target…");
  await call(`/rest/v1/${TABLE}?id=not.is.null`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
  const folders = await (
    await call(`/storage/v1/object/list/${BUCKET}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prefix: "", limit: 1000 }),
    })
  ).json();
  const paths = [];
  for (const f of folders ?? []) {
    const inner = await (
      await call(`/storage/v1/object/list/${BUCKET}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prefix: `${f.name}/`, limit: 1000 }),
      })
    ).json();
    for (const o of inner ?? []) paths.push(`${f.name}/${o.name}`);
  }
  if (paths.length) {
    await call(`/storage/v1/object/${BUCKET}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prefixes: paths }),
    });
  }
  console.log(`  removed ${paths.length} object(s) and all rows\n`);
}

// Same shape, no real content: byte count, MIME type, folder layout and the
// label prefix are preserved so size limits, content-type handling and the path
// structure are all exercised.
const syntheticBytes = (n) => randomBytes(n);

// The filename must NOT be preserved. Applicants upload documents named after
// themselves — of the 34 objects in the Tokyo backup, 12 carried a real person's
// name in the filename ("cv-Ahmad_AlNajjar_CV.pdf", "passport-Rahul_Passport.JPG").
// Copying the path verbatim would have moved that PII into the rehearsal project
// while the bytes were being carefully synthesised, which defeats the point.
//
// Kept: the submission-id folder (a random UUID, and what makes the row/object
// relationship worth testing), the label prefix that the uploader generates, and
// the extension that decides the content type. Replaced: the applicant's name.
function syntheticPath(path, index) {
  const [folder, file = ""] = [path.slice(0, path.indexOf("/")), path.slice(path.indexOf("/") + 1)];
  const label = file.match(/^(cv|passport|other-\d+)-/i)?.[1] ?? "document";
  const ext = file.includes(".") ? file.slice(file.lastIndexOf(".")) : "";
  return `${folder}/${label}-rehearsal-${String(index + 1).padStart(2, "0")}${ext}`;
}

function syntheticRow(r, i) {
  return {
    ...r,
    full_name: `Rehearsal Applicant ${i + 1}`,
    email: `rehearsal-${i + 1}@gogulf-rehearsal.invalid`,
    phone: `+9199${String(10000000 + i).slice(0, 8)}`,
    message: r.message == null ? null : "[synthetic — original message not copied]",
    experience: r.experience == null ? null : "[synthetic]",
  };
}

async function restore() {
  if (flag("wipe")) await wipe();

  // Real path -> the path actually written to the target. Identity unless the
  // run is synthetic, in which case the applicant's name is stripped out of it.
  const pathMap = new Map(manifest.documents.map((d, i) => [d.path, synthetic ? syntheticPath(d.path, i) : d.path]));
  const mapPath = (p) => pathMap.get(p) ?? p;

  let uploaded = 0;
  const expected = new Map();
  for (const d of manifest.documents) {
    const body = synthetic ? syntheticBytes(d.bytes) : readFileSync(join(dir, d.file));
    expected.set(mapPath(d.path), sha256(body));
    const res = await fetch(`${url}/storage/v1/object/${BUCKET}/${mapPath(d.path)}`, {
      method: "POST",
      headers: { ...headers, "Content-Type": d.mimetype ?? "application/octet-stream", "x-upsert": "true" },
      body,
    });
    if (!res.ok) fail(`upload ${mapPath(d.path)} → HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
    uploaded++;
    if (process.stdout.isTTY) process.stdout.write(`  ${uploaded}/${manifest.documents.length} uploaded\r`);
  }
  console.log(`  ${uploaded}/${manifest.documents.length} documents uploaded`);

  const payload = rows.map((r, i) => {
    const row = synthetic ? syntheticRow(r, i) : r;
    return {
      ...row,
      cv_path: mapPath(row.cv_path),
      passport_path: mapPath(row.passport_path),
      other_paths: (row.other_paths ?? []).map(mapPath),
    };
  });
  const res = await call(`/rest/v1/${TABLE}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) fail(`insert rows → HTTP ${res.status}`);
  console.log(`  ${payload.length} rows inserted\n`);

  // Prove it, rather than trust the 2xx responses.
  console.log("Verifying the target by reading it back:");
  const live = await (await call(`/rest/v1/${TABLE}?select=id,cv_path,passport_path,other_paths&order=created_at.asc`)).json();
  const liveIds = new Set(live.map((r) => r.id));
  const missingRows = manifest.application_ids.filter((a) => !liveIds.has(a.id));
  console.log(`  rows      : ${live.length}/${manifest.row_count}${missingRows.length ? ` — MISSING ${missingRows.length}` : ""}`);

  let mismatched = 0;
  for (const d of manifest.documents) {
    const at = mapPath(d.path);
    const got = await call(`/storage/v1/object/${BUCKET}/${at}`);
    if (!got.ok) {
      console.error(`  MISSING  ${at}`);
      mismatched++;
      continue;
    }
    const buf = Buffer.from(await got.arrayBuffer());
    if (buf.length !== d.bytes || sha256(buf) !== expected.get(at)) {
      console.error(`  MISMATCH ${at} (${buf.length} vs ${d.bytes} bytes)`);
      mismatched++;
    }
  }
  console.log(`  documents : ${manifest.documents.length - mismatched}/${manifest.documents.length} match by SHA-256 and byte count`);

  // Every path a row points at must resolve to an object that is actually there.
  const livePaths = new Set(manifest.documents.map((d) => mapPath(d.path)));
  const dangling = live.flatMap((r) => [r.cv_path, r.passport_path, ...(r.other_paths ?? [])].filter(Boolean)).filter((p) => !livePaths.has(p));
  console.log(`  references: ${dangling.length === 0 ? "every cv/passport/other path resolves" : `${dangling.length} DANGLING`}`);

  if (missingRows.length || mismatched || dangling.length) {
    fail("the restore did not reproduce the backup exactly.");
  }
  console.log(
    `\nPASS — ${manifest.row_count} rows and ${manifest.object_count} documents restored and verified byte-for-byte.` +
      (synthetic ? "\nSynthetic run: the procedure is proven; no production PII was copied." : ""),
  );
}

await restore();
