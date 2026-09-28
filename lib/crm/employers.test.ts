import { describe, expect, it } from "vitest";
import { employerRefusal, parseEmployerForm, parseEmployerLink } from "./employers";

const valid = {
  name: "  Gulf   Build   LLC ",
  country_code: "ae",
  registration_number: "",
  website: "",
  contact_person: "",
  email: "",
  phone: "",
  status: "active",
  notes: "",
};

describe("parseEmployerForm", () => {
  it("cleans a minimal employer and leaves the optional fields empty", () => {
    const parsed = parseEmployerForm(valid);
    expect(parsed).toEqual({
      ok: true,
      value: {
        name: "Gulf Build LLC",
        country_code: "AE",
        registration_number: null,
        website: null,
        contact_person: null,
        email: null,
        phone: null,
        status: "active",
        notes: null,
      },
    });
  });

  it("keeps every agreed field, and adds https:// to a bare website", () => {
    const parsed = parseEmployerForm({
      ...valid,
      registration_number: "CR 1234567",
      website: "gulfbuild.example.com",
      contact_person: "Aisha Khan",
      email: "HR@GulfBuild.example.com",
      phone: "+971 4 000 0000",
      status: "prospect",
      notes: "Met at the Dubai fair.\r\nFollow up in March.",
      branch_id: "19b190ea-8af6-4f9c-917f-3d35092d1e23",
    });
    expect(parsed.ok && parsed.value).toMatchObject({
      registration_number: "CR 1234567",
      website: "https://gulfbuild.example.com",
      contact_person: "Aisha Khan",
      email: "hr@gulfbuild.example.com",
      phone: "+971 4 000 0000",
      status: "prospect",
      notes: "Met at the Dubai fair.\nFollow up in March.",
      branch_id: "19b190ea-8af6-4f9c-917f-3d35092d1e23",
    });
  });

  it("does not send a branch unless one was chosen", () => {
    const parsed = parseEmployerForm(valid);
    expect(parsed.ok && "branch_id" in parsed.value).toBe(false);
  });

  it("names each field that needs attention", () => {
    const parsed = parseEmployerForm({
      name: "X",
      country_code: "UAE",
      registration_number: "x",
      website: "not a site",
      contact_person: "Y",
      email: "nope",
      phone: "call me",
      status: "blacklisted",
      notes: "n".repeat(4001),
      branch_id: "lucknow",
    });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(Object.keys(parsed.fieldErrors).sort()).toEqual(
        ["branch_id", "contact_person", "country_code", "email", "name", "notes", "phone", "registration_number", "status", "website"].sort(),
      );
    }
  });

  it("refuses markup in the name", () => {
    const parsed = parseEmployerForm({ ...valid, name: "<script>Acme</script>" });
    expect(parsed.ok).toBe(false);
  });
});

describe("parseEmployerLink", () => {
  it("is undefined when the form had no employer picker — a save never clears an unseen link", () => {
    expect(parseEmployerLink({ employer_id: "" })).toEqual({ ok: true, value: undefined });
  });
  it("is null for 'no employer record'", () => {
    expect(parseEmployerLink({ employer_field: "1", employer_id: "" })).toEqual({ ok: true, value: null });
  });
  it("accepts an employer id", () => {
    const id = "5747e570-0000-4000-8000-00000000000a";
    expect(parseEmployerLink({ employer_field: "1", employer_id: id })).toEqual({ ok: true, value: id });
  });
  it("refuses anything else", () => {
    expect(parseEmployerLink({ employer_field: "1", employer_id: "Gulf Build" })).toEqual({ ok: false });
  });
});

describe("employerRefusal", () => {
  it("explains a duplicate, a hidden employer, a format problem and a permission refusal", () => {
    expect(employerRefusal({ code: "23505" })).toMatch(/already exists/);
    expect(employerRefusal({ code: "42501", message: "employer_not_available: link only an employer you can see" })).toMatch(/not one you can link/);
    expect(employerRefusal({ code: "23514" })).toMatch(/valid format/);
    expect(employerRefusal({ code: "42501", message: "new row violates row-level security policy" })).toMatch(/permission/);
    expect(employerRefusal(null)).toMatch(/refused/);
  });
});
