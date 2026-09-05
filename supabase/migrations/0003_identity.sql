-- =============================================================================
-- 0003 — Unified identity: one person, many identifiers.
--
-- The requirement is that a Facebook ad click, a WhatsApp message, a phone
-- call, an application and a payment all resolve to the SAME person, with phone
-- as the primary signal. A `phone` column on a contacts table is not enough:
-- people have two numbers, change numbers, and share a household line.
--
-- There are deliberately NO separate leads / customers / candidates tables. A
-- person is one row; what they *are* is lifecycle_stage plus the cases attached
-- to them. Three parallel person tables is the failure mode this avoids.
--
-- ADDITIVE ONLY. `public.job_applications` is not touched.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Phone normalisation — ONE implementation, used by every write path.
--
-- Form, webhook, IVR and import must all produce identical values or the
-- uniqueness guarantee below is worthless. Hence a database function rather
-- than application code.
--
-- Returns NULL when the input cannot be resolved confidently. Callers must
-- treat NULL as "quarantine for human review", never as "guess something":
-- a wrong normalisation silently merges two different people.
-- -----------------------------------------------------------------------------
create or replace function public.normalize_phone_e164(
  raw text,
  default_country_code text default '91'   -- India
)
returns text
language plpgsql
immutable
as $$
declare
  digits text;
begin
  if raw is null or btrim(raw) = '' then
    return null;
  end if;

  digits := regexp_replace(raw, '[^0-9]', '', 'g');

  -- Strip international dialling prefixes: 00XX… and 011XX… (NANP style)
  if digits like '00%' and length(digits) > 4 then
    digits := substring(digits from 3);
  end if;

  -- Bare national mobile, e.g. 9936309015 -> +919936309015
  if length(digits) = 10 and substring(digits from 1 for 1) between '6' and '9' then
    return '+' || default_country_code || digits;
  end if;

  -- Leading trunk zero, e.g. 09936309015
  if length(digits) = 11 and substring(digits from 1 for 1) = '0' then
    return '+' || default_country_code || substring(digits from 2);
  end if;

  -- Already country-coded, e.g. 919936309015
  if length(digits) = 12 and substring(digits from 1 for 2) = default_country_code then
    return '+' || digits;
  end if;

  -- Plausible international number carrying its own country code.
  if length(digits) between 11 and 15 then
    return '+' || digits;
  end if;

  -- Anything else — too short, too long, or ambiguous. Quarantine.
  return null;
end;
$$;

comment on function public.normalize_phone_e164 is
  'Single source of truth for phone normalisation. Returns NULL when the input is ambiguous — callers must quarantine for human review, never guess.';

create or replace function public.normalize_email(raw text)
returns text
language sql
immutable
as $$
  select nullif(lower(btrim(raw)), '');
$$;

-- WhatsApp wa_id arrives as digits without '+'. Normalising it to the same
-- E.164 shape as phones is what lets a WhatsApp message resolve to a contact
-- created from a web form.
create or replace function public.normalize_wa_id(raw text)
returns text
language sql
immutable
as $$
  select public.normalize_phone_e164(raw);
$$;

-- -----------------------------------------------------------------------------
-- Contacts
-- -----------------------------------------------------------------------------
do $$ begin
  create type public.lifecycle_stage as enum
    ('subscriber','lead','opportunity','customer','past_customer','disqualified');
exception when duplicate_object then null; end $$;

create table if not exists public.contacts (
  id                 uuid primary key default gen_random_uuid(),
  full_name          text not null,
  display_name       text,

  -- Derived by trigger from the is_primary identity rows below. NOT
  -- independently writable: a second writable copy of a phone number drifts.
  primary_phone_e164 text,
  primary_email      citext,

  lifecycle_stage    public.lifecycle_stage not null default 'lead',
  owner_id           uuid references public.staff_users(id) on delete set null,
  branch_id          uuid references public.branches(id),

  country_code       char(2),
  nationality        text,
  preferred_language text not null default 'en',
  date_of_birth      date,
  gender             text,

  -- Consent is per channel and timestamped. Under DPDP, being able to show
  -- WHEN consent changed matters as much as that it existed.
  consent_email      boolean not null default false,
  consent_whatsapp   boolean not null default false,
  consent_sms        boolean not null default false,
  consent_calls      boolean not null default false,
  consent_marketing  boolean not null default false,
  consent_updated_at timestamptz,

  -- First-touch attribution: utm_source/medium/campaign/content, landing_page,
  -- referrer. jsonb because the shape varies by channel.
  first_touch        jsonb not null default '{}'::jsonb,

  -- Blocks automated deletion while a dispute or legal matter is live.
  legal_hold_until   date,

  notes_summary      text,
  merged_into_id     uuid references public.contacts(id) on delete set null,
  legacy_id          uuid,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  last_activity_at   timestamptz,
  deleted_at         timestamptz
);

create index if not exists contacts_owner_idx     on public.contacts (owner_id) where deleted_at is null;
create index if not exists contacts_branch_idx    on public.contacts (branch_id) where deleted_at is null;
create index if not exists contacts_lifecycle_idx on public.contacts (lifecycle_stage) where deleted_at is null;
create index if not exists contacts_activity_idx  on public.contacts (last_activity_at desc nulls last);
create index if not exists contacts_legacy_idx    on public.contacts (legacy_id) where legacy_id is not null;

create trigger contacts_updated_at
  before update on public.contacts
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Contact identities — the deduplication engine.
-- -----------------------------------------------------------------------------
do $$ begin
  create type public.identity_type as enum
    ('phone','email','whatsapp_wa_id','auth_user','ivr_caller','social_handle','job_portal');
exception when duplicate_object then null; end $$;

