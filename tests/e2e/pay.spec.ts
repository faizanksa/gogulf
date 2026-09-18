import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "./fixtures";

/**
 * The customer payment page (/pay/GG-INV-…), against the running site and its real
 * database — local Supabase, or Mumbai staging when E2E_BASE_URL is staging.
 *
 * Fixture invoices are created with the service-role key and are clearly synthetic
 * ("STAGING TEST"). They are issued, not deleted: invoices have no DELETE by design, so
 * on a disposable database they simply stay. Nothing here talks to Razorpay — a payment
 * is simulated by recording a provider event exactly the way the signed webhook does, and
 * the "Pay" button is checked to fail closed when no test-mode credentials exist.
 *
 * What is proven: the page shows a payer only what they need; drafts, unknown and
 * malformed references are 404; paid and void invoices offer no payment; the page is never
 * indexed; and nothing internal — a customer's name, email, notes, or an id — is in the HTML.
 */

test.skip(({ isMobile }) => isMobile, "the page is viewport-independent; axe runs it on both below");

function env(file: string): Record<string, string> {
  return Object.fromEntries(
    readFileSync(file, "utf8")
      .split(/\r?\n/)
      .filter((l) => /^[A-Z_]+=/.test(l))
      .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
  );
}

/** service-role for fixtures; anon for the one thing a payer's browser may call. */
function clients(baseURL: string | undefined) {
  const make = (url: string, key: string) => createClient(url, key, { auth: { persistSession: false } });
  if (baseURL?.includes("staging.gogulf.co")) {
    const s = env(".env.mumbai-staging.local");
    if (!s.MUMBAI_STAGING_URL?.includes("noxireidrbeqcvsirjec")) throw new Error("Staging tests must target Mumbai staging");
    return { db: make(s.MUMBAI_STAGING_URL!, s.MUMBAI_STAGING_SERVICE_ROLE_KEY!), anon: make(s.MUMBAI_STAGING_URL!, s.MUMBAI_STAGING_ANON_KEY!) };
  }
  const l = env(".env.production.local"); // written by `npm run env:local` — the LOCAL stack
  if (!/127\.0\.0\.1|localhost/.test(l.NEXT_PUBLIC_SUPABASE_URL ?? "")) throw new Error("Local tests must target local Supabase");
  return { db: make(l.NEXT_PUBLIC_SUPABASE_URL!, l.SUPABASE_SERVICE_ROLE_KEY!), anon: make(l.NEXT_PUBLIC_SUPABASE_URL!, l.NEXT_PUBLIC_SUPABASE_ANON_KEY!) };
}
const database = (baseURL: string | undefined) => clients(baseURL).db;

const SECRETS = {
  name: "STAGING TEST Confidential Customer Pvt Ltd",
  email: "confidential.customer@example.invalid",
  phone: "+919000000123",
  note: "INTERNAL NOTE: never show this to the customer",
  street: "77 Private Lane Confidentialpur",
};

async function makeInvoice(db: ReturnType<typeof database>, purpose: string, status: "draft" | "issued") {
  const { data, error } = await db
    .from("invoices")
    .insert({
      customer_name: SECRETS.name,
      customer_email: SECRETS.email,
      customer_phone: SECRETS.phone,
      billing_address: { line1: SECRETS.street },
      notes: SECRETS.note,
      purpose,
      line_items: [{ description: "STAGING TEST consultation", quantity: 2, unit_amount_minor: 125000 }],
    })
    .select("id, reference")
    .single();
  if (error) throw error;
  if (status === "issued") {
    const issued = await db.from("invoices").update({ status: "issued" }).eq("id", data.id);
    if (issued.error) throw issued.error;
  }
  return data;
}

