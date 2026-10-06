import { expect, test } from "./fixtures";

/**
 * Round 3 (6 Oct 2026), checked on the rendered pages:
 *   - the legal name and the registered office appear ONCE on ordinary pages (the footer),
 *     and in full on /verify; the brand is the face of the site;
 *   - the CIN stays in the top bar, and every contact route stays reachable;
 *   - company registration is not presented as a recruiting licence;
 *   - the written disclosure of the recruiting agent comes BEFORE the referral.
 */

const LEGAL_NAME = "Faizan Chaudhary Gulf Travels Private Limited";
const STREET = "Mishrapur";
const CIN = "U52291UP2024PTC198095";
const NOT_LICENCE = "Company registration is not a recruiting licence. Your recruiting agent's registration number is given to you in writing before you pay.";
const count = (text: string, needle: string) => text.split(needle).length - 1;

test.describe("legal name and registered office: shown once, not everywhere", () => {
  for (const path of ["/", "/jobs", "/candidates", "/employers", "/services", "/contact"]) {
    test(`${path}: once, in the footer; CIN in the top bar; every contact route present`, async ({ page }) => {
      await page.goto(path);
      const body = await page.locator("body").innerText();
      expect(count(body, LEGAL_NAME), "legal name").toBe(1);
      expect(count(body, STREET), "registered office").toBe(1);
      const footer = page.getByRole("contentinfo");
      await expect(footer).toContainText(LEGAL_NAME);
      await expect(footer).toContainText(STREET);
      const banner = page.getByRole("banner");
      await expect(banner).toContainText(CIN);
      await expect(banner).not.toContainText("Faizan");
      for (const contact of ["+91 99363 09015", "careers@gogulf.co", "business@gogulf.co"]) await expect(footer, contact).toContainText(contact);
      await expect(footer.getByRole("link", { name: /\+91 99363 09015.*opens WhatsApp/ })).toHaveAttribute("href", /wa\.me/);
    });
  }

  test("/verify shows the legal name and the registered office in full", async ({ page }) => {
    await page.goto("/verify");
    const main = page.getByRole("main");
    await expect(main).toContainText(LEGAL_NAME);
    await expect(main).toContainText("G No-364, Mishrapur");
    await expect(main).toContainText(CIN);
  });

  test("/contact points to /verify for company details instead of repeating them", async ({ page }) => {
    await page.goto("/contact");
    const aside = page.getByRole("complementary", { name: "Contact details and company details" });
    await expect(aside.getByRole("link", { name: "Verify Go Gulf" })).toHaveAttribute("href", /\/verify#company-heading$/);
    await expect(aside).not.toContainText(LEGAL_NAME);
  });
});

test.describe("company registration is not a recruiting licence", () => {
  for (const path of ["/", "/verify", "/about", "/employers"]) {
    test(`${path} says so beside the company facts`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole("main").getByText(NOT_LICENCE).first()).toBeVisible();
    });
  }
});

test("the process names the agent in writing before the referral", async ({ page }) => {
  await page.goto("/candidates");
  const steps = page.getByRole("main").locator("ol ol > li");
  await expect(steps).toHaveCount(10);
  await expect(steps.nth(3)).toContainText("Written disclosure");
  await expect(steps.nth(4)).toContainText("Referral, with your agreement");
  await expect(steps.nth(4)).toContainText("only after you have the agent's details in writing and have agreed");
});
