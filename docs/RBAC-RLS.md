# RBAC & RLS

Authorization exists at three layers. Two of them are advisory; one is real.

| Layer | Purpose | If it fails |
| --- | --- | --- |
| UI — hide what the user cannot do | Usability | User sees a button that errors. Annoying |
| Server — re-check every mutation | Correctness | Bug reaches the database layer |
| **Database — RLS** | **Security** | **Data breach** |

**Hiding a button is not authorization.** Every server action re-checks permission independently,
and RLS re-checks it again underneath.

---

## 1. Model

- **Permission** — a capability string, e.g. `contacts.view`. Seeded by migration, never created
  ad hoc: a permission string no policy references is a security illusion.
- **Scope** — `all` | `branch` | `own`, stored on the **grant**, not baked into the name.
- **Role** — a named bundle of (permission, scope) grants.
- **`user_roles`** may pin a role to a branch, so one person can be HR_MANAGER for Lucknow only.

Scope on the grant means `RECRUITER` holds `contacts.view @ own`, `HR_MANAGER` holds
`contacts.view @ branch`, `ADMIN` holds `contacts.view @ all` — one permission string, three
behaviours, instead of an unmaintainable `contacts.view.own` / `.branch` / `.all` explosion.

---

## 2. Roles

| Key | Label | Shape of access |
| --- | --- | --- |
| `SUPER_ADMIN` | Super Admin | Everything. Bypasses permission checks; all actions audited |
| `ADMIN` | Admin | Everything operational. **Not** roles, permissions or integrations |
| `HR_MANAGER` | HR Manager | Recruitment at branch scope; verifies documents; sees HR-private notes |
| `RECRUITER` | Recruiter | Assigned candidates only. Cannot verify documents |
| `TRAVEL_MANAGER` | Travel Manager | Travel at branch scope |
| `TRAVEL_AGENT` | Travel Agent | Assigned travel customers only |
| `FINANCE_MANAGER` | Finance Manager | All money. Approves refunds. **No identity documents** |
| `ACCOUNTS` | Accounts | Money at branch scope. Creates but cannot approve refunds |
| `OPERATIONS_MANAGER` | Operations Manager | Cross-module case and task oversight; no finance writes |
| `SUPPORT_AGENT` | Support Agent | Communications and case visibility. No money, no identity documents |
| `MARKETING_MANAGER` | Marketing Manager | Campaigns, sources, aggregate reporting. **No documents, no payments** |
| `VIEW_ONLY` | View Only | Read at branch scope. No mutations anywhere |

---

## 3. Permission matrix

**A** = all · **B** = branch · **O** = own/assigned · **✓** = unscoped capability · **–** = denied