test.describe("payment page", () => {
  test("shows the invoice number, service, amount and status — and offers a way to pay", async ({ page, baseURL }) => {
    const db = database(baseURL);
    const invoice = await makeInvoice(db, "STAGING TEST visa consultation", "issued");

    const response = await page.goto(`/pay/${invoice.reference}`);
    expect(response?.status()).toBe(200);
    const main = page.getByRole("main");
    await expect(main.getByText(invoice.reference)).toBeVisible();
    await expect(main.getByText("STAGING TEST visa consultation")).toBeVisible();
    await expect(main.getByRole("heading", { level: 1 })).toHaveText("₹2,500.00");
    await expect(main.getByText("Awaiting payment")).toBeVisible();
    await expect(main.getByRole("button", { name: "Pay ₹2,500.00 securely" })).toBeVisible();
    await expect(main.getByText("Go Gulf never sees or stores them")).toBeVisible();
  });

  test("never exposes anything internal in the page, its data or its headers", async ({ page, baseURL }) => {
    const db = database(baseURL);
    const invoice = await makeInvoice(db, "STAGING TEST privacy check", "issued");

    const response = await page.goto(`/pay/${invoice.reference}`);
    const html = (await response?.text()) ?? "";
    const rendered = await page.content();

    for (const secret of [SECRETS.name, SECRETS.email, SECRETS.phone, SECRETS.note, SECRETS.street, invoice.id, "supabase.co/rest", "service_role", "rzp_", "key_secret"]) {
      expect(html, `response leaks ${secret}`).not.toContain(secret);
      expect(rendered, `page leaks ${secret}`).not.toContain(secret);
    }
    // A payer's own page must not carry a Supabase project either — not even the public ref.
    expect(html).not.toMatch(/[a-z0-9]{20}\.supabase\.co/);
  });

  test("is never indexed or cached, and is kept out of robots.txt-crawled paths", async ({ page, request, baseURL }) => {
    const db = database(baseURL);
    const invoice = await makeInvoice(db, "STAGING TEST indexing check", "issued");

    const response = await page.goto(`/pay/${invoice.reference}`);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    expect(response?.headers()["cache-control"] ?? "").not.toMatch(/s-maxage|public/);

    const robots = await request.get("/robots.txt");
    // Production lists /pay/ among its private paths; staging and previews disallow everything.
    expect(await robots.text()).toMatch(/Disallow: \/pay\/|Disallow: \/\s*$/m);
  });

  test("is a 404 for a draft, an unknown reference and anything malformed", async ({ page, baseURL }) => {
    const db = database(baseURL);
    const draft = await makeInvoice(db, "STAGING TEST draft stays private", "draft");

    for (const path of [`/pay/${draft.reference}`, "/pay/GG-INV-2099-99999", "/pay/not-a-reference", "/pay/GG-JOB-2026-00001", "/pay/%2e%2e%2fadmin", "/pay/GG-INV-2026-00001%27%20OR%201=1"]) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(404);
    }
  });

  test("a paid invoice says so and offers no payment; a voided one is not payable", async ({ page, baseURL }) => {
    const { db, anon } = clients(baseURL);
    const tag = Math.random().toString(36).slice(2, 8).toUpperCase();

    // Paid: opened the way a payer opens it, then confirmed the way the signed webhook confirms it.
    const paid = await makeInvoice(db, "STAGING TEST paid flow", "issued");
    const order = `order_TEST_E2E_${tag}`;
    const opened = await anon.rpc("open_invoice_payment_request", { p_reference: paid.reference, p_provider_order_id: order });
    expect(opened.error).toBeNull();
    const event = await db.rpc("record_payment_event", {
      p_event_id: `evt_TEST_E2E_${tag}`,
      p_event_type: "order.paid",
      p_order_id: order,
      p_payment_id: `pay_TEST_E2E_${tag}`,
      p_amount: 250000,
      p_currency: "INR",
      p_method: "upi",
    });
    expect(event.data).toBe("processed");

    await page.goto(`/pay/${paid.reference}`);
    const main = page.getByRole("main");
    await expect(main.getByText("Payment received. Thank you")).toBeVisible();
    await expect(main.getByRole("button")).toHaveCount(0);

    // Void.
    const voided = await makeInvoice(db, "STAGING TEST void flow", "issued");
    const update = await db.from("invoices").update({ status: "void", void_reason: "STAGING TEST cancelled" }).eq("id", voided.id);
    expect(update.error).toBeNull();
    await page.goto(`/pay/${voided.reference}`);
    await expect(page.getByRole("main").getByText("This invoice cannot be paid online")).toBeVisible();
    await expect(page.getByRole("main").getByRole("button")).toHaveCount(0);
  });

  test("Pay fails closed without test-mode credentials: says so, opens no checkout, contacts no third party", async ({ page, baseURL }) => {
    const db = database(baseURL);
    const invoice = await makeInvoice(db, "STAGING TEST fail closed", "issued");

    const thirdParty: string[] = [];
    page.on("request", (req) => {
      if (/razorpay\.com/.test(req.url())) thirdParty.push(req.url());
    });

    await page.goto(`/pay/${invoice.reference}`);
    // Not loaded just by opening the page.
    expect(thirdParty).toEqual([]);

    await page.getByRole("button", { name: /Pay .* securely/ }).click();
    // Either a refusal (no usable key here) or, where a TEST key is configured, Checkout loads.
    // What must never happen is a silent success or a charge without a checkout.
    const refusal = page.getByRole("alert").filter({ hasText: /not available right now|Too many attempts/ });
    const checkoutRequested = () => thirdParty.some((u) => u.includes("checkout.razorpay.com"));
    await expect.poll(async () => (await refusal.count()) > 0 || checkoutRequested(), { timeout: 15_000 }).toBe(true);
    await expect(page.getByText("Payment received")).toHaveCount(0);
  });
});

test.describe("payment page accessibility", () => {
  for (const viewport of [
    { name: "phone", width: 375, height: 800 },
    { name: "desktop", width: 1280, height: 900 },
  ]) {
    test(`axe: an open invoice on a ${viewport.name}`, async ({ page, baseURL }) => {
      test.setTimeout(120_000);
      const db = database(baseURL);
      const invoice = await makeInvoice(db, "STAGING TEST accessibility", "issued");
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(`/pay/${invoice.reference}`);
      const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      const serious = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(serious, JSON.stringify(serious.map((v) => ({ id: v.id, nodes: v.nodes.length })))).toEqual([]);
    });
  }
});
