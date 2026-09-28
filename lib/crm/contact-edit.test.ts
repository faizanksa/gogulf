import { describe, expect, it } from "vitest";
import { editRefusal, isUuid, mergeRefusal, parseContactEdit, parseOwner } from "./contact-edit";

const valid = {
  full_name: "  Asha   Verma ",
  display_name: "",
  lifecycle_stage: "lead",
  country_code: "in",
  nationality: "Indian",
  preferred_language: "hi",
  date_of_birth: "1994-03-12",
  gender: "",
  notes_summary: "  Prefers WhatsApp.  ",
  consent_email: "on",
  consent_marketing: "true",
};
const today = new Date("2026-09-28T12:00:00Z");

describe("parseContactEdit", () => {
  it("cleans and normalises what staff typed", () => {
    const parsed = parseContactEdit(valid, today);
    expect(parsed).toEqual({
      ok: true,
      value: {
        full_name: "Asha Verma",
        display_name: null,
        lifecycle_stage: "lead",
        country_code: "IN",
        nationality: "Indian",
        preferred_language: "hi",
        date_of_birth: "1994-03-12",
        gender: null,
        notes_summary: "Prefers WhatsApp.",
        consent_email: true,
        consent_whatsapp: false,
        consent_sms: false,
        consent_calls: false,
        consent_marketing: true,
      },
    });
  });

  it("sends only the editable fields — never ids, merge links, primary identities or legal hold", () => {
    const parsed = parseContactEdit({ ...valid, id: "x", merged_into_id: "x", primary_email: "x@x.com", legal_hold_until: "2030-01-01", branch_id: "x" }, today);
    expect(parsed.ok && Object.keys(parsed.value).sort()).toEqual(
      ["consent_calls", "consent_email", "consent_marketing", "consent_sms", "consent_whatsapp", "country_code", "date_of_birth", "display_name", "full_name", "gender", "lifecycle_stage", "nationality", "notes_summary", "preferred_language"].sort(),
    );
  });

  it("defaults the language to English when none is sent", () => {
    const parsed = parseContactEdit({ ...valid, preferred_language: "" }, today);
    expect(parsed.ok && parsed.value.preferred_language).toBe("en");
  });

  it.each([
    ["a one-letter name", { full_name: "A" }, "full_name"],
    ["markup in the name", { full_name: "Asha <b>" }, "full_name"],
    ["an unknown stage", { lifecycle_stage: "vip" }, "lifecycle_stage"],
    ["a three-letter country", { country_code: "IND" }, "country_code"],
    ["an unknown language shape", { preferred_language: "hindi" }, "preferred_language"],
    ["an impossible date", { date_of_birth: "1994-02-31" }, "date_of_birth"],
    ["a future birth date", { date_of_birth: "2030-01-01" }, "date_of_birth"],
    ["a too-long summary", { notes_summary: "x".repeat(2001) }, "notes_summary"],
  ])("refuses %s", (_what, over, field) => {
    const parsed = parseContactEdit({ ...valid, ...over }, today);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(Object.keys(parsed.fieldErrors)).toContain(field);
  });
});

describe("parseOwner", () => {
  it("tells apart 'not sent', 'nobody' and a staff id", () => {
    expect(parseOwner({})).toEqual({ ok: true, value: undefined });
    expect(parseOwner({ owner_id: "" })).toEqual({ ok: true, value: null });
    expect(parseOwner({ owner_id: "11111111-1111-4111-8111-111111111111" })).toEqual({ ok: true, value: "11111111-1111-4111-8111-111111111111" });
    expect(parseOwner({ owner_id: "someone" })).toEqual({ ok: false });
  });
});

describe("database refusals, as sentences", () => {
  it("explains each merge refusal without exposing the raw error", () => {
    expect(mergeRefusal({ message: "cannot_merge_contact_into_itself" })).toMatch(/into itself/);
    expect(mergeRefusal({ message: "contact_already_merged" })).toMatch(/already been merged/);
    expect(mergeRefusal({ message: "survivor_is_merged: …" })).toMatch(/itself merged/);
    expect(mergeRefusal({ code: "42501", message: "cross_branch_merge_requires_all_scope" })).toMatch(/all branches/);
    expect(mergeRefusal({ code: "42501", message: "not_permitted" })).toMatch(/permission/);
    expect(mergeRefusal({ code: "XX000", message: "relation … secret detail" })).toBe("The merge was refused and nothing was changed.");
  });

  it("explains each edit refusal", () => {
    expect(editRefusal({ message: "contact_merged: …" })).toMatch(/merged into another/);
    expect(editRefusal({ message: "cross_branch_move_requires_all_scope" })).toMatch(/another branch/);
    expect(editRefusal({ message: "contacts_assign_required" })).toMatch(/assign/);
    expect(editRefusal(null)).toMatch(/refused/);
  });

  it("recognises a uuid", () => {
    expect(isUuid("11111111-1111-4111-8111-111111111111")).toBe(true);
    expect(isUuid("1; drop table")).toBe(false);
  });
});