create table if not exists public.contact_identities (
  id               uuid primary key default gen_random_uuid(),
  contact_id       uuid not null references public.contacts(id) on delete cascade,
  type             public.identity_type not null,
  value_raw        text not null,
  value_normalized text not null,
  is_primary       boolean not null default false,

  -- A household or agent number legitimately reaching several people. Excluded
  -- from automatic resolution and flagged for human review instead.
  is_shared        boolean not null default false,

  -- An identity captured from a form is unverified. Only VERIFIED identities
  -- may authenticate into the customer portal.
  verified_at      timestamptz,
  source           text,
  created_at       timestamptz not null default now(),

  -- THE dedup guarantee. Two contacts sharing a normalised phone is not a
  -- condition to detect later; it is a state the database refuses to enter.
  constraint contact_identities_unique unique (type, value_normalized)
);

create index if not exists contact_identities_contact_idx on public.contact_identities (contact_id);
create index if not exists contact_identities_lookup_idx  on public.contact_identities (type, value_normalized);

-- At most one primary identity of each type per contact.
create unique index if not exists contact_identities_one_primary
  on public.contact_identities (contact_id, type)
  where is_primary;

-- Normalise on write, in the database, so no code path can bypass it.
create or replace function public.contact_identities_normalize()
returns trigger
language plpgsql
as $$
begin
  new.value_normalized :=
    case new.type
      when 'phone'          then public.normalize_phone_e164(new.value_raw)
      when 'whatsapp_wa_id' then public.normalize_wa_id(new.value_raw)
      when 'ivr_caller'     then public.normalize_phone_e164(new.value_raw)
      when 'email'          then public.normalize_email(new.value_raw)
      else btrim(new.value_raw)
    end;

  if new.value_normalized is null or new.value_normalized = '' then
    raise exception
      'Identity of type % could not be normalised and must be quarantined for human review, not guessed', new.type
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger contact_identities_normalize_trg
  before insert or update of value_raw, type on public.contact_identities
  for each row execute function public.contact_identities_normalize();

-- Keep the denormalised convenience columns on contacts in step with the
-- primary identity rows. Derived, never independently edited.
create or replace function public.contacts_sync_primary_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_contact uuid;
begin
  target_contact := coalesce(new.contact_id, old.contact_id);

  update public.contacts c set
    primary_phone_e164 = (
      select ci.value_normalized from public.contact_identities ci
      where ci.contact_id = target_contact and ci.type = 'phone'
      order by ci.is_primary desc, ci.verified_at nulls last, ci.created_at
      limit 1
    ),
    primary_email = (
      select ci.value_normalized::citext from public.contact_identities ci
      where ci.contact_id = target_contact and ci.type = 'email'
      order by ci.is_primary desc, ci.verified_at nulls last, ci.created_at
      limit 1
    )
  where c.id = target_contact;

  return null;
end;
$$;

create trigger contact_identities_sync_primary
  after insert or update or delete on public.contact_identities
  for each row execute function public.contacts_sync_primary_identity();

-- -----------------------------------------------------------------------------
-- Merges — append-only and reversible.
--
-- Merging is a HUMAN action requiring contacts.merge. Nothing in this schema
-- merges automatically: auto-merging people who share a name is how a CRM sends
-- one candidate's passport to another.
-- -----------------------------------------------------------------------------
create table if not exists public.contact_merges (
  id         uuid primary key default gen_random_uuid(),
  winner_id  uuid not null references public.contacts(id),
  loser_id   uuid not null references public.contacts(id),
  merged_by  uuid references public.staff_users(id),
  reason     text,
  snapshot   jsonb not null,          -- full losing record, for reversal
  merged_at  timestamptz not null default now(),
  constraint contact_merges_distinct check (winner_id <> loser_id)
);

create index if not exists contact_merges_winner_idx on public.contact_merges (winner_id);

-- -----------------------------------------------------------------------------
-- Identity resolution.
--
-- Resolution order: WhatsApp wa_id -> phone -> email -> none.
-- wa_id first because it is provider-supplied and exact; email last because it
-- is the weakest signal (shared family addresses, typos, disposable domains).
--
-- Returns NULL when nothing matches. Creating the contact is the caller's job,
-- so the decision to create a person is always explicit.
-- -----------------------------------------------------------------------------
create or replace function public.resolve_contact(
  p_wa_id text default null,
  p_phone text default null,
  p_email text default null
)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  found uuid;
  norm  text;
begin
  if p_wa_id is not null then
    norm := public.normalize_wa_id(p_wa_id);
    if norm is not null then
      select ci.contact_id into found from public.contact_identities ci
      where ci.type = 'whatsapp_wa_id' and ci.value_normalized = norm and not ci.is_shared;
      if found is not null then return found; end if;
    end if;
  end if;

  if p_phone is not null then
    norm := public.normalize_phone_e164(p_phone);
    if norm is not null then
      select ci.contact_id into found from public.contact_identities ci
      where ci.type in ('phone','whatsapp_wa_id','ivr_caller')
        and ci.value_normalized = norm and not ci.is_shared;
      if found is not null then return found; end if;
    end if;
  end if;

  if p_email is not null then
    norm := public.normalize_email(p_email);
    if norm is not null then
      select ci.contact_id into found from public.contact_identities ci
      where ci.type = 'email' and ci.value_normalized = norm and not ci.is_shared;
      if found is not null then return found; end if;
    end if;
  end if;

  return null;
end;
$$;

comment on function public.resolve_contact is
  'Deterministic identity resolution: wa_id -> phone -> email. Never fuzzy-matches. Returns NULL when no exact match exists.';

alter table public.contacts           enable row level security;
alter table public.contact_identities enable row level security;
alter table public.contact_merges     enable row level security;
