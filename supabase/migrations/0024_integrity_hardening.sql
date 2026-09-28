-- =============================================================================
-- 0024 — Security and data-integrity hardening (after 0023; before the stages/tasks work,
-- which moves to 0025). Closes the findings recorded in docs/BRANCH-SCOPE-HARDENING.md that
-- need no product decision. Additive: no existing row is changed.
--
--   1. Portal identity is not staff-assertable. A candidate's portal session becomes a
--      contact through an `auth_user` identity (current_contact_id, 0006); a verified
--      identity is what the portal will trust. Staff sessions may no longer create, change,
--      move or remove an `auth_user` identity, set or change `verified_at`, or move any
--      identity to another contact. Editing a verified value clears its verification.
--      Linking and verifying are left to trusted server paths (a future OTP sign-in flow via
--      the service role or a SECURITY DEFINER function) and to merge_contacts.
--   2. Merge records come only from merge_contacts(): staff lose INSERT on contact_merges.
--   3. No silent destruction of recruitment history: staff lose DELETE on
--      case_recruitment and contact_identities, and identity changes are audited.
--   4. Soft-deleting a case (setting or clearing deleted_at) needs cases.delete — until
--      now any cases.update holder could hide a case from everyone. Hard delete is NOT
--      changed here: it is a product/legal decision (see the doc).
--   5. `converted` is reached only by convert_job_application(), and is final: staff can
--      neither set it directly nor move a converted application back. A converted
--      application always has its case.
--   6. A note keeps the visibility it was written with.
--
-- Trusted paths are unchanged: merge_contacts (SECURITY DEFINER) and the service role are
-- not staff sessions; convert_job_application vouches for its own writes (0023).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Identities: portal link and verification are not staff-assertable.
-- -----------------------------------------------------------------------------
-- SECURITY INVOKER: current_user is 'authenticated' for any staff API write, including the
-- identities conversion inserts (which are unverified phone/email and pass).
create or replace function public.contact_identities_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- A changed value is a different identity: whatever verified the old one does not carry over.
  if tg_op = 'UPDATE' and (new.value_raw is distinct from old.value_raw or new.type is distinct from old.type) then
    new.verified_at := null;
  end if;

  if current_user <> 'authenticated' then
    return new;
  end if;

  if new.type = 'auth_user' or (tg_op = 'UPDATE' and old.type = 'auth_user') then
    raise exception 'identity_portal_link_reserved: only the sign-in flow links a portal account to a contact'
      using errcode = 'insufficient_privilege';
  end if;
  if new.verified_at is not null and (tg_op = 'INSERT' or new.verified_at is distinct from old.verified_at) then
    raise exception 'identity_verification_reserved: only a verification flow marks an identity verified'
      using errcode = 'insufficient_privilege';
  end if;
  if tg_op = 'UPDATE' and new.contact_id is distinct from old.contact_id then
    raise exception 'identity_parent_locked: an identity moves to another contact only by merging contacts'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists contact_identities_guard_trg on public.contact_identities;
create trigger contact_identities_guard_trg
  before insert or update on public.contact_identities
  for each row execute function public.contact_identities_guard();

-- -----------------------------------------------------------------------------
-- 2. Merge records only from merge_contacts().
-- -----------------------------------------------------------------------------
drop policy if exists "staff create merges" on public.contact_merges;
revoke insert on table public.contact_merges from authenticated;

-- -----------------------------------------------------------------------------
-- 3. No silent deletion of recruitment details or identities; identities are audited.
-- -----------------------------------------------------------------------------
revoke delete on table public.case_recruitment from authenticated;
revoke delete on table public.contact_identities from authenticated;

drop trigger if exists audit_contact_identities on public.contact_identities;
create trigger audit_contact_identities
  after insert or update or delete on public.contact_identities
  for each row execute function public.audit_table_change();

-- -----------------------------------------------------------------------------
-- 4. Soft delete is a delete: it needs cases.delete.
-- -----------------------------------------------------------------------------
create or replace function public.cases_soft_delete_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'authenticated'
     and (tg_op = 'INSERT' and new.deleted_at is not null
          or tg_op = 'UPDATE' and new.deleted_at is distinct from old.deleted_at)
     and not public.has_perm('cases.delete', 'all') then
    raise exception 'case_delete_requires_permission: removing or restoring a case needs cases.delete'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

drop trigger if exists cases_soft_delete_guard_trg on public.cases;
create trigger cases_soft_delete_guard_trg
  before insert or update of deleted_at on public.cases
  for each row execute function public.cases_soft_delete_guard();

-- -----------------------------------------------------------------------------
-- 5. `converted` belongs to conversion.
-- -----------------------------------------------------------------------------
create or replace function public.job_applications_status_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;
  -- For every writer: a converted application has its case.
  if new.status = 'converted' and new.case_id is null then
    raise exception 'application_converted_needs_case: an application is converted together with its case'
      using errcode = 'check_violation';
  end if;
  if public.untrusted_staff_write() then
    if new.status = 'converted' then
      raise exception 'application_convert_via_conversion: convert the application to mark it converted'
        using errcode = 'check_violation';
    end if;
    if old.status = 'converted' then
      raise exception 'application_converted_is_final: a converted application stays converted'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists job_applications_status_guard_trg on public.job_applications;
create trigger job_applications_status_guard_trg
  before update of status on public.job_applications
  for each row execute function public.job_applications_status_guard();

-- -----------------------------------------------------------------------------
-- 6. A note keeps its visibility.
-- -----------------------------------------------------------------------------
create or replace function public.notes_visibility_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'authenticated' and new.visibility is distinct from old.visibility then
    raise exception 'note_visibility_locked: a note keeps the visibility it was written with'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists notes_visibility_guard_trg on public.notes;
create trigger notes_visibility_guard_trg
  before update of visibility on public.notes
  for each row execute function public.notes_visibility_guard();

revoke execute on function
  public.contact_identities_guard(),
  public.cases_soft_delete_guard(),
  public.job_applications_status_guard(),
  public.notes_visibility_guard()
from public, anon, authenticated;
