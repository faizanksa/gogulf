"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

// Interim jobs board (Phase 2B). Listings arrive as props from the server (content/jobs.ts,
// already filtered for this deployment), so neither the data module nor its validation
// library is shipped to the browser. Each card links to the job's own page. The visual
// redesign is 2C-1.

const NEW_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function formatDate(d) {
  try {
    return new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  } catch {
    return d;
  }
}

function isNewPosting(posted) {
  const ts = new Date(`${posted}T00:00:00Z`).getTime();
  if (Number.isNaN(ts)) return false;
  const age = Date.now() - ts;
  return age >= 0 && age <= NEW_WINDOW_MS;
}

function applyHref(job) {
  const params = new URLSearchParams({ job: job.title, country: job.country, type: job.type });
  return `/jobs/apply?${params.toString()}`;
}

function PinIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M10 2a5 5 0 0 0-5 5c0 3.75 5 9 5 9s5-5.25 5-9a5 5 0 0 0-5-5Z" />
      <circle cx="10" cy="7" r="2" fill="#fff" />
    </svg>
  );
}

function TagIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M17.5 10.5 10.5 3.5A2 2 0 0 0 9.08 3H4a1 1 0 0 0-1 1v5.08a2 2 0 0 0 .59 1.42l7 7a2 2 0 0 0 2.82 0l4.09-4.09a2 2 0 0 0 0-2.82Z" />
      <circle cx="6.5" cy="6.5" r="1.2" fill="#fff" />
    </svg>
  );
}

function WalletIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <rect x="2" y="5" width="16" height="10" rx="2" />
      <circle cx="14.5" cy="10" r="1.6" fill="#fff" />
    </svg>
  );
}

function SearchOffIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="10" cy="10" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <line x1="19" y1="19" x2="14.8" y2="14.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export default function JobsBoard({ jobs }) {
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("");
  const [industry, setIndustry] = useState("");

  const countries = useMemo(() => Array.from(new Set(jobs.map((j) => j.country))).sort(), [jobs]);
  const industries = useMemo(() => Array.from(new Set(jobs.map((j) => j.industry))).sort(), [jobs]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return jobs.filter((job) => {
      const matchesQ = !q || job.title.toLowerCase().includes(q) || job.industry.toLowerCase().includes(q);
      const matchesCountry = !country || job.country === country;
      const matchesIndustry = !industry || job.industry === industry;
      return matchesQ && matchesCountry && matchesIndustry;
    });
  }, [jobs, query, country, industry]);

  const hasFilters = Boolean(query || country || industry);

  function clearFilters() {
    setQuery("");
    setCountry("");
    setIndustry("");
  }

  return (
    <>
      <div className="jobs-toolbar" role="search" aria-label="Filter jobs">
        <div className="field">
          <label htmlFor="job-search">Search</label>
          <input type="search" id="job-search" placeholder="Job title or industry" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="job-country-filter">Country</label>
          <select id="job-country-filter" value={country} onChange={(e) => setCountry(e.target.value)}>
            <option value="">All countries</option>
            {countries.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="job-industry-filter">Industry</label>
          <select id="job-industry-filter" value={industry} onChange={(e) => setIndustry(e.target.value)}>
            <option value="">All industries</option>
            {industries.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>
      </div>

      {/* role=status announces the new count when filters change. */}
      <p className="jobs-count" id="jobs-count" role="status">
        {filtered.length} {filtered.length === 1 ? "open position" : "open positions"}
      </p>

      <div className="job-grid" id="job-grid">
        {filtered.length === 0 ? (
          <div className="jobs-empty">
            <SearchOffIcon />
            <p>No open positions match your filters right now. Try clearing a filter, or submit a general application.</p>
            {hasFilters && (
              <button type="button" className="jobs-empty-clear" onClick={clearFilters}>
                Clear filters
              </button>
            )}
          </div>
        ) : (
          filtered.map((job) => (
            <article className="job-card" key={job.slug} aria-labelledby={`job-${job.slug}`}>
              <div className="job-card-top">
                <h2 className="job-title" id={`job-${job.slug}`}>
                  <Link href={`/jobs/${job.slug}`}>{job.title}</Link>
                </h2>
                <span className="job-badge" data-type={job.type}>{job.type}</span>
              </div>
              {job.unconfirmed ? (
                <p className="job-unconfirmed">Unconfirmed listing — not shown in production</p>
              ) : null}
              <div className="job-meta">
                <span><PinIcon />{job.country}</span>
                <span><TagIcon />{job.industry}</span>
              </div>
              <p className="job-desc">{job.description}</p>
              <div className="job-salary"><WalletIcon />{job.salary ?? "Salary not stated"}</div>
              <div className="job-card-bottom">
                <div className="job-card-meta-bottom">
                  <span className="job-posted">Posted {formatDate(job.posted)}</span>
                  {isNewPosting(job.posted) && <span className="job-new">New</span>}
                </div>
                <Link href={applyHref(job)} className="btn btn-gold apply-btn">
                  Apply now<span className="visually-hidden">: {job.title}</span>
                </Link>
              </div>
            </article>
          ))
        )}
      </div>

      <div className="divider"></div>

      <div style={{ textAlign: "center" }}>
        <p>Don&apos;t see a matching role? We add new positions regularly.</p>
        <Link href="/jobs/apply" className="btn btn-outline js-apply-general">
          Submit a general application
        </Link>
      </div>
    </>
  );
}
