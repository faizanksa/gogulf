/**
 * The case lifecycle (0025): the fixed closing reasons, form parsing for the four lifecycle
 * actions, and plain-language refusals. The database is the authority — move_case_stage,
 * close_case, reopen_case and assign_case re-check everything — so this only shapes input
 * and explains the answer.
 */

import { isUuid } from "./contact-edit";

export type CloseOutcome = "lost" | "cancelled";

export interface ReasonOption {
  key: string;
  label: string;
}

/** Must match case_close_reason_label('lost', …) in 0025 (asserted in case-lifecycle.test.ts). */
export const LOST_REASONS: readonly ReasonOption[] = [
  { key: "candidate_withdrew", label: "Candidate withdrew" },
  { key: "candidate_unresponsive", label: "Candidate unavailable/unresponsive" },
  { key: "not_selected_by_employer", label: "Not selected by employer" },
  { key: "failed_screening", label: "Failed screening" },
  { key: "failed_medical", label: "Failed medical" },
  { key: "visa_refused", label: "Visa refused" },
  { key: "employer_cancelled_requirement", label: "Employer cancelled requirement" },
  { key: "position_filled", label: "Position filled" },
  { key: "duplicate", label: "Duplicate application/case" },
  { key: "fees_payment_issue", label: "Fees/payment issue" },
  { key: "other", label: "Other" },
];

/** Must match case_close_reason_label('cancelled', …) in 0025. */
export const CANCELLED_REASONS: readonly ReasonOption[] = [
  { key: "client_cancelled_requirement", label: "Employer/client cancelled requirement" },
  { key: "position_no_longer_available", label: "Position no longer available" },
  { key: "position_filled", label: "Position filled" },
  { key: "duplicate_case", label: "Duplicate case" },
  { key: "created_in_error", label: "Created in error" },
  { key: "superseded", label: "Case superseded/replaced" },
  { key: "wrong_branch_intake", label: "Wrong branch/intake" },
  { key: "recruitment_not_required", label: "Recruitment no longer required" },
  { key: "administrative_correction", label: "Administrative correction" },
  { key: "other", label: "Other" },
];

export const CLOSE_REASONS: Record<CloseOutcome, readonly ReasonOption[]> = { lost: LOST_REASONS, cancelled: CANCELLED_REASONS };

/** Roles that may own a case (0025, decision 27). The database checks this too. */
export const CASE_OWNER_ROLES = ["SUPER_ADMIN", "ADMIN", "HR_MANAGER", "RECRUITER"] as const;

/** Only these roles may make an exceptional (non-adjacent) stage move. */
export const EXCEPTIONAL_MOVE_ROLES = ["SUPER_ADMIN", "ADMIN"] as const;

export const REASON_MAX = 1000;

export function closeReasonLabel(outcome: string, key: string | null | undefined): string | null {
  if (outcome !== "lost" && outcome !== "cancelled") return null;
  return CLOSE_REASONS[outcome].find((r) => r.key === key)?.label ?? null;
}

type Parsed<T> = { ok: true; value: T } | { ok: false; message: string; fieldErrors?: Record<string, string> };
type Input = Record<string, FormDataEntryValue | undefined>;

const text = (v: FormDataEntryValue | undefined) => (typeof v === "string" ? v.trim() : "");

export function parseStageMove(input: Input): Parsed<{ caseId: string; stage: string; reason: string | null; exceptional: boolean }> {
  const caseId = text(input.case_id);
  const stage = text(input.stage);
  const reason = text(input.reason);
  const exceptional = input.exceptional === "on" || input.exceptional === "true";
  if (!isUuid(caseId)) return { ok: false, message: "That case could not be read." };
  if (!/^[a-z_]{1,40}$/.test(stage)) return { ok: false, message: "Choose a stage.", fieldErrors: { stage: "Choose a stage." } };
  if (reason.length > REASON_MAX) return { ok: false, message: "Keep the reason under 1000 characters.", fieldErrors: { reason: "Keep it under 1000 characters." } };
  if (exceptional && !reason) return { ok: false, message: "An exceptional move needs a reason.", fieldErrors: { reason: "Say why." } };
  return { ok: true, value: { caseId, stage, reason: reason || null, exceptional } };
}

