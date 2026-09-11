import { expect, test } from "./fixtures";

/** Keyboard and screen-reader behaviour of the shell. */

test.describe("skip link and landmarks", () => {
  test("the first Tab reaches the skip link, which moves focus to the main content", async ({ page }) => {
    await page.goto("/about");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to main content" });
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();
    await page.keyboard.press("Enter");
    await expect(page.locator("#main-content")).toBeFocused();
  });

  test("every page has one main landmark and one h1", async ({ page }) => {
    for (const path of ["/", "/jobs", "/verify", "/privacy-policy"]) {
      await page.goto(path);
      await expect(page.getByRole("main"), path).toHaveCount(1);
      await expect(page.locator("h1"), path).toHaveCount(1);
    }
  });
});

test.describe("desktop header", () => {
  test.skip(({ isMobile }) => isMobile, "desktop layout");

  test("shows the primary navigation, the current page and one primary action", async ({ page }) => {
    await page.goto("/about");
    const nav = page.getByRole("navigation", { name: "Main" });
    for (const name of ["Jobs", "Job seekers", "Employers", "About", "Contact"]) {
      await expect(nav.getByRole("link", { name, exact: true })).toBeVisible();
    }
    // Travel stays out of the navigation until a travel service is confirmed (D2).
    await expect(nav.getByRole("link", { name: "Travel" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "About" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("link", { name: "Find a job" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Menu" })).toBeHidden();
  });
});

test.describe("mobile menu", () => {
  test.skip(({ isMobile }) => !isMobile, "mobile layout");

  test("is a disclosure: state, keyboard entry, Escape closes and returns focus", async ({ page }) => {
    await page.goto("/");
    const button = page.getByRole("button", { name: "Menu" });
    await expect(button).toHaveAttribute("aria-expanded", "false");
    const panelId = await button.getAttribute("aria-controls");
    expect(panelId).toBeTruthy();
    const panel = page.locator(`[id="${panelId}"]`);
    await expect(panel).toBeHidden();

    await button.click();
    const close = page.getByRole("button", { name: "Close" });
    await expect(close).toHaveAttribute("aria-expanded", "true");
    await expect(panel).toBeVisible();

    await page.keyboard.press("Tab");
    await expect(panel.getByRole("link").first()).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    await expect(page.getByRole("button", { name: "Menu" })).toBeFocused();
  });

  test("marks the current page and closes when a link is chosen", async ({ page }) => {
    await page.goto("/about");
    await page.getByRole("button", { name: "Menu" }).click();
    const nav = page.getByRole("navigation", { name: "Main" });
    await expect(nav.getByRole("link", { name: "About" })).toHaveAttribute("aria-current", "page");
    await nav.getByRole("link", { name: "Contact" }).click();
    await expect(page).toHaveURL(/\/contact$/);
    await expect(page.getByRole("button", { name: "Menu" })).toHaveAttribute("aria-expanded", "false");
  });

  test("keeps the header's primary action visible and every target at least 44px", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Find a job" })).toBeVisible();
    const button = page.getByRole("button", { name: "Menu" });
    expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await button.click();
    for (const link of await page.getByRole("navigation", { name: "Main" }).getByRole("link").all()) {
      expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
  });
});
