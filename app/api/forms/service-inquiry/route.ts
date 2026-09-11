/**
 * POST /api/forms/service-inquiry
 *
 * The Services page's inquiry form, sent through Resend. The recipient desk (careers@ vs business@) is derived from the selected
 * service inside lib/email/config.ts — it is NOT taken from the payload, so a
 * tampered request cannot reroute an inquiry.
 *
 * No `dynamic = "force-dynamic"`: that directive fails the static export build,
 * which is still the production deploy path during the migration.
 */

import { serviceInquirySchema } from "@/lib/forms/schemas";
import { handleFormPost } from "@/lib/forms/handler";
import { sendServiceInquiryEmails } from "@/lib/email/send";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleFormPost(request, {
    flow: "service-inquiry",
    schema: serviceInquirySchema,
    send: (input) => sendServiceInquiryEmails(input),
  });
}
