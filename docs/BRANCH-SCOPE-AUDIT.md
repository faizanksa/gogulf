# Branch-scope audit — ownership bypasses branch isolation

**28 September 2026.** Read-only audit, prompted by the contact scope-hop found and closed in `0021`.
**Nothing in cases, tasks, notes or applications has been changed.** The fix is scheduled for
Recruitment Operations increment 4 (`0023`).

## The mechanism

Every staff write policy uses `scope_allows(perm, row_branch, row_owner)` (`0006`):

```
has_perm(perm, 'all')
or (has_perm(perm, 'branch') and row_branch = current_branch_id())
or (has_perm(perm, 'own')    and row_owner  = current_staff_id())
```

`has_perm(perm, 'own')` is true for **anyone holding the permission at any scope**, and the `own`
clause does not look at the branch at all. So for a row the caller owns — `owner_id`, `assignee_id` or
`created_by`, depending on the table — the policy passes **whatever its branch**. In a `WITH CHECK`,
that means a branch-scoped person can set `branch_id` to another branch as long as they (still) own
the row, and can create rows directly in another branch owned by themselves. The row stays visible to
them through the same clause, so PostgreSQL's "the updated row must stay visible" rule does not stop
it either.

## Evidence

Probed on the local disposable database (all `0001`–`0021`), acting as each role, in one transaction
that was rolled back. A second branch was created for the probe.

| Path | Role (scope) | Result |
| --- | --- | --- |
| Case: take ownership of a Lucknow case, then move it to another branch | HR Manager (branch) | **succeeded** (both steps) |
| Case: move a case you own to another branch | Recruiter (own) | **succeeded** |
| Case: create a case directly in another branch, owner = self | Recruiter (own) | **succeeded** |
| Task: assign a Lucknow task to self, then move it to another branch | HR Manager (branch) | **succeeded** (both steps) |
| Task: create a task in another branch assigned to self | Recruiter (own) | **succeeded** |
| Task: rewrite `created_by` (spoof who created it) | HR Manager (branch) | **succeeded** |
| Application: assign to self, then move it to another branch | HR Manager (branch) | **succeeded** (both steps) |
| Contact: **create** a contact in another branch owned by self | Recruiter (own) | **succeeded** (the `0021` guard covers updates only) |
| Invoice: create a draft directly in another branch (`created_by` = self) | Accounts (branch) | **succeeded** |
| Note: author re-attaches own note to a contact in another branch | Recruiter (own) | refused — the moved note would no longer be visible to its author |
| Contact: move an owned contact to another branch | Recruiter (own) | refused — `0021` guard |

Not affected: **notes** (the implicit visibility check blocks moves outside the author's scope; `visibility`
is not writable), **activities** (append-only, no branch column — they follow the contact),
`case_recruitment` (inherits the case's check), **jobs** (every holder of `jobs.manage` is all-scope
today, and `created_by` is frozen by trigger), `created_by` on **invoices** and **jobs** (frozen by
trigger). `job_applications` INSERT is the public form's only; staff cannot insert.

## Exposure today

Low in practice, not zero in design. **Production and staging each have one branch (Lucknow)**, and
`branch_id` must reference an existing branch, so there is nowhere to move a record to yet. The one
branch-scoped account in production is `careers@` (HR Manager). The gap becomes live the moment a second
branch is added — it must be closed before then.

## Minimum fix, for increment 4 (`0023`)

Write-side only; no change to `scope_allows` or to any read policy (a change there would alter what
own-scope roles such as Recruiter can *see* everywhere — a far larger blast radius than needed).

1. **One shared guard**, `SECURITY INVOKER` like `contacts_guard` (it must see `current_user` to tell a
   staff session from a definer function or the server), attached `BEFORE INSERT OR UPDATE OF branch_id`
   to `cases`, `tasks`, `job_applications`, `invoices`, `contacts` (INSERT; UPDATE is already guarded) and
   `jobs` (for future non-all-scope holders). For a staff session: if the row's branch is not the
   caller's own branch — on insert, or when `branch_id` changes on update — require the table's
   permission **at `all` scope** (`cases.update`/`cases.create`, `tasks.manage`, `applications.screen`,
   `invoices.issue`, `contacts.create`, `jobs.manage`), else refuse with `42501`. Ownership never
   carries a record across branches.
2. **`tasks.created_by` becomes provenance**: set to the caller on insert and kept on update, as
   `jobs` and `invoices` already do.
3. **Regression tests** (a new SQL suite, in the style of `contact-merge.test.sql`): every "succeeded"
   row above must be refused for branch-scoped and own-scoped roles, with all-scope ADMIN as the
   positive control; plus the owner-hijack two-step for cases, tasks and applications.

Taking ownership *within* the branch (step one of the hijack) stays allowed: it is legitimate for an
HR Manager to assign a case or task in their own branch to themselves. What the fix removes is the
second step — carrying it out of the branch.
