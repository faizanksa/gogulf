import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

/**
 * Scroll behaviour when the reader moves between pages.
 *
 * A page-wide `scroll-behavior: smooth` animates every scroll the page does not request
 * itself: the reset to the top after a link is followed (the next page appeared at the old
 * offset and glided up), the position the browser restores on Back/Forward (the page
 * appeared at the top and glided down) and a #section in the address bar. base.css no
 * longer sets it.
 *
 * The checks are frame by frame. A sampler records window.scrollY on every animation
 * frame, tagged with the pathname, so an animation shows up as intermediate values and a
 * jump before the new page is on screen shows up as a moved old-page frame.
 */

interface Frame {
  path: string;
  y: number;
}

interface ScrollProbe {
  frames: Frame[];
  /** scrollY when the last click began, read before any handler could move the page. */
  clickY: number | null;
}

declare global {
  interface Window {
    __scrollProbe?: ScrollProbe;
  }
}

/** Runs in the page, at document start, on every full load. Serialised by Playwright: keep it self-contained. */
function installSampler() {
  if (window.__scrollProbe) return;
  const probe: ScrollProbe = { frames: [], clickY: null };
  window.__scrollProbe = probe;
  // Only frames from the click onward count: what came before is the page settling.
  document.addEventListener(
    "click",
    () => {
      probe.clickY = window.scrollY;
      probe.frames = [];
    },
    { capture: true },
  );
  const tick = () => {
    probe.frames.push({ path: location.pathname, y: window.scrollY });
    requestAnimationFrame(tick);
  };
  tick();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(installSampler);
});

/** Forget the frames so far. Back and Forward are not clicks, so nothing else resets them. */
const resetFrames = (page: Page) =>
  page.evaluate(() => {
    window.__scrollProbe!.frames = [];
    window.__scrollProbe!.clickY = null;
  });

/** Wait until `count` frames have been drawn on `path`, long enough for any animation to show. */
async function framesOn(page: Page, path: string, count = 45) {
  await page.waitForFunction(
    ({ path, count }) => window.__scrollProbe!.frames.filter((f) => f.path === path).length >= count,
    { path, count },
  );
  return page.evaluate(() => ({ ...window.__scrollProbe! }));
}

/** Scroll the document to a fraction of its length, once fonts have settled its height. */
async function scrollTo(page: Page, fraction: number) {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate((fraction) => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo({ top: Math.round(max * fraction), behavior: "instant" });
  }, fraction);
  if (fraction > 0) await page.waitForFunction(() => window.scrollY > 0);
}

/** Every frame drawn on `path` has scrollY within `tolerance` of `y`. */
function expectHeldAt(frames: Frame[], path: string, y: number, tolerance: number, what: string) {
  const onPath = frames.filter((f) => f.path === path);
  expect(onPath.length, `${what}: frames drawn on ${path}`).toBeGreaterThan(0);
  const worst = Math.max(...onPath.map((f) => Math.abs(f.y - y)));
  expect(worst, `${what}: scrollY on ${path} should stay at ${y} but moved ${worst}px`).toBeLessThanOrEqual(tolerance);
}

test("the root does not scroll smoothly", async ({ page }) => {
  await page.goto("/");
  const behavior = await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior);
  expect(behavior).toBe("auto");
});

test.describe("following a link", () => {
  const findAJob = (page: Page) => page.getByRole("banner").getByRole("link", { name: "Find a job" });

  for (const [where, fraction] of [
    ["the top", 0],
    ["the middle", 0.5],
    ["the very bottom", 1],
  ] as const) {
    test(`from ${where} of a long page opens the next page at the top, on its first frame`, async ({ page }) => {
      await page.goto("/");
      await scrollTo(page, fraction);
      await findAJob(page).click();
      const { frames, clickY } = await framesOn(page, "/jobs");
      if (fraction > 0) expect(clickY, "the test starts away from the top").toBeGreaterThan(300);
      expectHeldAt(frames, "/jobs", 0, 0, "next page");
      // Nothing moves before the next page is swapped in.
      expectHeldAt(frames, "/", clickY!, 1, "old page");
    });
  }

  test("from a footer link near the bottom opens the next page at the top", async ({ page }) => {
    await page.goto("/");
    await scrollTo(page, 1);
    await page.locator('footer a[href="/about"]').first().click();
    const { frames, clickY } = await framesOn(page, "/about");
    expect(clickY, "the test starts away from the top").toBeGreaterThan(300);
    expectHeldAt(frames, "/about", 0, 0, "next page");
    expectHeldAt(frames, "/", clickY!, 1, "old page");
  });

  test("Back returns to where the reader was on the first frame, and Forward to the top", async ({ page }) => {
    await page.goto("/");
    await scrollTo(page, 0.7);
    await page.locator('footer a[href="/about"]').first().click();
    const { clickY: leftAt } = await framesOn(page, "/about");
    expect(leftAt, "the test starts away from the top").toBeGreaterThan(300);

    await resetFrames(page);
    await page.goBack();
    const back = await framesOn(page, "/");
    expectHeldAt(back.frames, "/", leftAt!, 2, "Back");

    await resetFrames(page);
    await page.goForward();
    const forward = await framesOn(page, "/about");
    expectHeldAt(forward.frames, "/about", 0, 0, "Forward");
  });
});

test.describe("loading a page directly", () => {
  test("opens at the top", async ({ page }) => {
    await page.goto("/about");
    const { frames } = await framesOn(page, "/about", 20);
    expectHeldAt(frames, "/about", 0, 0, "direct load");
  });

  test("with a #section lands on it, clear of the sticky header, without gliding", async ({ page }) => {
    await page.goto("/services#employers");
    const { frames } = await framesOn(page, "/services", 30);
    // Start of the page, then the section: two positions, not the run of them a glide passes through.
    expect(new Set(frames.map((f) => f.y)).size).toBeLessThanOrEqual(3);
    expect(await sectionClearance(page, "employers")).toBeGreaterThanOrEqual(-1);
    expect(await sectionClearance(page, "employers")).toBeLessThan(64);
  });
});

test("an in-page link jumps straight to its section, clear of the sticky header", async ({ page }) => {
  await page.goto("/services");
  await page.locator('a[href="#employers"]').first().click();
  const { frames } = await framesOn(page, "/services", 30);
  expect(new Set(frames.map((f) => f.y)).size, "the start, then the section").toBeLessThanOrEqual(2);
  expect(await sectionClearance(page, "employers")).toBeGreaterThanOrEqual(-1);
  expect(await sectionClearance(page, "employers")).toBeLessThan(64);
});

/** How far below the sticky header the section starts. Negative: hidden behind it. */
function sectionClearance(page: Page, id: string) {
  return page.evaluate((id) => {
    const top = document.getElementById(id)!.getBoundingClientRect().top;
    return top - document.querySelector("header")!.getBoundingClientRect().height;
  }, id);
}
