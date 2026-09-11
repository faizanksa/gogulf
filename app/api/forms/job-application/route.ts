/**
 * POST /api/forms/job-application
 *
 * The notification half of the /jobs/apply form, sent through Resend.
 *
 * This route handles the NOTIFICATION half only. Document upload still runs
 * first, from the browser, straight to Supabase Storage — unchanged in this
 * phase. The payload carries the submission id and a description of what was
 * uploaded, never the files themselves.
 *
 * That two-phase split is deliberate and predates this work: the application
 * record is the source of truth and must survive an email failure. Moving the
 * upload server-side is Phase 5 work, alongside the CRM tables.
 *
 * No `dynamic = "force-dynamic"`: that directive fails the static export build,
 * which is still the production deploy path during the migration.
 */

import { jobApplicationSchema } from "@/lib/forms/schemas";
import { handleFormPost } from "@/lib/forms/handler";
import { sendJobApplicationEmails } from "@/lib/email/send";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleFormPost(request, {
    flow: "job-application",
    schema: jobApplicationSchema,
    send: (input) => sendJobApplicationEmails(input),
  });
}
