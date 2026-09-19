/**
 * Prove what the DEPLOYED production site actually is, from what a browser receives — not from the Vercel dashboard.
 *
 *   node scripts/verify-production-deployment.mjs [--origin=https://www.gogulf.co]
 *
 * READ-ONLY apart from one UNSIGNED POST to the webhook, which is the only probe ever allowed against production
 * (it must be refused; nothing is created, and no application, invoice or payment is submitted).
 *
 *  1. Every JavaScript chunk the public pages load is scanned for Supabase project refs. Exactly one may appear:
 *     Mumbai production. Tokyo production, Tokyo staging and Mumbai staging must not appear anywhere. No JWT in a
 *     public bundle may carry the service_role claim.
 *  2. No staging or test content is public; production is indexable (not noindex) and robots keeps the private
 *     paths out; the sitemap lists no admin, payment or portal URL, and every listed URL answers 200.
 *  3. Every admin screen redirects a visitor without a session; sign-in offers Google and has no password field.
 *  4. The payment page 404s for anything that is not a real, issued invoice; the webhook is live but closed.
 *
 * It cannot prove Google sign-in (that needs a person), the build guard (read the Vercel build log for
 * "Supabase API: PRODUCTION Mumbai" and "Razorpay: live key"), or that documents open (needs a staff session).
 */

const origin = (process.argv.find((a) => a.startsWith("--origin=")) ?? "--origin=https://www.gogulf.co").split("=")[1].replace(/\/+$/, "");

const EXPECTED = "exsnksrmkycloxiajwmx"; // Mumbai production
const FORBIDDEN = {
  julbqkeyvzwluayokcdi: "Tokyo PRODUCTION",
  wxolbnhyzktfjdvcnixc: "Tokyo staging",
  noxireidrbeqcvsirjec: "Mumbai STAGING",
};

const get = (path, init = {}) => fetch(new URL(path, origin), { redirect: "manual", ...init, headers: { "user-agent": "Mozilla/5.0 (production-verifier)", ...(init.headers ?? {}) } });

