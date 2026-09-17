/**
 * Database refusals, in words a staff member can act on.
 *
 * The rules that refuse a write live in Postgres (0012, 0013). PostgREST passes their
 * errors through as { code, message, details, hint }; the triggers raise stable codes in
 * `message` and a comma-separated list of problems in `details`. Anything unrecognised
 * gets a neutral sentence — the raw database text is never shown, and never logged with
 * row data.
 */

import { isPublishProblem, PROBLEM_MESSAGES } from "./validation";

export interface DbError {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
}

export interface Explained {
  message: string;
  /** Publish problems, one sentence each, when that is what stopped the write. */
  problems?: string[];
}

const CONSTRAINTS: Record<string, string> = {
  jobs_ongoing_has_no_closing_date: "An ongoing job cannot have a closing date.",
  jobs_standard_has_no_featured_until: "Only a featured job can have a featured-until date.",
  jobs_named_employer_has_name: "A named employer needs a name.",
  jobs_confidential_employer_not_named: "A confidential employer cannot be named on the listing.",
  jobs_paid_application_not_public: "Paid application access is not currently available, so this job cannot be public.",
  jobs_salary_complete: "Give the salary currency, minimum, maximum and period together, with the maximum not below the minimum.",
  jobs_reference_format: "A reference uses capital letters, digits and single hyphens, 3 to 40 characters.",
  jobs_title_length: "The job title must be between 2 and 120 characters.",
  jobs_summary_length: "The summary must be between 20 and 600 characters.",
  jobs_key: "That reference is already used by another job.",
  jobs_reference_key: "That reference is already used by another job.",
  job_categories_slug_key: "A category with that name already exists.",
  job_categories_slug_format: "A category name must contain letters or digits.",
};

export function explainDbError(error: DbError | null | undefined): Explained {
  if (!error) return { message: "Something went wrong. Try again." };
  const message = error.message ?? "";
  const details = error.details ?? "";

  switch (message) {
    case "job_not_publishable": {
      const problems = details
        .split(",")
        .map((p) => p.trim())
        .filter(isPublishProblem)
        .map((p) => PROBLEM_MESSAGES[p]);
      return { message: "The job is not ready for that step yet.", problems };
    }
    case "job_transition_not_allowed":
      return { message: `That status change is not allowed${details ? ` (${details.replace("->", "→")})` : ""}. Refresh the page — the job may have changed.` };
    case "job_reference_locked":
      return { message: "A job's reference cannot change once it has been published." };
    case "job_must_start_as_draft":
      return { message: "A new job starts as a draft." };
    case "job_category_not_found":
      return { message: "Choose a category." };
    case "job_category_parent_classification_mismatch":
      return { message: "A sub-category must have the same classification as its parent." };
    case "job_not_accepting_applications":
      return { message: "This job is not accepting applications." };
    case "staff_session_required":
    case "permission_denied":
      return { message: "You do not have permission to do this." };
    case "application_not_found":
      return { message: "The application was not found, or you cannot see it." };
    case "application_closed":
      return { message: "A rejected or withdrawn application cannot be converted. Move it back to screening first." };
    case "contact_outside_scope":
      return { message: "This applicant already exists as a contact you cannot see. Ask an administrator to convert the application." };
    case "recruitment_pipeline_missing":
      return { message: "No active recruitment pipeline is configured. Ask an administrator." };
  }

  for (const [name, text] of Object.entries(CONSTRAINTS)) {
    if (message.includes(`"${name}"`)) return { message: text };
  }

  if (error.code === "42501") return { message: "You do not have permission to do this." };
  if (error.code === "PGRST116") return { message: "It was not found, or you do not have permission to change it." };
  if (error.code === "23505") return { message: "That value is already in use." };
  return { message: "The change could not be saved. Try again, and tell an administrator if it keeps happening." };
}
