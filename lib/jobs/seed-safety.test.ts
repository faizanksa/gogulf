import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Staging test jobs must never be able to reach production. These checks pin the three
 * controls described at the top of supabase/seeds/staging-jobs.sql.
 */

const ROOT = path.resolve(__dirname, "..", "..");
const read = (file: string) => readFileSync(path.join(ROOT, file), "utf8");

describe("staging test jobs stay out of production", () => {
  it("no migration writes a job row or mentions the staging test data", () => {
    const dir = path.join(ROOT, "supabase", "migrations");
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql"))) {
      const sql = readFileSync(path.join(dir, file), "utf8");
      expect(sql, file).not.toMatch(/insert\s+into\s+public\.jobs\b/i);
      expect(sql, file).not.toMatch(/STG-JOB|STAGING TEST/);
    }
  });

  it("the seed file refuses to run unless the runner marked the target as staging", () => {
    const seed = read("supabase/seeds/staging-jobs.sql");
    const guard = seed.indexOf("current_setting('app.seed_target', true)");
    const firstWrite = seed.search(/insert\s+into\s+public\.jobs/i);
    expect(guard).toBeGreaterThan(-1);
    expect(firstWrite).toBeGreaterThan(guard);
    expect(seed).toMatch(/raise exception 'staging-jobs\.sql refuses to run/);
  });

  it("marks every seeded job as staging test data", () => {
    const seed = read("supabase/seeds/staging-jobs.sql");
    const rows = [...seed.matchAll(/\('(STG-JOB-\d{3})', '([^']+)'/g)];
    expect(rows.length).toBeGreaterThanOrEqual(11);
    for (const [, reference, title] of rows) {
      expect(reference).toMatch(/^STG-JOB-\d{3}$/);
      expect(title, reference).toMatch(/^STAGING TEST — /);
    }
  });

  it("the remote runner seeds staging targets only", () => {
    const runner = read("scripts/db-remote.mjs");
    expect(runner).toMatch(/const SEEDABLE = \["staging", "mumbai-staging"\];/);
    expect(runner).toMatch(/!SEEDABLE\.includes\(targetName\) \|\| target\.requiresConfirmation/);
    expect(runner).toMatch(/set app\.seed_target = 'staging'/);
  });
});
