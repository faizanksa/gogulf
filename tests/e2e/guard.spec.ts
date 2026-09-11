import { readFileSync } from "node:fs";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "./fixtures";

/**
 * /admin and /portal, against the running site and its real Supabase.
 *
 * Anonymous, forged and wrong-kind sessions are exercised end to end. The positive
 * paths (a Google-signed-in staff member, a phone-OTP customer) need those sign-in
 * providers, which arrive in Phases 3–4; until then they are covered by the
 * sessionKind / routeDecision unit tests. Synthetic users only, always deleted.
 */

test.skip(({ isMobile }) => isMobile, "routing is viewport-independent");

function env(file: string): Record<string, string> {
  return Object.fromEntries(
    readFileSync(file, "utf8")
      .split(/\r?\n/)
      .filter((l) => /^[A-Z_]+=/.test(l))
      .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
  );
}

function supabaseFor(baseURL: string | undefined) {
  if (baseURL?.includes("staging.gogulf.co")) {
    const s = env(".env.staging.local");
    return { url: s.STAGING_SUPABASE_URL!, anon: s.STAGING_ANON_KEY!, service: s.STAGING_SERVICE_ROLE_KEY! };
  }
  const l = env(".env.production.local"); // written by `npm run env:local` — the LOCAL stack
  if (!/127\.0\.0\.1|localhost/.test(l.NEXT_PUBLIC_SUPABASE_URL ?? "")) throw new Error("Local tests must target local Supabase");
  return { url: l.NEXT_PUBLIC_SUPABASE_URL!, anon: l.NEXT_PUBLIC_SUPABASE_ANON_KEY!, service: l.SUPABASE_SERVICE_ROLE_KEY! };
}

/**
 * Retry an auth-admin call that Supabase marks as retryable (a GoTrue request that
 * timed out under load). Anything else is thrown at once.
 */
async function retrying<T extends { error: { name?: string } | null }>(call: () => Promise<T>, attempts = 3): Promise<T> {
  for (let i = 1; ; i++) {
    const result = await call();
    if (result.error?.name !== "AuthRetryableFetchError" || i === attempts) return result;
    await new Promise((resolve) => setTimeout(resolve, 1000 * i));
  }
}

test.describe("anonymous visitors", () => {
  for (const [path, login] of [
    ["/admin", "/admin/login"],
    ["/admin/users", "/admin/login"],
    ["/portal", "/portal/login"],
    ["/portal/cases", "/portal/login"],
  ] as const) {
    test(`${path} redirects to ${login}`, async ({ page }) => {
      const res = await page.request.get(path, { maxRedirects: 0 });
      expect(res.status()).toBe(307);
      expect(res.headers().location).toBe(`${login}?next=${encodeURIComponent(path)}`);
      expect(res.headers()["x-robots-tag"]).toContain("noindex");
    });
  }

  test("the sign-in pages are reachable and never indexed", async ({ page }) => {
    for (const path of ["/admin/login", "/portal/login"]) {
      const res = await page.request.get(path, { maxRedirects: 0 });
      expect(res.status(), path).toBe(200);
      expect(res.headers()["x-robots-tag"], path).toContain("noindex");
    }
  });

  test("a forged session cookie is treated as anonymous", async ({ page, context, baseURL }) => {
    const { url } = supabaseFor(baseURL);
    const cookieName = `sb-${new URL(url).hostname.split(".")[0]}-auth-token`;
    const forged = `base64-${Buffer.from(JSON.stringify({ access_token: "forged", refresh_token: "forged", user: { id: "x" } })).toString("base64url")}`;
    // Added to the context rather than sent as a Cookie header: a header would replace
    // every cookie, including Vercel's staging bypass cookie, and Vercel would answer.
    await context.addCookies([{ name: cookieName, value: forged, url: baseURL! }]);
    const res = await page.request.get("/admin", { maxRedirects: 0 });
    expect(res.status()).toBe(307);
    expect(res.headers().location).toMatch(/^\/admin\/login\?next=%2Fadmin/);
  });
});

test.describe("signed-in, wrong kind of session", () => {
  test("email + password sessions reach neither area — staff record or not", async ({ page, context, baseURL }) => {
    const sb = supabaseFor(baseURL);
    const admin = createClient(sb.url, sb.service, { auth: { persistSession: false, autoRefreshToken: false } });
    const tag = Math.random().toString(36).slice(2, 8);
    const created: string[] = [];
    let staffRowId: string | null = null;

    async function sessionCookies(email: string, password: string) {
      const jar = new Map<string, string>();
      const client = createServerClient(sb.url, sb.anon, {
        cookies: {
          getAll: () => [...jar].map(([name, value]) => ({ name, value })),
          setAll: (list) => list.forEach(({ name, value }) => (value ? jar.set(name, value) : jar.delete(name))),
        },
      });
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return [...jar].map(([name, value]) => ({ name, value, url: baseURL! }));
    }

    try {
      // 1. A signed-in person with no staff record and no customer sign-in.
      const password = `Pw-${tag}-${Math.random().toString(36).slice(2)}`;
      const plain = await retrying(() => admin.auth.admin.createUser({ email: `t-guard-plain-${tag}@gogulf.co`, password, email_confirm: true }));
      if (plain.error) throw plain.error;
      created.push(plain.data.user.id);
      await context.addCookies(await sessionCookies(`t-guard-plain-${tag}@gogulf.co`, password));

      let res = await page.request.get("/admin", { maxRedirects: 0 });
      expect(res.status()).toBe(307);
      expect(res.headers().location).toBe("/admin/login?next=%2Fadmin&reason=staff-sign-in-required");
      res = await page.request.get("/portal", { maxRedirects: 0 });
      expect(res.status()).toBe(307);
      expect(res.headers().location).toBe("/portal/login?next=%2Fportal&reason=customer-sign-in-required");

      // 2. An ACTIVE staff record, but signed in with email + password rather than the
      //    staff sign-in method: still refused. "A session exists" is not enough, and
      //    neither is "a staff record exists".
      // Only the Supabase session: on staging the Vercel bypass cookie must survive.
      await context.clearCookies({ name: /^sb-/ });
      const staff = await retrying(() => admin.auth.admin.createUser({ email: `t-guard-staff-${tag}@gogulf.co`, password, email_confirm: true }));
      if (staff.error) throw staff.error;
      created.push(staff.data.user.id);
      const { data: branch } = await admin.from("branches").select("id").limit(1).single();
      const { data: row, error: rowError } = await admin
        .from("staff_users")
        .insert({ auth_user_id: staff.data.user.id, email: `t-guard-staff-${tag}@gogulf.co`, full_name: "Guard Test Staff", role_key: "HR_MANAGER", branch_id: branch!.id })
        .select("id")
        .single();
      if (rowError) throw rowError;
      staffRowId = row.id;
      await context.addCookies(await sessionCookies(`t-guard-staff-${tag}@gogulf.co`, password));

      res = await page.request.get("/admin", { maxRedirects: 0 });
      expect(res.status()).toBe(307);
      expect(res.headers().location).toBe("/admin/login?next=%2Fadmin&reason=staff-sign-in-required");
      res = await page.request.get("/portal", { maxRedirects: 0 });
      expect(res.status()).toBe(307);
    } finally {
      if (staffRowId) await admin.from("staff_users").delete().eq("id", staffRowId);
      for (const id of created) await admin.auth.admin.deleteUser(id);
    }
  });
});