| Permission | SA | AD | HRM | REC | TVM | TVA | FIN | ACC | OPS | SUP | MKT | VO |
| --- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| `contacts.view` | A | A | B | O | B | O | A | B | B | B | B | B |
| `contacts.create` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | – | – | ✓ | ✓ | ✓ | – |
| `contacts.update` | A | A | B | O | B | O | – | – | B | O | – | – |
| `contacts.delete` | A | A | – | – | – | – | – | – | – | – | – | – |
| `contacts.merge` | A | A | B | – | B | – | – | – | B | – | – | – |
| `contacts.assign` | A | A | B | – | B | – | – | – | B | – | – | – |
| `contacts.export` | A | A | – | – | – | – | – | – | – | – | – | – |
| `notes.team.view` | A | A | B | O | B | O | B | B | B | B | – | B |
| `notes.team.create` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | – | – |
| `notes.hr_private.view` | A | A | B | – | – | – | – | – | – | – | – | – |
| `notes.finance_private.view` | A | A | – | – | – | – | A | B | – | – | – | – |
| `tags.manage` | ✓ | ✓ | ✓ | – | ✓ | – | – | – | ✓ | – | ✓ | – |
| `cases.view` | A | A | B | O | B | O | A | B | B | B | – | B |
| `cases.create` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | – | – | ✓ | ✓ | – | – |
| `cases.update` | A | A | B | O | B | O | – | – | B | – | – | – |
| `cases.stage.change` | A | A | B | O | B | O | – | – | B | – | – | – |
| `cases.assign` | A | A | B | – | B | – | – | – | B | – | – | – |
| `cases.close` | A | A | B | – | B | – | – | – | B | – | – | – |
| `cases.delete` | A | A | – | – | – | – | – | – | – | – | – | – |
| `jobs.view` | A | A | A | A | – | – | – | – | A | A | A | A |
| `jobs.manage` | ✓ | ✓ | ✓ | – | – | – | – | – | ✓ | – | – | – |
| `employers.view` | A | A | A | B | – | – | A | B | A | – | – | B |
| `employers.manage` | ✓ | ✓ | ✓ | – | – | – | – | – | – | – | – | – |
| `applications.screen` | A | A | B | O | – | – | – | – | B | – | – | – |
| `interviews.manage` | A | A | B | O | – | – | – | – | B | – | – | – |
| `offers.manage` | A | A | B | – | – | – | – | – | B | – | – | – |
| `travel.manage` | A | A | – | – | B | O | – | – | B | – | – | – |
| `bookings.view` | A | A | – | – | B | O | A | B | B | B | – | B |
| `bookings.manage` | A | A | – | – | B | O | – | – | B | – | – | – |
| `suppliers.manage` | ✓ | ✓ | – | – | ✓ | – | – | – | ✓ | – | – | – |
| `documents.view.identity` | A | A | B | O | B | O | – | – | B | – | – | – |
| `documents.view.employment` | A | A | B | O | B | O | – | – | B | B | – | – |
| `documents.view.financial` | A | A | – | – | – | – | A | B | B | – | – | – |
| `documents.view.travel` | A | A | B | O | B | O | – | – | B | B | – | – |
| `documents.view.medical` | A | A | B | – | – | – | – | – | B | – | – | – |
| `documents.upload` | A | A | B | O | B | O | B | B | B | B | – | – |
| `documents.verify` | A | A | B | – | B | – | – | – | B | – | – | – |
| `documents.download` | A | A | B | O | B | O | B | B | B | – | – | – |
| `documents.delete` | A | A | – | – | – | – | – | – | – | – | – | – |
| `orders.view` | A | A | B | O | B | O | A | B | B | B | – | B |
| `orders.create` | ✓ | ✓ | ✓ | – | ✓ | – | ✓ | ✓ | – | – | – | – |
| `payments.view` | A | A | B | O | B | O | A | B | B | B | – | B |
| `payments.record` | ✓ | ✓ | – | – | – | – | ✓ | ✓ | – | – | – | – |
| `installments.manage` | A | A | – | – | – | – | A | B | – | – | – | – |
| `refunds.create` | ✓ | ✓ | – | – | – | – | ✓ | ✓ | – | – | – | – |
| `refunds.approve` | ✓ | ✓ | – | – | – | – | ✓ | – | – | – | – | – |
| `invoices.view` | A | A | B | – | B | – | A | B | B | – | – | B |
| `invoices.issue` | ✓ | ✓ | – | – | – | – | ✓ | ✓ | – | – | – | – |
| `invoices.void` | ✓ | ✓ | – | – | – | – | ✓ | – | – | – | – | – |
| `payments.reconcile` | ✓ | ✓ | – | – | – | – | ✓ | ✓ | – | – | – | – |
| `communications.view` | A | A | B | O | B | O | B | B | B | B | – | B |
| `communications.send` | A | A | B | O | B | O | B | B | B | B | – | – |
| `whatsapp.reply` | A | A | B | O | B | O | – | – | B | B | – | – |
| `calls.view` | A | A | B | O | B | O | – | – | B | B | – | B |
| `calls.log` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | – | – | ✓ | ✓ | – | – |
| `templates.manage` | ✓ | ✓ | ✓ | – | ✓ | – | – | – | ✓ | – | ✓ | – |
| `campaigns.manage` | ✓ | ✓ | – | – | – | – | – | – | – | – | ✓ | – |
| `lead_sources.manage` | ✓ | ✓ | – | – | – | – | – | – | ✓ | – | ✓ | – |
| `tasks.view` | A | A | B | O | B | O | B | B | B | O | O | B |
| `tasks.manage` | A | A | B | O | B | O | B | B | A | O | O | – |
| `appointments.manage` | A | A | B | O | B | O | – | – | B | O | – | – |
| `reports.operational` | A | A | B | O | B | O | A | B | A | B | B | B |
| `reports.financial` | A | A | – | – | – | – | A | B | – | – | – | – |
| `reports.marketing` | A | A | B | – | B | – | – | – | B | – | A | B |
| `reports.staff_performance` | A | A | B | – | B | – | – | – | B | – | – | – |
| `imports.run` | ✓ | ✓ | ✓ | – | ✓ | – | – | – | ✓ | – | ✓ | – |
| `users.manage` | ✓ | ✓ | – | – | – | – | – | – | – | – | – | – |
| `roles.manage` | ✓ | – | – | – | – | – | – | – | – | – | – | – |
| `permissions.manage` | ✓ | – | – | – | – | – | – | – | – | – | – | – |
| `settings.manage` | ✓ | ✓ | – | – | – | – | – | – | – | – | – | – |
| `integrations.manage` | ✓ | – | – | – | – | – | – | – | – | – | – | – |
| `audit.view` | ✓ | ✓ | – | – | – | – | ✓ | – | – | – | – | – |