let failed = 0;
const report = (ok, line) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${line}`);
  if (!ok) failed++;
};
const refsIn = (text) => new Set([...text.matchAll(/https:\/\/([a-z0-9]{20})\.supabase\.co/g)].map((m) => m[1]));
const jwtRoles = (text) => {
  const roles = new Set();
  for (const m of text.matchAll(/eyJ[A-Za-z0-9_-]{10,}\.(eyJ[A-Za-z0-9_-]{10,})\.[A-Za-z0-9_-]{10,}/g)) {
    try { roles.add(JSON.parse(Buffer.from(m[1], "base64url").toString()).role); } catch { /* not a JWT */ }
  }
  return roles;
};

console.log(`Verifying ${origin}\n`);

// ---------------------------------------------------------------- 1. the bundle names exactly one project
const chunks = new Set();
const pageRefs = new Set();
const pages = {};
for (const path of ["/", "/jobs", "/jobs/apply", "/contact", "/candidates"]) {
  const res = await get(path);
  const html = await res.text();
  pages[path] = { status: res.status, html, headers: res.headers };
  for (const r of refsIn(html)) pageRefs.add(r);
  for (const m of html.matchAll(/\/_next\/static\/[^"'\s)]+\.js/g)) chunks.add(m[0]);
}
const bundleRefs = new Set(pageRefs);
const roles = new Set();
const queue = [...chunks];
const seen = new Set();
while (queue.length && seen.size < 500) {
  const chunk = queue.shift();
  if (seen.has(chunk)) continue;
  seen.add(chunk);
  const js = await (await get(chunk)).text();
  for (const r of refsIn(js)) bundleRefs.add(r);
  for (const bad of Object.keys(FORBIDDEN)) if (js.includes(bad)) bundleRefs.add(bad);
  for (const r of jwtRoles(js)) roles.add(r);
  for (const m of js.matchAll(/(?:\/_next\/)?static\/(?:immutable\/)?chunks\/[A-Za-z0-9._~-]+\.js/g)) {
    const next = m[0].startsWith("/_next/") ? m[0] : `/_next/${m[0]}`;
    if (!seen.has(next)) queue.push(next);
  }
}
console.log(`      scanned ${seen.size} JavaScript chunks; Supabase refs found: ${[...bundleRefs].join(", ") || "none"}; JWT roles embedded: ${[...roles].join(", ") || "none"}`);
report(bundleRefs.has(EXPECTED), `the deployed bundle targets Mumbai production (${EXPECTED})`);
for (const [ref, label] of Object.entries(FORBIDDEN)) report(!bundleRefs.has(ref), `no trace of ${label} (${ref})`);
report(bundleRefs.size === 1, "exactly one Supabase project is referenced");
report(!roles.has("service_role"), "no service-role JWT appears in any public JavaScript");

// ---------------------------------------------------------------- 2. public pages, indexing, no test content
for (const path of ["/", "/jobs"]) report(pages[path].status === 200, `${path} → ${pages[path].status}`);
const robotsHeader = (path) => (pages[path].headers.get("x-robots-tag") ?? "").toLowerCase();
report(!robotsHeader("/").includes("noindex") && !/<meta[^>]+name="robots"[^>]+noindex/i.test(pages["/"].html), "the home page is indexable (production is not noindex)");
report(!/STAGING TEST/i.test(pages["/"].html) && !/STAGING TEST/i.test(pages["/jobs"].html), "no 'STAGING TEST' content on the home or jobs page");
report(!(pages["/"].headers.get("x-powered-by")), "no x-powered-by header");
report((pages["/"].headers.get("x-content-type-options") ?? "").toLowerCase() === "nosniff", "x-content-type-options: nosniff");

const robots = await (await get("/robots.txt")).text();
report(!/^Disallow:\s*\/\s*$/m.test(robots), "robots.txt does not disallow the whole site");
report(/Disallow:\s*\/admin/i.test(robots) && /Disallow:\s*\/pay\//i.test(robots), "robots.txt keeps /admin and /pay/ out");
report(/^Sitemap:/im.test(robots), "robots.txt names the sitemap");

const sitemapRes = await get("/sitemap.xml");
const urls = [...(await sitemapRes.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
report(sitemapRes.status === 200 && urls.length > 0, `sitemap.xml → ${sitemapRes.status}, ${urls.length} URLs`);
report(!urls.some((u) => /\/(admin|pay|portal|api)(\/|$)/.test(new URL(u).pathname)), "the sitemap lists no admin, payment, portal or api URL");
let notOk = 0, testContent = 0, indexBlocked = 0;
for (const u of urls) {
  const res = await get(new URL(u).pathname + new URL(u).search);
  const html = res.status === 200 ? await res.text() : "";
  if (res.status !== 200) notOk++;
  if (/STAGING TEST/i.test(html)) testContent++;
  if ((res.headers.get("x-robots-tag") ?? "").toLowerCase().includes("noindex")) indexBlocked++;
}
report(notOk === 0, `every sitemap URL answers 200 (${urls.length - notOk}/${urls.length})`);
report(testContent === 0, "no sitemap page carries 'STAGING TEST' content");
report(indexBlocked === 0, "no sitemap page is marked noindex");
const legal = urls.filter((u) => /privacy|terms|cookie|legal|policy/i.test(u));
report(legal.length >= 1, `legal pages are published: ${legal.map((u) => new URL(u).pathname).join(", ") || "none found"}`);

// ---------------------------------------------------------------- 3. admin is closed, sign-in is Google only
for (const path of ["/admin", "/admin/jobs", "/admin/applications", "/admin/invoices", "/admin/payments", "/admin/audit", "/admin/staff", "/admin/roles", "/admin/settings", "/admin/integrations", "/portal"]) {
  const res = await get(path);
  const to = res.headers.get("location") ?? "";
  report(res.status === 307 && /^\/(admin|portal)\/login\?next=/.test(to), `${path} without a session → ${res.status} ${to.split("?")[0]}`);
}
const login = await get("/admin/login");
const loginHtml = await login.text();
report(login.status === 200 && /Sign in with Google/i.test(loginHtml), "/admin/login offers Google sign-in");
report(!/type="password"/i.test(loginHtml), "/admin/login has no password field");
report((login.headers.get("x-robots-tag") ?? "").toLowerCase().includes("noindex"), "/admin/login is noindex");
const cb = await get("/auth/callback?next=https://evil.example/admin");
report(cb.status === 303 && new URL(cb.headers.get("location") ?? "/", origin).pathname === "/admin/login", "the sign-in callback without a code returns to sign-in, never off-site");

// ---------------------------------------------------------------- 4. payments: closed unless real
for (const path of ["/pay/GG-INV-2099-99999", "/pay/not-a-reference", "/pay/GG-JOB-2026-00001"]) {
  const res = await get(path);
  report(res.status === 404, `${path} → ${res.status}`);
}
const hook = await get("/api/razorpay/webhook", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
report(hook.status === 401 || hook.status === 503, `POST /api/razorpay/webhook with no signature → ${hook.status} (live but closed; never 2xx)`);
report((await get("/api/forms/contact")).status === 405, "/api/forms/contact exists and accepts POST only (405 on GET)");

console.log(failed ? `\n${failed} check(s) FAILED` : "\nall production checks passed");
process.exit(failed ? 1 : 0);
