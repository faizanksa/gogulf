import { describe, expect, it } from "vitest";
import { jobPostingJsonLd } from "@/lib/job-posting";
import { explainDbError } from "./errors";
import {
  availableTransitions,
  canTransition,
  endOfIndianDay,
  indianDateOf,
  isActivelyFeatured,
  isOpenForApplications,
  JOB_STATUSES,
  PAID_APPLICATIONS_AVAILABLE,
  todayInIndia,
  TRANSITIONS,
} from "./model";
import { jobHasClosed, jobIsFeatured, jobIsOpen, orderForListing, toPublicJob, type JobRowForPublic, type PublicJob } from "./public-job";
import { linesOf, parseJobForm, PROBLEM_MESSAGES, PUBLISH_PROBLEMS, publishProblems, type PublishCheckInput } from "./validation";

const NOW = new Date("2026-09-17T08:00:00Z"); // 13:30 in India

function row(overrides: Partial<JobRowForPublic> = {}): JobRowForPublic {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    reference: "GG-JOB-2026-00001",
    slug: "warehouse-helper-gg-job-2026-00001",
    title: "Warehouse Helper",
    classification: "general",
    country_code: "AE",
    city: "Dubai",
    employer_disclosure: "confidential",
    employer_name: null,
    employment_type: "full_time",
    vacancies: null,
    salary_currency: null,
    salary_min: null,
    salary_max: null,
    salary_period: null,
    experience: null,
    education: null,
    languages: null,
    summary: "Loading, unloading and stock handling in a distribution warehouse.",
    responsibilities: [],
    requirements: [],
    benefits: [],
    additional_info: null,
    availability: "ongoing",
    closes_on: null,
    promotion: "standard",
    featured_until: null,
    application_access: "free",
    application_method: "online_form",
    status: "published",
    published_at: "2026-09-10T04:00:00Z",
    updated_at: "2026-09-12T04:00:00Z",
    category: { slug: "warehouse-helper", name: "Warehouse Helper" },
    ...overrides,
  };
}
const job = (overrides: Partial<JobRowForPublic> = {}): PublicJob => toPublicJob(row(overrides));

describe("lifecycle", () => {
  it("allows exactly the transitions jobs_before_write allows", () => {
    const allowed = JOB_STATUSES.flatMap((from) => JOB_STATUSES.filter((to) => canTransition(from, to)).map((to) => `${from}>${to}`));
    expect(allowed.sort()).toEqual(
      [
        "draft>review", "draft>archived",
        "review>draft", "review>published", "review>archived",
        "published>draft", "published>closed", "published>archived",
        "closed>published", "closed>archived",
        "archived>draft",
      ].sort(),
    );
  });

  it("never lets a draft jump straight to published, or an archived job straight back to public", () => {
    expect(canTransition("draft", "published")).toBe(false);
    expect(canTransition("archived", "published")).toBe(false);
    expect(canTransition("draft", "closed")).toBe(false);
  });

  it("names every action in words staff recognise", () => {
    expect(availableTransitions("published").map((a) => a.label)).toEqual(["Unpublish", "Close", "Archive"]);
    expect(availableTransitions("closed").map((a) => a.label)).toEqual(["Reopen", "Archive"]);
    expect(availableTransitions("archived").map((a) => a.label)).toEqual(["Restore"]);
    for (const from of JOB_STATUSES) expect(TRANSITIONS[from].length).toBeGreaterThan(0);
  });

  it("does not offer paid applications", () => {
    expect(PAID_APPLICATIONS_AVAILABLE).toBe(false);
  });
});

