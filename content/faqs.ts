import { z } from "zod";
import { validate, verification } from "./schema";

/**
 * Frequently asked questions, per hub. Empty until the business supplies real answers:
 * an FAQ is a promise, and none may be invented. No FAQPage structured data is planned
 * (Google limits FAQ rich results to government and health sites).
 */

const faq = z.object({
  question: z.string().min(8).endsWith("?"),
  answer: z.string().min(20),
  verification,
});

export type Faq = z.infer<typeof faq>;

export const FAQS = validate(
  z.object({ jobSeekers: z.array(faq), employers: z.array(faq), travel: z.array(faq) }),
  { jobSeekers: [], employers: [], travel: [] },
  "content/faqs.ts",
);
