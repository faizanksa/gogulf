# Case lifecycle — `0025` (Recruitment Operations, 0025 Step 1)

Decisions: `docs/0025-DISCOVERY.md` §2–§4, answered 28–29 Sep 2026 ("0025 Step 1 — FINAL DECISIONS").
Migration: `supabase/migrations/0025_case_lifecycle.sql`. Tests: `supabase/tests/case-lifecycle.test.sql`
(sections A–M below) plus updates to four existing suites.

## Rules

| Area | Rule |
| --- | --- |
| Stages | Exactly ten: New Lead → Contacted → Documents Pending → Screening → Interview → Selected → Offer & Processing → Visa Processing → Travel Preparation → Joined. `legacy_imported` and Lost are removed. Internal keys are unchanged (`new` … `completed`). Stage definitions change only by migration: no API write path, no settings screen. |
| Creation | Every new case starts `open` at the pipeline's first stage (New Lead), for every writer, the service role and the database owner included. Conversion already does this. |
| Forward | One stage at a time. No reason. |
| Backward | One stage at a time, with a reason. |
| Exceptional | ADMIN and SUPER_ADMIN only: an explicit exceptional move to any stage, with a reason. |
| Joined | The only route to `won`. It needs `cases.stage.change` **and** `cases.close`, so a RECRUITER cannot reach it. There is no "close as won". |
| Closed cases | A `won`, `lost` or `cancelled` case does not move. It is reopened first. |
| Lost and cancelled | `close_case`. A reason from the outcome's own fixed list is required; "Other" needs a note. The reason is internal and is never candidate-visible. |
| Closing | Open and in-progress tasks become `cancelled`. Nothing is deleted. Done and cancelled tasks are unchanged. |
| Reopen | `cases.close` and a reason. No time limit. The case returns to `reopen_stage_id`, the last active stage stored at closure: for lost and cancelled cases the stage it was at; for won cases the stage before Joined (normally Travel Preparation). Cancelled tasks stay cancelled. |
| Owner | For an open case: active, in the case's branch, of role SUPER_ADMIN, ADMIN, HR_MANAGER or RECRUITER, and able to view the case. Checked for every writer. A closed case keeps its historical owner. |
| Staff changes | A staff member who owns open cases cannot be deactivated, moved to another branch, given an ineligible role or removed until those cases are reassigned. |
| Gates | `case_stage_gate(case, from, to)` is called on every move and returns null today. Interviews, offers and documents add their gates when they exist. |

## Permissions

Each permission is checked separately, at the case's scope.

| Action | Function | Permission | SUPER_ADMIN | ADMIN | HR_MANAGER | RECRUITER | OPERATIONS_MANAGER |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Edit title, priority, value | direct update | `cases.update` | all | all | branch | own | branch |
| Move stage | `move_case_stage` | `cases.stage.change` | all | all | branch | own | branch |
| Exceptional move | `move_case_stage(…, true)` | role ADMIN or SUPER_ADMIN | ✓ | ✓ | — | — | — |
| Move to Joined | `move_case_stage` | `cases.stage.change` + `cases.close` | ✓ | ✓ | branch | — | — |
| Close / reopen | `close_case` / `reopen_case` | `cases.close` | all | all | branch | — | **removed** |
| Assign | `assign_case` | `cases.assign` | all | all | branch | — | **removed** |

TRAVEL_MANAGER was retired in `0019` and holds no grants; the migration's delete is a no-op for it.

## Objects

| Object | Why |
| --- | --- |
| `cases.closed_by` | Who closed the case (`closed_at` alone does not say). |
| `cases.close_reason`, `close_note` | The fixed-list reason key and the note that "Other" needs. Check constraints tie the reason to the outcome. |
| `cases.reopen_stage_id` | D9: the stage to reopen at, stored at closure, because a won case's own stage is then Joined. |
| `case_close_reason_label(outcome, key)` | The single source for both lists; used by the check constraint and the timeline wording. `lib/crm/case-lifecycle.ts` mirrors it, and a unit test compares them. |
| `move_case_stage`, `close_case`, `reopen_case`, `assign_case` | SECURITY DEFINER. Each re-checks the session, the case's visibility and its own permission, then sets the transaction-local `app.case_lifecycle` for its write. They write `case.stage_changed`, `case.closed`, `case.reopened` and `case.assigned` to the timeline (staff-only; the candidate allow-list stays empty) and to the audit trail, with the reason. |
| `cases_lifecycle_guard` | Runs for every writer. It enforces the creation rule; refuses changes to stage, pipeline, type or closure columns outside the functions; keeps the stage in the pipeline, Joined equal to `won`, and closed cases still; and validates an open case's owner. |
| `staff_users_case_owner_guard` | Enforces the staff rule. |
| `role_has_perm`, `case_owner_problem(_for)` | The ownership check, including for a role someone is about to be given. |
| Column grants | Staff lose UPDATE on `stage_id`, `pipeline_id`, `case_type`, `status`, the closure columns and `owner_id`; every other column keeps its grant (the `0023` freezes still apply). |

