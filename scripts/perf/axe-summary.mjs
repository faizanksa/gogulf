/**
 * Aggregates the per-route axe summaries written by tests/e2e/a11y.spec.ts.
 *
 *   node scripts/perf/axe-summary.mjs --label=baseline [--dir=test-results/axe]
 *
 * Writes perf/<label>-axe.json and prints violations by route and by rule.
 */

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")));
const dir = args.dir ?? "test-results/axe";
const label = args.label ?? "run";

const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
const reports = files.map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")));
const impacts = ["critical", "serious", "moderate", "minor"];

const byRoute = reports
  .sort((a, b) => a.route.localeCompare(b.route) || a.project.localeCompare(b.project))
  .map((r) => ({
    route: r.route,
    project: r.project,
    ...Object.fromEntries(impacts.map((i) => [i, r.violations.filter((v) => v.impact === i).reduce((n, v) => n + v.nodes, 0)])),
    rules: r.violations.map((v) => v.id),
  }));

const byRule = {};
for (const r of reports) for (const v of r.violations) {
  byRule[v.id] ??= { impact: v.impact, help: v.help, routes: new Set(), nodes: 0 };
  byRule[v.id].routes.add(`${r.project}:${r.route}`);
  byRule[v.id].nodes += v.nodes;
}

console.log("route".padEnd(28), "project".padEnd(8), impacts.map((i) => i.padStart(9)).join(""));
for (const r of byRoute) console.log(r.route.padEnd(28), r.project.padEnd(8), impacts.map((i) => String(r[i]).padStart(9)).join(""));
console.log("\nrule".padEnd(30), "impact".padEnd(10), "routes", "nodes");
for (const [id, v] of Object.entries(byRule).sort((a, b) => impacts.indexOf(a[1].impact) - impacts.indexOf(b[1].impact))) {
  console.log(id.padEnd(29), String(v.impact).padEnd(10), String(v.routes.size).padStart(6), String(v.nodes).padStart(6), " ", v.help);
}

mkdirSync("perf", { recursive: true });
writeFileSync(`perf/${label}-axe.json`, JSON.stringify({
  label, measuredAt: new Date().toISOString(), tags: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"],
  byRoute, byRule: Object.fromEntries(Object.entries(byRule).map(([k, v]) => [k, { ...v, routes: [...v.routes] }])),
}, null, 2));
console.log(`\nwrote perf/${label}-axe.json (${reports.length} route/project reports)`);