describe("dates are read in India", () => {
  it("rolls the date over at midnight in India, not UTC", () => {
    expect(todayInIndia(new Date("2026-09-16T18:29:59Z"))).toBe("2026-09-16");
    expect(todayInIndia(new Date("2026-09-16T18:30:00Z"))).toBe("2026-09-17");
    expect(indianDateOf("2026-09-16T20:00:00Z")).toBe("2026-09-17");
  });

  it("keeps a job open for the whole of its closing day", () => {
    const closing = { status: "published", availability: "time_limited", closesOn: "2026-09-17", promotion: "standard", featuredUntil: null, applicationAccess: "free" } as const;
    expect(endOfIndianDay("2026-09-17")).toBe(Date.parse("2026-09-17T18:30:00Z"));
    expect(isOpenForApplications(closing, new Date("2026-09-17T18:29:59Z"))).toBe(true);
    expect(isOpenForApplications(closing, new Date("2026-09-17T18:30:00Z"))).toBe(false);
  });

  it("keeps an ongoing job open with no date at all", () => {
    expect(jobIsOpen(job(), new Date("2099-01-01"))).toBe(true);
  });

  it("is not open when closed, not published, or not free", () => {
    expect(jobIsOpen(job({ status: "closed" }), NOW)).toBe(false);
    expect(jobIsOpen(job({ status: "draft" }), NOW)).toBe(false);
    expect(jobIsOpen(job({ application_access: "paid" }), NOW)).toBe(false);
    expect(jobIsOpen(job({ availability: "time_limited", closes_on: null }), NOW)).toBe(false);
    expect(jobHasClosed(job({ availability: "time_limited", closes_on: "2026-09-16" }), NOW)).toBe(true);
  });
});

describe("featured", () => {
  it("counts only while featured_until has not passed", () => {
    expect(jobIsFeatured(job({ promotion: "featured", featured_until: null }), NOW)).toBe(true);
    expect(jobIsFeatured(job({ promotion: "featured", featured_until: "2026-09-17" }), NOW)).toBe(true);
    expect(jobIsFeatured(job({ promotion: "featured", featured_until: "2026-09-16" }), NOW)).toBe(false);
    expect(jobIsFeatured(job({ promotion: "standard" }), NOW)).toBe(false);
  });

  it("changes nothing else when it lapses: a lapsed featured job is still open and free", () => {
    const lapsed = job({ promotion: "featured", featured_until: "2026-09-01" });
    expect(isActivelyFeatured(lapsed, NOW)).toBe(false);
    expect(jobIsOpen(lapsed, NOW)).toBe(true);
    expect(lapsed.applicationAccess).toBe("free");
  });

  it("lists featured jobs first, then the newest", () => {
    const a = job({ id: "a", reference: "A-001", published_at: "2026-09-15T00:00:00Z" });
    const b = job({ id: "b", reference: "B-001", published_at: "2026-09-01T00:00:00Z", promotion: "featured" });
    const c = job({ id: "c", reference: "C-001", published_at: "2026-09-16T00:00:00Z", promotion: "featured", featured_until: "2026-09-02" });
    expect(orderForListing([a, b, c], NOW).map((j) => j.id)).toEqual(["b", "c", "a"]);
  });
});

describe("the public view never states what the job does not", () => {
  it("leaves an absent salary, employer and category absent", () => {
    const j = job({ employer_disclosure: null, category: null });
    expect(j.salary).toBeNull();
    expect(j.employer).toBeNull();
    expect(j.category).toBeNull();
  });

  it("never exposes a confidential employer's name", () => {
    expect(job({ employer_disclosure: "confidential", employer_name: "Should Not Show" }).employer).toEqual({ disclosure: "confidential" });
    expect(job({ employer_disclosure: "named", employer_name: "Named Co" }).employer).toEqual({ disclosure: "named", name: "Named Co" });
  });

  it("builds a salary only from a complete statement", () => {
    expect(job({ salary_currency: "AED", salary_min: 1200, salary_max: null, salary_period: "month" }).salary).toBeNull();
    expect(job({ salary_currency: "AED", salary_min: 1200, salary_max: 1500, salary_period: "month" }).salary).toEqual({
      currency: "AED", min: 1200, max: 1500, period: "month",
    });
  });
});

