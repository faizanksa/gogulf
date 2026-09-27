import { describe, expect, it, vi } from "vitest";
import { onboardStaff, onboardingState, parseStaffInvite, type OnboardingPorts } from "./staff-onboarding";

const BRANCH = "6e104830-d261-460c-8caf-14a1de34cba6";
const STAFF_ID = "11111111-1111-4111-8111-111111111111";
const AUTH_ID = "22222222-2222-4222-8222-222222222222";

const form = (over: Record<string, unknown> = {}) => ({ full_name: "Asha Verma", email: "asha@gogulf.co", role: "RECRUITER", branch_id: BRANCH, ...over });

/** A database that says yes to everything, with every call recorded. */
function ports(over: Partial<OnboardingPorts> = {}) {
  const p: OnboardingPorts = {
    canCreateSuperAdmin: false,
    roleExists: vi.fn(async () => true),
    branchExists: vi.fn(async () => true),
    findStaff: vi.fn(async () => null),
    insertStaff: vi.fn(async () => ({ ok: true as const, id: STAFF_ID })),
    ensureLogin: vi.fn(async () => ({ ok: true as const, authUserId: AUTH_ID, created: true })),
    linkLogin: vi.fn(async () => ({ ok: true as const })),
    ...over,
  };
  return p;
}

describe("parseStaffInvite", () => {
  it("normalises what staff type", () => {
    expect(parseStaffInvite(form({ full_name: "  Asha   Verma ", email: " Asha@GoGulf.co " }))).toEqual({
      ok: true,
      value: { fullName: "Asha Verma", email: "asha@gogulf.co", role: "RECRUITER", branchId: BRANCH },
    });
  });

  it.each([
    ["an outside domain", { email: "asha@gmail.com" }, "email"],
    ["a look-alike domain", { email: "asha@gogulf.co.evil.com" }, "email"],
    ["a subdomain", { email: "asha@mail.gogulf.co" }, "email"],
    ["two @ signs", { email: "a@b@gogulf.co" }, "email"],
    ["an empty address", { email: "" }, "email"],
    ["a one-letter name", { full_name: "A" }, "full_name"],
    ["markup in the name", { full_name: "Asha <script>" }, "full_name"],
    ["a control character in the name", { full_name: "Asha\u0007Verma" }, "full_name"],
    ["no role", { role: "" }, "role"],
    ["a malformed role", { role: "admin; drop" }, "role"],
    ["a malformed branch", { branch_id: "lucknow" }, "branch_id"],
    ["a non-string field", { email: ["asha@gogulf.co"] }, "email"],
  ])("refuses %s", (_what, over, field) => {
    const parsed = parseStaffInvite(form(over));
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(Object.keys(parsed.fieldErrors)).toContain(field);
  });
});

