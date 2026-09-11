/**
 * Which deployment this build is for — decides whether unconfirmed content may appear.
 *
 *   production  the live site           unconfirmed content excluded entirely
 *   staging     staging.gogulf.co        shown, always visibly flagged
 *   preview     other Vercel previews    shown, flagged
 *   local       developer machines       shown, flagged
 *
 * Evaluated at build time for static pages. Fail-safe direction: anything that is not
 * provably production still flags unconfirmed content rather than hiding the flag.
 */

export type DeploymentStage = "production" | "staging" | "preview" | "local";

export function deploymentStage(env: Record<string, string | undefined> = process.env): DeploymentStage {
  if (env.APP_ENV === "staging") return "staging";
  if (env.VERCEL_ENV === "production") return "production";
  if (env.VERCEL_ENV === "preview") return "preview";
  if (env.APP_ENV === "production") return "production";
  return "local";
}

/** Unconfirmed content (placeholder jobs, pending facts) may appear only outside production. */
export function showsUnconfirmedContent(stage: DeploymentStage = deploymentStage()): boolean {
  return stage !== "production";
}
