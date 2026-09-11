import { test as base, expect } from "@playwright/test";
import { getStagingBypass, STAGING_ORIGIN } from "../../scripts/perf/vercel-bypass.mjs";

/**
 * The staging deployment sits behind Vercel Authentication. When the tests run against
 * it, one request carrying the bypass secret asks Vercel to set its bypass cookie in
 * this browser context. Cookies are host-scoped, so the secret's effect never reaches a
 * third-party request — unlike a blanket extra header. Local runs need nothing.
 */
export const test = base.extend({
  // The second argument is Playwright's fixture callback (conventionally `use`); named
  // `provide` so React's hooks lint rule does not mistake it for a hook.
  context: async ({ context, baseURL }, provide) => {
    if (baseURL?.startsWith(STAGING_ORIGIN)) {
      const secret = await getStagingBypass();
      const response = await context.request.get(`${STAGING_ORIGIN}/robots.txt`, {
        headers: { "x-vercel-protection-bypass": secret, "x-vercel-set-bypass-cookie": "true" },
        maxRedirects: 0,
      });
      if (response.status() >= 400) throw new Error(`Staging bypass was refused (HTTP ${response.status()})`);
    }
    await provide(context);
  },
});

export { expect };
