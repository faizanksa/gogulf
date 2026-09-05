# Database Design

Postgres 17 on Supabase, `ap-south-1`. Conventions: `uuid` primary keys via `gen_random_uuid()`,
`timestamptz` everywhere, money as `bigint` **paise**, `created_at`/`updated_at` on every table
(`updated_at` by trigger, never by application code), soft delete via `deleted_at` on
customer-facing entities, **RLS enabled on every table in `public`**, and every foreign key
explicitly indexed.

Two decisions carry most of the weight: how a person is identified, and how work is contained.

---

## 1. Identity — one person, many identifiers

The requirement is that a Facebook ad click, a WhatsApp message, a phone call, an application and a
payment all resolve to the same person, with phone as the primary signal. A `phone` column on a
contacts table is not enough — people have two numbers, change numbers, and share a household line.

```sql
create type lifecycle_stage as enum
  ('subscriber','lead','opportunity','customer','past_customer','disqualified');

create table contacts (
  id                  uuid primary key default gen_random_uuid(),
  full_name           text not null,
  display_name        text,
  -- Derived by trigger from the is_primary identity rows. NOT independently
  -- writable — a second writable copy of a phone number will drift.
  primary_phone_e164  text,
  primary_email       citext,
  lifecycle_stage     lifecycle_stage not null default 'lead',
  source_id           uuid references lead_sources(id),
  campaign_id         uuid references campaigns(id),
  owner_id            uuid references staff_users(id),
  branch_id           uuid references branches(id),
  country_code        char(2),
  nationality         text,
  preferred_language  text not null default 'en',
  date_of_birth       date,
  gender              text,
  consent_email       boolean not null default false,
  consent_whatsapp    boolean not null default false,
  consent_sms         boolean not null default false,
  consent_calls       boolean not null default false,
  consent_marketing   boolean not null default false,
  consent_updated_at  timestamptz,
  first_touch         jsonb,          -- utm_*, landing_page, referrer
  legal_hold_until    date,           -- blocks automated deletion; see retention
  merged_into_id      uuid references contacts(id),
  legacy_id           uuid,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  last_activity_at    timestamptz,
  deleted_at          timestamptz
);

create type identity_type as enum
  ('phone','email','whatsapp_wa_id','auth_user','ivr_caller','social_handle','job_portal');

create table contact_identities (
  id               uuid primary key default gen_random_uuid(),
  contact_id       uuid not null references contacts(id) on delete cascade,
  type             identity_type not null,
  value_raw        text not null,
  value_normalized text not null,
  is_primary       boolean not null default false,
  is_shared        boolean not null default false,  -- household/agent number
  verified_at      timestamptz,
  source           text,
  created_at       timestamptz not null default now(),
  constraint uq_identity unique (type, value_normalized)
);
create index on contact_identities (contact_id);

create table contact_merges (          -- append-only, reversible
  id         uuid primary key default gen_random_uuid(),
  winner_id  uuid not null references contacts(id),
  loser_id   uuid not null references contacts(id),
  merged_by  uuid references staff_users(id),
  reason     text,
  snapshot   jsonb not null,           -- full losing record
  merged_at  timestamptz not null default now()
);
```

**`unique (type, value_normalized)` is the deduplication guarantee.** Two contacts sharing a
verified phone number is not a condition to detect later; it is a state the database refuses to
enter.

### Resolution rules

1. Normalise in **one Postgres function**, never ad hoc in application code, so every write path —
   form, webhook, IVR, import — produces identical values. Phones to E.164 with default region
   India; emails lowercased and trimmed; WhatsApp `wa_id` (digits, no `+`) normalised to the same
   E.164 form as phones.
2. Resolution order: `whatsapp_wa_id` → `phone` → `email` → create new.
3. A Supabase Auth user is *an* identity (`type = 'auth_user'`), not *the* identity. Someone who
   applied by phone in January attaches to the same contact when they log in by OTP in March.
