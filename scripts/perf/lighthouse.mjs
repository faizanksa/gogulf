/**
 * Lighthouse across the public routes, median of N runs, summarised.
 *
 *   node scripts/perf/lighthouse.mjs --target=staging --label=baseline [--runs=3] [--preset=desktop]
 *   node scripts/perf/lighthouse.mjs --target=http://127.0.0.1:3100 --label=local
 *
 * Staging is reached through staging-proxy.mjs so the bypass secret never leaves this
 * machine except toward staging. Writes perf/<label>-lighthouse[-desktop].json (summary
 * only — no raw report, no headers, no secret).
 *
 * Lab data: Lighthouse's default mobile profile (simulated slow 4G, 4× CPU slowdown).
 * INP cannot be measured in a navigation run — see inp.mjs.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import lighthouse from "lighthouse";
import desktopConfig from "lighthouse/core/config/desktop-config.js";
import * as chromeLauncher from "chrome-launcher";
import { getStagingBypass, STAGING_ORIGIN } from "./vercel-bypass.mjs";
import { startStagingProxy } from "./staging-proxy.mjs";

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")));
const label = args.label ?? "run";
const runs = Number(args.runs ?? 3);
const preset = args.preset === "desktop" ? "desktop" : "mobile";
const routes = (args.routes ?? [
  "/", "/about", "/services", "/jobs", "/jobs/apply", "/candidates", "/employers", "/contact",
  "/pricing", "/privacy-policy", "/terms-and-conditions", "/cancellation-and-refunds", "/shipping-policy",
].join(",")).split(",");

let base = args.target ?? "http://127.0.0.1:3100";
let proxy;
if (base === "staging") {
  const secret = await getStagingBypass();
  proxy = await startStagingProxy({ target: STAGING_ORIGIN, secret });
  base = proxy.origin;
}

const chrome = await chromeLauncher.launch({ chromeFlags: ["--headless=new", "--no-first-run"] });
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const row = (items, type) => items.find((i) => i.resourceType === type) ?? { transferSize: 0, requestCount: 0 };

const results = [];
try {
  for (const route of routes) {
    const samples = [];
    for (let i = 0; i < runs; i++) {
      const r = await lighthouse(
        base + route,
        { port: chrome.port, output: "json", logLevel: "error", onlyCategories: ["performance", "accessibility", "best-practices", "seo"] },
        preset === "desktop" ? desktopConfig : undefined,
      );
      const lhr = r.lhr;
      const a = lhr.audits;
      const items = a["resource-summary"]?.details?.items ?? [];
      samples.push({
        performance: Math.round(lhr.categories.performance.score * 100),
        accessibility: Math.round(lhr.categories.accessibility.score * 100),
        bestPractices: Math.round(lhr.categories["best-practices"].score * 100),
        seo: Math.round(lhr.categories.seo.score * 100),
        lcpMs: Math.round(a["largest-contentful-paint"].numericValue),
        fcpMs: Math.round(a["first-contentful-paint"].numericValue),
        tbtMs: Math.round(a["total-blocking-time"].numericValue),
        cls: Number(a["cumulative-layout-shift"].numericValue.toFixed(3)),
        speedIndexMs: Math.round(a["speed-index"].numericValue),
        bytes: {
          total: row(items, "total").transferSize,
          document: row(items, "document").transferSize,
          script: row(items, "script").transferSize,
          stylesheet: row(items, "stylesheet").transferSize,
          image: row(items, "image").transferSize,
          font: row(items, "font").transferSize,
          thirdParty: row(items, "third-party").transferSize,
        },
        requests: {
          total: row(items, "total").requestCount,
          script: row(items, "script").requestCount,
          font: row(items, "font").requestCount,
          thirdParty: row(items, "third-party").requestCount,
        },
        lcpElement: a["largest-contentful-paint-element"]?.details?.items?.[0]?.items?.[0]?.node?.snippet?.slice(0, 120) ?? null,
      });
    }
    // Report the run with the median performance score, as PageSpeed does.
    const med = median(samples.map((s) => s.performance));
    const pick = samples.find((s) => s.performance === med);
    results.push({ route, runs, spread: { performance: [Math.min(...samples.map((s) => s.performance)), Math.max(...samples.map((s) => s.performance))] }, ...pick });
    const b = pick.bytes;
    console.log(
      `${route.padEnd(26)} perf ${String(pick.performance).padStart(3)}  a11y ${String(pick.accessibility).padStart(3)}  seo ${String(pick.seo).padStart(3)}  ` +
      `LCP ${String(pick.lcpMs).padStart(5)}ms  CLS ${pick.cls.toFixed(3)}  TBT ${String(pick.tbtMs).padStart(4)}ms  ` +
      `JS ${(b.script / 1024).toFixed(0)}KB  CSS ${(b.stylesheet / 1024).toFixed(0)}KB  img ${(b.image / 1024).toFixed(0)}KB  font ${(b.font / 1024).toFixed(0)}KB  3p ${pick.requests.thirdParty}req/${(b.thirdParty / 1024).toFixed(0)}KB  total ${(b.total / 1024).toFixed(0)}KB`,
    );
  }
} finally {
  await chrome.kill();
  proxy?.server.close();
}

mkdirSync("perf", { recursive: true });
const file = `perf/${label}-lighthouse${preset === "desktop" ? "-desktop" : ""}.json`;
writeFileSync(file, JSON.stringify({
  label, preset, target: args.target ?? base, measuredAt: new Date().toISOString(), runsPerRoute: runs,
  method: args.target === "staging"
    ? "Local Lighthouse via a localhost proxy to staging (bypass header added only toward staging; browser→proxy HTTP/1.1)"
    : "Local Lighthouse",
  lighthouseVersion: (await import("lighthouse/package.json", { with: { type: "json" } })).default.version,
  results,
}, null, 2));
console.log(`\nwrote ${file}`);
