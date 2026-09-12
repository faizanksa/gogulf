import AxeBuilder from "@axe-core/playwright";
import { SAMPLE_JOB } from "./a11y-routes";
import { expect, test } from "./fixtures";

/**
 * The job-seeker journey (2C): home → jobs → job page → application form. Nothing is
 * uploaded or sent — the form tests stop at the browser's own checks, and assert that no
 * request left the page.
 */

const WCAG = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];

test.describe("home", () => {
  test("says what Go Gulf does, with the primary action, the company facts and the process", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Work in the Gulf, with a company you can check.");
    const main = page.getByRole("main");
    await expect(main.getByRole("link", { name: "Find a job" }).first()).toBeVisible();
    await expect(main.getByText("U52291UP2024PTC198095")).toBeVisible();
    // The business's ten steps, as real nested ordered lists (four phases).
    await expect(main.locator("ol ol > li")).toHaveCount(10);
  });
});

test.describe("jobs list", () => {
  test("filters narrow the list, announce the count and survive a reload", async ({ page }) => {
    await page.goto("/jobs");
    const cards = page.getByRole("main").locator("article");
    const total = await cards.count();
    expect(total).toBeGreaterThan(1);

    await page.getByLabel("Country", { exact: true }).selectOption({ label: "Qatar" });
    await expect(cards).toHaveCount(1);
    await expect(page.getByRole("status").filter({ hasText: /job/ })).toHaveText("1 job");
    await expect(page).toHaveURL(/country=Qatar/);

    await page.reload();
    await expect(cards).toHaveCount(1);

    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(cards).toHaveCount(total);
  });

  test("a search with no match says so and offers a way out", async ({ page }) => {
    await page.goto("/jobs");
    await page.getByRole("searchbox", { name: "Search" }).fill("zzzz-no-such-job");
    await expect(page.getByRole("heading", { name: "No jobs match these filters" })).toBeVisible();
    await page.getByRole("button", { name: "Clear filters" }).first().click();
    await expect(page.getByRole("main").locator("article").first()).toBeVisible();
  });
});

test.describe("job page", () => {
  test("puts the facts first and links to the form for this job", async ({ page }) => {
    await page.goto(SAMPLE_JOB);
    const facts = page.getByRole("complementary", { name: "Key facts" });
    await expect(facts).toContainText("SAR 3,500 – 4,500 / month");
    await expect(facts).toContainText("site-supervisor-saudi-arabia");
    await expect(page.getByRole("link", { name: "Apply for this job" }).first()).toHaveAttribute(
      "href",
      /\/jobs\/apply\?job=Site\+Supervisor&country=Saudi\+Arabia&type=Full-Time$/,
    );
    // Nothing is listed for this job, and the page says so instead of inventing it.
    await expect(page.getByText("The full requirements for this job are not listed here yet.")).toBeVisible();
  });
});

test.describe("application form", () => {
  test("shows the job being applied for, taken from the link", async ({ page }) => {
    await page.goto("/jobs/apply?job=Site%20Supervisor&country=Saudi%20Arabia&type=Full-Time");
    const form = page.locator("form#apply-form");
    await expect(form.getByText("You are applying for")).toBeVisible();
    await expect(form).toContainText("Site Supervisor");
    await expect(form).toContainText("Saudi Arabia");
  });

  test("an empty submit lists every problem, focuses the summary and sends nothing", async ({ page }) => {
    const sent: string[] = [];
    page.on("request", (r) => {
      if (/\/api\/forms\/|supabase/.test(r.url())) sent.push(r.url());
    });
    await page.goto("/jobs/apply");
    await page.getByRole("button", { name: "Submit application" }).click();

    const summary = page.getByRole("alert").filter({ hasText: "There is a problem" });
    await expect(summary).toBeFocused();
    await expect(summary.getByRole("link")).toHaveText([
      "Enter your full name.",
      "Enter your phone or WhatsApp number.",
      "Enter your email address.",
      "Attach your CV.",
      "Attach a copy of your passport.",
    ]);
    await expect(page.getByLabel("CV or resume")).toHaveAttribute("aria-invalid", "true");

    const { violations } = await new AxeBuilder({ page }).include("#apply-form").withTags(WCAG).analyze();
    expect(violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
    expect(sent).toEqual([]);
  });

  test("a file over 8 MB is refused before anything uploads", async ({ page }) => {
    const sent: string[] = [];
    page.on("request", (r) => {
      if (/\/api\/forms\/|supabase/.test(r.url())) sent.push(r.url());
    });
    await page.goto("/jobs/apply");
    await page.getByLabel("Full name").fill("Test Person");
    await page.getByLabel(/Phone or WhatsApp number/).fill("+91 90000 00000");
    await page.getByLabel("Email address").fill("test@example.com");
    await page.getByLabel("CV or resume").setInputFiles({ name: "cv.pdf", mimeType: "application/pdf", buffer: Buffer.alloc(9 * 1024 * 1024) });
    await page.getByLabel("Passport copy").setInputFiles({ name: "passport.jpg", mimeType: "image/jpeg", buffer: Buffer.alloc(1024) });
    await page.getByRole("button", { name: "Submit application" }).click();

    await expect(page.getByRole("alert").filter({ hasText: "There is a problem" })).toContainText("cv.pdf is larger than 8 MB");
    expect(sent).toEqual([]);
  });
});
