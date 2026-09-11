import { SAMPLE_JOB } from "./a11y-routes";
import { expect, test } from "./fixtures";
import { PRODUCTION_ROUTES } from "./routes";

/** The SEO foundation's rules, checked against the running site. */

test.skip(({ isMobile }) => isMobile, "markup is identical on both viewports");

test("every page has a unique title, a description and a self-referencing canonical", async ({ page }) => {
  const titles = new Map<string, string>();
  for (const path of [...PRODUCTION_ROUTES, "/verify"]) {
    await page.goto(path);
    const title = await page.title();
    expect(title.length, path).toBeLessThanOrEqual(60);
    expect(titles.has(title), `duplicate title "${title}" on ${path} and ${titles.get(title)}`).toBe(false);
    titles.set(title, path);
    await expect(page.locator('meta[name="description"]'), path).toHaveAttribute("content", /.{90,}/);
    const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
    expect(new URL(canonical!).pathname, path).toBe(path);
    await expect(page.locator('meta[name="keywords"]'), path).toHaveCount(0);
    await expect(page.locator('meta[property="og:image"]').first(), path).toHaveAttribute("content", /\/opengraph-image/);
  }
});

async function jsonLd(page: import("@playwright/test").Page) {
  return (await page.locator('script[type="application/ld+json"]').allTextContents()).map((t) => JSON.parse(t));
}

test("JobPosting never appears on the list page, nor for an unconfirmed job", async ({ page }) => {
  await page.goto("/jobs");
  expect(JSON.stringify(await jsonLd(page))).not.toContain("JobPosting");
  await page.goto(SAMPLE_JOB);
  expect(JSON.stringify(await jsonLd(page))).not.toContain("JobPosting");
  // …and the unconfirmed job is flagged and kept out of the index.
  await expect(page.getByText(/Unconfirmed — not shown in production/)).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});

test("the Organization node asserts only verified facts", async ({ page }) => {
  await page.goto("/");
  const graph = (await jsonLd(page)).find((d) => d["@graph"]);
  const org = graph["@graph"].find((n: { "@type": string | string[] }) => [n["@type"]].flat().includes("EmploymentAgency"));
  expect(org.foundingDate).toBe("2024-02-22");
  expect(org.identifier).toMatchObject({ propertyID: "CIN", value: "U52291UP2024PTC198095" });
  for (const key of ["taxID", "vatID", "areaServed", "sameAs"]) expect(org, key).not.toHaveProperty(key);
  expect(JSON.stringify(graph)).not.toMatch(/2008|placements|MOFA|genuine|verified/i);
});

test("breadcrumb structured data matches the visible breadcrumbs", async ({ page }) => {
  await page.goto("/verify");
  const visible = await page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("listitem").allTextContents();
  const crumbs = (await jsonLd(page)).find((d) => d["@type"] === "BreadcrumbList");
  expect(crumbs.itemListElement.map((i: { name: string }) => i.name)).toEqual(visible.map((t) => t.trim()));
});

test("sitemap lists indexable pages with content dates, and nothing unpublished", async ({ page }) => {
  const xml = await (await page.request.get("/sitemap.xml")).text();
  expect(xml).toContain("/verify</loc>");
  expect(xml).not.toContain("/travel");
  expect(xml).not.toContain("/admin");
  expect(xml).not.toContain(SAMPLE_JOB); // unconfirmed
  const dates = [...xml.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((m) => m[1]!.slice(0, 10));
  expect(new Set(dates).size).toBeGreaterThan(1); // real content dates, not one build date
});

test("robots.txt and llms.txt", async ({ page, baseURL }) => {
  const robots = await (await page.request.get("/robots.txt")).text();
  if (baseURL?.includes("staging")) {
    expect(robots).toMatch(/Disallow: \/\s*$/m);
  } else {
    expect(robots).toContain("Disallow: /admin");
    expect(robots).toContain("Disallow: /portal");
    expect(robots).toContain("Sitemap:");
  }
  const llms = await (await page.request.get("/llms.txt")).text();
  expect(llms).toContain("U52291UP2024PTC198095");
  expect(llms).not.toMatch(/direct-approval|MOFA compliant|genuine, screened|since 2008|GSTIN/i);
});

test("share image and icons are generated, small and served", async ({ page }) => {
  const og = await page.request.get("/opengraph-image");
  expect(og.status()).toBe(200);
  expect(og.headers()["content-type"]).toBe("image/png");
  const favicon = await page.request.get("/favicon.ico");
  expect(favicon.status()).toBe(200);
  expect((await favicon.body()).length).toBeLessThan(20_000);
  // Old asset URLs still resolve, permanently redirected.
  const oldLogo = await page.request.get("/assets/go-gulf-logo.png", { maxRedirects: 0 });
  expect(oldLogo.status()).toBe(308);
});
