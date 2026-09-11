import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures";
import { A11Y_ROUTES } from "./a11y-routes";

/**
 * axe-core against every public route, on a phone and a desktop viewport.
 *
 *   A11Y_MODE=report  → record violations only (used for the baseline)
 *   default           → fail on any serious or critical violation
 *
 * Each run writes one JSON summary per route to test-results/axe for
 * scripts/perf/axe-summary.mjs. axe finds roughly a third of WCAG issues;
 * keyboard and screen-reader checks are separate.
 */
const REPORT_ONLY = process.env.A11Y_MODE === "report";
const OUT = process.env.A11Y_OUT ?? "test-results/axe";
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

for (const { path, expectStatus } of A11Y_ROUTES) {
  test(`axe ${path}`, async ({ page }, info) => {
    // axe's colour-contrast rule walks every text node; on the long legacy pages, with
    // three workers sharing one local server, a full analysis can pass 60s.
    test.setTimeout(120_000);
    const response = await page.goto(path);
    expect(response?.status()).toBe(expectStatus);

    const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    const summary = violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      nodes: v.nodes.length,
      targets: v.nodes.slice(0, 3).map((n) => n.target.join(" ")),
    }));

    mkdirSync(OUT, { recursive: true });
    const slug = path === "/" ? "home" : path.replaceAll("/", "-").replace(/^-/, "");
    writeFileSync(join(OUT, `${info.project.name}--${slug}.json`), JSON.stringify({ route: path, project: info.project.name, violations: summary }, null, 2));

    if (!REPORT_ONLY) {
      const blocking = summary.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
    }
  });
}
