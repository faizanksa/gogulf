-- =============================================================================
-- 0019 — Go Gulf is not a travel agency. Retire the standalone travel-service model;
--        keep candidate deployment, which is part of recruitment.
--
-- PRODUCT DECISION (27 Sep 2026): Go Gulf = recruitment + recruitment operations +
-- candidate deployment. It does not sell travel, tours or visas to the public. A
-- candidate SELECTED through Go Gulf still needs visa processing, a flight and travel
-- to join the employer — that is recruitment fulfilment and stays.
--
-- RETIRED — seeded by 0004/0008 for a travel-agency line of business, used by no code:
--
--   * case types  'travel', 'visa', 'tour_booking'  (standalone travel/visa customers;
--                                                   the enum is rebuilt without them)
--   * tables      case_travel (a holiday booking: destination, return date, adults and
--                 children, budget) and case_visa (a visa-only customer)
--   * the default "Travel" pipeline: inquiry → quote → awaiting payment → travel ready
--   * roles       TRAVEL_MANAGER ("travel operations"), TRAVEL_AGENT ("travel customers")
--
-- KEPT — and where it changes, only its words change:
--
--   * the generic `cases` model, `case_recruitment`, case types 'recruitment' and 'support',
--     and every existing case, untouched
--   * the recruitment pipeline, including 'visa' (Visa Processing) and 'travel'
--     (Travel Preparation): a selected candidate's deployment
--   * documents.view.travel — the candidate's visa and ticket documents
--   * travel.manage, bookings.view, bookings.manage, suppliers.manage — kept, with every
--     grant a remaining role holds, and relabelled as CANDIDATE DEPLOYMENT permissions
--     (placed candidates' travel and flight bookings; recruitment suppliers such as
--     ticketing agents, medical centres and attestation providers). Their domain moves
--     from 'travel' to 'deployment', which is also the heading the Roles screen shows.
--   * every other role, permission, grant and RLS policy, and the audit trail
--
-- SAFETY — this file refuses to run, changing nothing, if the retired model is in use:
--
--   * any case whose type is not 'recruitment' or 'support';
--   * any row in case_travel or case_visa;
--   * any staff member holding a travel role;
--   * any case on a stage of a non-recruitment, non-support pipeline.
--
-- The whole file runs in one transaction, so a refusal leaves everything as it was.
--
-- AUDIT — role_permissions deletions are recorded by its trigger (0005). roles,
-- permissions and pipelines have no trigger, so each retirement and relabel is written
-- explicitly as a `system` entry, old and new values included. Entity types follow the
-- 0016 gate: catalogue changes as `role_permissions` (roles.manage), the pipeline as
-- `settings` (settings.manage — "business settings and pipelines").
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Refuse if anything uses the retired model.
-- -----------------------------------------------------------------------------
do $$
declare
  n bigint;
begin
  select count(*) into n from public.cases where case_type::text not in ('recruitment', 'support');
  if n > 0 then
    raise exception '0019 refused: % case(s) are of a travel, visa or tour type. Nothing was changed.', n;
  end if;

  select count(*) into n from public.case_travel;
  if n > 0 then raise exception '0019 refused: case_travel holds % row(s). Nothing was changed.', n; end if;

  select count(*) into n from public.case_visa;
  if n > 0 then raise exception '0019 refused: case_visa holds % row(s). Nothing was changed.', n; end if;

  select count(*) into n from public.staff_users where role_key in ('TRAVEL_MANAGER', 'TRAVEL_AGENT');
  if n > 0 then
    raise exception '0019 refused: % staff member(s) hold a travel role. Reassign them first. Nothing was changed.', n;
  end if;

  select count(*) into n
    from public.cases c
    join public.pipelines p on p.id = c.pipeline_id
   where p.case_type::text not in ('recruitment', 'support');
  if n > 0 then
    raise exception '0019 refused: % case(s) sit on a travel-type pipeline. Nothing was changed.', n;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 2. The travel-agency pipeline and its stages. The recruitment pipeline, with its
--    Visa Processing and Travel Preparation stages, is not touched.
-- -----------------------------------------------------------------------------
do $$
declare
  p record;
begin
  for p in
    select pl.id, pl.name, pl.case_type::text as case_type,
           (select jsonb_agg(s.key order by s.position) from public.pipeline_stages s where s.pipeline_id = pl.id) as stages
      from public.pipelines pl
     where pl.case_type::text not in ('recruitment', 'support')
  loop
    perform public.write_audit_log(
      'system', null, '0019_retire_travel_services', 'pipelines.retire', 'settings', p.id,
      jsonb_build_object('name', p.name, 'case_type', p.case_type, 'stages', p.stages), null);
  end loop;
