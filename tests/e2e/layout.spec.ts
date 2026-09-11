import { SAMPLE_JOB } from "./a11y-routes";
import { expect, test } from "./fixtures";
import { PRODUCTION_ROUTES } from "./routes";

const ROUTES = [...PRODUCTION_ROUTES, "/verify", SAMPLE_JOB];

test.describe("reflow and zoom", () => {
  test.skip(({ isMobile }) => isMobile, "viewport is set explicitly");

  // 320px is the WCAG 1.4.10 reflow width; 640px is a 1280px window at 200% zoom.
  for (const width of [320, 640]) {
    test(`no page scrolls sideways at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const offenders: string[] = [];
      for (const path of ROUTES) {
        await page.goto(path);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        if (overflow > 0) offenders.push(`${path} (+${overflow}px)`);
      }
      expect(offenders).toEqual([]);
    });
  }
});

test("reduced motion removes transitions and smooth scrolling", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const { duration, behaviour } = await page.evaluate(() => ({
    duration: getComputedStyle(document.documentElement).getPropertyValue("--duration-base").trim(),
    behaviour: getComputedStyle(document.documentElement).scrollBehavior,
  }));
  // Compare the value, not the string: the CSS minifier writes 0.01ms as ".01ms".
  const ms = duration.endsWith("ms") ? parseFloat(duration) : parseFloat(duration) * 1000;
  expect(ms, `--duration-base is "${duration}"`).toBeLessThanOrEqual(0.01);
  expect(behaviour).toBe("auto");
});

test.describe("not found", () => {
  test("an unknown URL gets the helpful 404, not indexed", async ({ page }) => {
    const response = await page.goto("/this-page-does-not-exist");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("We can’t find that page");
    await expect(page.getByRole("link", { name: "Current Gulf job openings" })).toBeVisible();
    // Next adds its own noindex tag to every 404 alongside ours; both must say noindex.
    const robots = await page.locator('meta[name="robots"]').evaluateAll((els) => els.map((el) => el.getAttribute("content") ?? ""));
    expect(robots.length).toBeGreaterThan(0);
    for (const content of robots) expect(content).toMatch(/noindex/);
  });

  test("an unknown job and the unpublished travel page are 404s", async ({ page }) => {
    expect((await page.goto("/jobs/no-such-job"))?.status()).toBe(404);
    expect((await page.goto("/travel"))?.status()).toBe(404);
  });
});

test("security headers are set on pages", async ({ page }) => {
  const response = await page.goto("/");
  const headers = response!.headers();
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["strict-transport-security"]).toContain("max-age=");
  expect(headers["permissions-policy"]).toContain("camera=()");
  expect(headers["x-powered-by"]).toBeUndefined();
});
