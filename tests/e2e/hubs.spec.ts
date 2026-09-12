import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { EMPLOYER_SERVICES } from "../../lib/forms/service-options";
import { expect, test } from "./fixtures";

/**
 * The job-seeker hub, the employer page and the service catalogue (2C). Nothing reaches
 * the real form route: empty submits stop at the browser's checks, and the one submit
 * per form is answered by the test — which also checks the payload is what the server
 * already routes on (service name, page source, the language header).
 */

const WCAG = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];
const INQUIRY = "**/api/forms/service-inquiry";

async function seriousViolations(page: Page, selector: string) {
  const { violations } = await new AxeBuilder({ page }).include(selector).withTags(WCAG).analyze();
  return violations.filter((v) => v.impact === "serious" || v.impact === "critical");
}

test.describe("job-seeker hub", () => {
  test("covers the steps, documents, fees, safety and questions, each reachable from the page's own contents", async ({ page }) => {
    await page.goto("/candidates");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Working in the Gulf, step by step");
    const toc = page.getByRole("navigation", { name: "On this page" });
    for (const link of await toc.getByRole("link").all()) {
      const target = (await link.getAttribute("href"))!;
      await expect(page.locator(target)).toHaveCount(1);
    }
    await expect(page.getByRole("main").locator("ol ol > li")).toHaveCount(10);

    const question = page.getByText("Does Go Gulf guarantee me a job or a visa?");
    await question.click();
    await expect(page.getByText(/We do not guarantee selection, employment, a visa or a joining date\. Our Terms/)).toBeVisible();
  });
});

test.describe("service catalogue", () => {
  test("a service card preselects its service in the enquiry form", async ({ page }) => {
    await page.goto("/services");
    await page.locator("#service-bulk-manpower").getByRole("link").click();
    await expect(page).toHaveURL(/\?service=bulk-manpower#inquiry$/);
    await expect(page.getByLabel("What do you need?")).toHaveValue("Bulk Manpower Recruitment");
  });

  test("an empty submit lists every missing field in order, and sends nothing", async ({ page }) => {
    let sent = false;
    await page.route(INQUIRY, (route) => {
      sent = true;
      return route.abort();
    });
    await page.goto("/services");
    await page.getByRole("button", { name: "Send enquiry" }).click();
    const summary = page.getByRole("alert").filter({ hasText: "There is a problem" });
    await expect(summary).toBeFocused();
    await expect(summary.getByRole("link")).toHaveText(["Choose the service you need.", "Enter your full name.", "Enter your email address.", "Enter your phone or WhatsApp number."]);
    expect(sent).toBe(false);
    expect(await seriousViolations(page, "#inquiry-form")).toEqual([]);
  });

  test("sends the exact service name the server routes on, with the page and language", async ({ page }) => {
    let body: Record<string, string> = {};
    let locale: string | undefined;
    await page.route(INQUIRY, (route) => {
      body = route.request().postDataJSON();
      locale = route.request().headers()["x-form-locale"];
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, acknowledgementSent: true }) });
    });
    await page.goto("/services");
    await page.getByLabel("What do you need?").selectOption({ label: "Medical Coordination" });
    await page.getByLabel("Full name").fill("Test Person");
    await page.getByLabel("Email address").fill("test@example.com");
    await page.getByLabel(/Phone or WhatsApp number/).fill("+91 98765 43210");
    await page.getByLabel("Preferred country").selectOption({ label: "Qatar" });
    await page.getByRole("button", { name: "Send enquiry" }).click();

    await expect(page.getByRole("status").filter({ hasText: "Enquiry received" })).toBeVisible();
    expect(body).toMatchObject({ service_type: "Medical Coordination", country: "Qatar", page_source: "Services Page", website: "" });
    expect(locale).toBe("en");
  });
});

test.describe("employer requirement", () => {
  test("an empty submit lists every missing field in order, and sends nothing", async ({ page }) => {
    let sent = false;
    await page.route(INQUIRY, (route) => {
      sent = true;
      return route.abort();
    });
    await page.goto("/employers#requirement");
    await page.getByRole("button", { name: "Send requirement" }).click();
    const summary = page.getByRole("alert").filter({ hasText: "There is a problem" });
    await expect(summary).toBeFocused();
    await expect(summary.getByRole("link")).toHaveText([
      "Enter your company’s name.",
      "Choose the country where the jobs are.",
      "Tell us the roles and trades you need.",
      "Enter your name.",
      "Enter your email address.",
      "Enter your phone or WhatsApp number.",
    ]);
    expect(sent).toBe(false);
    expect(await seriousViolations(page, "#employer-form")).toEqual([]);
  });

  test("sends an employer service to the business desk, with the requirement written out in English", async ({ page }) => {
    let body: Record<string, string> = {};
    await page.route(INQUIRY, (route) => {
      body = route.request().postDataJSON();
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, acknowledgementSent: true }) });
    });
    await page.goto("/employers#requirement");
    await page.getByLabel("Company name").fill("Test Contracting LLC");
    await page.getByLabel("Country where the jobs are").selectOption({ label: "Qatar" });
    await page.getByLabel(/^City/).fill("Doha");
    await page.getByLabel("Roles and trades you need").fill("20 electricians");
    await page.getByLabel(/Total number of people/).fill("20");
    await page.getByLabel(/When do you need them/).selectOption({ label: "Within a month" });
    await page.getByLabel(/^Accommodation/).selectOption({ label: "Provided by us" });
    await page.getByLabel("Your name").fill("Test Person");
    await page.getByLabel("Work email").fill("test@example.com");
    await page.getByLabel(/Phone or WhatsApp number/).fill("+974 5555 0000");
    await page.getByRole("button", { name: "Send requirement" }).click();

    await expect(page.getByRole("status").filter({ hasText: "Requirement received" })).toBeVisible();
    expect(EMPLOYER_SERVICES as readonly string[]).toContain(body.service_type);
    expect(body.page_source).toBe("Employers Page");
    expect(body.message).toBe(
      ["Company: Test Contracting LLC", "Work location: Doha, Qatar", "Roles and trades: 20 electricians", "Total headcount: 20", "Start: Within a month", "Accommodation: Provided by the employer"].join("\n"),
    );
  });
});
