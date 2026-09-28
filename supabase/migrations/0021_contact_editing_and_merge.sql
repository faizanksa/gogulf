-- =============================================================================
-- 0021 — Contact editing and merging (Recruitment Operations, increment 2).
--
-- Builds on the existing model: contacts, contact_identities (globally unique per
-- type + value, one primary per type), contact_merges (snapshot) and
-- contacts.merged_into_id. No new contact model.
--
-- EDITING
--
--   1. Staff may UPDATE only the editable columns of contacts. Until now the privilege
--      was table-wide, so anyone holding contacts.update could also write merged_into_id
--      (fake or undo a merge), the identity-synced primary email/phone, consent_updated_at,
--      the legal hold or the soft-delete marker. RLS still decides WHICH rows.
--   2. contacts_guard (BEFORE UPDATE), for staff sessions:
--        * a merged contact is read-only;
--        * changing the owner or the branch needs contacts.assign (RLS still decides
--          which branch: a branch-scoped role cannot move a contact out of its branch);
--        * a consent change stamps consent_updated_at.
--      The trigger does nothing when the writer is not a staff session (the owner of a
--      SECURITY DEFINER function such as merge_contacts, or the service role).
--
-- MERGING — public.merge_contacts(p_survivor, p_merged, p_reason) → contact_merges.id
--
--   One transaction: any error undoes all of it. Refuses: a contact into itself; an
--   already-merged contact (unless it is this exact merge being retried — then the
--   original merge id is returned and nothing changes); a merged survivor; either
--   contact outside the caller's contacts.merge scope; and contacts in DIFFERENT
--   branches unless the caller holds contacts.merge at ALL scope.
--
--   Relationships, deliberately not all the same:
--     identities            moved; a primary is demoted if the survivor has one of that type
--     job_applications      moved
--     cases                 moved (audited by audit_cases)
--     notes, tasks          moved
--     activities            moved — the timeline is about the person; rows are not
--                           otherwise changed, and their ids are kept in the snapshot
--     invoices, DRAFT       moved — a draft is a working document
--     invoices, issued+     NOT touched — frozen by design once issued (0015)
--     payments              NOT touched — provider-confirmed records, written only by
--                           the server; still reachable through merged_into_id
--     earlier merges        contacts merged INTO the merged contact are re-pointed to
--                           the survivor, so merged_into_id always names an active contact
--   The survivor keeps its own details and consents (consent is never combined or
--   manufactured); its legal hold becomes the later of the two, and last_activity_at the
--   later of the two. The merged contact keeps its row, read-only, with merged_into_id.
--
--   Audit: the contact_merges row carries a full snapshot (both contacts before, the
--   merged contact's identities, every moved and untouched id); a 'contacts.merged' audit
--   entry; the contacts updates are audited by audit_contacts; a 'contact.merged' activity
--   on the survivor's timeline.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Column-level UPDATE for staff.
-- -----------------------------------------------------------------------------
revoke update on table public.contacts from authenticated;
grant update (
  full_name, display_name, lifecycle_stage, owner_id, branch_id,
  country_code, nationality, preferred_language, date_of_birth, gender,
  consent_email, consent_whatsapp, consent_sms, consent_calls, consent_marketing,
  notes_summary
) on table public.contacts to authenticated;

-- -----------------------------------------------------------------------------
-- 2. The edit guard.
-- -----------------------------------------------------------------------------
-- SECURITY INVOKER on purpose: current_user is then the role that issued the UPDATE —
-- 'authenticated' for a staff edit through the API, the function owner inside a SECURITY
-- DEFINER function such as merge_contacts, 'service_role' for the server. (A definer trigger
-- would always see its own owner and could not tell them apart.)
create or replace function public.contacts_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'authenticated' then
    if old.merged_into_id is not null then
      raise exception 'contact_merged: this contact was merged into another and is read-only'
        using errcode = 'check_violation';
    end if;

    if (new.owner_id is distinct from old.owner_id or new.branch_id is distinct from old.branch_id)
       and not public.has_perm('contacts.assign', 'own') then
      raise exception 'contacts_assign_required: changing the owner or branch needs contacts.assign'
        using errcode = 'insufficient_privilege';
    end if;

    -- A contact leaves a branch only by all-scope staff. RLS alone lets a branch-scoped
    -- person who OWNS a contact move it anywhere (scope_allows accepts ownership on its
    -- own), which would let records hop out of a branch.
    if new.branch_id is distinct from old.branch_id
       and new.branch_id is distinct from public.current_branch_id()
       and not public.has_perm('contacts.assign', 'all') then
      raise exception 'cross_branch_move_requires_all_scope: only all-scope staff move a contact to another branch'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  if (new.consent_email, new.consent_whatsapp, new.consent_sms, new.consent_calls, new.consent_marketing)
     is distinct from
     (old.consent_email, old.consent_whatsapp, old.consent_sms, old.consent_calls, old.consent_marketing) then
    new.consent_updated_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists contacts_guard_trg on public.contacts;
create trigger contacts_guard_trg
  before update on public.contacts
  for each row execute function public.contacts_guard();

-- -----------------------------------------------------------------------------
-- 3. merge_contacts
-- -----------------------------------------------------------------------------
create or replace function public.merge_contacts(p_survivor uuid, p_merged uuid, p_reason text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  staff      uuid := public.current_staff_id();
  staff_mail text;
  s          public.contacts%rowtype;
  m          public.contacts%rowtype;
  merge_id   uuid;
  snap       jsonb;
  moved      jsonb := '{}'::jsonb;
  ids        uuid[];
begin
  if staff is null or not public.is_staff() then
    raise exception 'staff_only' using errcode = 'insufficient_privilege';
  end if;
  if p_survivor is null or p_merged is null then
    raise exception 'both contacts are required' using errcode = 'invalid_parameter_value';
  end if;
  if p_survivor = p_merged then
    raise exception 'cannot_merge_contact_into_itself' using errcode = 'check_violation';
  end if;

  -- Lock both rows in a fixed order, so two merges touching the same pair cannot deadlock.
  perform 1 from public.contacts where id in (p_survivor, p_merged) order by id for update;
  select * into s from public.contacts where id = p_survivor;
  select * into m from public.contacts where id = p_merged;

  if s.id is null or m.id is null or s.deleted_at is not null or m.deleted_at is not null then
    raise exception 'contact_not_found' using errcode = 'no_data_found';
  end if;

  -- Scope: the caller must be able to merge each contact where it lives.
  if not public.scope_allows('contacts.merge', s.branch_id, s.owner_id)
     or not public.scope_allows('contacts.merge', m.branch_id, m.owner_id) then
    raise exception 'not_permitted: contacts.merge is required for both contacts' using errcode = 'insufficient_privilege';
  end if;
  if s.branch_id is distinct from m.branch_id and not public.has_perm('contacts.merge', 'all') then
    raise exception 'cross_branch_merge_requires_all_scope' using errcode = 'insufficient_privilege';
  end if;

  -- Safe retry: this exact merge already happened → return it, change nothing.
  if m.merged_into_id = s.id then
    select id into merge_id from public.contact_merges
     where winner_id = s.id and loser_id = m.id order by merged_at desc limit 1;
    if merge_id is not null then
      return merge_id;
    end if;
  end if;
  if m.merged_into_id is not null then
    raise exception 'contact_already_merged' using errcode = 'check_violation';
  end if;
  if s.merged_into_id is not null then
    raise exception 'survivor_is_merged: merge into the contact it was merged into instead' using errcode = 'check_violation';
  end if;

  select su.email::text into staff_mail from public.staff_users su where su.id = staff;

  snap := jsonb_build_object(
    'survivor_before', to_jsonb(s),
    'merged_before',   to_jsonb(m),
    'merged_identities', coalesce((select jsonb_agg(to_jsonb(i) order by i.created_at) from public.contact_identities i where i.contact_id = m.id), '[]'::jsonb)
  );

  -- Identities: moved; a primary is demoted when the survivor already has one of that type.
  -- (Values are unique per type across ALL contacts, so a move can never collide on value.)
  with u as (
    update public.contact_identities i
       set contact_id = s.id,
           is_primary = i.is_primary and not exists (
             select 1 from public.contact_identities x where x.contact_id = s.id and x.type = i.type and x.is_primary)
     where i.contact_id = m.id
    returning i.id)
  select coalesce(array_agg(id), '{}') into ids from u;
  moved := jsonb_build_object('identities', to_jsonb(ids));

  with u as (update public.job_applications set contact_id = s.id where contact_id = m.id returning id)
  select coalesce(array_agg(id), '{}') into ids from u;
  moved := moved || jsonb_build_object('job_applications', to_jsonb(ids));

  with u as (update public.cases set contact_id = s.id where contact_id = m.id returning id)
  select coalesce(array_agg(id), '{}') into ids from u;
  moved := moved || jsonb_build_object('cases', to_jsonb(ids));

  with u as (update public.notes set contact_id = s.id where contact_id = m.id returning id)
  select coalesce(array_agg(id), '{}') into ids from u;
  moved := moved || jsonb_build_object('notes', to_jsonb(ids));

  with u as (update public.tasks set contact_id = s.id where contact_id = m.id returning id)
  select coalesce(array_agg(id), '{}') into ids from u;
  moved := moved || jsonb_build_object('tasks', to_jsonb(ids));

  with u as (update public.activities set contact_id = s.id where contact_id = m.id returning id)
  select coalesce(array_agg(id), '{}') into ids from u;
  moved := moved || jsonb_build_object('activities', to_jsonb(ids));

  with u as (update public.invoices set contact_id = s.id where contact_id = m.id and status = 'draft' returning id)
  select coalesce(array_agg(id), '{}') into ids from u;
  moved := moved || jsonb_build_object('draft_invoices', to_jsonb(ids));

  with u as (update public.contacts set merged_into_id = s.id where merged_into_id = m.id returning id)
  select coalesce(array_agg(id), '{}') into ids from u;
  moved := moved || jsonb_build_object('earlier_merges_repointed', to_jsonb(ids));

  snap := snap
    || jsonb_build_object('moved', moved)
    || jsonb_build_object('untouched', jsonb_build_object(
         'issued_invoices', coalesce((select jsonb_agg(id) from public.invoices where contact_id = m.id), '[]'::jsonb),
         'payments',        coalesce((select jsonb_agg(id) from public.payments where contact_id = m.id), '[]'::jsonb)));

  -- The survivor: its own details and consents; the later legal hold and last activity.
  update public.contacts
     set legal_hold_until = greatest(s.legal_hold_until, m.legal_hold_until),
         last_activity_at = greatest(s.last_activity_at, m.last_activity_at, now())
   where id = s.id;

  -- The merged contact: kept, read-only, pointing at the survivor.
  update public.contacts set merged_into_id = s.id where id = m.id;

  insert into public.contact_merges (winner_id, loser_id, merged_by, reason, snapshot)
  values (s.id, m.id, staff, nullif(btrim(coalesce(p_reason, '')), ''), snap)
  returning id into merge_id;

  perform public.write_audit_log(
    'staff', staff, staff_mail, 'contacts.merged', 'contacts', s.id,
    jsonb_build_object('merged_contact_id', m.id, 'merged_branch_id', m.branch_id),
    jsonb_build_object('merge_id', merge_id,
                       'counts', (select jsonb_object_agg(k, jsonb_array_length(v)) from jsonb_each(moved) as e(k, v)),
                       'untouched_issued_invoices', jsonb_array_length(snap -> 'untouched' -> 'issued_invoices'),
                       'untouched_payments', jsonb_array_length(snap -> 'untouched' -> 'payments')));

  perform public.log_activity(s.id, null, 'staff', staff, 'contact.merged',
    'Another contact record was merged into this one', 'contact', m.id,
    jsonb_build_object('merge_id', merge_id));

  return merge_id;
end;
$$;

comment on function public.merge_contacts(uuid, uuid, text) is
  'Merges p_merged into p_survivor in one transaction (0021). contacts.merge on both; cross-branch only at all scope; idempotent for the same pair.';

revoke all on function public.merge_contacts(uuid, uuid, text) from public, anon;
grant execute on function public.merge_contacts(uuid, uuid, text) to authenticated;

revoke all on function public.contacts_guard() from public, anon, authenticated;
