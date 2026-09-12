import { describe, it, expect } from "vitest";
import {
  contactSchema,
  serviceInquirySchema,
  jobApplicationSchema,
  toFieldErrors,
} from "./schemas";

describe("contact schema", () => {
  it("accepts a well-formed submission", () => {
    const parsed = contactSchema.safeParse({
      from_name: "  Asha   Kumar ",
      reply_to: "  ASHA@Example.COM ",
      phone: "9936309015",
      message: "Hello",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.from_name).toBe("Asha Kumar"); // trimmed, collapsed
      expect(parsed.data.reply_to).toBe("asha@example.com"); // lowercased
    }
  });

  it("gives human-readable messages for missing required fields", () => {
    // Raw Zod type errors ("expected string, received undefined") reach the
    // user, so they must be phrased for a person, not a developer.
    const parsed = contactSchema.safeParse({});
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const errors = toFieldErrors(parsed.error);
      expect(errors.from_name?.[0]).toBe("Name is required.");
      expect(errors.reply_to?.[0]).toBe("Email address is required.");
      expect(errors.message?.[0]).toBe("Message is required.");
    }
  });

  it("rejects a malformed email", () => {
    const parsed = contactSchema.safeParse({
      from_name: "A", reply_to: "not-an-email", message: "m",
    });
    expect(parsed.success).toBe(false);
  });

  it("treats phone as optional but validates it when present", () => {
    expect(contactSchema.safeParse({ from_name: "A", reply_to: "a@b.co", message: "m" }).success).toBe(true);
    expect(contactSchema.safeParse({ from_name: "A", reply_to: "a@b.co", message: "m", phone: "123" }).success).toBe(false);
  });

  it("caps message length so a huge body cannot be posted", () => {
    const parsed = contactSchema.safeParse({
      from_name: "A", reply_to: "a@b.co", message: "x".repeat(6000),
    });
    expect(parsed.success).toBe(false);
  });

  it("ACCEPTS a filled honeypot at the schema layer", () => {
    // Critical: rejecting here would return a 400 naming the `website` field,
    // telling a bot exactly what tripped it. The handler drops it with a 200
    // instead, so rejection is indistinguishable from success.
    const parsed = contactSchema.safeParse({
      from_name: "Bot", reply_to: "bot@example.com", message: "spam", website: "http://spam",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.website).toBe("http://spam");
  });
});

describe("service inquiry schema", () => {
  const valid = {
    service_type: "Job Matching",
    from_name: "Ravi",
    reply_to: "ravi@example.com",
    phone: "+919936309015",
  };

  it("requires service, name, email and phone", () => {
    expect(serviceInquirySchema.safeParse(valid).success).toBe(true);
    const { phone: _omit, ...noPhone } = valid;
    expect(serviceInquirySchema.safeParse(noPhone).success).toBe(false);
  });

  it("treats an empty optional string as absent rather than empty", () => {
    const parsed = serviceInquirySchema.safeParse({ ...valid, country: "", message: "" });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.country).toBeUndefined();
      expect(parsed.data.message).toBeUndefined();
    }
  });

  it("strips unknown fields, so a forged to_email cannot ride along", () => {
    const parsed = serviceInquirySchema.safeParse({
      ...valid, to_email: "attacker@evil.example",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data).not.toHaveProperty("to_email");
  });
});

describe("job application schema", () => {
  const valid = {
    from_name: "Imran",
    reply_to: "imran@example.com",
    phone: "9936309015",
    service_type: "Site Supervisor",
  };

  it("accepts a submission without an upload reference", () => {
    expect(jobApplicationSchema.safeParse(valid).success).toBe(true);
  });

  it("requires submission_id to be a UUID when present", () => {
    expect(jobApplicationSchema.safeParse({ ...valid, submission_id: "not-a-uuid" }).success).toBe(false);
    expect(
      jobApplicationSchema.safeParse({
        ...valid, submission_id: "3f6e1556-c66a-49ba-8005-22b0699793cb",
      }).success,
    ).toBe(true);
  });

  it("normalises a phone in any of the formats seen in legacy data", () => {
    for (const phone of ["9936309015", "09936309015", "919936309015", "+91 99363 09015"]) {
      expect(jobApplicationSchema.safeParse({ ...valid, phone }).success, phone).toBe(true);
    }
  });
});
