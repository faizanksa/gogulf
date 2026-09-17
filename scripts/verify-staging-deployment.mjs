/**
 * Prove which Supabase project the DEPLOYED staging site talks to — from what a browser
 * actually receives, not from the Vercel dashboard.
 *
 *   node scripts/verify-staging-deployment.mjs
 *
 * 1. Every JavaScript chunk the home, jobs and apply pages load is scanned for Supabase
 *    project refs. Exactly one may appear: Mumbai staging. Tokyo staging, Tokyo production
 *    and Mumbai production must not appear anywhere.
 * 2. The server-rendered /jobs page must list the STAGING TEST jobs, which exist only in
 *    Mumbai staging — so the server side reads the same project the bundle names.
 * 3. /admin must redirect a visitor without a session to the staff sign-in page.
 *
 * Uses the automation-bypass secret (scripts/perf/vercel-bypass.mjs), sent only to
 * staging.gogulf.co, never printed. Prints project refs, which are not secrets.
 */

import { getStagingBypass, STAGING_ORIGIN } from "./perf/vercel-bypass.mjs";

const EXPECTED = "noxireidrbeqcvsirjec";
const FORBIDDEN = {
  wxolbnhyzktfjdvcnixc: "Tokyo staging (retired for the web app)",
  julbqkeyvzwluayokcdi: "Tokyo PRODUCTION",
  exsnksrmkycloxiajwmx: "Mumbai PRODUCTION",
};

const secret = await getStagingBypass();
const get = (path, init = {}) =>
  fetch(new URL(path, STAGING_ORIGIN), { redirect: "manual", ...init, headers: { "x-vercel-protection-bypass": secret, ...(init.headers ?? {}) } });

let failed = false;
const report = (ok, line) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${line}`);
  if (!ok) failed = true;
};

const refsIn = (text) => new Set([...text.matchAll(/https:\/\/([a-z0-9]{20})\.supabase\.co/g)].map((m) => m[1]));

const chunks = new Set();
const pageRefs = new Set();
for (const path of ["/", "/jobs", "/jobs/apply?ref=STG-JOB-002"]) {
  const res = await get(path);
  const html = await res.text();
  report(res.status === 200, `${path} → ${res.status}`);
  for (const r of refsIn(html)) pageRefs.add(r);
  for (const m of html.matchAll(/\/_next\/static\/[^"'\s)]+\.js/g)) chunks.add(m[0]);
}

// The Supabase client is loaded on demand (the apply form imports it when focused), so its
// chunk is not in the page HTML: follow chunk references inside chunks as well.
const bundleRefs = new Set(pageRefs);
const queue = [...chunks];
const seen = new Set();
while (queue.length && seen.size < 400) {
  const chunk = queue.shift();
  if (seen.has(chunk)) continue;
  seen.add(chunk);
  const js = await (await get(chunk)).text();
  for (const r of refsIn(js)) bundleRefs.add(r);
  for (const bad of Object.keys(FORBIDDEN)) if (js.includes(bad)) bundleRefs.add(bad);
  for (const m of js.matchAll(/(?:\/_next\/)?static\/(?:immutable\/)?chunks\/[A-Za-z0-9._~-]+\.js/g)) {
    const next = m[0].startsWith("/_next/") ? m[0] : `/_next/${m[0]}`;
    if (!seen.has(next)) queue.push(next);
  }
}
chunks.clear();
for (const c of seen) chunks.add(c);
console.log(`      scanned ${chunks.size} JavaScript chunks; Supabase refs found: ${[...bundleRefs].join(", ") || "none"}`);
report(bundleRefs.has(EXPECTED), `the deployed bundle targets Mumbai staging (${EXPECTED})`);
for (const [ref, label] of Object.entries(FORBIDDEN)) report(!bundleRefs.has(ref), `no trace of ${label} (${ref})`);
report(bundleRefs.size === 1, "exactly one Supabase project is referenced");

const jobs = await (await get("/jobs")).text();
report(jobs.includes("STAGING TEST — Warehouse Helper") && jobs.includes("STAGING TEST — Site Supervisor"), "server-rendered /jobs lists the Mumbai staging test jobs");
report(!jobs.includes("HVAC Technician") && !jobs.includes("Civil Engineer"), "drafts and archived jobs are not listed");

const draft = await get("/jobs/staging-test-hvac-technician-stg-job-005");
report(draft.status === 404, `a draft job page is not public (${draft.status})`);

const admin = await get("/admin");
report(admin.status === 307 && (admin.headers.get("location") ?? "").startsWith("/admin/login"), `/admin without a session → ${admin.status} ${admin.headers.get("location")}`);

const login = await get("/admin/login");
const loginHtml = await login.text();
report(login.status === 200 && loginHtml.includes("Sign in with Google"), "/admin/login offers Google sign-in");
report((login.headers.get("x-robots-tag") ?? "").includes("noindex"), "/admin/login is noindex");

process.exit(failed ? 1 : 0);
