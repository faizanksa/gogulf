-- =============================================================================
-- 0008 — Seed roles, permissions and grants.
--
-- Idempotent: safe to re-run. Permissions are seeded by migration and never
-- created at runtime, because a permission string that no policy references is
-- a security illusion.
--
-- The grant matrix mirrors docs/RBAC-RLS.md §3. If the two ever disagree, this
-- file is the truth — it is what the database enforces.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Roles
-- -----------------------------------------------------------------------------
insert into public.roles (key, label, description, is_super, sort_order) values
  ('SUPER_ADMIN',        'Super Admin',        'Unrestricted platform access. All actions audited.', true,  10),
  ('ADMIN',              'Admin',              'Full operational access. Cannot change roles, permissions or integrations.', false, 20),
  ('HR_MANAGER',         'HR Manager',         'Recruitment at branch scope. Verifies documents. Sees private HR notes.', false, 30),
  ('RECRUITER',          'Recruiter',          'Assigned candidates only. Cannot verify documents.', false, 40),
  ('TRAVEL_MANAGER',     'Travel Manager',     'Travel operations at branch scope.', false, 50),
  ('TRAVEL_AGENT',       'Travel Agent',       'Assigned travel customers only.', false, 60),
  ('FINANCE_MANAGER',    'Finance Manager',    'All financial records. Approves refunds. No identity documents.', false, 70),
  ('ACCOUNTS',           'Accounts',           'Financial records at branch scope. Raises but cannot approve refunds.', false, 80),
  ('OPERATIONS_MANAGER', 'Operations Manager', 'Cross-module case and task oversight. No financial writes.', false, 90),
  ('SUPPORT_AGENT',      'Support Agent',      'Communications and case visibility. No money, no identity documents.', false, 100),
  ('MARKETING_MANAGER',  'Marketing Manager',  'Campaigns, sources and aggregate reporting. No documents, no payments.', false, 110),
  ('VIEW_ONLY',          'View Only',          'Read-only at branch scope. No mutations anywhere.', false, 120)
on conflict (key) do update
  set label = excluded.label,
      description = excluded.description,
      is_super = excluded.is_super,
      sort_order = excluded.sort_order;

