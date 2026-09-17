import AxeBuilder from "@axe-core/playwright";
import { ARCHIVED_JOB, CLOSED_JOB, DRAFT_JOB, FEATURED_JOB, SAMPLE_JOB, WHATSAPP_JOB } from "./a11y-routes";
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
  test("groups open jobs into featured, general and professional, and hides what is not open", async ({ page }) => {
    await page.goto("/jobs");
    const main = page.getByRole("main");
    await expect(main.getByRole("heading", { level: 2, name: "Featured opportunities" })).toBeVisible();
    await expect(main.getByRole("heading", { level: 2, name: "Ongoing and general hiring" })).toBeVisible();
    await expect(main.getByRole("heading", { level: 2, name: "Professional opportunities" })).toBeVisible();

    const featured = main.getByRole("region", { name: "Featured opportunities" });
    await expect(featured.getByRole("heading", { level: 3, name: "STAGING TEST — Site Supervisor" })).toBeVisible();
    await expect(featured.getByText("Featured", { exact: true })).toBeVisible();

    // A featured period that has ended leaves the job listed, as standard, still free to apply for.
    const general = main.getByRole("region", { name: "Ongoing and general hiring" });
    const labour = general.locator("article").filter({ hasText: "STAGING TEST — Labour" });
    await expect(labour).toBeVisible();
    await expect(labour.getByText("Featured", { exact: true })).toHaveCount(0);
    await expect(labour.getByText("Free to apply")).toBeVisible();

    // Drafts, jobs in review, closed and archived jobs are not listed.
    for (const hidden of ["HVAC Technician", "Sales Executive", "STAGING TEST — Helper", "Civil Engineer", "Operations Manager", "paid access"]) {
      await expect(main.getByText(hidden, { exact: false }), hidden).toHaveCount(0);
    }
    // No urgency devices.
    await expect(main.getByText(/closes soon|only \d+ left|hurry/i)).toHaveCount(0);
  });

  test("filters narrow the list, announce the count and survive a reload", async ({ page }) => {
    await page.goto("/jobs");
    const cards = page.getByRole("main").locator("article");
    const total = await cards.count();
    expect(total).toBeGreaterThan(1);

    await page.getByLabel("Country", { exact: true }).selectOption({ label: "Qatar" });
    await expect(cards).toHaveCount(1);
    await expect(page.getByRole("status").filter({ hasText: /job/ })).toHaveText("1 job");
    await expect(page).toHaveURL(/country=QA/);

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
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("STAGING TEST — Accountant");
    const facts = page.getByRole("complementary", { name: "Key facts" });
    await expect(facts).toContainText("SAR 6,000 – 8,000 / month");
    await expect(facts).toContainText("STG-JOB-003");
    await expect(facts).toContainText("Professional opportunity");
    await expect(facts).toContainText("Free — there is no fee to apply for this job");
    await expect(facts).toContainText("Applications close");
    await expect(page.getByRole("link", { name: "Apply for this job" }).first()).toHaveAttribute("href", "/jobs/apply?ref=STG-JOB-003");
    await expect(page.getByRole("heading", { name: "Responsibilities" })).toBeVisible();
  });

  test("an ongoing job says it has no closing date, and states no salary it was not given", async ({ page }) => {
    await page.goto(FEATURED_JOB);
    await expect(page.getByRole("complementary", { name: "Key facts" })).toContainText("Ongoing hiring — no closing date");
    await page.goto(CLOSED_JOB);
    await expect(page.getByRole("complementary", { name: "Key facts" })).toContainText("Not stated");
  });

  test("a closed job explains itself and offers no way to apply", async ({ page }) => {
    const response = await page.goto(CLOSED_JOB);
    expect(response?.status()).toBe(200);
    await expect(page.getByText("This position has closed")).toBeVisible();
    await expect(page.getByRole("link", { name: "Apply for this job" })).toHaveCount(0);
  });

  test("drafts and archived jobs do not exist publicly", async ({ page }) => {
    expect((await page.goto(DRAFT_JOB))?.status()).toBe(404);
    expect((await page.goto(ARCHIVED_JOB))?.status()).toBe(404);
  });

  test("a job taken on WhatsApp applies there, not through the form", async ({ page }) => {
    await page.goto(WHATSAPP_JOB);
    await expect(page.getByRole("link", { name: /Apply on WhatsApp/ }).first()).toHaveAttribute("href", /wa\.me|whatsapp/);
    await expect(page.getByRole("link", { name: "Apply for this job" })).toHaveCount(0);
  });
});

test.describe("application form", () => {
  test("shows the job being applied for, looked up from its reference", async ({ page }) => {
    await page.goto("/jobs/apply?ref=STG-JOB-002");
    const form = page.locator("form#apply-form");
    await expect(form.getByText("You are applying for")).toBeVisible();
    await expect(form).toContainText("STAGING TEST — Mall Cleaner");
    await expect(form).toContainText("Qatar");
    await expect(form).toContainText("STG-JOB-002");
  });

  test("a link to a job that is not open says so and offers a general application", async ({ page }) => {
    for (const ref of ["STG-JOB-007", "STG-JOB-005", "STG-JOB-011", "NO-SUCH-REF"]) {
      await page.goto(`/jobs/apply?ref=${ref}`);
      await expect(page.getByText("This job is not accepting applications"), ref).toBeVisible();
      await expect(page.locator("form#apply-form"), ref).toContainText("General application");
    }
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