4. Only **verified** identities may authenticate into the portal.
5. **Never fuzzy-merge automatically.** Similar names or a shared address may *suggest* a duplicate
   and raise a review task; merging requires a human holding `contacts.merge`. Auto-merging people
   who share a name is how a CRM sends one candidate's passport to another.
6. A number flagged `is_shared` is excluded from automatic resolution.

There are deliberately **no separate `leads` / `customers` / `candidates` tables.** A person is one
row; what they *are* is a function of `lifecycle_stage` plus the cases attached to them.

---

## 2. Work — one case container, typed extensions

Recruitment applications, travel inquiries, visa services and tour bookings each need a pipeline, a
stage, an owner, a timeline, tasks, documents, payments and notifications. Building those seven
subsystems four times is how CRMs rot.

```sql
create type case_type   as enum ('recruitment','travel','visa','tour_booking','support');
create type case_status as enum ('open','won','lost','cancelled');

create table pipelines (
  id uuid primary key default gen_random_uuid(),
  case_type case_type not null,
  name text not null,
  is_default boolean not null default false,
  is_active  boolean not null default true
);

create table pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  pipeline_id uuid not null references pipelines(id) on delete cascade,
  name text not null,
  position int not null,
  is_won  boolean not null default false,
  is_lost boolean not null default false,
  sla_hours int,                       -- powers the "stalled case" report
  unique (pipeline_id, position)
);

create table cases (
  id                 uuid primary key default gen_random_uuid(),
  case_number        text not null unique,       -- GG-REC-2026-00184
  contact_id         uuid not null references contacts(id),
  case_type          case_type not null,
  pipeline_id        uuid not null references pipelines(id),
  stage_id           uuid not null references pipeline_stages(id),
  status             case_status not null default 'open',
  owner_id           uuid references staff_users(id),
  branch_id          uuid references branches(id),
  value_amount_paise bigint,
  priority           smallint not null default 3,
  legacy_id          uuid,
  opened_at          timestamptz not null default now(),
  stage_entered_at   timestamptz not null default now(),
  closed_at          timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz
);
create index on cases (contact_id);
create index on cases (pipeline_id, stage_id);
create index on cases (owner_id) where status = 'open' and deleted_at is null;

-- 1:1 typed extensions — only the fields that type actually needs
create table case_recruitment (
  case_id uuid primary key references cases(id) on delete cascade,
  job_id uuid references jobs(id),
  employer_id uuid references employers(id),
  legacy_job_title text, legacy_job_country text,
  expected_salary_paise bigint,
  years_experience numeric(4,1),
  passport_number_last4 text                     -- never the full number
);

create table case_travel (
  case_id uuid primary key references cases(id) on delete cascade,
  destination_id uuid references destinations(id),
  depart_date date, return_date date,
  pax_adults int not null default 1, pax_children int not null default 0,
  budget_paise bigint
);

create table case_visa (
  case_id uuid primary key references cases(id) on delete cascade,
  visa_type text, country_code char(2),
  application_ref text, submitted_at timestamptz
);
```

**Stages are data, not code.** An administrator adds or reorders stages without a deploy. The
stages listed in the Phase 0 audit are placeholders — the real ones come from a workshop with the
recruitment and travel leads (decision I5).

Adding a new service line later — Umrah packages, say — is a new `case_type`, one extension table
and some pipeline rows. Not a new subsystem.

---

## 3. Timeline, work management, communications

```sql
create table activities (              -- append-only; the Customer 360 spine
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references contacts(id) on delete cascade,
  case_id    uuid references cases(id) on delete cascade,
  actor_type text not null,            -- staff | customer | system | provider
  actor_id   uuid,
  verb       text not null,            -- case.created, stage.changed, document.uploaded …
  entity_type text, entity_id uuid,
  summary    text not null,            -- pre-rendered: the timeline needs no joins
  metadata   jsonb not null default '{}',
  occurred_at timestamptz not null default now()
);
create index on activities (contact_id, occurred_at desc);
create index on activities (case_id, occurred_at desc);
```