-- -----------------------------------------------------------------------------
-- Permissions
-- -----------------------------------------------------------------------------
insert into public.permissions (key, domain, description) values
  -- CRM
  ('contacts.view',                'crm',           'View contact records'),
  ('contacts.create',              'crm',           'Create contacts'),
  ('contacts.update',              'crm',           'Edit contacts'),
  ('contacts.delete',              'crm',           'Delete contacts'),
  ('contacts.merge',               'crm',           'Merge duplicate contacts'),
  ('contacts.assign',              'crm',           'Change contact ownership'),
  ('contacts.export',              'crm',           'Bulk export contact data'),
  ('notes.team.view',              'crm',           'View team-visible notes'),
  ('notes.team.create',            'crm',           'Write team-visible notes'),
  ('notes.hr_private.view',        'crm',           'View private HR notes'),
  ('notes.finance_private.view',   'crm',           'View private finance notes'),
  ('tags.manage',                  'crm',           'Manage tags'),
  -- Cases
  ('cases.view',                   'cases',         'View cases'),
  ('cases.create',                 'cases',         'Create cases'),
  ('cases.update',                 'cases',         'Edit cases'),
  ('cases.stage.change',           'cases',         'Move a case between stages'),
  ('cases.assign',                 'cases',         'Change case ownership'),
  ('cases.close',                  'cases',         'Close or reopen a case'),
  ('cases.delete',                 'cases',         'Delete cases'),
  -- Recruitment
  ('jobs.view',                    'recruitment',   'View job postings'),
  ('jobs.manage',                  'recruitment',   'Create and edit job postings'),
  ('employers.view',               'recruitment',   'View employers'),
  ('employers.manage',             'recruitment',   'Manage employers'),
  ('applications.screen',          'recruitment',   'Screen applications'),
  ('interviews.manage',            'recruitment',   'Schedule and record interviews'),
  ('offers.manage',                'recruitment',   'Manage offers'),
  -- Travel
  ('travel.manage',                'travel',        'Manage travel cases'),
  ('bookings.view',                'travel',        'View bookings'),
  ('bookings.manage',              'travel',        'Manage bookings'),
  ('suppliers.manage',             'travel',        'Manage suppliers'),
  -- Documents, permissioned per category
  ('documents.view.identity',      'documents',     'View identity documents (passport, ID)'),
  ('documents.view.employment',    'documents',     'View employment documents (CV, certificates)'),
  ('documents.view.financial',     'documents',     'View financial documents (receipts, statements)'),
  ('documents.view.travel',        'documents',     'View travel documents (visa, tickets)'),
  ('documents.view.medical',       'documents',     'View medical documents'),
  ('documents.upload',             'documents',     'Upload documents'),
  ('documents.verify',             'documents',     'Approve or reject documents'),
  ('documents.download',           'documents',     'Download document files'),
  ('documents.delete',             'documents',     'Delete documents'),
  -- Money
  ('orders.view',                  'finance',       'View orders'),
  ('orders.create',                'finance',       'Create orders and quotes'),
  ('payments.view',                'finance',       'View payments'),
  ('payments.record',              'finance',       'Record an offline payment'),
  ('installments.manage',          'finance',       'Manage installment schedules'),
  ('refunds.create',               'finance',       'Raise a refund request'),
  ('refunds.approve',              'finance',       'Approve a refund'),
  ('invoices.view',                'finance',       'View invoices'),
  ('invoices.issue',               'finance',       'Issue invoices'),
  ('invoices.void',                'finance',       'Void invoices'),
  ('payments.reconcile',           'finance',       'Reconcile settlements'),
  -- Communications
  ('communications.view',          'communications','View communication history'),
  ('communications.send',          'communications','Send communications'),
  ('whatsapp.reply',               'communications','Reply in WhatsApp conversations'),
  ('calls.view',                   'communications','View call records'),
  ('calls.log',                    'communications','Log a call'),
  ('templates.manage',             'communications','Manage message templates'),
  ('campaigns.manage',             'marketing',     'Manage campaigns'),
  ('lead_sources.manage',          'marketing',     'Manage lead sources'),
  -- Work management
  ('tasks.view',                   'work',          'View tasks'),
  ('tasks.manage',                 'work',          'Create and edit tasks'),
  ('appointments.manage',          'work',          'Manage appointments'),
  -- Reporting
  ('reports.operational',          'reports',       'Operational reports'),
  ('reports.financial',            'reports',       'Financial reports'),
  ('reports.marketing',            'reports',       'Marketing and attribution reports'),
  ('reports.staff_performance',    'reports',       'Staff performance reports'),
  -- Platform
  ('imports.run',                  'platform',      'Run data imports'),
  ('users.manage',                 'platform',      'Manage staff users'),
  ('roles.manage',                 'platform',      'Manage roles and their permissions'),
  ('permissions.manage',           'platform',      'Manage the permission catalogue'),
  ('settings.manage',              'platform',      'Manage business settings and pipelines'),
  ('integrations.manage',          'platform',      'Manage third-party integrations'),
  ('audit.view',                   'platform',      'Read the audit trail')
on conflict (key) do update
  set domain = excluded.domain, description = excluded.description;

-- -----------------------------------------------------------------------------
-- Grants.
--
-- SUPER_ADMIN is deliberately absent: roles.is_super short-circuits has_perm(),
-- so granting it rows would be redundant and would risk drift between the two
-- mechanisms.
-- -----------------------------------------------------------------------------
create or replace function public.grant_perm(p_role text, p_perm text, p_scope text)
returns void
language plpgsql
as $$
begin
  insert into public.role_permissions (role_key, permission_id, scope)
  select p_role, id, p_scope from public.permissions where key = p_perm
  on conflict (role_key, permission_id) do update set scope = excluded.scope;
end;
$$;

