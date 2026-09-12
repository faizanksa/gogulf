import { SAMPLE_JOB } from "./a11y-routes";
import { expect, test } from "./fixtures";

/**
 * The multilingual foundation (docs/I18N.md). No real language is published yet, so the
 * other-language routes are exercised with the pseudo-locales, which local and staging
 * builds include: en-XA (accented, lengthened) and ar-XB (right-to-left).
 */

const RLO = "‮";

test.describe("English stays where it was", () => {
  test("English pages keep their URLs and are marked en-IN, left to right", async ({ page }) => {
    const response = await page.goto("/verify");
    expect(response?.status()).toBe(200);
    await expect(page.locator("html")).toHaveAttribute("lang", "en-IN");
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  });

  test("/en/… is never a public URL: it redirects permanently to the unprefixed path", async ({ page }) => {
    const response = await page.goto("/en/verify");
    expect(new URL(page.url()).pathname).toBe("/verify");
    const hop = await response?.request().redirectedFrom()?.response();
    expect(hop?.status()).toBe(308);
  });
});

test.describe("right to left", () => {
  test("an RTL page is right-to-left at the document level, with mirrored direction icons", async ({ page }) => {
    const response = await page.goto("/ar-XB/verify");
    expect(response?.status()).toBe(200);
    await expect(page.locator("html")).toHaveAttribute("lang", "ar-XB");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    const chevron = page.locator("main nav ol svg").first();
    expect(await chevron.evaluate((el) => getComputedStyle(el).transform)).toBe("matrix(-1, 0, 0, 1, 0, 0)");
    const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
    expect(new URL(canonical!).pathname).toBe("/ar-XB/verify");
  });

  test("phone numbers keep their digit order inside right-to-left text", async ({ page }) => {
    await page.goto("/ar-XB/verify");
    await expect(page.locator('footer dl bdi[dir="ltr"]').first()).toHaveText("+91 99363 09015");
  });

  test.describe("reflow", () => {
    test.skip(({ isMobile }) => isMobile, "viewport is set explicitly");
    for (const width of [320, 640, 1024]) {
      test(`no right-to-left or lengthened page scrolls sideways at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        const offenders: string[] = [];
        for (const path of ["/ar-XB/verify", `/ar-XB${SAMPLE_JOB}`, "/en-XA/verify", `/en-XA${SAMPLE_JOB}`]) {
          await page.goto(path);
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
          if (overflow > 0) offenders.push(`${path} (+${overflow}px)`);
        }
        expect(offenders).toEqual([]);
      });
    }
  });
});

test.describe("which languages exist", () => {
  test("a language that is not published has no pages", async ({ page }) => {
    for (const path of ["/hi", "/hi/verify", "/ar/verify", "/ml/verify", "/ta/verify", "/bn/verify"]) {
      expect((await page.goto(path))?.status(), path).toBe(404);
    }
  });

  test("an untranslated page under a language is the helpful 404", async ({ page }) => {
    // No route matches, so app/global-not-found.tsx answers — in English, the canonical language.
    const response = await page.goto("/ar-XB/about");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("We can’t find that page");
  });

  test("pseudo-English marks every interface string that comes from the catalogue", async ({ page }) => {
    await page.goto("/en-XA/verify");
    await expect(page.locator("html")).toHaveAttribute("lang", "en-XA");
    await expect(page.locator('a[href="#main-content"]')).toHaveText(/^\[Šķîþ ţö ɱáîñ çöñţéñţ/);
  });

  test("pseudo-locales never reach hreflang or the sitemap", async ({ page }) => {
    await page.goto("/verify");
    const langs = await page.locator('link[rel="alternate"][hreflang]').evaluateAll((els) => els.map((e) => e.getAttribute("hreflang") ?? ""));
    expect(langs.filter((l) => /-X[AB]$/i.test(l))).toEqual([]);
    const sitemap = await (await page.request.get("/sitemap.xml")).text();
    expect(sitemap).not.toMatch(/\/(en-XA|ar-XB)\b/);
  });
});

test.describe("choosing a language", () => {
  test("the desktop menu lists the page's languages and works from the keyboard", async ({ page, isMobile }) => {
    test.skip(isMobile, "phones get the list inside the menu panel");
    await page.goto("/verify");
    const button = page.getByRole("button", { name: "Language: English" });
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await button.focus();
    await page.keyboard.press("Enter");
    await expect(button).toHaveAttribute("aria-expanded", "true");
    const list = page.locator(`[id="${await button.getAttribute("aria-controls")}"]`);
    await expect(list.getByRole("link")).toHaveCount(3);
    await expect(list.getByRole("link").first()).toHaveAttribute("aria-current", "true");
    await expect(list.locator('a[lang="ar-XB"]')).toHaveAttribute("hreflang", "ar-XB");
    await page.keyboard.press("Escape");
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await expect(button).toBeFocused();
    await button.click();
    await list.locator('a[lang="ar-XB"]').click();
    await expect(page).toHaveURL(/\/ar-XB\/verify$/);
    expect(await page.evaluate(() => localStorage.getItem("gg-lang"))).toBe("ar-XB");
  });

  test("phones get the languages inside the menu panel", async ({ page, isMobile }) => {
    test.skip(!isMobile, "desktop uses the header menu");
    await page.goto("/verify");
    await page.getByRole("button", { name: "Menu" }).click();
    await expect(page.locator('#site-menu a[lang="ar-XB"]')).toBeVisible();
  });

  test("a page that exists in one language shows no language choice", async ({ page }) => {
    await page.goto("/about");
    await expect(page.locator("header a[hreflang]")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Language:/ })).toHaveCount(0);
  });

  test("the suggestion offers the chosen language, never redirects, and stays dismissed", async ({ page }) => {
    await page.goto("/verify");
    await page.evaluate(() => localStorage.setItem("gg-lang", "ar-XB"));
    await page.reload();
    expect(new URL(page.url()).pathname).toBe("/verify");
    const offer = page.locator('aside[lang="ar-XB"]');
    await expect(offer).toBeVisible();
    await expect(offer.getByRole("link")).toHaveAttribute("href", "/ar-XB/verify");
    await offer.getByRole("button").click();
    await expect(offer).toHaveCount(0);
    await page.reload();
    await expect(page.locator('aside[lang="ar-XB"]')).toHaveCount(0);
  });
});

test.describe("browser language", () => {
  test.use({ locale: "hi-IN" });

  test("an unpublished browser language is not suggested", async ({ page }) => {
    await page.goto("/verify");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("aside[lang]")).toHaveCount(0);
  });
});

test.describe("jobs and forms in other languages", () => {
  test("a job in a right-to-left language keeps its facts and carries no JobPosting", async ({ page }) => {
    const response = await page.goto(`/ar-XB${SAMPLE_JOB}`);
    expect(response?.status()).toBe(200);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("main")).toContainText("3,500");
    const data = await page.locator('script[type="application/ld+json"]').allTextContents();
    expect(data.join("\n")).not.toContain("JobPosting");
  });

  test("the form API answers in the page's language", async ({ page, isMobile }) => {
    test.skip(isMobile, "one request is enough, and the endpoint is rate-limited");
    const response = await page.request.post("/api/forms/contact", { data: {}, headers: { "X-Form-Locale": "ar-XB" } });
    expect([400, 429]).toContain(response.status());
    const body = (await response.json()) as { error: string };
    expect(body.error.startsWith(RLO)).toBe(true);
  });
});