**68 permissions across 12 roles.**

### The denials that carry weight

| Denial | Reason |
| --- | --- |
| `FINANCE_MANAGER` / `ACCOUNTS` → `documents.view.identity` | Finance never needs to open a passport. Required explicitly by the brief |
| `FINANCE_MANAGER` / `ACCOUNTS` → `notes.hr_private.view` | HR assessments are not finance's business |
| `HR_MANAGER` → `documents.view.financial` | Symmetric: HR does not need bank statements or receipts |
| `MARKETING_MANAGER` → any document, any payment | Marketing works with aggregates and campaigns, not candidate PII |
| `SUPPORT_AGENT` → `documents.view.identity`, all finance writes | Support answers questions; it does not handle passports or money |
| `RECRUITER` → `documents.verify` | Separation of duties — whoever progresses a candidate does not also approve their documents |
| `ACCOUNTS` → `refunds.approve` | Two-person rule. Accounts raises, Finance approves |
| `ADMIN` → `roles.manage`, `permissions.manage`, `integrations.manage` | Privilege-escalation guard. Only SUPER_ADMIN changes who can do what |
| Everyone except SA/AD → `contacts.export` | Bulk PII extraction is the single highest-impact insider risk |
| **Everyone** → `audit_logs` UPDATE/DELETE | No policy exists, for any role including SUPER_ADMIN |

---

## 4. Implementation

The JWT carries **identity only**. Permissions resolve live in the database.

The Phase 0 audit proposed baking the full permission set into the token for RLS performance. That
was wrong: it creates a revocation lag of up to the token lifetime, so a dismissed employee retains
access for the rest of their session. Corrected here.

```sql
-- Injected at token issue: staff_id, role, branch. Small and stable.
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb language plpgsql stable as $$
declare claims jsonb; su record;
begin
  select id, role_key, branch_id, is_active into su
  from public.staff_users where auth_user_id = (event->>'user_id')::uuid;

  claims := event->'claims';
  if su.id is not null and su.is_active then
    claims := jsonb_set(claims, '{app_staff_id}', to_jsonb(su.id));
    claims := jsonb_set(claims, '{app_role}',     to_jsonb(su.role_key));
    claims := jsonb_set(claims, '{app_branch}',   to_jsonb(su.branch_id));
  end if;
  return jsonb_set(event, '{claims}', claims);
end; $$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook from authenticated, anon, public;
grant all on table public.staff_users to supabase_auth_admin;
revoke all on table public.staff_users from authenticated, anon, public;

-- Permission check: live against the DB. Postgres caches a STABLE function
-- per statement, so a list query evaluates this once, not once per row.
create or replace function public.has_perm(perm text, required_scope text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.staff_users su
    join public.role_permissions rp on rp.role_key = su.role_key
    join public.permissions p       on p.id = rp.permission_id
    where su.id = (nullif(auth.jwt() ->> 'app_staff_id',''))::uuid
      and su.is_active                       -- deactivation takes effect immediately
      and p.key = perm
      and case required_scope
            when 'own'    then rp.scope in ('own','branch','all')
            when 'branch' then rp.scope in ('branch','all')
            else               rp.scope = 'all'
          end
  );
$$;

create or replace function public.current_staff_id() returns uuid
language sql stable as $$ select nullif(auth.jwt() ->> 'app_staff_id','')::uuid $$;

create or replace function public.current_branch_id() returns uuid
language sql stable as $$ select nullif(auth.jwt() ->> 'app_branch','')::uuid $$;

create or replace function public.current_contact_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select ci.contact_id from public.contact_identities ci
  where ci.type = 'auth_user' and ci.value_normalized = auth.uid()::text
$$;
```

