import { describe, expect, it } from "vitest";
import { hrefWith, oneOf, pageCount, pageOf, rangeOf, safeStaffNext, searchText, uuidParam } from "./params";

describe("list parameters", () => {
  it("reads a page number, defaulting anything odd to 1", () => {
    expect(pageOf({ page: "3" })).toBe(3);
    for (const bad of ["0", "-1", "2.5", "abc", "", "99999999"]) expect(pageOf({ page: bad })).toBe(1);
    expect(pageOf({ page: ["4", "5"] })).toBe(4);
    expect(pageOf({})).toBe(1);
  });

  it("turns a page into an inclusive PostgREST range, and counts pages", () => {
    expect(rangeOf(1, 25)).toEqual({ from: 0, to: 24 });
    expect(rangeOf(3, 25)).toEqual({ from: 50, to: 74 });
    expect(pageCount(0)).toBe(1);
    expect(pageCount(26, 25)).toBe(2);
  });

  it("accepts a filter only from its vocabulary", () => {
    expect(oneOf({ status: "published" }, "status", ["draft", "published"] as const)).toBe("published");
    expect(oneOf({ status: "published),id.gt.(0" }, "status", ["draft", "published"] as const)).toBe("");
    expect(uuidParam({ job: "not-a-uuid" }, "job")).toBe("");
    expect(uuidParam({ job: "0F0B2236-8EAE-492A-8B0D-5F68B7500099" }, "job")).toBe("0f0b2236-8eae-492a-8b0d-5f68b7500099");
  });

  it("strips PostgREST filter syntax out of search text", () => {
    expect(searchText({ q: "  Warehouse,  helper  " })).toBe("Warehouse helper");
    expect(searchText({ q: "x),status.eq.draft,title.ilike.(*" })).toBe("x status eq draft title ilike");
    expect(searchText({ q: "a".repeat(200) })).toHaveLength(80);
  });

  it("builds list links that keep other filters and drop empty ones", () => {
    expect(hrefWith("/admin/jobs", { q: "helper", status: "" }, { page: 2 })).toBe("/admin/jobs?q=helper&page=2");
    expect(hrefWith("/admin/jobs", { q: "helper", page: "3" }, { page: 1 })).toBe("/admin/jobs?q=helper");
  });
});

describe("post sign-in redirect", () => {
  it("allows only paths inside the staff workspace", () => {
    expect(safeStaffNext("/admin/jobs?status=draft")).toBe("/admin/jobs?status=draft");
    expect(safeStaffNext("/admin")).toBe("/admin");
    for (const bad of [
      "https://evil.example/admin",
      "//evil.example/admin",
      "/\\evil.example",
      "/admin\\@evil.example",
      "/portal",
      "/",
      "javascript:alert(1)",
      "/admin/login?next=/admin",
      null,
      undefined,
      "",
    ]) {
      expect(safeStaffNext(bad as string | null | undefined), String(bad)).toBe("/admin");
    }
  });
});
