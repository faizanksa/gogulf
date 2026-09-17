/**
 * Supabase database types.
 *
 * `Database` is generated from the migrated schema — never edited by hand:
 *
 *   npx supabase migration up --local
 *   npx supabase gen types typescript --local --schema public > types/supabase.generated.ts
 *
 * Regenerate after every migration. Generated types make the schema and the code
 * disagree loudly rather than silently. The aliases below are convenience names
 * for the enums, so application code does not spell out the generated paths.
 */

import type { Database } from "./supabase.generated";

export type { Database, Json } from "./supabase.generated";

type Enums = Database["public"]["Enums"];
type Tables = Database["public"]["Tables"];

export type TableRow<T extends keyof Tables> = Tables[T]["Row"];

export type LifecycleStage = Enums["lifecycle_stage"];
export type IdentityType = Enums["identity_type"];
export type CaseType = Enums["case_type"];
export type CaseStatus = Enums["case_status"];

export type JobStatus = Enums["job_status"];
export type JobClassification = Enums["job_classification"];
export type JobAvailability = Enums["job_availability"];
export type JobPromotion = Enums["job_promotion"];
export type JobApplicationAccess = Enums["job_application_access"];
export type JobApplicationMethod = Enums["job_application_method"];
export type JobEmploymentType = Enums["job_employment_type"];
export type JobEmployerDisclosure = Enums["job_employer_disclosure"];
export type JobSalaryPeriod = Enums["job_salary_period"];
export type ApplicationStatus = Enums["application_status"];

/** Scope on a permission grant (0002). A check constraint, not an enum, in the schema. */
export type PermissionScope = "all" | "branch" | "own";

export type NoteVisibility = "team" | "hr_private" | "finance_private";

export type ActorType = "staff" | "customer" | "system" | "provider";
