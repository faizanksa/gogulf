# Branch-scope hardening — `0023` (Recruitment Operations, increment 4a)

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
| **case_recruitment** | under the case's policy — unchanged | unchanged; employer link guarded (0022) | no branch (inherits case) | before: `case_id` writable → **after: fixed** | DELETE allowed under cases.update — **unchanged, reported** | `created_at` frozen |
| **tasks** | before: any branch if assignee = self; `created_by` forgeable → **after: branch from case → contact; free-standing tasks own branch only; parent must be visible; case must belong to contact** | unchanged | before: assignee could move → **after: follows parent; a different branch is refused** | before: any `case_id`/`contact_id` → **after: visible parents only, re-derived** | before: assignee could DELETE (unaudited) → **after: no DELETE; cancel** | `created_by` set and frozen; `completed_by`/`completed_at` set by the database |
| **notes** | author = self (unchanged); before: `case_id` unchecked, `branch_id` free text → **after: case must be visible and belong to the contact; branch derived** | author only (unchanged) | derived, follows parent | before: author could re-attach (stopped only by visibility) → **after: fixed** | no DELETE policy (unchanged) | `author_id` = self (RLS); `created_at` frozen |
| **job_applications** | public form only (unchanged) | status, assignee (unchanged) | before: assignee could move → **after: all scope only** | before: `contact_id`/`case_id` settable to any visible row → **after: conversion only** | none | no creator column |
| **invoices** | before: any branch (created_by = self) → **after: own branch only**; contact/case must be visible and agree | unchanged (0015 lifecycle) | **after: all scope only** | draft only (0015) — **after: visible and consistent** | none | frozen since 0015 |
| **jobs** | before: any branch (created_by = self) → **after: own branch only** (every current holder of `jobs.manage` is all-scope) | unchanged | **after: all scope only** | employer link guarded (0022) | none (archive) | frozen since 0012 |
| **employers** | RLS `scope_allows(…, branch, NULL)` — no owner hop (0022) | — | RLS | — | none | frozen (0022) |
| **activities** | before: any staff could insert (any verb, any wording, as themselves) → **after: none — database functions only** | append-only | — | — | append-only | — |
| **contact_merges** | direct INSERT by any `contacts.merge` holder — **unchanged, reported** | append-only | — | — | append-only | — |
| **contact_identities** | under `contacts.update` of the contact — **`verified_at` writable, reported** | same | — | same | same, unaudited — **reported** | — |

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

## Found, not fixed — need a decision

1. **Identity verification is writable by staff.** Anyone with `contacts.update` on a contact can add an
   identity or set `verified_at` / `is_shared`. A verified identity is what will let a person sign in to
   the candidate portal, so this becomes an account-takeover path when the portal goes live. Decide who
   may verify an identity (OTP only?) before the portal opens.
2. **Merge records can be forged.** Any `contacts.merge` holder can insert a `contact_merges` row
   directly, bypassing `merge_contacts()`. No screen does; the fix is to revoke staff INSERT.
3. **Unaudited deletions**: `case_recruitment` rows and contact identities can be deleted by staff who
   may edit the case/contact, with no audit entry.
4. **Case hard delete** (ADMIN) deletes the case's tasks, notes and timeline with it (`deleted_at` exists).
5. **Stage and assignment permissions** (`cases.stage.change`, `cases.assign`) are not enforced
   separately from `cases.update`; stage/pipeline consistency is not checked. Planned for `0024`.
6. **Application status** can be set to `converted` directly, without converting (no case is created,
   and since `0023` no timeline entry either).
7. **Note visibility** can be changed by the author after writing (e.g. `team` → `hr_private`).

## Known limits

- The staff member's branch is read from the session token (`current_branch_id()`), as every RLS policy
  already does; after a staff member changes branch, it takes effect when their token refreshes (≤ 1 hour).
- `app.trusted_write`, like 0015's `app.invoice_trusted_transition`, relies on no API path letting a
  client set a server setting (PostgREST exposes none).
- A SUPER_ADMIN with no branch who creates a record without choosing a branch leaves it without one.
