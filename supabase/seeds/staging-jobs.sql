-- =============================================================================
-- STAGING TEST jobs — synthetic listings for manual QA and the end-to-end suite.
--
-- NEVER PRODUCTION. Three things keep these rows out of a live database:
--
--   1. This file is not a migration. `supabase db push` and every migration path
--      ignore supabase/seeds/, and the migration suite asserts no migration writes a
--      job row (lib/jobs/seed-safety.test.ts).
--   2. It runs only through `npm run db:mumbai -- seed-jobs` or `npm run db:seed:local`,
--      which refuse every target but Mumbai staging and the local stack, and which set
--      app.seed_target before running it.
--   3. The guard below aborts unless that setting says staging — so pasting this file
--      into a SQL editor, or `psql -f` against the wrong project, does nothing.
--
-- Every title starts with "STAGING TEST —", every reference with STG-JOB-, and every
-- summary says it is a staging test listing. Idempotent: a job that already exists (by
-- reference) is left as it is, including any changes made to it during QA.
--
-- Dates are relative to the day the seed runs, so the scenarios stay meaningful. Rows
-- are written as the system (no staff claims), which is how the audit trail records them.
-- =============================================================================

begin;

do $$
begin
  if coalesce(current_setting('app.seed_target', true), '') <> 'staging' then
    raise exception 'staging-jobs.sql refuses to run: app.seed_target is not "staging". Use npm run db:mumbai -- seed-jobs or npm run db:seed:local.';
  end if;
end $$;

select set_config('request.jwt.claims', '', false);

create temp table stg_job (
  reference text, title text, category text, country text, city text,
  disclosure public.job_employer_disclosure, employer text,
  employment public.job_employment_type, vacancies int,
  currency text, salary_min int, salary_max int, period public.job_salary_period,
  experience text, education text, languages text, summary text,
  responsibilities text[], requirements text[], benefits text[], additional text, notes text,
  availability public.job_availability, closes_in int,
  promotion public.job_promotion, featured_in int,
  access public.job_application_access, method public.job_application_method,
  status public.job_status
) on commit drop;

insert into stg_job values
-- 1. Ongoing general hiring, published, free.
('STG-JOB-001', 'STAGING TEST — Warehouse Helper', 'warehouse-helper', 'AE', 'Dubai', 'confidential', null,
 'full_time', null, 'AED', 1200, 1500, 'month', null, null, 'Basic English or Hindi',
 'Staging test listing. Loading, unloading and stock handling in a distribution warehouse, on rotating shifts.',
 array['Load and unload delivery vehicles', 'Move stock to marked locations', 'Keep aisles clear and safe'],
 '{}', array['Shared accommodation (staging test value)'], null, 'Staging test: confidential employer, no real client.',
 'ongoing', null, 'standard', null, 'free', 'online_form', 'published'),
-- 2. Time-limited general hiring, published, free, named employer.
('STG-JOB-002', 'STAGING TEST — Mall Cleaner', 'mall-cleaner', 'QA', 'Doha', 'named', 'STAGING TEST Facilities WLL',
 'full_time', 20, null, null, null, null, null, null, null,
 'Staging test listing. Cleaning of shopping mall common areas on a rotating shift for a specific contract.',
 array['Clean floors, washrooms and seating areas', 'Report spills and damage to the supervisor'],
 '{}', '{}', null, null,
 'time_limited', 30, 'standard', null, 'free', 'online_form', 'published'),
-- 3. Professional, free, standard, time-limited, fully described.
('STG-JOB-003', 'STAGING TEST — Accountant', 'accountant', 'SA', 'Riyadh', 'confidential', null,
 'full_time', 2, 'SAR', 6000, 8000, 'month', '3 years of accounting experience, GCC preferred', 'B.Com or equivalent', 'English',
 'Staging test listing. Maintain the general ledger and prepare monthly management accounts for a trading company.',
 array['Maintain the general ledger', 'Prepare monthly management accounts', 'Reconcile bank statements'],
 array['Degree in commerce or accounting', 'Working knowledge of Tally or SAP', '3 years of accounting experience'],
 array['Annual return air ticket (staging test value)'], 'Interviews are held online. This is a staging test listing.', null,
 'time_limited', 21, 'standard', null, 'free', 'online_form', 'published'),
-- 4. Featured professional, free, ongoing.
('STG-JOB-004', 'STAGING TEST — Site Supervisor', 'supervisor', 'KW', 'Kuwait City', 'confidential', null,
 'contract', null, 'KWD', 350, 450, 'month', '5 years supervising construction crews', null, 'English and Hindi',
 'Staging test listing. Supervise daily site activity and labour teams on an active construction project.',
 array['Plan daily work for labour teams', 'Enforce site safety rules', 'Report progress to the project engineer'],
 array['5 years of site supervision', 'Safety training certificate'],
 '{}', null, null,
 'ongoing', null, 'featured', 14, 'free', 'online_form', 'published'),
