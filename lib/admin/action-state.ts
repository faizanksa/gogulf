/**
 * What a staff Server Action reports back to the form that called it. Plain data, so it
 * crosses the server/client boundary; never a raw database error.
 */
export type ActionState = {
  ok: boolean;
  message: string;
  /** Reasons the database refused, one sentence each. */
  problems?: string[];
  /** Saved, but with something the staff member should know (a removed contradiction). */
  warnings?: string[];
  /** Per-field messages for a form. */
  fieldErrors?: Record<string, string>;
} | null;
