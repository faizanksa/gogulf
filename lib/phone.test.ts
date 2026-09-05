import { describe, it, expect } from "vitest";
import { normalizePhoneE164, normalizeEmail, normalizeWaId } from "./phone";

/**
 * These cases are the contract between this file and the Postgres function
 * `public.normalize_phone_e164`. The two implementations must agree — if one
 * changes, change both and extend this table.
 *
 * The production inspection found four legacy applications carrying four
 * different phone formats (10, 11, 12 and 13 digits), so the shapes below are
 * real data, not hypotheticals.
 */
describe("normalizePhoneE164", () => {
  it("prefixes a bare Indian mobile with +91", () => {
    expect(normalizePhoneE164("9936309015")).toBe("+919936309015");
    expect(normalizePhoneE164("6123456789")).toBe("+916123456789");
  });

  it("strips a leading trunk zero", () => {
    expect(normalizePhoneE164("09936309015")).toBe("+919936309015");
  });

  it("accepts an already country-coded number", () => {
    expect(normalizePhoneE164("919936309015")).toBe("+919936309015");
    expect(normalizePhoneE164("+91 99363 09015")).toBe("+919936309015");
  });

  it("ignores punctuation and spacing", () => {
    expect(normalizePhoneE164("+91-99363-09015")).toBe("+919936309015");
    expect(normalizePhoneE164("(0) 99363 09015")).toBe("+919936309015");
  });

  it("strips a 00 international prefix", () => {
    expect(normalizePhoneE164("00919936309015")).toBe("+919936309015");
  });

  it("keeps a foreign number with its own country code", () => {
    expect(normalizePhoneE164("971501234567")).toBe("+971501234567");
    expect(normalizePhoneE164("+966512345678")).toBe("+966512345678");
  });

  // The critical property. Returning null forces the caller to quarantine the
  // row for human review; guessing would silently merge two different people.
  it("returns null rather than guessing when the input is ambiguous", () => {
    expect(normalizePhoneE164("12345")).toBeNull();
    expect(normalizePhoneE164("999")).toBeNull();
    expect(normalizePhoneE164("1234567890123456789")).toBeNull();
    expect(normalizePhoneE164("abc")).toBeNull();
    expect(normalizePhoneE164("")).toBeNull();
    expect(normalizePhoneE164(null)).toBeNull();
    expect(normalizePhoneE164(undefined)).toBeNull();
  });

  it("does not treat a 10-digit landline-style number as a mobile", () => {
    // Indian mobiles start 6-9. A 10-digit number starting 2 is not one, so it
    // falls through rather than being wrongly prefixed.
    expect(normalizePhoneE164("2234567890")).toBeNull();
  });

  it("is idempotent — normalising twice changes nothing", () => {
    const once = normalizePhoneE164("9936309015");
    expect(normalizePhoneE164(once)).toBe(once);
  });
});

describe("normalizeEmail", () => {
  it("lowercases and trims", () => {
    expect(normalizeEmail("  Careers@GoGulf.CO ")).toBe("careers@gogulf.co");
  });

  it("returns null for empty input", () => {
    expect(normalizeEmail("")).toBeNull();
    expect(normalizeEmail("   ")).toBeNull();
    expect(normalizeEmail(null)).toBeNull();
  });
});

describe("normalizeWaId", () => {
  // This is what lets a WhatsApp message resolve to a contact created from a
  // web form: wa_id arrives as bare digits, and must land on the same value.
  it("resolves a wa_id to the same E.164 value as the phone identity", () => {
    expect(normalizeWaId("919936309015")).toBe("+919936309015");
    expect(normalizeWaId("919936309015")).toBe(normalizePhoneE164("+91 99363 09015"));
  });
});