The alternative — a `UNION` view across eight source tables at read time — is cleaner in theory and
unusably slow on the busiest screen in the product. Accept the redundancy: written once, read
constantly. **Every state change writes its `activities` row in the same transaction as the change
itself**; a change that does not appear on the timeline is a defect, not a nice-to-have.

```sql
create table tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null, description text,
  assignee_id uuid references staff_users(id),
  contact_id uuid references contacts(id),
  case_id uuid references cases(id),
  priority smallint not null default 3,
  status text not null default 'open',
  due_at timestamptz, completed_at timestamptz,
  completed_by uuid references staff_users(id),
  branch_id uuid references branches(id),
  created_by uuid references staff_users(id),
  created_at timestamptz not null default now()
);

create table appointments (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references cases(id), contact_id uuid references contacts(id),
  kind text not null,                  -- interview | medical | office_visit | call_back
  starts_at timestamptz not null, ends_at timestamptz,
  location text, meeting_url text,
  status text not null default 'scheduled',
  owner_id uuid references staff_users(id), branch_id uuid references branches(id)
);

create table notes (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references contacts(id), case_id uuid references cases(id),
  body text not null,
  visibility text not null default 'team',   -- team | hr_private | finance_private
  author_id uuid references staff_users(id),
  created_at timestamptz not null default now()
);

create type comm_channel   as enum ('email','whatsapp','sms','call','in_person','note');
create type comm_direction as enum ('inbound','outbound');

create table communications (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references contacts(id), case_id uuid references cases(id),
  channel comm_channel not null, direction comm_direction not null,
  provider text, provider_message_id text,
  template_key text, subject text, body_preview text,
  status text, status_updated_at timestamptz,   -- queued|sent|delivered|read|failed|bounced
  agent_id uuid references staff_users(id),
  consent_basis text,                  -- what permitted this outbound send
  metadata jsonb not null default '{}',
  occurred_at timestamptz not null default now(),
  unique (provider, provider_message_id)
);

create table calls (
  id uuid primary key default gen_random_uuid(),
  communication_id uuid references communications(id),
  contact_id uuid references contacts(id),
  provider text, provider_call_id text unique,
  from_e164 text, to_e164 text, direction comm_direction not null,
  ivr_path text[], department text,
  agent_id uuid references staff_users(id),
  answered boolean, duration_seconds int, recording_path text,
  outcome text, notes text,
  started_at timestamptz, ended_at timestamptz
);
```

`communications.consent_basis` records *why* an outbound message was permitted. Under DPDP, being
able to show that is worth more than being able to say the consent existed.

---

## 4. Documents

```sql
create type document_status   as enum
  ('requested','uploaded','under_review','approved','rejected','expired');
create type document_category as enum
  ('identity','employment','financial','travel','medical','other');

create table documents (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts(id),
  case_id uuid references cases(id),
  category document_category not null,
  doc_type text not null,              -- passport | cv | photo | visa | receipt …
  status document_status not null default 'requested',
  storage_path text,                   -- contacts/{c}/cases/{k}/{doc_id}.{ext}
  legacy_path text,
  original_filename text, mime_type text, size_bytes bigint, sha256 text,
  uploaded_by_staff uuid references staff_users(id),
  uploaded_by_contact uuid references contacts(id),
  uploaded_at timestamptz,
  verified_by uuid references staff_users(id), verified_at timestamptz,
  rejection_reason text,
  issued_on date, expires_at date,
  notes text, branch_id uuid references branches(id),
  created_at timestamptz not null default now(), deleted_at timestamptz
);

create table document_requirements (   -- drives "what is still missing"
  id uuid primary key default gen_random_uuid(),
  case_type case_type not null, doc_type text not null,
  category document_category not null,
  is_mandatory boolean not null default true,
  requires_expiry boolean not null default false,
  instructions text
);

create table document_access_log (     -- append-only
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id),
  accessed_by_staff uuid references staff_users(id),
  accessed_by_contact uuid references contacts(id),
  action text not null,                -- view | download | sign_url
  ip_address inet, user_agent text,
  occurred_at timestamptz not null default now()
);
```

