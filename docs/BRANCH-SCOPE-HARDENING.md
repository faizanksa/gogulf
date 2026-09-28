# Branch-scope hardening — `0023` (increment 4a) and integrity hardening — `0024`

Built from the live schema (policies, column grants, triggers and callable functions as of `0022`), not
only from `BRANCH-SCOPE-AUDIT.md`. Write-side only: `scope_allows()` and the read policies on contacts,
cases, jobs, applications and invoices are unchanged. Tests: `supabase/tests/branch-scope.test.sql` (74).

**Rule.** A staff member creates a record in, or moves a record to, a branch other than their own only
with the table's permission at **all** scope, and moving a record between branches needs all scope in
every case. Ownership (`owner_id`, `assignee_id`, `created_by`) never carries a record across branches.
A child (task, note) always takes its parent's branch.

## The matrix

"Before" is the state at `0022`; "after" is `0023`. *Refused* means for branch- and own-scoped staff;
ADMIN and SUPER_ADMIN (all scope) keep every cross-branch ability they had.

| Table | Create | Update | Branch change | Parent reassignment | Delete / cancel | Creator fields |
| --- | --- | --- | --- | --- | --- | --- |
| **contacts** | before: any branch if owner = self → **after: own branch only** | unchanged (0021 columns) | before: 0021 let an assigner pull an owned contact *into* their branch → **after: all scope only** | — | contacts.delete (all) only — unchanged | no creator column; `first_touch` not writable |
| **cases** | before: any branch if owner = self → **after: own branch only**; `created_by` added, set by the database | title, stage, owner, priority… unchanged | before: owner could move → **after: all scope only**; tasks and notes follow | before: `contact_id` writable → **after: only merge_contacts** | cases.delete (all, hard) — **unchanged, decision** | before: `case_number`, `created_at`, `opened_at`, `stage_entered_at`, `legacy_id` writable → **after: frozen**; `created_by` frozen |
| **case_recruitment** | under the case's policy — unchanged | unchanged; employer link guarded (0022) | no branch (inherits case) | before: `case_id` writable → **after: fixed** | DELETE allowed under cases.update → **no staff DELETE (`0024`)** | `created_at` frozen |
| **tasks** | before: any branch if assignee = self; `created_by` forgeable → **after: branch from case → contact; free-standing tasks own branch only; parent must be visible; case must belong to contact** | unchanged | before: assignee could move → **after: follows parent; a different branch is refused** | before: any `case_id`/`contact_id` → **after: visible parents only, re-derived** | before: assignee could DELETE (unaudited) → **after: no DELETE; cancel** | `created_by` set and frozen; `completed_by`/`completed_at` set by the database |
| **notes** | author = self (unchanged); before: `case_id` unchecked, `branch_id` free text → **after: case must be visible and belong to the contact; branch derived** | author only (unchanged) | derived, follows parent | before: author could re-attach (stopped only by visibility) → **after: fixed** | no DELETE policy (unchanged) | `author_id` = self (RLS); `created_at` frozen |
| **job_applications** | public form only (unchanged) | status, assignee (unchanged) | before: assignee could move → **after: all scope only** | before: `contact_id`/`case_id` settable to any visible row → **after: conversion only** | none | no creator column |
| **invoices** | before: any branch (created_by = self) → **after: own branch only**; contact/case must be visible and agree | unchanged (0015 lifecycle) | **after: all scope only** | draft only (0015) — **after: visible and consistent** | none | frozen since 0015 |
| **jobs** | before: any branch (created_by = self) → **after: own branch only** (every current holder of `jobs.manage` is all-scope) | unchanged | **after: all scope only** | employer link guarded (0022) | none (archive) | frozen since 0012 |
| **employers** | RLS `scope_allows(…, branch, NULL)` — no owner hop (0022) | — | RLS | — | none | frozen (0022) |
| **activities** | before: any staff could insert (any verb, any wording, as themselves) → **after: none — database functions only** | append-only | — | — | append-only | — |
| **contact_merges** | direct INSERT by any `contacts.merge` holder → **`merge_contacts()` only (`0024`)** | append-only | — | — | append-only | — |
| **contact_identities** | under `contacts.update` of the contact; → **no `auth_user`, no `verified_at` from staff (`0024`)** | same; verified value edit clears verification | — | → **merge only (`0024`)** | → **no staff DELETE; audited (`0024`)** | — |

### Reading and cross-branch access

| Path | Before | After |
| --- | --- | --- |
| Timeline, staff | by the **contact's** visibility — a case run by another branch was readable through the person | an entry **on a case** by the case's visibility; a contact-level entry by the contact's |
| Timeline, candidate | every verb except `internal.*`, `note.*`, `assignment.*` (so employer, merge and conversion entries) | an explicit allow-list — **empty**; adding a verb is a migration, approved first |
| Employers, HR_MANAGER | view all, manage all | view all, **manage own branch** (decided 28 Sep) |
| Everything else | unchanged | unchanged |