do $$
declare
  r record;
  -- role, permission, scope. Mirrors docs/RBAC-RLS.md §3.
  grants text[][] := array[
    -- ADMIN — everything operational, but NOT roles/permissions/integrations.
    -- That gap is the privilege-escalation guard: an admin can manage people
    -- but cannot redefine what a role is allowed to do.
    ['ADMIN','contacts.view','all'],['ADMIN','contacts.create','all'],['ADMIN','contacts.update','all'],
    ['ADMIN','contacts.delete','all'],['ADMIN','contacts.merge','all'],['ADMIN','contacts.assign','all'],
    ['ADMIN','contacts.export','all'],['ADMIN','notes.team.view','all'],['ADMIN','notes.team.create','all'],
    ['ADMIN','notes.hr_private.view','all'],['ADMIN','notes.finance_private.view','all'],['ADMIN','tags.manage','all'],
    ['ADMIN','cases.view','all'],['ADMIN','cases.create','all'],['ADMIN','cases.update','all'],
    ['ADMIN','cases.stage.change','all'],['ADMIN','cases.assign','all'],['ADMIN','cases.close','all'],
    ['ADMIN','cases.delete','all'],['ADMIN','jobs.view','all'],['ADMIN','jobs.manage','all'],
    ['ADMIN','employers.view','all'],['ADMIN','employers.manage','all'],['ADMIN','applications.screen','all'],
    ['ADMIN','interviews.manage','all'],['ADMIN','offers.manage','all'],['ADMIN','travel.manage','all'],
    ['ADMIN','bookings.view','all'],['ADMIN','bookings.manage','all'],['ADMIN','suppliers.manage','all'],
    ['ADMIN','documents.view.identity','all'],['ADMIN','documents.view.employment','all'],
    ['ADMIN','documents.view.financial','all'],['ADMIN','documents.view.travel','all'],
    ['ADMIN','documents.view.medical','all'],['ADMIN','documents.upload','all'],
    ['ADMIN','documents.verify','all'],['ADMIN','documents.download','all'],['ADMIN','documents.delete','all'],
    ['ADMIN','orders.view','all'],['ADMIN','orders.create','all'],['ADMIN','payments.view','all'],
    ['ADMIN','payments.record','all'],['ADMIN','installments.manage','all'],['ADMIN','refunds.create','all'],
    ['ADMIN','refunds.approve','all'],['ADMIN','invoices.view','all'],['ADMIN','invoices.issue','all'],
    ['ADMIN','invoices.void','all'],['ADMIN','payments.reconcile','all'],
    ['ADMIN','communications.view','all'],['ADMIN','communications.send','all'],['ADMIN','whatsapp.reply','all'],
    ['ADMIN','calls.view','all'],['ADMIN','calls.log','all'],['ADMIN','templates.manage','all'],
    ['ADMIN','campaigns.manage','all'],['ADMIN','lead_sources.manage','all'],
    ['ADMIN','tasks.view','all'],['ADMIN','tasks.manage','all'],['ADMIN','appointments.manage','all'],
    ['ADMIN','reports.operational','all'],['ADMIN','reports.financial','all'],['ADMIN','reports.marketing','all'],
    ['ADMIN','reports.staff_performance','all'],['ADMIN','imports.run','all'],['ADMIN','users.manage','all'],
    ['ADMIN','settings.manage','all'],['ADMIN','audit.view','all'],

    -- HR_MANAGER — recruitment at branch scope. No financial documents.
    ['HR_MANAGER','contacts.view','branch'],['HR_MANAGER','contacts.create','own'],['HR_MANAGER','contacts.update','branch'],
    ['HR_MANAGER','contacts.merge','branch'],['HR_MANAGER','contacts.assign','branch'],
    ['HR_MANAGER','notes.team.view','branch'],['HR_MANAGER','notes.team.create','own'],
    ['HR_MANAGER','notes.hr_private.view','branch'],['HR_MANAGER','tags.manage','branch'],
    ['HR_MANAGER','cases.view','branch'],['HR_MANAGER','cases.create','own'],['HR_MANAGER','cases.update','branch'],
    ['HR_MANAGER','cases.stage.change','branch'],['HR_MANAGER','cases.assign','branch'],['HR_MANAGER','cases.close','branch'],
    ['HR_MANAGER','jobs.view','all'],['HR_MANAGER','jobs.manage','all'],['HR_MANAGER','employers.view','all'],
    ['HR_MANAGER','employers.manage','all'],['HR_MANAGER','applications.screen','branch'],
    ['HR_MANAGER','interviews.manage','branch'],['HR_MANAGER','offers.manage','branch'],
    ['HR_MANAGER','documents.view.identity','branch'],['HR_MANAGER','documents.view.employment','branch'],
    ['HR_MANAGER','documents.view.travel','branch'],['HR_MANAGER','documents.view.medical','branch'],
    ['HR_MANAGER','documents.upload','branch'],['HR_MANAGER','documents.verify','branch'],
    ['HR_MANAGER','documents.download','branch'],
    ['HR_MANAGER','orders.view','branch'],['HR_MANAGER','orders.create','own'],['HR_MANAGER','payments.view','branch'],
    ['HR_MANAGER','invoices.view','branch'],
    ['HR_MANAGER','communications.view','branch'],['HR_MANAGER','communications.send','branch'],
    ['HR_MANAGER','whatsapp.reply','branch'],['HR_MANAGER','calls.view','branch'],['HR_MANAGER','calls.log','own'],
    ['HR_MANAGER','templates.manage','branch'],
    ['HR_MANAGER','tasks.view','branch'],['HR_MANAGER','tasks.manage','branch'],['HR_MANAGER','appointments.manage','branch'],
    ['HR_MANAGER','reports.operational','branch'],['HR_MANAGER','reports.marketing','branch'],
    ['HR_MANAGER','reports.staff_performance','branch'],['HR_MANAGER','imports.run','branch'],

    -- RECRUITER — assigned candidates only. Cannot verify documents
    -- (separation of duties: whoever progresses a candidate does not approve
    -- their paperwork).
    ['RECRUITER','contacts.view','own'],['RECRUITER','contacts.create','own'],['RECRUITER','contacts.update','own'],
    ['RECRUITER','notes.team.view','own'],['RECRUITER','notes.team.create','own'],
    ['RECRUITER','cases.view','own'],['RECRUITER','cases.create','own'],['RECRUITER','cases.update','own'],
    ['RECRUITER','cases.stage.change','own'],['RECRUITER','jobs.view','all'],['RECRUITER','employers.view','branch'],
    ['RECRUITER','applications.screen','own'],['RECRUITER','interviews.manage','own'],
    ['RECRUITER','documents.view.identity','own'],['RECRUITER','documents.view.employment','own'],
    ['RECRUITER','documents.view.travel','own'],['RECRUITER','documents.upload','own'],
    ['RECRUITER','documents.download','own'],
    ['RECRUITER','orders.view','own'],['RECRUITER','payments.view','own'],
    ['RECRUITER','communications.view','own'],['RECRUITER','communications.send','own'],
    ['RECRUITER','whatsapp.reply','own'],['RECRUITER','calls.view','own'],['RECRUITER','calls.log','own'],
    ['RECRUITER','tasks.view','own'],['RECRUITER','tasks.manage','own'],['RECRUITER','appointments.manage','own'],
    ['RECRUITER','reports.operational','own'],

    -- TRAVEL_MANAGER
    ['TRAVEL_MANAGER','contacts.view','branch'],['TRAVEL_MANAGER','contacts.create','own'],
    ['TRAVEL_MANAGER','contacts.update','branch'],['TRAVEL_MANAGER','contacts.merge','branch'],
    ['TRAVEL_MANAGER','contacts.assign','branch'],['TRAVEL_MANAGER','notes.team.view','branch'],
    ['TRAVEL_MANAGER','notes.team.create','own'],['TRAVEL_MANAGER','tags.manage','branch'],
    ['TRAVEL_MANAGER','cases.view','branch'],['TRAVEL_MANAGER','cases.create','own'],
    ['TRAVEL_MANAGER','cases.update','branch'],['TRAVEL_MANAGER','cases.stage.change','branch'],
    ['TRAVEL_MANAGER','cases.assign','branch'],['TRAVEL_MANAGER','cases.close','branch'],
    ['TRAVEL_MANAGER','travel.manage','branch'],['TRAVEL_MANAGER','bookings.view','branch'],
    ['TRAVEL_MANAGER','bookings.manage','branch'],['TRAVEL_MANAGER','suppliers.manage','branch'],
    ['TRAVEL_MANAGER','documents.view.identity','branch'],['TRAVEL_MANAGER','documents.view.employment','branch'],
    ['TRAVEL_MANAGER','documents.view.travel','branch'],['TRAVEL_MANAGER','documents.upload','branch'],
    ['TRAVEL_MANAGER','documents.verify','branch'],['TRAVEL_MANAGER','documents.download','branch'],
    ['TRAVEL_MANAGER','orders.view','branch'],['TRAVEL_MANAGER','orders.create','own'],
    ['TRAVEL_MANAGER','payments.view','branch'],['TRAVEL_MANAGER','invoices.view','branch'],
    ['TRAVEL_MANAGER','communications.view','branch'],['TRAVEL_MANAGER','communications.send','branch'],
    ['TRAVEL_MANAGER','whatsapp.reply','branch'],['TRAVEL_MANAGER','calls.view','branch'],
    ['TRAVEL_MANAGER','calls.log','own'],['TRAVEL_MANAGER','templates.manage','branch'],
    ['TRAVEL_MANAGER','tasks.view','branch'],['TRAVEL_MANAGER','tasks.manage','branch'],
    ['TRAVEL_MANAGER','appointments.manage','branch'],['TRAVEL_MANAGER','reports.operational','branch'],
    ['TRAVEL_MANAGER','reports.marketing','branch'],['TRAVEL_MANAGER','reports.staff_performance','branch'],
    ['TRAVEL_MANAGER','imports.run','branch'],

    -- TRAVEL_AGENT
    ['TRAVEL_AGENT','contacts.view','own'],['TRAVEL_AGENT','contacts.create','own'],['TRAVEL_AGENT','contacts.update','own'],
    ['TRAVEL_AGENT','notes.team.view','own'],['TRAVEL_AGENT','notes.team.create','own'],
    ['TRAVEL_AGENT','cases.view','own'],['TRAVEL_AGENT','cases.create','own'],['TRAVEL_AGENT','cases.update','own'],
    ['TRAVEL_AGENT','cases.stage.change','own'],['TRAVEL_AGENT','travel.manage','own'],
    ['TRAVEL_AGENT','bookings.view','own'],['TRAVEL_AGENT','bookings.manage','own'],
    ['TRAVEL_AGENT','documents.view.identity','own'],['TRAVEL_AGENT','documents.view.employment','own'],
    ['TRAVEL_AGENT','documents.view.travel','own'],['TRAVEL_AGENT','documents.upload','own'],
    ['TRAVEL_AGENT','documents.download','own'],
    ['TRAVEL_AGENT','orders.view','own'],['TRAVEL_AGENT','payments.view','own'],
    ['TRAVEL_AGENT','communications.view','own'],['TRAVEL_AGENT','communications.send','own'],
    ['TRAVEL_AGENT','whatsapp.reply','own'],['TRAVEL_AGENT','calls.view','own'],['TRAVEL_AGENT','calls.log','own'],
    ['TRAVEL_AGENT','tasks.view','own'],['TRAVEL_AGENT','tasks.manage','own'],
    ['TRAVEL_AGENT','appointments.manage','own'],['TRAVEL_AGENT','reports.operational','own'],

    -- FINANCE_MANAGER — all money. Deliberately NO identity documents and NO
    -- private HR notes: finance never needs to open a passport.
    ['FINANCE_MANAGER','contacts.view','all'],['FINANCE_MANAGER','notes.team.view','branch'],
    ['FINANCE_MANAGER','notes.team.create','own'],['FINANCE_MANAGER','notes.finance_private.view','all'],
    ['FINANCE_MANAGER','cases.view','all'],['FINANCE_MANAGER','employers.view','all'],
    ['FINANCE_MANAGER','bookings.view','all'],
    ['FINANCE_MANAGER','documents.view.financial','all'],['FINANCE_MANAGER','documents.upload','branch'],
    ['FINANCE_MANAGER','documents.download','branch'],
    ['FINANCE_MANAGER','orders.view','all'],['FINANCE_MANAGER','orders.create','all'],
    ['FINANCE_MANAGER','payments.view','all'],['FINANCE_MANAGER','payments.record','all'],
    ['FINANCE_MANAGER','installments.manage','all'],['FINANCE_MANAGER','refunds.create','all'],
    ['FINANCE_MANAGER','refunds.approve','all'],['FINANCE_MANAGER','invoices.view','all'],
    ['FINANCE_MANAGER','invoices.issue','all'],['FINANCE_MANAGER','invoices.void','all'],
    ['FINANCE_MANAGER','payments.reconcile','all'],
    ['FINANCE_MANAGER','communications.view','branch'],['FINANCE_MANAGER','communications.send','branch'],
    ['FINANCE_MANAGER','tasks.view','branch'],['FINANCE_MANAGER','tasks.manage','branch'],
    ['FINANCE_MANAGER','reports.operational','all'],['FINANCE_MANAGER','reports.financial','all'],
    ['FINANCE_MANAGER','audit.view','all'],

    -- ACCOUNTS — money at branch scope. Raises refunds but cannot approve them
    -- (two-person rule).
    ['ACCOUNTS','contacts.view','branch'],['ACCOUNTS','notes.team.view','branch'],['ACCOUNTS','notes.team.create','own'],
    ['ACCOUNTS','notes.finance_private.view','branch'],['ACCOUNTS','cases.view','branch'],
    ['ACCOUNTS','employers.view','branch'],['ACCOUNTS','bookings.view','branch'],
    ['ACCOUNTS','documents.view.financial','branch'],['ACCOUNTS','documents.upload','branch'],
    ['ACCOUNTS','documents.download','branch'],
    ['ACCOUNTS','orders.view','branch'],['ACCOUNTS','orders.create','branch'],['ACCOUNTS','payments.view','branch'],
    ['ACCOUNTS','payments.record','branch'],['ACCOUNTS','installments.manage','branch'],
    ['ACCOUNTS','refunds.create','branch'],['ACCOUNTS','invoices.view','branch'],['ACCOUNTS','invoices.issue','branch'],
    ['ACCOUNTS','payments.reconcile','branch'],
    ['ACCOUNTS','communications.view','branch'],['ACCOUNTS','communications.send','branch'],
    ['ACCOUNTS','tasks.view','branch'],['ACCOUNTS','tasks.manage','branch'],
    ['ACCOUNTS','reports.operational','branch'],['ACCOUNTS','reports.financial','branch'],

    -- OPERATIONS_MANAGER — cross-module oversight, no financial writes.
    ['OPERATIONS_MANAGER','contacts.view','branch'],['OPERATIONS_MANAGER','contacts.create','own'],
    ['OPERATIONS_MANAGER','contacts.update','branch'],['OPERATIONS_MANAGER','contacts.merge','branch'],
    ['OPERATIONS_MANAGER','contacts.assign','branch'],['OPERATIONS_MANAGER','notes.team.view','branch'],
    ['OPERATIONS_MANAGER','notes.team.create','own'],['OPERATIONS_MANAGER','tags.manage','branch'],
    ['OPERATIONS_MANAGER','cases.view','branch'],['OPERATIONS_MANAGER','cases.create','own'],
    ['OPERATIONS_MANAGER','cases.update','branch'],['OPERATIONS_MANAGER','cases.stage.change','branch'],
    ['OPERATIONS_MANAGER','cases.assign','branch'],['OPERATIONS_MANAGER','cases.close','branch'],
    ['OPERATIONS_MANAGER','jobs.view','all'],['OPERATIONS_MANAGER','jobs.manage','all'],
    ['OPERATIONS_MANAGER','employers.view','all'],['OPERATIONS_MANAGER','applications.screen','branch'],
    ['OPERATIONS_MANAGER','interviews.manage','branch'],['OPERATIONS_MANAGER','offers.manage','branch'],
    ['OPERATIONS_MANAGER','travel.manage','branch'],['OPERATIONS_MANAGER','bookings.view','branch'],
    ['OPERATIONS_MANAGER','bookings.manage','branch'],['OPERATIONS_MANAGER','suppliers.manage','branch'],
    ['OPERATIONS_MANAGER','documents.view.identity','branch'],['OPERATIONS_MANAGER','documents.view.employment','branch'],
    ['OPERATIONS_MANAGER','documents.view.financial','branch'],['OPERATIONS_MANAGER','documents.view.travel','branch'],
    ['OPERATIONS_MANAGER','documents.view.medical','branch'],['OPERATIONS_MANAGER','documents.upload','branch'],
    ['OPERATIONS_MANAGER','documents.verify','branch'],['OPERATIONS_MANAGER','documents.download','branch'],
    ['OPERATIONS_MANAGER','orders.view','branch'],['OPERATIONS_MANAGER','payments.view','branch'],
    ['OPERATIONS_MANAGER','invoices.view','branch'],
    ['OPERATIONS_MANAGER','communications.view','branch'],['OPERATIONS_MANAGER','communications.send','branch'],
    ['OPERATIONS_MANAGER','whatsapp.reply','branch'],['OPERATIONS_MANAGER','calls.view','branch'],
    ['OPERATIONS_MANAGER','calls.log','own'],['OPERATIONS_MANAGER','templates.manage','branch'],
    ['OPERATIONS_MANAGER','lead_sources.manage','branch'],
    ['OPERATIONS_MANAGER','tasks.view','branch'],['OPERATIONS_MANAGER','tasks.manage','all'],
    ['OPERATIONS_MANAGER','appointments.manage','branch'],
    ['OPERATIONS_MANAGER','reports.operational','all'],['OPERATIONS_MANAGER','reports.marketing','branch'],
    ['OPERATIONS_MANAGER','reports.staff_performance','branch'],['OPERATIONS_MANAGER','imports.run','branch'],

    -- SUPPORT_AGENT — answers questions. No passports, no money.
    ['SUPPORT_AGENT','contacts.view','branch'],['SUPPORT_AGENT','contacts.create','own'],
    ['SUPPORT_AGENT','contacts.update','own'],['SUPPORT_AGENT','notes.team.view','branch'],
    ['SUPPORT_AGENT','notes.team.create','own'],
    ['SUPPORT_AGENT','cases.view','branch'],['SUPPORT_AGENT','cases.create','own'],
    ['SUPPORT_AGENT','jobs.view','all'],['SUPPORT_AGENT','bookings.view','branch'],
    ['SUPPORT_AGENT','documents.view.employment','branch'],['SUPPORT_AGENT','documents.view.travel','branch'],
    ['SUPPORT_AGENT','documents.upload','branch'],
    ['SUPPORT_AGENT','orders.view','branch'],['SUPPORT_AGENT','payments.view','branch'],
    ['SUPPORT_AGENT','communications.view','branch'],['SUPPORT_AGENT','communications.send','branch'],
    ['SUPPORT_AGENT','whatsapp.reply','branch'],['SUPPORT_AGENT','calls.view','branch'],['SUPPORT_AGENT','calls.log','own'],
    ['SUPPORT_AGENT','tasks.view','own'],['SUPPORT_AGENT','tasks.manage','own'],
    ['SUPPORT_AGENT','appointments.manage','own'],['SUPPORT_AGENT','reports.operational','branch'],

    -- MARKETING_MANAGER — aggregates and campaigns. NO documents, NO payments.
    ['MARKETING_MANAGER','contacts.view','branch'],['MARKETING_MANAGER','contacts.create','own'],
    ['MARKETING_MANAGER','tags.manage','branch'],['MARKETING_MANAGER','jobs.view','all'],
    ['MARKETING_MANAGER','templates.manage','branch'],['MARKETING_MANAGER','campaigns.manage','all'],
    ['MARKETING_MANAGER','lead_sources.manage','all'],
    ['MARKETING_MANAGER','tasks.view','own'],['MARKETING_MANAGER','tasks.manage','own'],
    ['MARKETING_MANAGER','reports.operational','branch'],['MARKETING_MANAGER','reports.marketing','all'],
    ['MARKETING_MANAGER','imports.run','branch'],

    -- VIEW_ONLY — read at branch scope. No mutation permission of any kind,
    -- and no document access.
    ['VIEW_ONLY','contacts.view','branch'],['VIEW_ONLY','notes.team.view','branch'],
    ['VIEW_ONLY','cases.view','branch'],['VIEW_ONLY','jobs.view','all'],['VIEW_ONLY','employers.view','branch'],
    ['VIEW_ONLY','bookings.view','branch'],['VIEW_ONLY','orders.view','branch'],['VIEW_ONLY','payments.view','branch'],
    ['VIEW_ONLY','invoices.view','branch'],['VIEW_ONLY','communications.view','branch'],
    ['VIEW_ONLY','calls.view','branch'],['VIEW_ONLY','tasks.view','branch'],
    ['VIEW_ONLY','reports.operational','branch'],['VIEW_ONLY','reports.marketing','branch']
  ];
