/**
 * What each prerendered route actually ships, from the server build output.
 *
 *   npm run build:server && node scripts/perf/bundle-report.mjs --label=baseline
 *
 * For every prerendered HTML page in .next/server/app it sums the client JavaScript and
 * CSS the page references (raw and gzip -9), and notes which heavy libraries are present.
 * Deterministic — no server, no network. Writes perf/<label>-bundle.json.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { gzipSync } from "node:zlib";

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")));
const label = args.label ?? "run";
const APP = ".next/server/app";
if (!existsSync(APP)) { console.error("No server build found. Run `npm run build:server` first."); process.exit(1); }

const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const gz = (b) => gzipSync(b, { level: 9 }).length;

const assetCache = new Map();
function asset(src) {
  if (!assetCache.has(src)) {
    const path = join(".next", src.replace(/^\/_next\//, "").split("?")[0]);
    if (!existsSync(path)) { assetCache.set(src, null); return null; }
    const b = readFileSync(path);
    const s = b.toString("utf8");
    assetCache.set(src, {
      raw: b.length, gz: gz(b),
      libs: [
        /GoTrueClient|PostgrestClient|StorageClient/.test(s) && "supabase-js",
        /api\.emailjs\.com/.test(s) && "emailjs",
        /\$ZodType|ZodError/.test(s) && "zod",
      ].filter(Boolean),
    });
  }
  return assetCache.get(src);
}

const pages = walk(APP).filter((f) => f.endsWith(".html") && !/_not-found|_global-error/.test(f));
const out = [];
for (const f of pages.sort()) {
  const html = readFileSync(f, "utf8");
  const route = "/" + relative(APP, f).replaceAll("\\", "/").replace(/\.html$/, "").replace(/^index$/, "");
  // Modern browsers skip `noModule` scripts (Next's legacy polyfills), so they are
  // reported separately rather than counted as shipped JavaScript.
  const tags = [...html.matchAll(/<script\b([^>]*)>/g)].map((m) => m[1]);
  const modern = new Set();
  const legacy = new Set();
  for (const attrs of tags) {
    const src = attrs.match(/src="(\/_next\/static\/[^"]+\.js)"/)?.[1];
    if (!src) continue;
    (/\bnoModule\b/i.test(attrs) ? legacy : modern).add(src);
  }
  const styles = [...new Set([...html.matchAll(/href="(\/_next\/static\/[^"]+\.css)"/g)].map((m) => m[1]))];
  const sum = (list) => [...list].map(asset).filter(Boolean).reduce((acc, a) => ({ raw: acc.raw + a.raw, gz: acc.gz + a.gz, libs: [...new Set([...acc.libs, ...a.libs])] }), { raw: 0, gz: 0, libs: [] });
  const js = sum(modern);
  const nomodule = sum(legacy);
  const css = sum(styles);
  out.push({ route, jsChunks: modern.size, jsRaw: js.raw, jsGzip: js.gz, noModuleGzip: nomodule.gz, cssRaw: css.raw, cssGzip: css.gz, htmlRaw: html.length, htmlGzip: gz(Buffer.from(html)), libs: js.libs });
}

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
console.log("route".padEnd(30), "chunks", "JS gzip".padStart(10), "(nomodule)".padStart(11), "CSS gzip".padStart(10), "HTML gzip".padStart(10), " libraries");
for (const r of out) console.log(r.route.padEnd(30), String(r.jsChunks).padStart(6), kb(r.jsGzip).padStart(10), kb(r.noModuleGzip).padStart(11), kb(r.cssGzip).padStart(10), kb(r.htmlGzip).padStart(10), " " + (r.libs.join(", ") || "—"));

mkdirSync("perf", { recursive: true });
writeFileSync(`perf/${label}-bundle.json`, JSON.stringify({ label, measuredAt: new Date().toISOString(), method: "Prerendered HTML in .next/server/app; referenced /_next/static assets; gzip -9", routes: out }, null, 2));
console.log(`\nwrote perf/${label}-bundle.json`);