## Tests (`case-lifecycle.test.sql`)

- **A. Stage definitions:** ten stages in order with contiguous positions; no `legacy_imported` or Lost; one won stage; retirements audited; no API write path, even for SUPER_ADMIN.
- **B. Creation:** New Lead and `open` only, for staff and system writers; creating a case in another person's name needs `cases.assign`; conversion still works.
- **C. Forward:** one step forward; skips refused; timeline, audit and stage entry time.
- **D. Backward:** a reason is required, and a blank one is refused; two steps back refused.
- **E. Exceptional:** HR_MANAGER and RECRUITER refused; ADMIN and SUPER_ADMIN allowed with a reason; the move is marked on the timeline.
- **F. Joined:** RECRUITER refused; no close as won; HR_MANAGER reaches `won`; direct status, stage and owner writes are refused for staff and for the database owner.
- **G. Closed cases:** stage changes refused, exceptional ones included.
- **H. Reopen:** permission and reason required; won returns to Travel Preparation; lost and cancelled return to their stage; timeline and audit written; tasks not recreated.
- **I. Close and tasks:** reason lists per outcome; "Other" needs a note; task outcomes; reasons not candidate-visible; reason cannot be rewritten.
- **J. Ownership:** inactive, cross-branch, ineligible-role and cannot-view owners refused; SUPER_ADMIN accepted; take and hand-over need `cases.assign`; direct database writes validated.
- **K. Staff lifecycle:** deactivation, branch move, role change and removal blocked while the person owns open cases; a closed case keeps its historical owner; reopening needs an eligible owner first.
- **L. Role grants:** the matrix above; the OPERATIONS_MANAGER removals are audited.
- **M. Production-compatible data:** the production case's shape stays valid; ordinary edits still work; constraints are validated.

Mutation checks (each must fail the suite) all passed: without the lifecycle guard (B2), without the staff guard (K1), with owner eligibility disabled (J1), with the table-wide UPDATE grant restored (F5), and with `cases.close` re-granted to OPERATIONS_MANAGER (L4).

## Deploying

- **Deploy the code first, then the migration.** Two foreign keys now join `cases` to `pipeline_stages`, so an unqualified `stage:pipeline_stages(...)` embed becomes ambiguous. The new code names the key (`pipeline_stages!cases_stage_id_fkey`), which works against the old schema too. Old code against the new schema would fail on the cases list, contact page and dashboard.
- **Preflight** (read-only, 28–29 Sep): production has 1 case (open, New Lead, SUPER_ADMIN owner, same branch); staging has none. Section 0 of the migration refuses to run if any case sits on a removed stage, is already closed, is on Joined or another pipeline's stage, or has an ineligible owner.

## Known limits and follow-ups

- **Conversion and cross-branch assignees.** Conversion makes the application's assignee (else the converter) the owner. An application assigned to someone outside its branch therefore cannot be converted until it is reassigned within the branch. The same applies to all-scope staff converting another branch's unassigned application. This is the D27 owner rule working; application-assignee rules were left alone (D31). Decide whether conversion should fall back to an unassigned case.
- **Moving a case to another branch** (all scope) needs its owner cleared first (`assign_case(…, null)`), because the owner must work in the case's branch.
- **Contact-owner validation** is out of scope (decision 34). It is a separate security-hardening follow-up with the same owner-routes-visibility gap as cases had.
- **Candidate read policy.** The latent `customer reads own cases` policy (`0007`) returns the whole row, now including `close_reason` and `close_note`. No candidate can link an account today (`0024`). Tightening it is discovery item D7.2, which is still undecided.
- **Grant changes.** Eligibility checks `cases.view` at own scope for the owner's role. A later `role_permissions` change that removes it does not re-check existing owners.
- A soft-deleted open case is not counted by the staff guard, so restoring one could bring back an ineligible owner. No staff session can soft-delete or restore a case today (`0024`); the deletion decision (D1) must cover this.
