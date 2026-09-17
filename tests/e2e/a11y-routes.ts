import { PRODUCTION_ROUTES } from "./routes";

/**
 * Jobs from the STAGING TEST seed (supabase/seeds/staging-jobs.sql). Load it before a
 * local run with `npm run db:seed:local`; staging carries it already. Never present in
 * production, which is why no production test depends on a job existing.
 */
export const SAMPLE_JOB = "/jobs/staging-test-accountant-stg-job-003";
export const FEATURED_JOB = "/jobs/staging-test-site-supervisor-stg-job-004";
export const CLOSED_JOB = "/jobs/staging-test-helper-stg-job-007";
export const DRAFT_JOB = "/jobs/staging-test-hvac-technician-stg-job-005";
export const ARCHIVED_JOB = "/jobs/staging-test-civil-engineer-stg-job-008";
export const WHATSAPP_JOB = "/jobs/staging-test-cleaner-apply-on-whatsapp-stg-job-012";

/** Routes the axe suite scans, with the status each must return. */
export const A11Y_ROUTES: { path: string; expectStatus: number }[] = [
  ...PRODUCTION_ROUTES.map((path) => ({ path, expectStatus: 200 })),
  { path: "/verify", expectStatus: 200 },
  { path: SAMPLE_JOB, expectStatus: 200 },
  { path: CLOSED_JOB, expectStatus: 200 },
  { path: "/jobs/apply?ref=STG-JOB-002", expectStatus: 200 },
  { path: "/admin/login", expectStatus: 200 },
  { path: "/portal/login", expectStatus: 200 },
  { path: "/this-page-does-not-exist", expectStatus: 404 },
  // Pseudo-locales (local and staging builds only): right-to-left and lengthened text.
  { path: "/ar-XB", expectStatus: 200 },
  { path: "/ar-XB/jobs", expectStatus: 200 },
  { path: "/ar-XB/jobs/apply", expectStatus: 200 },
  { path: "/ar-XB/verify", expectStatus: 200 },
  { path: "/ar-XB/candidates", expectStatus: 200 },
  { path: "/ar-XB/employers", expectStatus: 200 },
  { path: "/ar-XB/services", expectStatus: 200 },
  { path: `/ar-XB${SAMPLE_JOB}`, expectStatus: 200 },
  { path: "/ar-XB/about", expectStatus: 200 },
  { path: "/ar-XB/contact", expectStatus: 200 },
  { path: "/en-XA/verify", expectStatus: 200 },
  { path: "/ar-XB/pricing", expectStatus: 404 },
];
