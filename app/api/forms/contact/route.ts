/**
 * POST /api/forms/contact
 *
 * Server-side replacement for the browser-side EmailJS call on the Contact
 * page. Only reachable when the app runs server-capable (PLATFORM_MODE=server);
 * under the legacy static export this route is not emitted and the client falls
 * back to EmailJS. See lib/forms/transport.ts.
 */

import { contactSchema } from "@/lib/forms/schemas";
import { handleFormPost } from "@/lib/forms/handler";
import { sendContactEmails } from "@/lib/email/send";

export const runtime = "nodejs";

// NOTE: no `export const dynamic = "force-dynamic"` here.
//
// That directive is incompatible with `output: 'export'` and fails the STATIC
// build outright — which is still how production is deployed during the
// migration. A POST-only handler is dynamic by nature, so the directive bought
// nothing and broke the live build path. Verified: both `npm run build` and
// `npm run build:server` pass without it.

export async function POST(request: Request) {
  return handleFormPost(request, {
    flow: "contact",
    schema: contactSchema,
    send: (input) => sendContactEmails(input),
  });
}
