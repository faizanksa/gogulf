# 0025 — Discovery: case lifecycle, interviews, offers and candidate visibility

**Status: DISCOVERY ONLY. Nothing here is implemented, and nothing here is decided.**
Prepared 28 Sep 2026 on `phase-2/redesign` at `6e29eef`, after Phase E closed (production on
`c7b8582`, database at `0024`). No migration exists for `0025`. Production and `main` are untouched.

This document describes how things work today, lists the options, and asks Afzal to decide. Where a
choice appears, it is listed as an option. None of the options is a recommendation. Section 12 is the
decision checklist. Section 13 is the proposed build order, which applies only after the decisions are
made.

**Sources read:**
- migrations `0004`, `0006`–`0009`, `0013`, `0015`, `0016`, `0021`–`0024`
- `docs/BRANCH-SCOPE-HARDENING.md`, `docs/RBAC-RLS.md`, `docs/DATABASE-DESIGN.md`, `docs/SECURITY-MODEL.md`
- `lib/crm/data.ts`, `lib/auth/permissions.ts`
- the admin case, contact and application pages, `components/admin/*`
- the portal routes

Some points were inferred from the code and have not been run. They are marked **(inferred — to verify
by test)**.

---

## 0. Baseline: what exists today

| Area | State |
| --- | --- |
| `cases` | One table for every case type. Columns: `pipeline_id`, `stage_id`, `status` (`open`/`won`/`lost`/`cancelled`), `owner_id`, `branch_id`, `closed_at`, `deleted_at`, `priority`, `value_amount_paise`. `created_by` was added in `0023`. |
| Recruitment pipeline (seeded in `0008`, described there as "a starting point, not business truth") | `legacy_imported` (0), `new` (1), `contacted`, `documents`, `screening`, `interview`, `selected`, `processing` ("Offer & Processing"), `visa`, `travel` ("Travel Preparation"), `completed` ("Joined", `is_won`), `lost` (`is_lost`). `sla_hours` is unused. |
| How a case is created | Only by `convert_job_application()`. The case opens at stage `new` with status `open`. There is no staff screen for creating a case. |
| Case screens | `/admin/cases` (list; filters by search and status) and `/admin/cases/[id]` (read-only record and timeline, plus the employer picker from `0022`). The page says: *"Stage changes, tasks and documents on cases arrive in a later phase."* |
| Case writes | The RLS policy `staff update cases` checks **only** `cases.update` at row scope. The `0023`/`0024` triggers freeze provenance columns, lock `contact_id`, keep branch moves to all-scope staff, and gate `deleted_at` behind `cases.delete`. |
| Permissions in the catalogue but not enforced | `cases.stage.change`, `cases.assign`, `cases.close`, `interviews.manage`, `offers.manage`. |
| Interviews, offers | No tables and no screens. |
| Candidate portal | `/portal` is a placeholder page. The `feature.customer_portal` flag is `false`. No trusted path exists to link a sign-in account to a contact (`0024` removed staff linking). In practice, no candidate can read anything today. |
| Candidate timeline | `activity_is_customer_visible()` returns false for every verb. The allow-list is an empty array (`0023`). |
| Live staff (production) | hello@ is SUPER_ADMIN, admin@ is ADMIN, careers@ is HR_MANAGER (branch scope). All three are in Lucknow, the only branch. |

