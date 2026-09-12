import { expect, test } from "./fixtures";

/**
 * The application form's success path, end to end in the browser: documents upload, the
 * row is saved, the server is told, and the applicant sees a receipt whose reference is
 * the one the server received (the reference the confirmation email carries). Every
 * request is answered by the test — nothing is uploaded, stored or sent.
 */

const PDF = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");

test("a successful application ends on a receipt carrying the reference the server received", async ({ page }) => {
  const uploads: string[] = [];
  let body: Record<string, string> = {};
  await page.route("**/storage/v1/object/**", (route) => {
    uploads.push(new URL(route.request().url()).pathname);
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ Key: "job-applications/test", Id: "test" }) });
  });
  await page.route("**/rest/v1/**", (route) => route.fulfill({ status: 201, body: "" }));
  await page.route("**/api/forms/job-application", (route) => {
    body = route.request().postDataJSON();
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, acknowledgementSent: true }) });
  });

  await page.goto("/jobs/apply");
  await page.locator("#a_name").fill("Test Person");
  await page.locator("#a_email").fill("test@example.com");
  await page.locator("#a_phone").fill("+91 98765 43210");
  await page.locator("#a_cv").setInputFiles({ name: "cv.pdf", mimeType: "application/pdf", buffer: PDF });
  await page.locator("#a_passport").setInputFiles({ name: "passport.png", mimeType: "image/png", buffer: PNG });
  await page.locator("main form button[type=submit]").click();

  const receipt = page.getByRole("heading", { name: "We have your application" });
  await expect(receipt).toBeVisible();
  expect(uploads).toHaveLength(2);
  expect(body).toMatchObject({ service_type: "General Application", documents: "CV, Passport", page_source: "Jobs Page", website: "" });
  expect(body.submission_id).toMatch(/^[0-9a-f-]{36}$/);
  await expect(page.getByRole("main")).toContainText(body.submission_id!);
});