end $$;

delete from public.pipeline_stages s
 using public.pipelines p
 where s.pipeline_id = p.id
   and p.case_type::text not in ('recruitment', 'support');

delete from public.pipelines where case_type::text not in ('recruitment', 'support');

-- -----------------------------------------------------------------------------
-- 3. The two travel roles and their grants. Nobody holds them (asserted above).
-- -----------------------------------------------------------------------------
delete from public.role_permissions where role_key in ('TRAVEL_MANAGER', 'TRAVEL_AGENT');

do $$
declare
  r record;
begin
  for r in select key, label, description from public.roles where key in ('TRAVEL_MANAGER', 'TRAVEL_AGENT') loop
    perform public.write_audit_log(
      'system', null, '0019_retire_travel_services', 'roles.retire', 'role_permissions', null,
      jsonb_build_object('role', r.key, 'label', r.label, 'description', r.description), null);
  end loop;
end $$;

delete from public.roles where key in ('TRAVEL_MANAGER', 'TRAVEL_AGENT');

-- -----------------------------------------------------------------------------
-- 4. Candidate deployment permissions: kept, relabelled. Keys do not change, so no
--    grant, policy or line of code that names them is affected.
-- -----------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select p.id, p.key, p.domain as old_domain, p.description as old_description, n.domain, n.description
      from public.permissions p
      join (values
        ('travel.manage',         'deployment', 'Arrange and manage travel for a placed candidate'),
        ('bookings.view',         'deployment', 'View flight bookings for placed candidates'),
        ('bookings.manage',       'deployment', 'Manage flight bookings for placed candidates'),
        ('suppliers.manage',      'deployment', 'Manage recruitment and deployment suppliers (ticketing agents, medical centres, attestation providers)'),
        ('documents.view.travel', 'documents',  'View a candidate''s deployment documents (visa, tickets)')
      ) as n(key, domain, description) on n.key = p.key
  loop
    update public.permissions set domain = r.domain, description = r.description where id = r.id;
    perform public.write_audit_log(
      'system', null, '0019_retire_travel_services', 'permissions.relabel', 'role_permissions', r.id,
      jsonb_build_object('permission', r.key, 'domain', r.old_domain, 'description', r.old_description),
      jsonb_build_object('permission', r.key, 'domain', r.domain, 'description', r.description));
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- 5. The standalone travel and visa case tables. Empty (asserted above); their
--    RLS policies go with them. Visa work lives on the recruitment case.
-- -----------------------------------------------------------------------------
drop table public.case_travel;
drop table public.case_visa;

-- -----------------------------------------------------------------------------
-- 6. case_type without the retired values.
--
-- Postgres cannot drop an enum value, so the type is rebuilt: the old one is renamed,
-- the new one created with only the values Go Gulf uses, the two columns converted
-- (every existing value is valid, asserted in step 1), and the one function taking the
-- type recreated with its 0009 grants. Row triggers do not fire on a type change, so
-- no case is re-audited and no timestamp moves.
-- -----------------------------------------------------------------------------
alter type public.case_type rename to case_type_retired_0019;

create type public.case_type as enum ('recruitment', 'support');

alter table public.pipelines alter column case_type type public.case_type using case_type::text::public.case_type;
alter table public.cases     alter column case_type type public.case_type using case_type::text::public.case_type;

drop function public.next_case_number(public.case_type_retired_0019);

create function public.next_case_number(p_type public.case_type)
returns text
language plpgsql
as $$
declare
  prefix text;
  n      bigint;
begin
  prefix := case p_type
              when 'recruitment' then 'REC'
              else 'SUP'
            end;
  n := nextval('public.case_number_seq');
  return 'GG-' || prefix || '-' || to_char(now(), 'YYYY') || '-' || lpad(n::text, 5, '0');
end;
$$;

revoke execute on function public.next_case_number(public.case_type) from public, anon;
grant execute on function public.next_case_number(public.case_type) to authenticated, service_role;

drop type public.case_type_retired_0019;

comment on type public.case_type is
  'Case types Go Gulf operates: recruitment (application → contact → case, through visa, travel preparation and joining) and support. The standalone travel, visa and tour types were retired in 0019.';
