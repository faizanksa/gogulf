/**
 * Lab Interaction to Next Paint (and the LCP element): scripted interactions on a
 * throttled phone profile.
 *
 *   node scripts/perf/inp.mjs --target=staging|http://127.0.0.1:3100 --label=baseline
 *
 * Lighthouse navigation runs cannot measure INP and the site has too little traffic for
 * field data, so this drives Chrome (Pixel 7 emulation, 4× CPU slowdown) through the
 * interactions that exist — the mobile menu and the job filters — and reads INP from
 * Google's web-vitals library. It is a lab proxy, reported as such.
 *
 * Staging access: one request asks Vercel to set its host-scoped bypass cookie; the
 * secret is never attached to other requests.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium, devices } from "@playwright/test";
import { getStagingBypass, STAGING_ORIGIN } from "./vercel-bypass.mjs";

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")));
const label = args.label ?? "run";
const base = args.target === "staging" ? STAGING_ORIGIN : (args.target ?? "http://127.0.0.1:3100");
const webVitals = readFileSync("node_modules/web-vitals/dist/web-vitals.iife.js", "utf8");

const browser = await chromium.launch({ channel: "chrome" });
const context = await browser.newContext({ ...devices["Pixel 7"] });
if (args.target === "staging") {
  const secret = await getStagingBypass();
  const r = await context.request.get(`${STAGING_ORIGIN}/robots.txt`, {
    headers: { "x-vercel-protection-bypass": secret, "x-vercel-set-bypass-cookie": "true" },
    maxRedirects: 0,
  });
  if (r.status() >= 400) throw new Error(`Staging bypass refused (HTTP ${r.status()})`);
}
await context.addInitScript(
  `${webVitals};window.__inp=null;webVitals.onINP(function(m){window.__inp=m.value},{reportAllChanges:true});` +
  `window.__lcp=null;new PerformanceObserver(function(l){var e=l.getEntries().pop();if(e){var el=e.element;window.__lcp={ms:Math.round(e.startTime),size:e.size,tag:el?el.tagName.toLowerCase():null,src:e.url||null,text:el&&!e.url?(el.textContent||'').trim().slice(0,60):null};}}).observe({type:'largest-contentful-paint',buffered:true});`,
);

const menuButton = 'button[aria-controls]:visible, .nav-toggle:visible';
const scenarios = [
  {
    name: "open and close the mobile menu (home)",
    path: "/",
    run: async (page) => {
      const button = page.locator(menuButton).first();
      await button.waitFor({ state: "visible", timeout: 15000 });
      for (let i = 0; i < 3; i++) {
        await button.click();
        await page.waitForTimeout(250);
        await button.click();
        await page.waitForTimeout(250);
      }
    },
  },
  {
    name: "search and filter jobs (/jobs)",
    path: "/jobs",
    run: async (page) => {
      const search = page.locator('input[type="search"], #job-search').first();
      await search.waitFor({ state: "visible", timeout: 15000 });
      await search.click();
      await search.pressSequentially("supervisor", { delay: 80 });
      const select = page.locator("select").first();
      if (await select.count()) await select.selectOption({ index: 1 });
      await page.waitForTimeout(300);
    },
  },
];

const results = [];
for (const s of scenarios) {
  const values = [];
  let lcp = null;
  for (let i = 0; i < 3; i++) {
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    const response = await page.goto(base + s.path, { waitUntil: "load" });
    if (!response || response.status() >= 400) throw new Error(`${s.path} returned ${response?.status()}`);
    await s.run(page);
    await page.waitForTimeout(500);
    values.push(await page.evaluate(() => window.__inp));
    lcp ??= await page.evaluate(() => window.__lcp);
    await page.close();
  }
  const sorted = values.filter((v) => typeof v === "number").sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? null;
  results.push({ scenario: s.name, path: s.path, inpMs: median, samples: values, lcpElement: lcp });
  console.log(`${s.name.padEnd(42)} INP ${median === null ? "n/a" : `${Math.round(median)} ms`}  samples ${values.map((v) => (v === null ? "n/a" : Math.round(v))).join(", ")}  | LCP element: ${lcp ? `${lcp.tag} ${lcp.src ?? `"${lcp.text}"`}` : "n/a"}`);
}
await browser.close();

mkdirSync("perf", { recursive: true });
const file = `perf/${label}-inp.json`;
writeFileSync(file, JSON.stringify({
  label, target: args.target ?? base, measuredAt: new Date().toISOString(),
  method: "Playwright + Chrome, Pixel 7 emulation, 4× CPU throttle, web-vitals onINP (lab proxy, not field data). LCP element from PerformanceObserver, unthrottled network.",
  results,
}, null, 2));
console.log(`\nwrote ${file}`);
