import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures";

/**
 * Form error and status states — the form kit's reference implementation (contact).
 * Nothing is ever sent: the browser checks stop invalid submissions, and the server
 * route is intercepted and answered by the test.
 */

test.describe("contact form", () => {
  test("an empty submit shows a focused error summary linked to each field, and sends nothing", async ({ page }) => {
    let sent = false;
    await page.route("**/api/forms/contact", (route) => {
      sent = true;
      return route.abort();
    });
    await page.goto("/contact");
    await page.getByRole("button", { name: "Send message" }).click();

    const summary = page.getByRole("alert").filter({ hasText: "There is a problem" });
    await expect(summary).toBeFocused();
    await expect(summary.getByRole("link")).toHaveText(["Enter your full name.", "Enter your email address.", "Enter your message."]);

    const name = page.getByLabel("Full name");
    await expect(name).toHaveAttribute("aria-invalid", "true");
    expect(await name.getAttribute("aria-describedby")).toContain("c_name-error");
    await expect(page.locator("#c_name-error")).toContainText("Enter your full name.");
    // The optional phone field is not flagged.
    await expect(page.getByLabel(/Phone or WhatsApp number/)).not.toHaveAttribute("aria-invalid", "true");

    await summary.getByRole("link", { name: "Enter your full name." }).click();
    await expect(name).toBeFocused();
    expect(sent).toBe(false);

    // The error state itself must be accessible.
    const { violations } = await new AxeBuilder({ page }).include("#contact-form").withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect(violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
  });

  test("a malformed email is caught in the browser with a specific message", async ({ page }) => {
    await page.goto("/contact");
    await page.getByLabel("Full name").fill("Test Person");
    await page.getByLabel("Email address").fill("not-an-email");
    await page.getByLabel("Message").fill("Hello");
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.locator("#c_email-error")).toContainText("name@example.com");
  });

  test("server field errors render through the same path", async ({ page }) => {
    await page.route("**/api/forms/contact", (route) =>
      route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, error: "Please check the highlighted fields.", fieldErrors: { phone: ["Enter a valid phone number, including country code if outside India."] } }),
      }),
    );
    await page.goto("/contact");
    await page.getByLabel("Full name").fill("Test Person");
    await page.getByLabel("Email address").fill("test@example.com");
    await page.getByLabel(/Phone or WhatsApp number/).fill("12");
    await page.getByLabel("Message").fill("Hello");
    await page.getByRole("button", { name: "Send message" }).click();

    await expect(page.getByLabel(/Phone or WhatsApp number/)).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByRole("alert").filter({ hasText: "There is a problem" })).toBeFocused();
    await expect(page.getByRole("status").filter({ hasText: "Please check the highlighted fields." })).toBeVisible();
  });

  test("while sending, fields stay enabled and the button reports its state; success is announced", async ({ page }) => {
    let release: () => void = () => {};
    const held = new Promise<void>((r) => (release = r));
    await page.route("**/api/forms/contact", async (route) => {
      await held;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, acknowledgementSent: true }) });
    });
    await page.goto("/contact");
    await page.getByLabel("Full name").fill("Test Person");
    await page.getByLabel("Email address").fill("test@example.com");
    await page.getByLabel("Message").fill("Hello");
    await page.getByRole("button", { name: "Send message" }).click();

    const button = page.getByRole("button", { name: "Sending…" });
    await expect(button).toHaveAttribute("aria-busy", "true");
    await expect(page.getByLabel("Full name")).toBeEnabled();
    release();
    await expect(page.getByRole("status").filter({ hasText: "Message received" })).toBeVisible();
  });
});