export function parseClose(input: Input): Parsed<{ caseId: string; outcome: CloseOutcome; reason: string; note: string | null }> {
  const caseId = text(input.case_id);
  const outcome = text(input.outcome);
  const reason = text(input.reason);
  const note = text(input.note);
  if (!isUuid(caseId)) return { ok: false, message: "That case could not be read." };
  if (outcome !== "lost" && outcome !== "cancelled") return { ok: false, message: "Choose lost or cancelled.", fieldErrors: { outcome: "Choose an outcome." } };
  if (!closeReasonLabel(outcome, reason)) return { ok: false, message: "Choose a reason from the list.", fieldErrors: { reason: "Choose a reason." } };
  if (reason === "other" && !note) return { ok: false, message: "\"Other\" needs a note.", fieldErrors: { note: "Explain the reason." } };
  if (note.length > REASON_MAX) return { ok: false, message: "Keep the note under 1000 characters.", fieldErrors: { note: "Keep it under 1000 characters." } };
  return { ok: true, value: { caseId, outcome, reason, note: note || null } };
}

export function parseReopen(input: Input): Parsed<{ caseId: string; reason: string }> {
  const caseId = text(input.case_id);
  const reason = text(input.reason);
  if (!isUuid(caseId)) return { ok: false, message: "That case could not be read." };
  if (!reason) return { ok: false, message: "Reopening needs a reason.", fieldErrors: { reason: "Say why." } };
  if (reason.length > REASON_MAX) return { ok: false, message: "Keep the reason under 1000 characters.", fieldErrors: { reason: "Keep it under 1000 characters." } };
  return { ok: true, value: { caseId, reason } };
}

/** An empty owner means "unassigned". */
export function parseAssign(input: Input): Parsed<{ caseId: string; owner: string | null }> {
  const caseId = text(input.case_id);
  const owner = text(input.owner_id);
  if (!isUuid(caseId)) return { ok: false, message: "That case could not be read." };
  if (owner && !isUuid(owner)) return { ok: false, message: "Choose an owner from the list." };
  return { ok: true, value: { caseId, owner: owner || null } };
}

const REFUSALS: [string, string][] = [
  ["case_not_found", "This case is not one you can see."],
  ["case_stage_change_requires_permission", "You cannot move this case."],
  ["case_close_requires_permission", "You cannot close this case."],
  ["case_reopen_requires_permission", "You cannot reopen this case."],
  ["case_assign_requires_permission", "You cannot assign this case."],
  ["case_closed_reopen_first", "This case is closed. Reopen it before changing its stage."],
  ["case_already_closed", "This case is already closed."],
  ["case_not_closed", "This case is already open."],
  ["stage_skip_not_allowed", "A case moves one stage at a time. Only an administrator can make an exceptional move, with a reason."],
  ["stage_unchanged", "The case is already at that stage."],
  ["stage_not_in_pipeline", "That stage is not part of this case's pipeline."],
  ["exceptional_move_admin_only", "Only an administrator or super administrator can make an exceptional move."],
  ["joined_requires_close_permission", "Moving a case to Joined closes it as won, which needs permission to close cases."],
  ["won_only_via_joined", "A case is won only by moving it to Joined."],
  ["close_reason_invalid", "Choose a reason from the list."],
  ["close_note_required", "\"Other\" needs a note."],
  ["close_outcome_invalid", "Choose lost or cancelled."],
  ["reason_required", "A reason is needed for this."],
  ["reason_too_long", "Keep the reason under 1000 characters."],
  ["case_owner_invalid_reassign_first", "The case's owner can no longer own an open case. Assign an eligible owner first, then reopen it."],
  ["owner_inactive", "That person is not active."],
  ["owner_other_branch", "The owner must work in the case's branch."],
  ["owner_role_not_eligible", "That person's role cannot own recruitment cases."],
  ["owner_cannot_view", "That person cannot see this case."],
  ["owner_not_found", "That person was not found."],
  ["reopen_stage_missing", "The stage to return to was not recorded. Ask a super administrator."],
  ["stage_gate", "This stage cannot be reached yet."],
];

/** One sentence for a database refusal. Never the raw message. */
export function caseLifecycleRefusal(error: { code?: string; message?: string } | null | undefined): string {
  const message = error?.message ?? "";
  for (const [key, sentence] of REFUSALS) if (message.includes(key)) return sentence;
  if (error?.code === "42501") return "You do not have permission to do this.";
  return "The change was refused. You may not have permission to do this.";
}

/** The staff screen's refusal when someone still owns open cases (0025, decision 29). */
export function ownsOpenCasesRefusal(error: { message?: string } | null | undefined): string | null {
  const match = error?.message?.match(/staff_owns_open_cases: reassign (\d+) open case/);
  if (!match) return null;
  const n = Number(match[1]);
  return `This person owns ${n} open case${n === 1 ? "" : "s"}. Reassign ${n === 1 ? "it" : "them"} to someone else first.`;
}