**Grants that matter here** (from the `0008` seed, today's values):

| Permission | ADMIN | HR_MANAGER | RECRUITER | OPERATIONS_MGR | others |
| --- | --- | --- | --- | --- | --- |
| `cases.update` | all | branch | own | branch | TRAVEL_* |
| `cases.stage.change` | all | branch | own | branch | TRAVEL_* |
| `cases.assign` | all | branch | — | branch | TRAVEL_MANAGER |
| `cases.close` | all | branch | — | branch | TRAVEL_MANAGER |
| `cases.delete` | all | — | — | — | — |
| `contacts.delete` | all | — | — | — | — |
| `interviews.manage` | all | branch | own | branch | — |
| `offers.manage` | all | branch | — | branch | — |
| `notes.hr_private.view` | all | branch | — | — | — |
| `cases.view` | all | branch | own | branch | FINANCE (all), ACCOUNTS / SUPPORT / VIEW_ONLY (branch) |

SUPER_ADMIN bypasses the permission lookup.

---

## 1. Case and contact deletion policy

### Current behaviour
- **Case hard delete:**
  - The policy `staff delete cases` checks `has_perm('cases.delete')` at all scope, so only ADMIN and SUPER_ADMIN can delete. No screen offers it; it is reachable only through the API.
  - Deleting a case **cascades** to `case_recruitment`, `case_travel`, `case_visa`, `tasks`, `notes` and **`activities`**, so the case's timeline is destroyed.
  - It sets `case_id` to null on `job_applications`, `payments` and `invoices`.
  - The `0005` audit trigger keeps a snapshot of the deleted case row in `audit_logs`.
- **Case soft delete:**
  - `deleted_at` exists, and `0024` requires `cases.delete` to set it.
  - In practice no staff session can soft-delete. The read policy hides deleted rows, and PostgreSQL refuses an update that would hide the row from its own writer, even for ADMIN.
  - Nothing restores a soft-deleted case, and no screen lists deleted cases.
- **Contact hard delete:**
  - The policy `staff delete contacts` checks `has_perm('contacts.delete')` (ADMIN and SUPER_ADMIN). No screen offers it.
  - The delete is **blocked** by any case (`cases.contact_id … on delete restrict`) and by any merge record (`contact_merges` has plain foreign keys).
  - It **cascades** to identities, notes, tasks and timeline entries.
  - It **sets `contact_id` to null** on applications, payments and invoices.
- **Side effects (inferred — to verify by test):**
  1. Deleting a case whose application is `converted` leaves that application `converted` with no case. The `0024` status guard runs only when the status changes, and the foreign-key null-out does not change the status. This breaks the rule that a converted application has its case.
  2. An **issued** invoice probably **blocks** deleting its case or contact. The `0015` freeze trigger copies `case_id` and `contact_id` back from the old row, so the foreign key's `SET NULL` cannot take effect and the delete fails. Payments need the same check.
  3. Deleting a contact does **not** erase the person:
     - the application row (name, phone, email) stays;
     - the CV and passport files stay in Storage;
     - `audit_logs` keeps PII snapshots. It is append-only, and the design keeps it for 8 years.

### Relevant objects
- Policies: `staff delete cases`, `staff delete contacts`, `staff read cases` (`deleted_at is null`), `customer reads own cases`.
- Triggers: `cases_soft_delete_guard` (`0024`), `audit_table_change` on cases and contacts, and the `0015` invoice freeze.
- Foreign keys: listed above.
- Tests: `integrity-hardening.test.sql`.

### What would need to change, depending on the decision
- **Keep hard delete as it is:**
  - Add a pre-delete refusal with a clear message, so staff don't meet a raw foreign-key error (for example on issued invoices or payments).
  - Fix the orphaned `converted` application. Options: refuse the delete, or have a trigger move the application to another status. Which status is a decision.
- **Working soft delete:**
  - A `SECURITY DEFINER` function `delete_case(id, reason)` / `restore_case(id)`, because the RLS self-visibility rule makes a direct update impossible.
  - A "Deleted cases" view for the roles that may restore.
  - Every child table's read policy must treat a deleted parent as hidden. Timeline, tasks and notes already check the case for staff. Interviews and offers (new) would have to check it too.
- **Erasure (right to be forgotten)** is a separate procedure:
  - Anonymise the contact, applications, identities and Storage files.
  - Decide what happens to the `audit_logs` snapshots. They cannot be updated by design.
  - This needs a legal position before any code is written.

### Security and branch-scope implications
- Deletion is all-scope today. If branch-scoped roles (HR) were allowed to delete, the rule must be "own branch only", and a delete must not become a way to hide a cross-branch record.
- A soft-delete function must re-check `cases.delete` scope itself. `SECURITY DEFINER` bypasses RLS.

### Migration
- None if hard delete stays and only the orphan issue is handled in the application code.
- The orphan fix, a soft-delete or restore function, or an erasure procedure each need a migration.

### Frontend and backend work
- A delete or restore action with a confirmation dialog, a required reason, and a list of what will be lost or kept.
- If soft delete is chosen: a filter or page for deleted cases.

### Tests
- SQL:
  - who may delete or restore, at each scope;
  - a deleted case disappears from every staff read path (case, timeline, tasks, notes, interviews, offers) and from the candidate's view;
  - issued-invoice and payment blocking;
  - no orphaned `converted` application;
  - audit rows written.
- E2E: the delete dialog; a restore round-trip, if restore exists.

### Decisions for Afzal
- **D1.1** Cases: keep **hard** delete, move to **soft** delete, or both (soft delete for daily use, hard delete only as an erasure procedure)?
- **D1.2** Who may delete a case: ADMIN only (today), or HR_MANAGER in their own branch as well? The same question for restoring a case.
- **D1.3** Must a reason be recorded when a case is deleted?
- **D1.4** Contacts: the same question as D1.1. Should a contact that has cases, invoices or payments be deletable at all?
- **D1.5** Can a case or contact with an **issued invoice or a payment** be deleted? (Today it probably cannot, by accident.)
- **D1.6** When a case is deleted, what happens to its converted application?
  - Refuse the delete.
  - Move the application to another status (which one).
  - Leave it as it is.
- **D1.7** Erasure requests: is a data-erasure procedure in scope for 0025? If yes, what must be kept, and for how long? Examples: invoices for tax purposes, and the audit log.

---

## 2. Recruitment stage movement rules

### Current behaviour
- Any staff member with `cases.update` on the row can set `stage_id` and `pipeline_id` to any value, through the API only (there is no screen). `cases.stage.change` is not checked.
- Nothing checks:
  - that the stage belongs to the case's pipeline;
  - that the pipeline matches the case type;
  - which way a move goes (skipping, going backwards, leaving `lost` or `completed`).
- `stage_entered_at` is updated automatically (`0004` and `0023`).
- A stage change writes an `audit_logs` row through the update audit, but **no timeline entry**.
- Stage and status are **independent**. A case can be `open` in the "Lost" stage, `won` in "New Lead", or `lost` in "Joined". `closed_at` is set by nothing.
- `pipeline_stages` can be edited only with `settings.manage` (SUPER_ADMIN only since `0016`). There is no screen for it. Customers can read every stage row.

### Relevant objects
- Columns: `cases.stage_id`, `pipeline_id`, `stage_entered_at`, `status`, `closed_at`.
- `pipeline_stages` (`is_won`, `is_lost`, `position`, `sla_hours`).
- Triggers: `cases_touch_stage_entered`, `cases_before_write`.
- Policy: `staff update cases`.
- UI: the case detail page (read-only stage) and the list page (stage column, no stage filter).

### What would need to change
- A server-side stage guard, either as a trigger that checks the change or as a `move_case_stage(case, stage, note)` function. The column grant on `stage_id` and `pipeline_id` would be removed if the function route is chosen. It would enforce:
  - `cases.stage.change` at row scope;
  - the stage must belong to the case's pipeline, and the pipeline must match the case type;
  - the approved transition rules;
  - how stage and status stay consistent (section 3).
- A timeline entry for every stage change, such as `case.stage_changed`, written by the database and hidden from candidates unless allow-listed (section 8).
- If gates are chosen (for example "Selected needs a recorded interview result", or "Processing needs an accepted offer"), the guard depends on the interview and offer tables (sections 5 and 6).
- If the stage list changes, a data migration moves existing cases. Staging has almost none. Production has live cases created by conversions, so a count is needed first.

### Security and branch-scope implications
- A stage change never changes the branch, so the `0023` branch guard is not affected.
- A RECRUITER has `cases.stage.change` at own scope, so they could move only cases they own. That depends on assignment rules (section 4).
- The function route must be `SECURITY INVOKER`, or re-check scope if it is `DEFINER`.

### Migration
Yes. A guard or function, a timeline trigger, grant changes, and possibly stage data changes.

### Frontend and backend work
- A stage control on the case page. It could be a select, a stepper, or "next and previous" buttons (a UX choice follows the decisions).
- An optional note on each move.
- A stage filter and a "days in stage" column on the cases list.
- A server action that re-checks the permission (the `lib/auth` pattern).

### Tests
- SQL:
  - the permission matrix per role and scope;
  - cross-pipeline and foreign stage refused;
  - every allowed and refused transition;
  - `stage_entered_at`;
  - the timeline entry exists and is hidden from candidates.
- Unit: the action guard.
- E2E: moving a stage on the synthetic case.

### Decisions for Afzal
- **D2.1** Is the seeded stage list the real Go Gulf process? Rename, add or remove stages, including `legacy_imported` (is it still needed?).
- **D2.2** Can a case **skip** stages?
- **D2.3** Can it move **backwards**? If yes, who may move it back, and is a reason required?
- **D2.4** Are there **gates**? For example: Interview → Selected needs an interview result; Selected → Offer & Processing needs an offer; Visa needs verified documents.
- **D2.5** Are "Joined" and "Lost" stages, or are they only the result of closing the case (section 3)?
- **D2.6** Should a note be required on some moves, or on every move?
- **D2.7** Should `sla_hours` (the "stalled case" alert) be set now? If yes, per stage, and with what values?
- **D2.8** Who edits the stage list in future: SUPER_ADMIN only through a migration, or through a settings screen?

---

## 3. Lost reason and reopen rules

### Current behaviour
- The status enum is `open`/`won`/`lost`/`cancelled`. The difference between `lost` and `cancelled` is not defined anywhere.
- There is no `lost_reason`, `closed_by` or reopen history.
- `cases.close` exists but is not enforced. Anyone with `cases.update` can set `status` directly, and nothing sets `closed_at`.
- Applications have their own `rejected` and `withdrawn` statuses. Conversion refuses those, and they are separate from the case.

### What would need to change
- New columns:
  - a lost or cancel reason (a fixed list, an admin-managed list, or free text with a category);
  - an optional note;
  - `closed_by`;
  - possibly a reopen count, or reopen history kept on the timeline and audit.
- A close/reopen guard or function that:
  - enforces `cases.close`;
  - sets `closed_at` and `closed_by`;
  - requires the reason where the decision says so;
  - keeps status and stage consistent;
  - writes timeline entries (`case.closed`, `case.reopened`).
- A decision on what closing does to open tasks, interviews and offers: cancel them, keep them, or refuse to close.

### Security and branch-scope implications
- `cases.close` exists at branch scope for HR and at all scope for ADMIN. RECRUITER has none, so under today's grants a recruiter could not close their own case.
- A reopened case keeps its branch.
- A lost reason may be sensitive, for example a medical or background finding. That affects who can read it and whether a candidate ever sees it.

### Migration
Yes: the columns, the reason list if it is data, and the guard or function.

### Frontend and backend work
- A "Close case" dialog (outcome, reason, note).
- A "Reopen" action with a reason.
- A status badge.
- Reason filters on the list.

### Tests
- SQL:
  - who may close and who may reopen;
  - the reason is required when closing as lost or cancelled;
  - status and stage stay consistent;
  - `closed_at` and `closed_by` set;
  - the timeline entry exists;
  - side effects on tasks, interviews and offers;
  - reopen within and outside any time limit.
- E2E: close and reopen on the synthetic case.

### Decisions for Afzal
- **D3.1** What do `won`, `lost` and `cancelled` each mean? Is `won` the same as "Joined"?
- **D3.2** The list of lost reasons. Examples to confirm or replace: candidate withdrew, not selected by employer, failed medical, visa refused, no response, duplicate, fees not paid. Is the list fixed or editable? Is free text allowed?
- **D3.3** Is a reason **mandatory** for lost and for cancelled?
- **D3.4** Who may close a case? Should a RECRUITER be able to close their own cases (this would need a grant change)?
- **D3.5** Who may **reopen** a case? Is there a time limit? Which stage does a reopened case return to (the last stage, "New", or chosen at reopen)?
- **D3.6** What happens on closing to open tasks, scheduled interviews, and open or accepted offers?
- **D3.7** Is the lost reason internal only, or is it ever shown to the candidate?

---

## 4. Separate stage-change and assignment permissions

### Current behaviour
- One RLS predicate (`cases.update` at row scope) covers every column: title, priority, value, stage, status, owner.
- `cases.assign`, `cases.stage.change` and `cases.close` have no effect.
- Contacts are already stricter: the `0021` `contacts_guard` requires `contacts.assign` for owner changes. Cases and contacts are therefore **inconsistent**.
- **Finding, not yet fixed:**
  - Nothing checks **who** a case's `owner_id` points at. It is not checked that the owner is an active staff member, in the case's branch, or able to see the case.
  - Because own-scope visibility follows `owner_id`, assigning a case to a staff member in another branch would give that person (for example a future RECRUITER) access to a case outside their branch.
  - The `0023` rule "ownership never carries records across branches" covers `branch_id` changes, not this route. Risk today is nil: there is one branch and no own-scope staff. The same question applies to `tasks.assignee_id` and `job_applications.assignee_id`.

### What would need to change
- A column-aware guard (the `contacts_guard` pattern, `SECURITY INVOKER`):
  - an `owner_id` change requires `cases.assign` at row scope;
  - a `stage_id` or `pipeline_id` change requires `cases.stage.change`;
  - a `status`, `closed_at` or `closed_by` change requires `cases.close`;
  - everything else stays under `cases.update`.
- Alternatively, dedicated functions per action, with the table grants narrowed.
- Owner validation, following the decision: active, same branch, holds `cases.view`.
- A timeline entry for assignment (verb family `assignment.*`, historically never shown to candidates).

### Security and branch-scope implications
This is the main item for branch isolation. It closes the owner route described above, and it must be regression-tested against `branch-scope.test.sql`.

### Migration
Yes: the guard or functions, and owner validation. It may also need `role_permissions` changes if the decisions change who holds what. Those changes are audited, as in `0023`.

### Frontend and backend work
- An owner picker, showing only eligible staff.
- A "take this case" action, if self-assignment is allowed.
- Stage, assign and close controls shown only to roles that hold each permission. The database still decides.

### Tests
- SQL: a matrix per role × scope × column (this can extend `recruitment-scope.test.sql`); the refused cross-branch owner; the refused inactive owner; the refused owner without `cases.view`; the timeline and audit rows.
- Unit: the actions guard.

### Decisions for Afzal
- **D4.1** Should stage changes, assignment and closing each require their own permission (as the catalogue intends), or stay under "Edit cases"?
- **D4.2** Can someone with edit rights but no assign right **take** an unassigned case, or hand their own case to someone else?
- **D4.3** Who may be an owner: any active staff member, only staff in the case's branch, or only staff with a recruitment role?
- **D4.4** Should the same owner rules apply to task assignees and application assignees in 0025, or later?
- **D4.5** Is a **RECRUITER** role going to be used soon? If yes, confirm its grants: stage change on own cases yes; assign no; close no.

---

## 5. Interview feedback visibility

### Current behaviour
- There is no `interviews` table. `docs/DATABASE-DESIGN.md` plans a generic `appointments` table (`kind: interview | medical | office_visit | call_back`), and separately lists `interviews`.
- `interviews.manage` is granted to ADMIN (all), HR (branch), RECRUITER (own) and OPERATIONS_MANAGER (branch). There is no `interviews.view` permission.
- The only confidential channel today is `notes.visibility = 'hr_private'`, readable by ADMIN and HR_MANAGER only. Since `0024` the visibility is locked once written.
- FINANCE_MANAGER, ACCOUNTS, SUPPORT_AGENT and VIEW_ONLY hold `cases.view`. Anything readable "with the case" is therefore readable by them too. No such staff exist yet.

### What would need to change
- A new table with a clear field set, for example: the case, round, scheduled time, mode (in person, video, phone, employer trade test), location or link, interviewer (Go Gulf staff or the employer's person), status (scheduled, completed, no-show, cancelled), outcome, feedback, the person who recorded it and when.
- Branch **inherited from the case by trigger**. This is the `0020` and `0023` lesson: a null branch hides rows from branch-scoped roles.
- Separate read rules for the schedule and for the feedback, if the decision separates them. Options:
  - a separate column behind a column-level function or view;
  - a separate `interview_feedback` table;
  - storing feedback as an `hr_private` note linked to the interview.
- Timeline entries (scheduled, rescheduled, completed), staff-only by default.
- Whether an interview result advances the stage automatically, or only enables a gate (D2.4).

### Security and branch-scope implications
- Feedback about a candidate is personal data, and may be the employer's confidential assessment.
- The read predicate must not be `cases.view` alone if FINANCE, ACCOUNTS or SUPPORT should not see it.
- The candidate must never read feedback through a direct table query. The current policy style ("customer reads own …") must **not** be copied onto this table without a decision.

### Migration
Yes: the table, RLS, the branch-inherit trigger, the timeline trigger and the audit trigger. Possibly a new permission (`interviews.view` or `interviews.feedback.view`). The catalogue does not have one, which would be the first new permission in this release.

### Frontend and backend work
- An interviews panel on the case: schedule, reschedule, record the outcome.
- An "upcoming interviews" list (possibly on the dashboard).
- Mobile-friendly entry forms. Staff record outcomes on the day.

### Tests
- SQL:
  - who may schedule, record and read, at each scope;
  - branch inherited and following case moves;
  - a candidate cannot read the table directly;
  - FINANCE, ACCOUNTS and VIEW_ONLY cannot read feedback (if so decided);
  - a deleted case hides its interviews;
  - timeline and audit.
- E2E: schedule and record on the synthetic case.

### Decisions for Afzal
- **D5.1** What is recorded for an interview? Confirm the fields. Is one case allowed several rounds?
- **D5.2** Who **reads the feedback**?
  - every staff member who can see the case;
  - only `interviews.manage` holders;
  - only HR_MANAGER and ADMIN (the `hr_private` model).
- **D5.3** Are **employer-provided** results or feedback treated differently from Go Gulf's own screening?
- **D5.4** Can feedback be edited after it is recorded? By whom? Is the history kept?
- **D5.5** Does an interview result move the stage automatically, only unlock a move, or neither?
- **D5.6** Does the candidate ever see anything:
  - the interview schedule (date, time, mode, location);
  - the outcome;
  - never?

---

## 6. Offers: workflow, visibility and acceptance

### Current behaviour
- There is no `offers` table.
- Locked decision (28 Sep): offers come between interview/selection and processing, and are extensible (status, dates, details).
- `offers.manage` is granted to ADMIN (all), HR (branch) and OPERATIONS_MANAGER (branch). RECRUITER has none.
- The seeded stage `processing` is labelled "Offer & Processing".
- The case can link an employer (`0022`), and the employer must be visible to the person linking it.
- There is no documents table, so an offer letter file cannot be stored in a structured way yet.

### What would need to change
- An `offers` table. Fields to confirm:
  - case, employer (must match the case's employer?), position or title;
  - salary amount **and currency**, in integer minor units following the billing convention (AED, SAR, QAR, KWD, OMR and BHD use different minor units: KWD, BHD and OMR have 3 decimals);
  - allowances, contract duration, joining date, validity or expiry date;
  - status, `issued_at`, `responded_at`, the person who recorded the response and its evidence;
  - `created_by` (frozen).
- A status model, for example draft → issued → accepted / declined / withdrawn / expired, plus possibly superseded. It needs a transition guard in the style of the `0015` invoices, and a **freeze once accepted**.
- Rules on how many offers a case may have (one active, or several in parallel).
- What acceptance does: stage move, closing other offers, creating tasks, and possibly billing. Billing is money, so it is out of scope unless decided. Refunds stay blocked (locked decision 2).

### Security and branch-scope implications
- Salary is sensitive. The read predicate needs a decision (the same set of options as D5.2).
- Branch inherited from the case by trigger.
- The employer link must obey `employer_link_guard` visibility.
- If the candidate accepts in the portal, identity verification must exist first (the `0024` pending decision: OTP flow and a trusted linking function). Without it, the only possible way is **"staff record the candidate's acceptance"**, with evidence.

### Migration
Yes: the table, the status guard and freeze, RLS, the branch-inherit trigger, the audit and timeline triggers, and possibly a new view permission.

### Frontend and backend work
- An offer panel on the case: create a draft, issue, record acceptance or decline (with evidence and a note), withdraw.
- A currency-aware amount input.
- An "open offers" list.

### Tests
- SQL:
  - the transition matrix;
  - the freeze after acceptance;
  - who may issue and who may record acceptance;
  - salary visibility per role;
  - branch inheritance;
  - employer consistency;
  - one-active-offer rule (if chosen);
  - the candidate cannot read the table directly;
  - timeline and audit.
- Unit: minor-unit arithmetic per currency.
- E2E: the offer lifecycle on the synthetic case.

### Decisions for Afzal
- **D6.1** Offer fields: confirm the list above. Which currencies? Is salary monthly or annual?
- **D6.2** The statuses and allowed transitions. Do offers **expire** automatically?
- **D6.3** One active offer per case, or several at once (for example from different employers)?
- **D6.4** Who may **issue** an offer (`offers.manage` holders: ADMIN, HR in their branch)? Does it need a second person's approval?
- **D6.5** **Acceptance:** how is it recorded?
  - by staff, on the candidate's behalf, with evidence (signed letter, email, WhatsApp screenshot);
  - by the candidate in the portal (needs portal identity verification first);
  - both.
- **D6.6** What does acceptance trigger? A stage move to "Offer & Processing" or beyond? Closing other offers? Creating tasks? Anything in billing?
- **D6.7** What does a **decline** trigger? Does the case close as lost with a reason, or stay open for another offer?
- **D6.8** Who may see salary and offer terms? For example: all case viewers; only `offers.manage` holders; also finance roles.
- **D6.9** Does the offer letter need a file? If yes, offers depend on the documents increment. Offers could ship without a file first.

---

## 7. Candidate-facing visibility

### Current behaviour
No candidate can currently sign in to a linked account, so nothing is exposed today. But the **latent RLS** from `0007` would expose far more than intended as soon as portal linking exists:

| Policy | What a linked candidate could read through the API |
| --- | --- |
| `customer reads own cases` | the **whole case row**: `owner_id`, `branch_id`, `priority`, `value_amount_paise`, `title`, `legacy_id`, `created_by` |
| `customer reads own case_recruitment` | `employer_id` (possibly a **confidential** employer), `expected_salary_paise`, `passport_number_last4`, `legacy_*` |
| `customer reads own contact` | the whole contact row, including internal columns such as `owner_id`, `lifecycle_stage` and `first_touch` |
| `customer reads own identities` | own identities (probably fine) |
| `customer reads stages` | **every** stage row, including internal names such as "Legacy — imported, not triaged" |
| `customer reads own activities` | only allow-listed verbs, and the list is empty (`0023`) |

Column grants cannot separate candidates from staff, because both use the `authenticated` role. The existing safe pattern is the one used by `0015` for the payment page: a definer function that returns "exactly the fields the customer page may show".

### What would need to change
- Replace the direct candidate policies with a small set of candidate-safe functions or views, such as `portal_my_cases()` returning candidate-safe fields and candidate labels only.
- Alternatively, drop the candidate policies until the portal is built.
- Map internal stages to **candidate-facing labels**. Several internal stages may show as one candidate step, and some stages may never be shown.
- The portal itself (sign-in by OTP, linking, screens) is **not** part of 0025 unless decided. The portal has 6 locales (en, hi, ar RTL, ml, later ta and bn). Any candidate text must be translatable, so it cannot be staff-typed free text.

### Security and branch-scope implications
- This is a pre-portal security debt. The fix is defensive and does not change anything a staff member sees.
- Every new table in 0025 (interviews, offers, reasons) must start with **no** candidate policy.

### Migration
Yes, if the latent policies are tightened in 0025. It is not needed if the portal and this cleanup are deferred together, but then the debt must be recorded as a blocker for the portal.

### Frontend and backend work
- None for staff.
- Portal screens only if the portal is in scope.

### Tests
- SQL: under a customer JWT with a linked identity (the test fixtures can simulate it), direct reads of `cases`, `case_recruitment`, `contacts`, `pipeline_stages`, `interviews` and `offers` return nothing or only allowed columns; the safe function returns exactly the approved fields; a customer can never read another contact.

### Decisions for Afzal
- **D7.1** Is the **candidate portal** (or any candidate-facing status page) in scope for 0025? Or is 0025 staff-only?
- **D7.2** Should 0025 **tighten the latent candidate read policies** now, even if the portal comes later?
- **D7.3** What may a candidate eventually see? For each item, yes or no:
  - current step, with a candidate-friendly label;
  - the name of their Go Gulf contact person;
  - employer name (and what about confidential jobs?);
  - interview date, time and place;
  - offer terms;
  - document requests or status;
  - that the case is closed;
  - the reason it was closed.
- **D7.4** Candidate-facing stage labels: who writes them, and in which languages first?

---

## 8. Candidate timeline allow-list

### Current behaviour
- `activity_is_customer_visible(verb)` returns false for every verb (`0023`). Adding a verb requires a migration, approved first.
- Verbs the database writes today:
  - `application.converted`
  - `contact.merged`
  - `case.employer_linked`, `case.employer_unlinked`, `case.employer_changed`
- 0025 would add verbs such as `case.stage_changed`, `case.assigned`, `case.closed`, `case.reopened`, `interview.*` and `offer.*`.
- Every `summary` is written **for staff**, in English, and may name employers, staff and job references. For example, `"Employer changed: A → B"` names both employers. Allow-listing a verb exposes its summary as it is.

### What would need to change
- A candidate-safe rendering: a `metadata` key that the portal translates, or a separate candidate summary. Otherwise the candidate sees staff wording.
- Then add verbs to the allow-list, one reviewed migration each.
- Possibly `metadata` scrubbing: the policy returns the whole row, including `actor_id`, `actor_label` and `metadata`. The candidate read should go through a function that returns only safe fields (the same pattern as section 7).

### Security and branch-scope implications
- Timeline rows are append-only and can't be edited afterwards. Anything allow-listed exposes **all past rows** with that verb, not only new ones.

### Migration
Yes, for each verb added, and for the safe candidate read function.

### Frontend and backend work
- The portal timeline component (only if the portal is in scope).
- Staff side: show the human-readable text instead of the raw verb (section 11).

### Tests
- SQL: for each allowed verb, visible to its own candidate; every other verb hidden; another candidate's rows hidden; staff-only fields not returned.

### Decisions for Afzal
- **D8.1** Which events should a candidate see? A starting list to accept or reject item by item:
  - application received;
  - moved to the next step (candidate label only);
  - interview scheduled;
  - offer issued;
  - offer accepted;
  - case closed.
- **D8.2** Should the candidate see **who** did something (a named staff member), or only "Go Gulf"?
- **D8.3** Should entries written **before** a verb is allowed become visible retroactively?
- **D8.4** If the portal is not in 0025, should the allow-list stay **empty** for now?

---

## 9. Synthetic staging case for browser verification

### Current state
- Staging (Mumbai, `exsnksrmkycloxiajwmx`) had 0 contacts after the 28 Sep contact-merge cleanup. It has one test employer ("STAGING TEST Employer A", LKO) and synthetic jobs (`STG-JOB-*`).
- A case needs a contact, and creation goes only through conversion. So staging probably has **no case**. This must be confirmed with a read-only count before anything is created.
- Previous practice, used for the contact-merge check:
  - fixed-UUID `STAGING TEST` records on Mumbai staging only;
  - `example.com` addresses;
  - an agreed cleanup by those fixed ids;
  - audit rows kept (append-only).
- Staging mail goes to careers@gogulf.co.
- Real staff accounts on staging are the same three roles. There is **no RECRUITER, second-branch or finance user**, so own-scope and cross-branch behaviour can be proven only in SQL tests, not in the browser.

### Options for creating it
- **Option A:** submit the staging apply form with synthetic data (including a dummy CV), then convert it in the admin. This tests the real path end to end, but leaves a synthetic CV in the staging Storage bucket.
- **Option B:** SQL seed of a fixed-id contact, identity, case and `case_recruitment` row (LKO, owned by careers@ or no owner). This is quick and exactly removable, but skips conversion.
- **Either option, optionally:**
  - a second synthetic case in a **second synthetic branch**, to see branch isolation in the browser. This requires creating a branch row on staging, which is a data change needing approval;
  - a synthetic staff account for another role. This needs a Google-linked account, which is a real identity question.

### Cleanup
- Cleanup by the fixed ids, in order: offers, interviews, tasks and notes (cascade), case (hard delete by ADMIN, which cascades the timeline), identities, contact.
- If Option A: the application row and its Storage objects too.
- Audit rows stay.
- If 0025 introduces soft delete, cleanup must use the hard path, so the cleanup plan depends on D1.

### Decisions for Afzal
- **D9.1** Option A (through the apply form) or Option B (SQL seed)?
- **D9.2** Is a second synthetic branch on staging approved, for browser checks of branch isolation?
- **D9.3** Is a synthetic staff account for another role (for example RECRUITER) wanted? If yes, which Google identity would it use?
- **D9.4** Which role owns the synthetic case? When is it deleted: after 0025 QA, or kept as a standing fixture?

---

## 10. Dependencies between the decisions

```
D1 deletion ─────────────┬─> every new table's FK behaviour (cascade vs restrict) and read rules
                         └─> synthetic case cleanup (D9)
D2 stages ──┬─> D3 close/reopen (are Joined/Lost stages or outcomes?)
            ├─> D2.4 gates ──> D5 interviews, D6 offers (gates need their tables)
            └─> D7.4 candidate labels (map from the final stage list)
D3 close ───┬─> D6.7 decline → lost?   D3.6 closing cancels interviews/offers?
            └─> D4 (cases.close holder list)
D4 perms ───> the stage, close, offer and interview UIs (who sees which control); RECRUITER (D4.5)
D5, D6 visibility ─> may need the first NEW permission (view feedback / view offer terms)
D6.5 acceptance by candidate ─> portal identity verification (0024 pending) ─> D7.1 portal scope
D7 candidate visibility ─> D8 allow-list (the allow-list is meaningless without a safe read path)
D9 synthetic case ─> needs D1 (cleanup path) and the D4 roles available on staging
```

**Recommended order of deciding:** D2 and D3 together, then D4, then D1, then D5 and D6, then D7 and D8, then D9. This order follows the dependencies above. It is not a product preference.

---

## 11. Admin/recruitment UI observations

**Recommendations only; not part of any decision.** Reviewed against the installed ui-ux-pro-max, frontend-design, ui-design-system, senior-frontend and mobile-design guidance. Items marked ★ are small enough to fold into the 0025 screens that already touch those pages.

1. ★ **The case status is plain text.** Jobs, applications, invoices and employers use toned `Badge`s (`JobStatusBadge`, `ApplicationStatusBadge` and so on); cases print `CASE_STATUS_LABELS[...]` as bare text on both the list and the detail page. A `CaseStatusBadge` would make them consistent. The text label keeps meaning without colour.
2. ★ **The raw verb is shown to staff.** The case and contact timelines render `summary · case.employer_linked`. The developer verb is noise. Show a human label and the **actor** instead (`actor_label` exists but is not shown), for example "careers@ · 28 Sep, 14:02".
3. ★ **Stale copy.** The case page says "Stage changes, tasks and documents on cases arrive in a later phase." 0025 must replace or remove it.
4. ★ **The case type is rendered in lowercase** with `replace(/_/g, " ")` ("recruitment"). Elsewhere, labels come from a map. Add `CASE_TYPE_LABELS`.
5. ★ **Name collision.** `STAGE_LABELS` in `components/admin/ui.tsx` holds the contact **lifecycle** labels (Subscriber, Lead…). Once pipeline stages get a UI, two meanings of "stage" will coexist. Renaming it to `LIFECYCLE_LABELS` avoids mistakes.
6. **Missing list filters.** The cases list has no stage filter, no owner filter ("My cases") and no "days in stage", although the database already has the partial index for my open cases and keeps `stage_entered_at`.
7. **No notes on the case and contact pages.** `AddNoteForm` is used only on the application page, although notes attach to contacts and cases. With interviews and offers arriving, the case page becomes the working page.
8. **Status and stage are packed into the header description** ("recruitment · Open · New Lead") as one string. A row of badges (type, status, stage, days in stage) scans better. On mobile it would also wrap better.
9. **Destructive actions need a pattern.** Close as lost, withdraw an offer and delete a case need a shared confirmation dialog with a required reason. None exists yet. `ActionForm` and `SubmitButton` handle pending states, which is good. The dialog needs focus trapping and must return focus to its trigger (accessibility).
10. **Mobile.** Tables already collapse into labelled cards below 768 px, and touch targets use `--target-min`. For the stage control, a kanban board is not a good fit on phones. A select or stepper with the current step highlighted works on both screen sizes. Interview-outcome entry should be a short, single-column form.
11. **Success feedback is inconsistent.** Employer and contact pages show a success `AlertView` after saving (`?saved=`). New 0025 actions should follow that pattern, not introduce toasts.

---

## 12. Decision checklist for Afzal

Tick or answer each. "Defer" is a valid answer for any item.

**Deletion (§1)**
- [ ] D1.1 Cases: hard delete, soft delete, or both?
- [ ] D1.2 Who may delete a case, and who may restore one?
- [ ] D1.3 Reason required on delete?
- [ ] D1.4 Contacts: same question as D1.1; deletable if it has cases?
- [ ] D1.5 Deletable with an issued invoice or a payment?
- [ ] D1.6 What happens to the converted application when its case is deleted?
- [ ] D1.7 Is an erasure procedure in 0025? What must be kept?

**Stages (§2)**
- [ ] D2.1 The real stage list (keep `legacy_imported`?)
- [ ] D2.2 Skipping allowed?
- [ ] D2.3 Backwards allowed? By whom, and with a reason?
- [ ] D2.4 Gates (interview result, offer, documents)?
- [ ] D2.5 Are Joined and Lost stages or outcomes?
- [ ] D2.6 Note required on moves?
- [ ] D2.7 SLA hours per stage?
- [ ] D2.8 Who edits the stage list in future?

**Close and reopen (§3)**
- [ ] D3.1 Meaning of won, lost and cancelled
- [ ] D3.2 Lost reason list; fixed or editable; free text allowed?
- [ ] D3.3 Reason mandatory?
- [ ] D3.4 Who may close? RECRUITER too?
- [ ] D3.5 Who may reopen; time limit; which stage it returns to
- [ ] D3.6 Effect of closing on tasks, interviews and offers
- [ ] D3.7 Lost reason ever shown to the candidate?

**Permissions (§4)**
- [ ] D4.1 Enforce stage, assign and close permissions separately?
- [ ] D4.2 Self-assign or hand over without the assign permission?
- [ ] D4.3 Who may be an owner (active, same branch, recruitment role)?
- [ ] D4.4 Same rules for task and application assignees now?
- [ ] D4.5 RECRUITER role coming soon? Confirm its grants

**Interviews (§5)**
- [ ] D5.1 Fields; several rounds?
- [ ] D5.2 Who reads the feedback?
- [ ] D5.3 Employer feedback treated differently?
- [ ] D5.4 Feedback editable; history kept?
- [ ] D5.5 Result moves the stage, unlocks a move, or neither?
- [ ] D5.6 Candidate sees schedule, outcome, or nothing?

**Offers (§6)**
- [ ] D6.1 Fields, currencies, monthly or annual salary
- [ ] D6.2 Statuses and transitions; automatic expiry?
- [ ] D6.3 One active offer or several?
- [ ] D6.4 Who issues; second approval?
- [ ] D6.5 Acceptance recorded by staff with evidence, by the candidate in the portal, or both
- [ ] D6.6 What acceptance triggers
- [ ] D6.7 What a decline triggers
- [ ] D6.8 Who sees salary and offer terms
- [ ] D6.9 Offer letter file needed now (it depends on documents)?

**Candidate visibility (§7, §8)**
- [ ] D7.1 Portal in 0025, or staff-only?
- [ ] D7.2 Tighten the latent candidate read policies now?
- [ ] D7.3 What a candidate may see, item by item
- [ ] D7.4 Candidate stage labels: who writes them, which languages first
- [ ] D8.1 Candidate-visible events, item by item
- [ ] D8.2 Show staff names, or "Go Gulf" only?
- [ ] D8.3 Retroactive visibility of older entries?
- [ ] D8.4 Keep the allow-list empty if there is no portal?

**Staging verification (§9)**
- [ ] D9.1 Synthetic case through the apply form, or SQL seed?
- [ ] D9.2 Second synthetic branch on staging?
- [ ] D9.3 Synthetic staff account for another role?
- [ ] D9.4 Owner of the synthetic case, and when it is removed

**UI (§11):** approve the ★ items for inclusion? (yes / no / choose)

---

## 13. Proposed implementation order after approval

This order is conditional: each step starts only after its decisions are made, and after Afzal's explicit go.
- Every step follows the established release path:
  1. a local migration and SQL tests (mutation-checked);
  2. unit tests;
  3. Mumbai **staging only**;
  4. the staging E2E and verifier runs;
  5. the manual check on the synthetic case;
  6. Afzal's acceptance.
- Production gets a separate prepared runbook and needs a separate GO.
- Migration numbers from `0025` onward are assigned at build time, one per step.

| Step | Contents | Needs decisions | Why this position |
| --- | --- | --- | --- |
| 0 | Read-only staging count; create the synthetic case (D9) | D9, D1 (cleanup path) | Everything after it is verified on this case |
| 1 | **Case write guard:** separate stage, assign and close permissions; owner validation; stage belongs to the pipeline; status and stage consistent; `closed_at`/`closed_by`; staff-only timeline verbs for stage, assign, close and reopen. **Screens:** stage control, owner picker, close/reopen dialog, status badge, list filters | D2, D3, D4 | Fixes the open owner-routing issue first; it is the base that interviews and offers change |
| 2 | **Deletion policy**, as decided: orphan fix, pre-delete refusals, soft delete and restore if chosen | D1 | Must exist before the new child tables, so their foreign keys and read rules follow it |
| 3 | **Tighten candidate read paths** (if D7.2 = yes): remove direct candidate policies; safe read function(s); candidate stage labels | D7.2, D7.4 | Defensive and independent. Doing it before the new tables means they never copy the old pattern |
| 4 | **Interviews:** table, branch inheritance, feedback visibility, timeline, case panel; stage gates if D2.4 says so | D5, D2.4 | It comes before offers in the process |
| 5 | **Offers:** table, status guard and freeze, acceptance recording, salary visibility, case panel; decline handling through step 1's close | D6, D3.6 | Depends on steps 1 and 4 and on the employer link (0022) |
| 6 | **Candidate timeline allow-list** (only if D7.1 or D8 approves anything): candidate-safe rendering, then verbs one at a time | D8, D7.1 | Only meaningful once the verbs from steps 1, 4 and 5 exist and step 3 provides a safe read path |
| 7 | **UI consistency** items not already folded into steps 1–5 | §11 approval | Low risk; can be done in parallel |

**Explicitly out of scope unless decided otherwise:**
- the candidate portal build (OTP sign-in and account linking);
- documents and passport expiry;
- deployment, flights and suppliers (locked: Admin, SUPER_ADMIN and Operations only);
- refunds (locked: blocked until a Finance user exists);
- GST and tax invoices (D8, deferred).