describe("onboardStaff", () => {
  it("writes the row, then creates the login, then links them — in that order", async () => {
    const order: string[] = [];
    const p = ports({
      insertStaff: vi.fn(async () => (order.push("insert"), { ok: true as const, id: STAFF_ID })),
      ensureLogin: vi.fn(async () => (order.push("login"), { ok: true as const, authUserId: AUTH_ID, created: true })),
      linkLogin: vi.fn(async () => (order.push("link"), { ok: true as const })),
    });
    const result = await onboardStaff(form(), p);
    expect(result).toEqual({ ok: true, staffId: STAFF_ID, message: "Staff member added." });
    expect(order).toEqual(["insert", "login", "link"]);
    expect(p.insertStaff).toHaveBeenCalledWith({ fullName: "Asha Verma", email: "asha@gogulf.co", role: "RECRUITER", branchId: BRANCH });
    expect(p.linkLogin).toHaveBeenCalledWith(STAFF_ID, AUTH_ID);
  });

  it("creates no login at all when the form is invalid", async () => {
    const p = ports();
    const result = await onboardStaff(form({ email: "asha@gmail.com" }), p);
    expect(result.ok).toBe(false);
    expect(p.insertStaff).not.toHaveBeenCalled();
    expect(p.ensureLogin).not.toHaveBeenCalled();
  });

  it("refuses a SUPER_ADMIN unless the caller may manage roles", async () => {
    const p = ports();
    const result = await onboardStaff(form({ role: "SUPER_ADMIN" }), p);
    expect(result).toMatchObject({ ok: false, fieldErrors: { role: expect.any(String) } });
    expect(p.ensureLogin).not.toHaveBeenCalled();

    const allowed = await onboardStaff(form({ role: "SUPER_ADMIN" }), ports({ canCreateSuperAdmin: true }));
    expect(allowed.ok).toBe(true);
  });

  it("refuses a role or branch the database does not know", async () => {
    const p = ports({ roleExists: vi.fn(async () => false), branchExists: vi.fn(async () => false) });
    const result = await onboardStaff(form(), p);
    expect(result).toMatchObject({ ok: false, fieldErrors: { role: expect.any(String), branch_id: expect.any(String) } });
    expect(p.insertStaff).not.toHaveBeenCalled();
  });

  it("creates no login when RLS refuses the row", async () => {
    const p = ports({ insertStaff: vi.fn(async () => ({ ok: false as const, conflict: false })) });
    const result = await onboardStaff(form(), p);
    expect(result).toMatchObject({ ok: false, message: expect.stringMatching(/refused/) });
    expect(p.ensureLogin).not.toHaveBeenCalled();
  });

  it("reports a duplicate address as a field error", async () => {
    const p = ports({ insertStaff: vi.fn(async () => ({ ok: false as const, conflict: true })) });
    expect(await onboardStaff(form(), p)).toMatchObject({ ok: false, fieldErrors: { email: expect.any(String) } });
    expect(p.ensureLogin).not.toHaveBeenCalled();
  });

  it("never touches someone already onboarded, active or not", async () => {
    for (const isActive of [true, false]) {
      const p = ports({ findStaff: vi.fn(async () => ({ id: STAFF_ID, authUserId: AUTH_ID, isActive, role: "RECRUITER" })) });
      const result = await onboardStaff(form(), p);
      expect(result.ok).toBe(false);
      expect(result.message).toMatch(isActive ? /already on the staff list/ : /Reactivate/);
      expect(p.insertStaff).not.toHaveBeenCalled();
      expect(p.ensureLogin).not.toHaveBeenCalled();
      expect(p.linkLogin).not.toHaveBeenCalled();
    }
  });

  it("resumes a row an earlier attempt left without a login, without inserting again", async () => {
    const p = ports({ findStaff: vi.fn(async () => ({ id: STAFF_ID, authUserId: null, isActive: true, role: "RECRUITER" })) });
    const result = await onboardStaff(form(), p);
    expect(result).toEqual({ ok: true, staffId: STAFF_ID, message: "Finished an earlier, incomplete invitation." });
    expect(p.insertStaff).not.toHaveBeenCalled();
    expect(p.linkLogin).toHaveBeenCalledWith(STAFF_ID, AUTH_ID);
  });

  it.each([
    ["unconfirmed", /unconfirmed/],
    ["not-staff-shaped", /customer sign-in method/],
    ["failed", /Add the same address again/],
  ] as const)("does not link when the login step reports %s", async (reason, message) => {
    const p = ports({ ensureLogin: vi.fn(async () => ({ ok: false as const, reason })) });
    const result = await onboardStaff(form(), p);
    expect(result).toMatchObject({ ok: false, staffId: STAFF_ID });
    expect(result.message).toMatch(message);
    expect(p.linkLogin).not.toHaveBeenCalled();
  });

  it("does not resume a SUPER_ADMIN row for a caller who could not link it — no login is created", async () => {
    const p = ports({ findStaff: vi.fn(async () => ({ id: STAFF_ID, authUserId: null, isActive: true, role: "SUPER_ADMIN" })) });
    expect((await onboardStaff(form(), p)).ok).toBe(false);
    expect(p.ensureLogin).not.toHaveBeenCalled();
  });

  it("sends a deactivated row without a login to Reactivate, creating nothing", async () => {
    const p = ports({ findStaff: vi.fn(async () => ({ id: STAFF_ID, authUserId: null, isActive: false, role: "RECRUITER" })) });
    expect((await onboardStaff(form(), p)).message).toMatch(/Reactivate/);
    expect(p.ensureLogin).not.toHaveBeenCalled();
  });

  it("treats a link another administrator just made to the same account as success", async () => {
    const p = ports({ linkLogin: vi.fn(async () => ({ ok: false as const, conflict: false, linkedTo: AUTH_ID })) });
    expect(await onboardStaff(form(), p)).toEqual({ ok: true, staffId: STAFF_ID, message: "Staff member added." });
  });

  it("does not treat a row linked to a DIFFERENT account as success", async () => {
    const p = ports({ linkLogin: vi.fn(async () => ({ ok: false as const, conflict: false, linkedTo: "33333333-3333-4333-8333-333333333333" })) });
    expect((await onboardStaff(form(), p)).ok).toBe(false);
  });

  it("explains a login that already belongs to another staff record", async () => {
    const p = ports({ linkLogin: vi.fn(async () => ({ ok: false as const, conflict: true })) });
    expect((await onboardStaff(form(), p)).message).toMatch(/belongs to another staff record/);
  });
});

describe("onboardingState", () => {
  const base = { staff_id: STAFF_ID, has_login: true, email_confirmed: true, google_linked: false, google_last_sign_in: null };
  it("reads each stage of onboarding", () => {
    expect(onboardingState(undefined)).toBe("unknown");
    expect(onboardingState({ ...base, has_login: false, email_confirmed: false })).toBe("no-login");
    expect(onboardingState({ ...base, email_confirmed: false })).toBe("unconfirmed");
    expect(onboardingState(base)).toBe("awaiting-sign-in");
    expect(onboardingState({ ...base, google_linked: true, google_last_sign_in: "2026-09-27T10:00:00Z" })).toBe("signed-in");
  });
});