Categories exist so permissions can be granted per category — that is how Accounts sees receipts
without ever seeing a passport, and Marketing sees neither. Full requirements in
`SECURITY-MODEL.md` §4.

---

## 5. Money — append-only, webhook-authoritative

```sql
create table orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  contact_id uuid not null references contacts(id),
  case_id uuid references cases(id),
  description text not null,
  subtotal_paise bigint not null,
  tax_paise bigint not null default 0,
  total_amount_paise bigint not null,
  currency char(3) not null default 'INR',
  status text not null default 'draft',       -- draft|active|completed|cancelled
  razorpay_order_id text unique,
  created_by uuid references staff_users(id),
  branch_id uuid references branches(id),
  created_at timestamptz not null default now()
);

create table installments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  seq int not null, label text,
  amount_paise bigint not null, due_date date,
  status text not null default 'pending',     -- pending|due|paid|partial|overdue|waived
  paid_paise bigint not null default 0,
  waived_by uuid references staff_users(id), waived_reason text,
  unique (order_id, seq)
);

create table payment_attempts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id),
  installment_id uuid references installments(id),
  razorpay_payment_id text unique,
  amount_paise bigint not null,
  method text, status text not null,          -- created|authorized|captured|failed
  failure_code text, failure_reason text,
  raw jsonb, attempted_at timestamptz not null default now()
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id),
  installment_id uuid references installments(id),
  attempt_id uuid references payment_attempts(id),
  amount_paise bigint not null,
  method text, bank_reference text,
  razorpay_payment_id text not null unique,
  captured_at timestamptz not null,
  recorded_by uuid references staff_users(id),   -- null = webhook, the normal case
  created_at timestamptz not null default now()
);

create table refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references payments(id),
  amount_paise bigint not null, reason text not null,
  status text not null default 'pending',
  razorpay_refund_id text unique,
  requested_by uuid references staff_users(id),
  approved_by uuid references staff_users(id),
  approved_at timestamptz, processed_at timestamptz,
  constraint refund_two_person check (approved_by is null or approved_by <> requested_by)
);

create table invoices (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id),
  invoice_number text not null unique,   -- gapless, per financial year
  financial_year text not null,          -- '2026-27'
  issued_at timestamptz not null,
  place_of_supply text not null,         -- GST state code
  supplier_gstin text,                   -- NULL until a GSTIN is verified
  customer_gstin text,
  subtotal_paise bigint not null,
  cgst_paise bigint not null default 0,
  sgst_paise bigint not null default 0,
  igst_paise bigint not null default 0,
  total_paise bigint not null,
  pdf_path text, status text not null default 'issued',
  cancelled_reason text
);

create table invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  description text not null, sac_code text,
  quantity numeric(10,2) not null default 1,
  unit_amount_paise bigint not null,
  tax_rate numeric(5,2) not null default 18.00,
  line_total_paise bigint not null
);

create table webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  signature_valid boolean not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz, error text,
  unique (provider, provider_event_id)     -- ← the idempotency guarantee
);
```

### Rules

- **Append-only.** A correction is a new row. Balances are derived, so history is always
  reconstructable.
- **Integer paise.** No floating point anywhere, reports included.
- **The webhook is the only thing that may mark a payment captured.** The browser's success
  callback updates the UI and nothing else.
- **Every attempt is recorded, including failures**, with the provider's reason. "Why did my
  payment fail?" must be answerable.