`su.is_active` inside `has_perm` is the detail that matters: deactivating a staff row revokes access
on their **next query**, not when their token expires.

---

## 5. Policy templates

Every business table carries `owner_id` and `branch_id`, so one template covers the estate.

```sql
-- STAFF READ
create policy "staff read contacts" on contacts for select to authenticated
using (
  deleted_at is null and (
       has_perm('contacts.view','all')
    or (has_perm('contacts.view','branch') and branch_id = current_branch_id())
    or (has_perm('contacts.view','own')    and owner_id  = current_staff_id())
  )
);

-- STAFF UPDATE — note the WITH CHECK
create policy "staff update contacts" on contacts for update to authenticated
using (
       has_perm('contacts.update','all')
    or (has_perm('contacts.update','branch') and branch_id = current_branch_id())
    or (has_perm('contacts.update','own')    and owner_id  = current_staff_id())
)
with check (
  -- Without this, a branch-scoped user could reassign a record to another
  -- branch and thereby move data outside the scope that protects it.
       has_perm('contacts.update','all')
    or (has_perm('contacts.update','branch') and branch_id = current_branch_id())
);

-- DOCUMENTS — permission is per category
create policy "staff read documents" on documents for select to authenticated
using (
  deleted_at is null
  and has_perm('documents.view.' || category::text, 'all')
  or (has_perm('documents.view.' || category::text, 'branch') and branch_id = current_branch_id())
  or (has_perm('documents.view.' || category::text, 'own')
      and exists (select 1 from cases c where c.id = documents.case_id
                    and c.owner_id = current_staff_id()))
);

-- NOTES — visibility is part of the predicate
create policy "staff read notes" on notes for select to authenticated
using (
  case visibility
    when 'team'            then has_perm('notes.team.view','branch')
    when 'hr_private'      then has_perm('notes.hr_private.view','branch')
    when 'finance_private' then has_perm('notes.finance_private.view','branch')
    else false
  end
);

-- CUSTOMER — deliberately simple, so it is easy to prove correct
create policy "customer reads own cases" on cases for select to authenticated
using (contact_id = current_contact_id());

create policy "customer reads own documents" on documents for select to authenticated
using (contact_id = current_contact_id() and deleted_at is null);

create policy "customer reads own payments" on payments for select to authenticated
using (exists (select 1 from orders o
               where o.id = payments.order_id and o.contact_id = current_contact_id()));

-- AUDIT — the absence of policies IS the control
alter table audit_logs enable row level security;
create policy "read audit" on audit_logs for select to authenticated
  using (has_perm('audit.view','all'));
-- No INSERT policy: writes come only from SECURITY DEFINER triggers.
-- No UPDATE policy. No DELETE policy. For anyone. Ever.
```

---

## 6. Test matrix

Written in Phase 1, run in CI on every PR, and a release gate for Phase 14. Each row asserts both
**allow** and **deny**.

| # | Assertion |
| --- | --- |
| 1 | Customer A cannot read Customer B's cases, documents, payments or communications — by direct query, by guessed id, and through every API route |
| 2 | `RECRUITER` cannot read a contact owned by another recruiter |
| 3 | `HR_MANAGER` in branch X reads zero rows from branch Y |
| 4 | `ACCOUNTS` receives **zero rows** from `documents` where `category = 'identity'` |
| 5 | `MARKETING_MANAGER` receives zero rows from `payments` and `documents` |
| 6 | `VIEW_ONLY` is rejected on every mutation — at the route **and** at the database |
| 7 | `ADMIN` cannot grant themselves `roles.manage` |
| 8 | No role can `UPDATE` or `DELETE` `audit_logs` |
| 9 | Anonymous requests reach nothing but published jobs and marketing content |
| 10 | A staff row set `is_active = false` loses access on the **next query**, without waiting for token expiry |
| 11 | A branch-scoped user cannot move a record to another branch (the `with check` clause) |
| 12 | `ACCOUNTS` cannot approve a refund they created |
| 13 | A customer's portal session cannot read `notes` of any visibility |
| 14 | Signed URLs cannot be minted for a document outside the caller's permitted category |