### Trusted functions (database-function bypasses)

| Function | How it runs | Treatment |
| --- | --- | --- |
| `merge_contacts` | SECURITY DEFINER (owner) | every staff-only rule stands aside (`current_user` is the owner); checks `contacts.merge` scope itself, cross-branch at all scope only (0021). Moved tasks and notes re-derive their branch |
| `convert_job_application` | SECURITY INVOKER — under the caller's RLS | sets transaction-local `app.trusted_write` around its writes and clears it before returning: exempts only the branch guard and the application link lock; RLS still applies. Records land in the application's branch, which the caller does not choose. Its timeline entry is now written by a trigger |
| `log_activity`, audit triggers, `employer_link_audit`, `children_follow_branch`, `job_applications_conversion_timeline` | SECURITY DEFINER, not callable by staff | the only writers of the timeline |
| service role (server) | `current_user` = service_role | not a staff session — rules stand aside, as for every other table |

## Findings after `0023` — status

Tests: `supabase/tests/integrity-hardening.test.sql` (40).

| # | Finding | Status |
| --- | --- | --- |
| 1 | **Portal identity was staff-assertable.** A portal session becomes a contact through an `auth_user` identity (`current_contact_id`), and anyone with `contacts.update` could insert one — binding any sign-in account to any contact they could edit — or set `verified_at`. | **Fixed in `0024`.** Staff sessions (every role, SUPER_ADMIN included) can no longer create, change, move or delete an `auth_user` identity, set or change `verified_at`, or move any identity to another contact; editing a verified value clears its verification. Linking and verifying are left to trusted paths — the future OTP sign-in flow (service role or a SECURITY DEFINER function) and `merge_contacts`. The portal itself is out of scope. |
| 2 | **Merge records could be forged** by direct INSERT on `contact_merges`. | **Fixed in `0024`**: staff INSERT and its policy removed; `merge_contacts()` (owner) still writes them. |
| 3 | **Unaudited deletion** of `case_recruitment` rows and contact identities by staff. | **Fixed in `0024`**: staff DELETE revoked on both; identity inserts, updates and (system) deletes are audited. Correcting a wrong phone or email stays possible as an audited edit. |
| 4 | **Case deletion.** On inspection, `deleted_at` could not be misused: no staff session can soft-delete at all — the read policy hides deleted cases and PostgreSQL refuses an update whose writer could no longer see the row (even ADMIN). The only delete path is ADMIN/SUPER_ADMIN **hard** delete, which cascades the case's tasks, notes, recruitment details and **timeline** (the audit log keeps the case row). | **Guard added in `0024`** (setting/clearing `deleted_at` needs `cases.delete`, defence in depth). **Hard delete unchanged — pending a product/legal decision** (below). |
| 5 | **Application status** could be set to `converted` directly, or moved off `converted`. | **Fixed in `0024`**: staff reach `converted` only through `convert_job_application()`, and it is final — matching what the screens already assumed; for every writer, `converted` requires the case. |
| 6 | **Note visibility** could be changed by its author after writing (e.g. into a level they cannot read). | **Fixed in `0024`**: a note keeps the visibility it was written with; its text can still be corrected by its author. |
| — | **Stage and assignment permissions** (`cases.stage.change`, `cases.assign`) not enforced separately; stage/pipeline consistency unchecked. | **Pending — part of the stages work (`0025`)**, with its product decisions. |

### Pending product decisions

- **Case deletion.** Should ADMIN keep **hard** delete (needed for a data-erasure request, but it
  destroys the case's timeline and notes), or should deletion become a working **soft** delete — and
  then who may soft-delete, who can see and restore deleted cases, and how an erasure request is
  handled? The same question applies to contacts (`contacts.delete` hard-deletes a contact without
  cases, cascading its identities, notes, tasks and timeline).
- **Identity verification model for the portal.** `0024` enforces "staff never assert identity". Still
  to decide with the portal work: the verification flow itself (phone OTP via Supabase Auth, then a
  trusted function that links `auth_user` and stamps `verified_at`), and whether a staff member may ever
  *un*-verify or unlink an account (e.g. a lost phone) — today only the system can.

## Known limits

- The staff member's branch is read from the session token (`current_branch_id()`), as every RLS policy
  already does; after a staff member changes branch, it takes effect when their token refreshes (≤ 1 hour).
- `app.trusted_write`, like 0015's `app.invoice_trusted_transition`, relies on no API path letting a
  client set a server setting (PostgREST exposes none).
- A SUPER_ADMIN with no branch who creates a record without choosing a branch leaves it without one.
