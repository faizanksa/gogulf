import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { paymentQrDataUri } from "./qr";

/**
 * Structural guarantees, asserted on the source itself so a later change that crosses one
 * fails a test instead of relying on someone remembering. The database enforces the same
 * lines (supabase/tests/invoices.test.sql, payments.test.sql); this is the application side.
 */

const ROOT = process.cwd();
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

/** Code without its comments — the comments state the rules, so they must not trip them. */
function code(path: string): string {
  return read(path)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => line.replace(/(^|[^:"'`])\/\/.*$/, "$1"))
    .join("\n");
}

const listFiles = (dir: string): string[] =>
  readdirSync(join(ROOT, dir)).flatMap((name) => {
    const rel = `${dir}/${name}`;
    return statSync(join(ROOT, rel)).isDirectory() ? listFiles(rel) : [rel];
  });

/** Every file that makes up billing and the customer payment flow, tests excluded. */
const BILLING_FILES = [
  ...listFiles("lib/billing"),
  ...listFiles("lib/payments"),
  ...listFiles("components/pay"),
  "components/admin/InvoiceForm.tsx",
  "components/admin/InvoiceControls.tsx",
  "components/admin/PaymentLinkPanel.tsx",
  ...listFiles("app/(admin)/admin/(protected)/invoices"),
  ...listFiles("app/(marketing)/pay"),
].filter((f) => /\.(ts|tsx)$/.test(f) && !f.endsWith(".test.ts"));

describe("billing is for consultation and service payments only", () => {
  it("is found where expected", () => {
    expect(BILLING_FILES.length).toBeGreaterThan(15);
  });

  it("never mentions a job or a job application in code — candidate payment has nowhere to attach", () => {
    for (const file of BILLING_FILES) {
      expect(code(file), file).not.toMatch(/job_id|job_application|jobApplication|applications?\.screen|\bjobs?\./i);
    }
  });

  it("never calls a document a tax invoice or invents a GST rate", () => {
    for (const file of BILLING_FILES) {
      const source = code(file);
      expect(source, file).not.toMatch(/tax invoice/i);
      expect(source, file).not.toMatch(/\b(cgst|sgst|igst)\b/i);
      expect(source, file).not.toMatch(/tax_rate_percent:\s*\d/); // no default rate baked into code
    }
  });
});

describe("secrets and privileged access", () => {
  it("never uses the service-role client for staff or customer requests", () => {
    for (const file of BILLING_FILES) {
      if (file === "lib/payments/consultation.ts" || file === "lib/payments/record.ts") continue; // pre-existing, documented (no call site / webhook)
      if (file === "lib/payments/invoice-payment.ts") continue; // the one 0017 exception, pinned tightly below
      expect(code(file), file).not.toMatch(/createAdminClient|SUPABASE_SERVICE_ROLE_KEY|supabase\/admin/);
    }
  });

  it("uses the privileged client in exactly one billing place, for exactly one call, under its own reason (0017)", () => {
    const source = code("lib/payments/invoice-payment.ts");
    // One use, named for what it is, and it never reads a table: the only thing it can do here
    // is record an order the server has just created.
    expect(source.match(/createAdminClient\(/g)).toHaveLength(1);
    expect(source).toMatch(/createAdminClient\("payment-request"\)/);
    expect(source).not.toMatch(/\.from\(/);
    expect(source.match(/\.rpc\(/g)).toHaveLength(1);
    expect(source).toMatch(/\.rpc\("open_invoice_payment_request"/);
    // The customer-facing reader must stay free of it: it is the anon side of the page.
    expect(code("lib/billing/public-data.ts")).not.toMatch(/createAdminClient|open_invoice_payment_request|SERVICE_ROLE/);
  });

  it("makes open_invoice_payment_request server-only in the schema, and never grants it back (0017)", () => {
    const migrations = listFiles("supabase/migrations").filter((f) => f.endsWith(".sql")).sort();
    const grants = migrations.flatMap((file) =>
      read(file).split("\n").map((line) => ({ file, line: line.replace(/--.*$/, "") })).filter(({ line }) => /grant\s+execute\s+on\s+function\s+public\.open_invoice_payment_request/i.test(line)),
    );
    const last = grants.at(-1);
    if (!last) throw new Error("no grant on open_invoice_payment_request found in any migration");
    expect(last.file).toContain("0017_");
    expect(last.line).toMatch(/to\s+service_role\s*;/i);
    expect(last.line).not.toMatch(/anon|authenticated|public\s*;/i);
  });

  it("reads the Razorpay secret only in the module that calls Razorpay", () => {
    for (const file of BILLING_FILES) {
      if (file === "lib/payments/provider-order.ts") continue;
      expect(code(file), file).not.toMatch(/RAZORPAY_KEY_SECRET/);
    }
  });

  it("keeps every client component free of server-only imports", () => {
    const clients = BILLING_FILES.filter((f) => read(f).trimStart().startsWith('"use client"'));
    expect(clients.length).toBeGreaterThanOrEqual(4);
    for (const file of clients) {
      expect(code(file), file).not.toMatch(
        /server-only|lib\/supabase|lib\/env|lib\/payments\/(provider-order|invoice-payment|record|webhook|consultation)|lib\/billing\/(public-data|admin-data|qr)/,
      );
    }
  });
});

describe("the customer payment page", () => {
  const page = code("app/(marketing)/pay/[reference]/page.tsx");
  const action = code("app/(marketing)/pay/[reference]/actions.ts");
  const button = code("components/pay/PayButton.tsx");

  it("reads only through the explicit allow-list, never the invoices table or the staff reader", () => {
    expect(page).toMatch(/getPublicInvoice/);
    expect(page).not.toMatch(/admin-data|createServerSupabase|\.from\(|audit|billing_address|customer_email|customer_phone|\bnotes\b|created_by/);
    expect(code("lib/billing/public-data.ts")).toMatch(/rpc\("public_invoice_view"/);
    expect(code("lib/billing/public-data.ts")).not.toMatch(/\.from\(/);
  });

  it("is never cached and never indexed", () => {
    expect(page).toMatch(/dynamic = "force-dynamic"/);
    expect(page).toMatch(/index: false/);
    expect(read("app/robots.ts")).toMatch(/"\/pay\/"/);
  });

  it("takes only the reference from a payer — no amount, no id", () => {
    expect(action).toMatch(/beginPayment\(reference: string\)/);
    expect(action).not.toMatch(/amount|invoiceId|invoice_id/i);
    expect(action).toMatch(/rateLimit/);
  });

  it("never treats the checkout callback as payment proof", () => {
    expect(button).toMatch(/handler: \(\) =>/);
    // The success handler takes no arguments and never posts anything back to us.
    expect(button).not.toMatch(/razorpay_signature|razorpay_payment_id|fetch\(/);
    expect(button).not.toMatch(/setStatus|markPaid|status:\s*"paid"/);
  });

  it("loads checkout.js only when the payer presses Pay, not when the page opens", () => {
    expect(button).toMatch(/await loadCheckout\(\)/);
    expect(button).not.toMatch(/useEffect\([^)]*loadCheckout/);
  });
});

describe("the QR code", () => {
  it("encodes only the URL it is given, as an SVG data URI generated locally", async () => {
    const a = await paymentQrDataUri("https://www.gogulf.co/pay/GG-INV-2026-00001");
    const b = await paymentQrDataUri("https://www.gogulf.co/pay/GG-INV-2026-00002");
    expect(a).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
    expect(a).not.toBe(b);
    expect(decodeURIComponent(a)).toContain("<svg");
    expect(code("lib/billing/qr.ts")).not.toMatch(/fetch\(|https?:\/\//); // no QR web service
  });
});
