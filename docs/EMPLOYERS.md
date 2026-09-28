# Employers (`0022`, Recruitment Operations increment 3)

An **employer** is the organisation a candidate is recruited *for*. It belongs to the existing
model — contact → recruitment case — and is not a new customer or case model.

| Where | What |
| --- | --- |
| `public.employers` | name, country, optional registration number and website, contact person, email, phone, status (`prospect` / `active` / `inactive`), notes, **branch (required)** |
| `case_recruitment.employer_id` | the employer a recruitment case is for (column from `0004`, foreign key added in `0022`) |
| `jobs.employer_id` | optional internal link. **Not public.** The listing still shows `employer_disclosure` + `employer_name` exactly as before |

Screens: `/admin/employers` (list, search, status filter), `/admin/employers/new`,
`/admin/employers/[id]` (details, linked jobs and cases you can see), `/admin/employers/[id]/edit`,
an employer picker on the job form and on the recruitment case page.

## The free-text employer name on jobs is unchanged

`employer_name` remains the public wording and is never derived from, or overwritten by, the linked
record. A confidential job keeps `employer_name` null while it may be linked internally. `anon` has no
column privilege on `jobs.employer_id` and none on `employers`. A job with no employer record behaves
exactly as before `0022`.

## Access — existing permissions only

| Permission | Seeded scopes (`0008`) |
| --- | --- |
| `employers.view` | ADMIN all · HR_MANAGER **all** · FINANCE_MANAGER all · OPERATIONS_MANAGER all · RECRUITER branch · ACCOUNTS branch · VIEW_ONLY branch |
| `employers.manage` | ADMIN all · HR_MANAGER **all** |

SUPER_ADMIN bypasses permission lookup. No permission or role was added or changed.

- RLS is `scope_allows(perm, branch_id, NULL)`. There is **no owner**, so the ownership hop described
  in `BRANCH-SCOPE-AUDIT.md` cannot arise here: a branch-scoped holder reads and writes its own branch
  only, and can neither create an employer in nor move one to another branch.
- No DELETE for staff (no policy, no privilege). An employer is made inactive; foreign keys `ON DELETE
  RESTRICT` keep a linked employer from being removed even by the server.
- Linking a job or case: the job's or case's own policy decides whether you may edit it (as before);
  `employer_link_guard` adds that you may link only an employer you can see.
- `created_by` / `created_at` are not writable by staff; `created_by` is set to the creator.
- The same name in the same country is one employer (case- and space-insensitive unique index).

**HR Manager note.** The seed gives HR_MANAGER `employers.view` and `employers.manage` at **all** scope
(like `jobs.*`), so careers@ sees and manages employers of every branch. HR Manager's *case* access stays
branch-scoped: they can link an employer only to cases in their own branch. Narrowing HR's employer
scope to `branch` would be a `role_permissions` change and needs an explicit decision.

## Audit

| Change | Entry |
| --- | --- |
| employer created / edited | `employers.insert` / `employers.update` (old and new rows) |
| job linked / changed / unlinked | `job.employer_linked` / `job.employer_changed` / `job.employer_unlinked` (employer id and name); `jobs_audit` also records `job.updated` |
| case linked / changed / unlinked | `case.employer_*` (employer id and name) **and** a timeline entry on the case |

## Promoting `0022` to production — what it changes

Additive only; no existing row's values change and no data is written.

- creates the `employer_status` type, the empty `employers` table, its triggers, policies and grants;
- adds the nullable `jobs.employer_id` column (every existing job gets NULL — `employer_name` untouched),
  its foreign key and a partial index;
- adds the foreign key and a partial index on `case_recruitment.employer_id`;
- **guard:** refuses to run if any `case_recruitment.employer_id` is already non-null (they could point at
  nothing). Applications converted through `0013` never set it. Run a read-only preflight on production
  first: `select count(*) from public.case_recruitment where employer_id is not null;` must be 0.

Rollback SQL is in the header of `supabase/migrations/0022_employers.sql`.

Tests: `supabase/tests/employers.test.sql` (54 assertions), `lib/crm/employers.test.ts`,
`lib/jobs/jobs.test.ts` (public select), `lib/admin/actions-guard.test.ts`, `tests/e2e/guard.spec.ts`.
