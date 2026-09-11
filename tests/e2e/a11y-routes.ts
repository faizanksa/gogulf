import { PRODUCTION_ROUTES } from "./routes";

/** A job that exists outside production (unconfirmed listings are shown, flagged). */
export const SAMPLE_JOB = "/jobs/site-supervisor-saudi-arabia";

/** Routes the axe suite scans, with the status each must return. */
export const A11Y_ROUTES: { path: string; expectStatus: number }[] = [
  ...PRODUCTION_ROUTES.map((path) => ({ path, expectStatus: 200 })),
  { path: "/verify", expectStatus: 200 },
  { path: SAMPLE_JOB, expectStatus: 200 },
  { path: "/admin/login", expectStatus: 200 },
  { path: "/portal/login", expectStatus: 200 },
  { path: "/this-page-does-not-exist", expectStatus: 404 },
];
