import { z } from "zod";

/**
 * Shared content validation. Every module in content/ validates its data on import,
 * and the build imports them — so invalid content fails the build instead of being
 * published. Server-side only: client components receive plain props, never these
 * modules (this keeps Zod out of the browser bundle).
 */

export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date")
  .refine((d) => !Number.isNaN(Date.parse(`${d}T00:00:00Z`)), "Not a real date");

export const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase words joined by hyphens");

/**
 * `confirmed`   the business has confirmed it; may be published anywhere
 * `unconfirmed` shown only outside production, always visibly flagged (lib/deployment.ts)
 */
export const verification = z.enum(["confirmed", "unconfirmed"]);
export type Verification = z.infer<typeof verification>;

export function validate<T>(schema: z.ZodType<T>, data: unknown, source: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`).join("\n");
    throw new Error(`Invalid content in ${source}:\n${issues}`);
  }
  return result.data;
}
