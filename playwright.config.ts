import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end and accessibility tests.
 *
 *   E2E_BASE_URL unset                     → a local production server on :3100
 *                                            (run `npm run build:server` first)
 *   E2E_BASE_URL=https://staging.gogulf.co → the private staging deployment; the Vercel
 *                                            bypass is scoped to staging in fixtures.ts
 *
 * Uses the installed Chrome (`channel: "chrome"`) so no browser download is needed.
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3100";
const local = !process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: local ? 4 : 2,
  retries: 0,
  reporter: [["list"]],
  outputDir: "test-results",
  use: { baseURL, trace: "retain-on-failure" },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"], channel: "chrome" } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel: "chrome" } },
  ],
  webServer: local
    ? { command: "npm run start -- -p 3100", url: baseURL, reuseExistingServer: true, timeout: 120_000 }
    : undefined,
});