begin
  for i in 1 .. array_length(grants, 1) loop
    perform public.grant_perm(grants[i][1], grants[i][2], grants[i][3]);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- Baseline branch. One physical branch today; the column exists everywhere so
-- multi-branch is a switch to turn on rather than a migration.
-- -----------------------------------------------------------------------------
insert into public.branches (name, code, city, region, country_code)
values ('Lucknow', 'LKO', 'Lucknow', 'Uttar Pradesh', 'IN')
on conflict (code) do nothing;

-- -----------------------------------------------------------------------------
-- Default pipelines. These stages are a STARTING POINT, not business truth —
-- they are data, and an administrator replaces them with the real workflow
-- after the recruitment and travel leads confirm it.
-- -----------------------------------------------------------------------------
do $$
declare
  rec_pipeline uuid;
  trv_pipeline uuid;
begin
  insert into public.pipelines (case_type, name, is_default)
  values ('recruitment', 'Recruitment', true)
  on conflict do nothing;

  select id into rec_pipeline from public.pipelines
   where case_type = 'recruitment' and is_default limit 1;

  if rec_pipeline is not null then
    insert into public.pipeline_stages (pipeline_id, key, name, position, is_won, is_lost) values
      (rec_pipeline, 'legacy_imported', 'Legacy — imported, not triaged', 0, false, false),
      (rec_pipeline, 'new',             'New Lead',            1, false, false),
      (rec_pipeline, 'contacted',       'Contacted',           2, false, false),
      (rec_pipeline, 'documents',       'Documents Pending',   3, false, false),
      (rec_pipeline, 'screening',       'Screening',           4, false, false),
      (rec_pipeline, 'interview',       'Interview',           5, false, false),
      (rec_pipeline, 'selected',        'Selected',            6, false, false),
      (rec_pipeline, 'processing',      'Offer & Processing',  7, false, false),
      (rec_pipeline, 'visa',            'Visa Processing',     8, false, false),
      (rec_pipeline, 'travel',          'Travel Preparation',  9, false, false),
      (rec_pipeline, 'completed',       'Joined',             10, true,  false),
      (rec_pipeline, 'lost',            'Lost',               11, false, true)
    on conflict (pipeline_id, key) do nothing;
  end if;

  insert into public.pipelines (case_type, name, is_default)
  values ('travel', 'Travel', true)
  on conflict do nothing;

  select id into trv_pipeline from public.pipelines
   where case_type = 'travel' and is_default limit 1;

  if trv_pipeline is not null then
    insert into public.pipeline_stages (pipeline_id, key, name, position, is_won, is_lost) values
      (trv_pipeline, 'new',         'New Inquiry',          1, false, false),
      (trv_pipeline, 'contacted',   'Contacted',            2, false, false),
      (trv_pipeline, 'requirement', 'Requirement Collected',3, false, false),
      (trv_pipeline, 'quoted',      'Quote Sent',           4, false, false),
      (trv_pipeline, 'awaiting',    'Awaiting Payment',     5, false, false),
      (trv_pipeline, 'confirmed',   'Confirmed',            6, false, false),
      (trv_pipeline, 'documents',   'Documents Pending',    7, false, false),
      (trv_pipeline, 'processing',  'Processing',           8, false, false),
      (trv_pipeline, 'ready',       'Travel Ready',         9, false, false),
      (trv_pipeline, 'completed',   'Completed',           10, true,  false),
      (trv_pipeline, 'cancelled',   'Cancelled',           11, false, true)
    on conflict (pipeline_id, key) do nothing;
  end if;
end $$;

-- Feature flags — everything platform-side starts OFF. Code can deploy without
-- launching a feature, and there is an instant off-switch that needs no deploy.
insert into public.settings (key, value, description) values
  ('feature.customer_portal',  'false'::jsonb, 'Customer portal (Phase 3)'),
  ('feature.admin_crm',        'false'::jsonb, 'Staff CRM (Phase 4)'),
  ('feature.payments',         'false'::jsonb, 'Razorpay payments (Phase 7)'),
  ('feature.whatsapp',         'false'::jsonb, 'WhatsApp Cloud API (Phase 9)'),
  ('feature.telephony',        'false'::jsonb, 'IVR / telephony (Phase 10)'),
  ('feature.resend_email',     'false'::jsonb, 'Server-side email via Resend (Phase 1.5)')
on conflict (key) do nothing;
