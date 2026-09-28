import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CANCELLED_REASONS,
  LOST_REASONS,
  caseLifecycleRefusal,
  closeReasonLabel,
  ownsOpenCasesRefusal,
  parseAssign,
  parseClose,
  parseReopen,
  parseStageMove,
} from "./case-lifecycle";

const CASE = "5747e570-0000-4000-8000-00000000000a";

/** The reason lists as the migration defines them: `when 'key' then 'Label'` inside each outcome. */
function sqlReasons(outcome: "lost" | "cancelled"): [string, string][] {
  const sql = readFileSync(join(process.cwd(), "supabase/migrations/0025_case_lifecycle.sql"), "utf8");
  const body = sql.split(`when '${outcome}' then case p_reason`)[1]!.split(/\n\s+end\n/)[0]!;
  return [...body.matchAll(/when '([a-z_]+)'\s+then '([^']+)'/g)].map((m) => [m[1]!, m[2]!]);
}

describe("closing reasons", () => {
  it("are the database's lists exactly, in order", () => {
    expect(LOST_REASONS.map((r) => [r.key, r.label])).toEqual(sqlReasons("lost"));
    expect(CANCELLED_REASONS.map((r) => [r.key, r.label])).toEqual(sqlReasons("cancelled"));
    expect(LOST_REASONS).toHaveLength(11);
    expect(CANCELLED_REASONS).toHaveLength(10);
  });

  it("are labelled per outcome and refused across outcomes", () => {
    expect(closeReasonLabel("lost", "failed_medical")).toBe("Failed medical");
    expect(closeReasonLabel("cancelled", "failed_medical")).toBeNull();
    expect(closeReasonLabel("cancelled", "created_in_error")).toBe("Created in error");
    expect(closeReasonLabel("won", "other")).toBeNull();
  });
});

describe("form parsing", () => {
  it("a stage move needs a case and a stage; an exceptional move needs a reason", () => {
    expect(parseStageMove({ case_id: CASE, stage: "contacted" })).toEqual({ ok: true, value: { caseId: CASE, stage: "contacted", reason: null, exceptional: false } });
    expect(parseStageMove({ case_id: "nope", stage: "contacted" }).ok).toBe(false);
    expect(parseStageMove({ case_id: CASE, stage: "" }).ok).toBe(false);
    expect(parseStageMove({ case_id: CASE, stage: "visa", exceptional: "on", reason: "  " }).ok).toBe(false);
    expect(parseStageMove({ case_id: CASE, stage: "visa", exceptional: "on", reason: " Visa in hand " })).toEqual({
      ok: true,
      value: { caseId: CASE, stage: "visa", reason: "Visa in hand", exceptional: true },
    });
    expect(parseStageMove({ case_id: CASE, stage: "new", reason: "x".repeat(1001) }).ok).toBe(false);
  });

  it("closing needs a listed reason for the outcome, and a note for Other", () => {
    expect(parseClose({ case_id: CASE, outcome: "won", reason: "other", note: "x" }).ok).toBe(false);
    expect(parseClose({ case_id: CASE, outcome: "lost", reason: "created_in_error" }).ok).toBe(false);
    expect(parseClose({ case_id: CASE, outcome: "lost", reason: "other" }).ok).toBe(false);
    expect(parseClose({ case_id: CASE, outcome: "cancelled", reason: "other", note: "Merged requisition" })).toEqual({
      ok: true,
      value: { caseId: CASE, outcome: "cancelled", reason: "other", note: "Merged requisition" },
    });
    expect(parseClose({ case_id: CASE, outcome: "lost", reason: "visa_refused", note: "" })).toEqual({
      ok: true,
      value: { caseId: CASE, outcome: "lost", reason: "visa_refused", note: null },
    });
  });

  it("reopening needs a reason; assigning takes an owner or none", () => {
    expect(parseReopen({ case_id: CASE, reason: "" }).ok).toBe(false);
    expect(parseReopen({ case_id: CASE, reason: "Back" })).toEqual({ ok: true, value: { caseId: CASE, reason: "Back" } });
    expect(parseAssign({ case_id: CASE, owner_id: "" })).toEqual({ ok: true, value: { caseId: CASE, owner: null } });
    expect(parseAssign({ case_id: CASE, owner_id: "not-a-uuid" }).ok).toBe(false);
  });
});

describe("refusals", () => {
  it("explain the database's reason in one sentence, never the raw message", () => {
    const say = (message: string, code = "23514") => caseLifecycleRefusal({ code, message });
    expect(say("stage_skip_not_allowed: a case moves one stage at a time")).toMatch(/one stage at a time/);
    expect(say("joined_requires_close_permission: …", "42501")).toMatch(/Joined/);
    expect(say("case_owner_invalid: owner_other_branch")).toBe("The owner must work in the case's branch.");
    expect(say("case_owner_invalid_reassign_first: …")).toMatch(/Assign an eligible owner first/);
    expect(say("something unexpected", "42501")).toBe("You do not have permission to do this.");
    expect(say("something unexpected", "XX000")).not.toContain("something unexpected");
  });

  it("tell the staff screen how many open cases need reassigning", () => {
    expect(ownsOpenCasesRefusal({ message: "staff_owns_open_cases: reassign 1 open case(s) before this change" })).toBe(
      "This person owns 1 open case. Reassign it to someone else first.",
    );
    expect(ownsOpenCasesRefusal({ message: "staff_owns_open_cases: reassign 3 open case(s) before this change" })).toMatch(/3 open cases/);
    expect(ownsOpenCasesRefusal({ message: "permission denied" })).toBeNull();
  });
});
