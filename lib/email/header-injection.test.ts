import { describe, it, expect } from "vitest";
import {
  contactSchema,
  serviceInquirySchema,
  jobApplicationSchema,
} from "@/lib/forms/schemas";
import { contactInternalEmail } from "./templates/contact";
import { serviceInquiryInternalEmail } from "./templates/service-inquiry";
import { jobApplicationInternalEmail } from "./templates/job-application";

/**
 * Email header injection.
 *
 * User input reaches the Subject header (and Reply-To). The vulnerability is a
 * CR or LF surviving into a header, which lets an attacker append their own —
 * Bcc, for instance. The shared text cleaner collapses all whitespace runs to a
 * single space, so newlines never get that far.
 *
 * Note what is NOT a vulnerability: the literal text "Bcc:" appearing inside a
 * single-line subject. Without a newline it is just characters in one header
 * value, and mail clients render it as part of the subject. Asserting its
 * absence would be testing the wrong property.
 */

const ATTACK = "Attacker\nBcc: victim@evil.example\r\nX-Injected: yes";
const hasCrLf = (s: string) => /[\r\n]/.test(s);

describe("header injection is neutralised at validation", () => {
  it("strips CR/LF from the contact subject", () => {
    const parsed = contactSchema.parse({
      from_name: ATTACK,
      reply_to: "a@b.co",
      message: "line one\nline two",
    });
    expect(hasCrLf(parsed.from_name)).toBe(false);

    const mail = contactInternalEmail(parsed);
    expect(hasCrLf(mail.subject)).toBe(false);
  });

  it("strips CR/LF from the service inquiry subject", () => {
    const parsed = serviceInquirySchema.parse({
      service_type: ATTACK,
      from_name: ATTACK,
      reply_to: "a@b.co",
      phone: "9936309015",
    });
    expect(hasCrLf(serviceInquiryInternalEmail(parsed).subject)).toBe(false);
  });

  it("strips CR/LF from the job application subject", () => {
    const parsed = jobApplicationSchema.parse({
      from_name: ATTACK,
      reply_to: "a@b.co",
      phone: "9936309015",
      service_type: ATTACK,
      country: "Saudi\nArabia",
    });
    expect(hasCrLf(jobApplicationInternalEmail(parsed).subject)).toBe(false);
  });

  it("rejects a non-string reply_to, so an array cannot become extra recipients", () => {
    // Reply-To is built from this value. An array reaching the provider could
    // widen the recipient set.
    const parsed = contactSchema.safeParse({
      from_name: "A",
      reply_to: ["a@b.co", "attacker@evil.example"],
      message: "m",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects an email containing a newline outright", () => {
    const parsed = contactSchema.safeParse({
      from_name: "A",
      reply_to: "a@b.co\nBcc: attacker@evil.example",
      message: "m",
    });
    expect(parsed.success).toBe(false);
  });
});