describe("the staff job form", () => {
  const base = {
    title: "  STAGING TEST — Accountant ",
    category_id: "0f0b2236-8eae-492a-8b0d-5f68b7500099",
    availability: "ongoing",
    promotion: "standard",
    application_access: "free",
    application_method: "online_form",
  };

  it("accepts a minimal draft and tidies whitespace", () => {
    const r = parseJobForm(base, NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.values.title).toBe("STAGING TEST — Accountant");
    expect(r.values.closes_on).toBeNull();
    expect(r.values.salary_currency).toBeNull();
    expect(r.warnings).toEqual([]);
  });

  it("requires a title and a category even for a draft", () => {
    const r = parseJobForm({ ...base, title: "", category_id: "" }, NOW);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(Object.keys(r.fieldErrors).sort()).toEqual(["category_id", "title"]);
  });

  it("removes a closing date from an ongoing job, and says so", () => {
    const r = parseJobForm({ ...base, closes_on: "2026-10-01" }, NOW);
    expect(r.ok && r.values.closes_on).toBe(null);
    expect(r.warnings.join(" ")).toMatch(/Ongoing jobs have no closing date/);
  });

  it("removes a featured-until date from a standard job, and says so", () => {
    const r = parseJobForm({ ...base, featured_until: "2026-10-01" }, NOW);
    expect(r.ok && r.values.featured_until).toBe(null);
    expect(r.warnings.join(" ")).toMatch(/Standard jobs are not featured/);
  });

  it("warns that a featured job whose date has passed is not shown as featured", () => {
    const r = parseJobForm({ ...base, promotion: "featured", featured_until: "2026-09-16" }, NOW);
    expect(r.ok && r.values.featured_until).toBe("2026-09-16");
    expect(r.warnings.join(" ")).toMatch(/not shown as featured/);
  });

  it("never saves a confidential employer's name on the listing", () => {
    const r = parseJobForm({ ...base, employer_disclosure: "confidential", employer_name: "Secret Client LLC" }, NOW);
    expect(r.ok && r.values.employer_name).toBe(null);
    expect(r.warnings.join(" ")).toMatch(/internal notes/);
  });

  it("requires a name for a named employer", () => {
    const r = parseJobForm({ ...base, employer_disclosure: "named" }, NOW);
    expect(!r.ok && r.fieldErrors.employer_name).toMatch(/employer's name/);
  });

  it("takes a salary whole or not at all, maximum not below minimum", () => {
    expect(parseJobForm({ ...base, salary_currency: "SAR", salary_min: "3,500" }, NOW).ok).toBe(false);
    const inverted = parseJobForm({ ...base, salary_currency: "SAR", salary_min: "4500", salary_max: "3500", salary_period: "month" }, NOW);
    expect(!inverted.ok && inverted.fieldErrors.salary_max).toMatch(/cannot be lower/);
    const ok = parseJobForm({ ...base, salary_currency: "SAR", salary_min: "3,500", salary_max: "4500", salary_period: "month" }, NOW);
    expect(ok.ok && [ok.values.salary_min, ok.values.salary_max]).toEqual([3500, 4500]);
  });

  it("warns that paid application access cannot be published", () => {
    const r = parseJobForm({ ...base, application_access: "paid" }, NOW);
    expect(r.ok).toBe(true);
    expect(r.warnings.join(" ")).toMatch(/Paid application access is not currently available/);
  });

  it("refuses values outside the vocabulary", () => {
    const r = parseJobForm({ ...base, country_code: "US", employment_type: "gig", availability: "forever" }, NOW);
    expect(!r.ok && Object.keys(r.fieldErrors).sort()).toEqual(["availability", "country_code", "employment_type"]);
    expect(parseJobForm({ ...base, reference: "gg job 1" }, NOW).ok).toBe(false);
    expect(parseJobForm({ ...base, closes_on: "2026-02-30", availability: "time_limited" }, NOW).ok).toBe(false);
  });

  it("reads one list entry per line, dropping typed bullets and blank lines", () => {
    expect(linesOf("- Degree in accounting\n\n• 3 years GCC experience\r\n2. Tally ")).toEqual([
      "Degree in accounting",
      "3 years GCC experience",
      "Tally",
    ]);
  });
});

describe("publish rules mirror job_publish_problems()", () => {
  const complete: PublishCheckInput = {
    classification: "general",
    categoryActive: true,
    country_code: "AE",
    employment_type: "full_time",
    summary: "Loading, unloading and stock handling.",
    employer_disclosure: "confidential",
    availability: "ongoing",
    closes_on: null,
    requirements: [],
    application_access: "free",
  };

  it("lets a complete general ongoing job publish without inventing requirements or a date", () => {
    expect(publishProblems(complete, "published", { now: NOW })).toEqual([]);
  });

  it("names everything missing from an empty draft, in the database's order", () => {
    const empty: PublishCheckInput = { ...complete, country_code: null, employment_type: null, summary: null, employer_disclosure: null };
    expect(publishProblems(empty, "review", { now: NOW })).toEqual([
      "country_missing", "employment_type_missing", "summary_missing", "employer_disclosure_missing",
    ]);
  });

  it("requires a closing date for a time-limited job, still ahead at publication", () => {
    expect(publishProblems({ ...complete, availability: "time_limited" }, "review", { now: NOW })).toEqual(["closing_date_missing"]);
    const past = { ...complete, availability: "time_limited" as const, closes_on: "2026-09-16" };
    expect(publishProblems(past, "review", { now: NOW })).toEqual([]);
    expect(publishProblems(past, "published", { now: NOW })).toEqual(["closing_date_passed"]);
    expect(publishProblems({ ...past, closes_on: "2026-09-17" }, "published", { now: NOW })).toEqual([]);
    expect(publishProblems(past, "published", { now: NOW, entering: false })).toEqual([]);
  });

  it("requires a professional job to state its requirements", () => {
    expect(publishProblems({ ...complete, classification: "professional" }, "review", { now: NOW })).toEqual(["requirements_missing"]);
    expect(publishProblems({ ...complete, classification: "professional", requirements: ["Degree"] }, "review", { now: NOW })).toEqual([]);
  });

  it("allows paid access in review but never at publication", () => {
    const paid = { ...complete, application_access: "paid" as const };
    expect(publishProblems(paid, "review", { now: NOW })).toEqual([]);
    expect(publishProblems(paid, "published", { now: NOW })).toEqual(["paid_application_unavailable"]);
  });

  it("has a sentence for every problem code", () => {
    for (const p of PUBLISH_PROBLEMS) expect(PROBLEM_MESSAGES[p].length).toBeGreaterThan(10);
  });
});

describe("database refusals in words", () => {
  it("lists the publish problems the trigger named", () => {
    const e = explainDbError({ code: "23514", message: "job_not_publishable", details: "country_missing,paid_application_unavailable" });
    expect(e.problems).toEqual([PROBLEM_MESSAGES.country_missing, PROBLEM_MESSAGES.paid_application_unavailable]);
  });

  it("recognises constraint names and privilege errors, and never echoes raw database text", () => {
    expect(explainDbError({ code: "23514", message: 'new row for relation "jobs" violates check constraint "jobs_paid_application_not_public"' }).message)
      .toMatch(/Paid application access is not currently available/);
    expect(explainDbError({ code: "42501", message: "new row violates row-level security policy for table \"jobs\"" }).message)
      .toBe("You do not have permission to do this.");
    const unknown = explainDbError({ code: "XX000", message: "relation secret_table does not exist" });
    expect(unknown.message).not.toMatch(/secret_table/);
  });
});

describe("JobPosting structured data", () => {
  it("is emitted for an open, complete job — without an expiry for ongoing hiring", () => {
    const posting = jobPostingJsonLd(job(), NOW);
    expect(posting).toMatchObject({ "@type": "JobPosting", identifier: { value: "GG-JOB-2026-00001" }, datePosted: "2026-09-10", directApply: true });
    expect(posting).not.toHaveProperty("validThrough");
    expect(posting).not.toHaveProperty("baseSalary");
    expect(posting).not.toHaveProperty("totalJobOpenings");
  });

  it("states a time-limited job's own closing date, at the end of the day in India", () => {
    expect(jobPostingJsonLd(job({ availability: "time_limited", closes_on: "2026-10-01" }), NOW)).toMatchObject({
      validThrough: "2026-10-01T23:59:59+05:30",
    });
  });

  it("is never emitted for a closed, expired, unpublished or incomplete job", () => {
    expect(jobPostingJsonLd(job({ status: "closed" }), NOW)).toBeNull();
    expect(jobPostingJsonLd(job({ availability: "time_limited", closes_on: "2026-09-16" }), NOW)).toBeNull();
    expect(jobPostingJsonLd(job({ status: "draft" }), NOW)).toBeNull();
    expect(jobPostingJsonLd(job({ employer_disclosure: null }), NOW)).toBeNull();
    expect(jobPostingJsonLd(job({ summary: null }), NOW)).toBeNull();
  });

  it("names a confidential employer's recruiter as the hiring organisation, never the client", () => {
    const posting = jobPostingJsonLd(job({ employer_disclosure: "confidential" }), NOW);
    expect(JSON.stringify(posting)).toContain('"name":"Go Gulf"');
    expect(jobPostingJsonLd(job({ employer_disclosure: "named", employer_name: "Named Co" }), NOW)).toMatchObject({
      hiringOrganization: { name: "Named Co" },
    });
  });

  it("marks directApply only when the online form is the way to apply", () => {
    expect(jobPostingJsonLd(job({ application_method: "whatsapp" }), NOW)).toMatchObject({ directApply: false });
  });
});