-- 5. Draft, complete enough to submit for review.
('STG-JOB-005', 'STAGING TEST — HVAC Technician', 'technician', 'OM', 'Muscat', 'confidential', null,
 'full_time', null, null, null, null, null, '2 years with split and ducted systems', 'ITI or diploma', null,
 'Staging test listing. Install and service HVAC units in residential and commercial buildings.',
 array['Install split and ducted units', 'Carry out preventive maintenance'],
 array['ITI or diploma in refrigeration and air conditioning'], '{}', null, null,
 'ongoing', null, 'standard', null, 'free', 'online_form', 'draft'),
-- 6. In review.
('STG-JOB-006', 'STAGING TEST — Sales Executive', 'sales', 'BH', 'Manama', 'confidential', null,
 'full_time', null, null, null, null, null, '2 years in retail or B2B sales', null, 'English',
 'Staging test listing. Develop and manage accounts for a building materials distributor.',
 array['Visit existing customers', 'Find new accounts'],
 array['2 years of sales experience', 'Valid GCC driving licence'], '{}', null, null,
 'time_limited', 25, 'standard', null, 'free', 'online_form', 'review'),
-- 7. Closed.
('STG-JOB-007', 'STAGING TEST — Helper', 'helper', 'AE', 'Abu Dhabi', 'confidential', null,
 'full_time', null, null, null, null, null, null, null, null,
 'Staging test listing. General helper for a catering unit. This job has closed.',
 '{}', '{}', '{}', null, null,
 'ongoing', null, 'standard', null, 'free', 'online_form', 'closed'),
-- 8. Archived.
('STG-JOB-008', 'STAGING TEST — Civil Engineer', 'engineer', 'SA', 'Jeddah', 'confidential', null,
 'full_time', null, null, null, null, null, null, null, null,
 'Staging test listing. Archived: not visible anywhere on the public site.',
 '{}', array['B.E. Civil'], '{}', null, null,
 'ongoing', null, 'standard', null, 'free', 'online_form', 'archived'),
-- 9. Featured period ended: published, still free, no longer featured.
('STG-JOB-009', 'STAGING TEST — Labour', 'labour', 'OM', 'Sohar', 'confidential', null,
 'full_time', null, 'OMR', 120, 150, 'month', null, null, null,
 'Staging test listing. General labour for an industrial site. Its featured period has ended.',
 '{}', '{}', '{}', null, null,
 'ongoing', null, 'featured', -2, 'free', 'online_form', 'published'),
-- 10. Invalid publish attempt: a professional draft missing country, summary, employer and requirements.
('STG-JOB-010', 'STAGING TEST — Operations Manager (incomplete)', 'manager', null, null, null, null,
 null, null, null, null, null, null, null, null, null,
 null, '{}', '{}', '{}', null, 'Staging test: try to submit this for review — it must be refused, naming what is missing.',
 'time_limited', null, 'standard', null, 'free', 'online_form', 'draft'),
-- 11. Paid application access: complete and in review, but publishing must be refused.
('STG-JOB-011', 'STAGING TEST — Mechanical Engineer (paid access)', 'engineer', 'QA', 'Doha', 'confidential', null,
 'full_time', null, null, null, null, null, '4 years in plant maintenance', 'B.E. Mechanical', null,
 'Staging test listing. Exists only to prove that paid application access cannot be published.',
 array['Maintain rotating equipment'], array['B.E. Mechanical', '4 years of plant maintenance'], '{}', null,
 'Staging test: press Publish — it must be refused because paid application access is not available.',
 'ongoing', null, 'standard', null, 'paid', 'online_form', 'review'),
-- 12. Applied for on WhatsApp.
('STG-JOB-012', 'STAGING TEST — Cleaner (apply on WhatsApp)', 'cleaner', 'BH', 'Manama', 'confidential', null,
 'part_time', null, null, null, null, null, null, null, null,
 'Staging test listing. Office cleaning in the evenings. Applications for this job are taken on WhatsApp.',
 '{}', '{}', '{}', null, null,
 'ongoing', null, 'standard', null, 'free', 'whatsapp', 'published');

insert into public.jobs (
  reference, title, category_id, country_code, city, employer_disclosure, employer_name,
  employment_type, vacancies, salary_currency, salary_min, salary_max, salary_period,
  experience, education, languages, summary, responsibilities, requirements, benefits,
  additional_info, internal_notes, availability, closes_on, promotion, featured_until,
  application_access, application_method, status
)
select
  s.reference, s.title, c.id, s.country, s.city, s.disclosure, s.employer,
  s.employment, s.vacancies, s.currency, s.salary_min, s.salary_max, s.period,
  s.experience, s.education, s.languages, s.summary, s.responsibilities, s.requirements, s.benefits,
  s.additional, s.notes, s.availability,
  case when s.closes_in is null then null else (now() at time zone 'Asia/Kolkata')::date + s.closes_in end,
  s.promotion,
  case when s.featured_in is null then null else (now() at time zone 'Asia/Kolkata')::date + s.featured_in end,
  s.access, s.method, s.status
from stg_job s
join public.job_categories c on c.slug = s.category
on conflict (reference) do nothing;

select 'staging test jobs present: ' || count(*) as result from public.jobs where reference like 'STG-JOB-%';

commit;