- **Refunds need two people** — enforced by `refund_two_person`, not by convention.
- `supplier_gstin` is **nullable**, because the company's GSTIN is currently unverified. See
  `LEGAL-DATA-MIGRATION.md` §3. Invoicing cannot go live until it is resolved (decision I6).

```sql
create view order_balances as
select o.id as order_id, o.total_amount_paise,
       coalesce(sum(p.amount_paise), 0)                        as paid_paise,
       coalesce(sum(r.amount_paise), 0)                        as refunded_paise,
       o.total_amount_paise - coalesce(sum(p.amount_paise), 0)
                            + coalesce(sum(r.amount_paise), 0) as outstanding_paise
from orders o
left join payments p on p.order_id = o.id
left join refunds  r on r.payment_id = p.id and r.status = 'processed'
group by o.id;
```

---

## 6. Access control and system tables

```sql
create table branches (
  id uuid primary key default gen_random_uuid(),
  name text not null, city text, is_active boolean not null default true
);

create table staff_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,            -- references auth.users
  email citext not null unique,        -- must be @gogulf.co
  full_name text not null,
  role_key text not null references roles(key),
  branch_id uuid references branches(id),
  is_active boolean not null default true,
  deactivated_at timestamptz,
  created_at timestamptz not null default now()
);

create table roles            (key text primary key, label text not null, description text);
create table permissions      (id uuid primary key default gen_random_uuid(),
                               key text not null unique, domain text not null, description text);
create table role_permissions (role_key text references roles(key),
                               permission_id uuid references permissions(id),
                               scope text not null check (scope in ('all','branch','own')),
                               primary key (role_key, permission_id));

create table audit_logs (              -- immutable
  id uuid primary key default gen_random_uuid(),
  actor_type text not null, actor_id uuid, actor_label text,
  action text not null,
  entity_type text not null, entity_id uuid,
  old_values jsonb, new_values jsonb,  -- redacted: never secrets, OTPs or document bytes
  ip_address inet, user_agent text,
  occurred_at timestamptz not null default now()
);
create index on audit_logs (entity_type, entity_id, occurred_at desc);

create table events (                  -- automation bus, append-only
  id uuid primary key default gen_random_uuid(),
  event_type text not null, payload jsonb not null,
  occurred_at timestamptz not null default now()
);

create table outbox (                  -- reliable side effects
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events(id),
  handler text not null, payload jsonb not null,
  status text not null default 'pending',
  attempts int not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text, processed_at timestamptz
);
create index on outbox (status, next_attempt_at);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_staff_id uuid references staff_users(id),
  recipient_contact_id uuid references contacts(id),
  title text not null, body text, link_url text,
  read_at timestamptz, created_at timestamptz not null default now()
);

create table settings (
  key text primary key, value jsonb not null,
  updated_by uuid references staff_users(id),
  updated_at timestamptz not null default now()
);
```

Supporting tables added as their phases land: `lead_sources`, `campaigns`, `jobs`, `employers`,
`interviews`, `offers`, `destinations`, `packages`, `bookings`, `booking_items`, `travelers`,
`suppliers`, `message_templates`, `tags`, `case_tags`.

**Phase 1 builds identity, access control and audit only.** Everything else lands with its module.

---

## 7. Indexing notes

| Index | Why |
| --- | --- |
| `contact_identities (type, value_normalized)` | The unique constraint doubles as the resolution lookup — one index, two jobs |
| `activities (contact_id, occurred_at desc)` | The most-hit index in the product |
| `cases (owner_id) where status='open' and deleted_at is null` | Partial index for "my open cases" |
| Every FK | Postgres does not index foreign keys automatically; without it, deletes and joins crawl |
| `audit_logs` partitioned by year | 8-year retention with no delete path — partitioning is the only sane way to manage it |

`case_number` and `invoice_number` are generated from a Postgres sequence per type per financial
year, so both are gapless. GST requires that of invoice numbers; doing the same for case numbers
costs nothing and makes support conversations easier.
