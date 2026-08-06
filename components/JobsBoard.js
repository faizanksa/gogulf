"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { jobs } from "@/lib/jobs-data";

function formatDate(d) {
  try {
    return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch (e) {
    return d;
  }
}

// Builds the /jobs/apply?job=&country= link that prefills ApplyForm.
function applyHref(title, country) {
  const params = new URLSearchParams();
  if (title) params.set("job", title);
  if (country) params.set("country", country);
  const qs = params.toString();
  return qs ? `/jobs/apply?${qs}` : "/jobs/apply";
}

export default function JobsBoard() {
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("");
  const [industry, setIndustry] = useState("");

  const countries = useMemo(() => Array.from(new Set(jobs.map((j) => j.country))).sort(), []);
  const industries = useMemo(() => Array.from(new Set(jobs.map((j) => j.industry))).sort(), []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return jobs.filter((job) => {
      const matchesQ = !q || job.title.toLowerCase().includes(q) || job.industry.toLowerCase().includes(q);
      const matchesCountry = !country || job.country === country;
      const matchesIndustry = !industry || job.industry === industry;
      return matchesQ && matchesCountry && matchesIndustry;
    });
  }, [query, country, industry]);

  return (
    <>
      <div className="jobs-toolbar">
        <div className="field">
          <label htmlFor="job-search">Search</label>
          <input
            type="text"
            id="job-search"
            placeholder="Job title or industry..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="job-country-filter">Country</label>
          <select id="job-country-filter" value={country} onChange={(e) => setCountry(e.target.value)}>
            <option value="">All Countries</option>
            {countries.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="job-industry-filter">Industry</label>
          <select id="job-industry-filter" value={industry} onChange={(e) => setIndustry(e.target.value)}>
            <option value="">All Industries</option>
            {industries.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>
      </div>

      <span className="jobs-count" id="jobs-count">
        {filtered.length} {filtered.length === 1 ? "open position" : "open positions"}
      </span>

      <div className="job-grid" id="job-grid">
        {filtered.length === 0 ? (
          <div className="jobs-empty">
            No open positions match your filters right now. Try clearing a filter, or submit a general inquiry.
          </div>
        ) : (
          filtered.map((job) => (
            <div className="job-card" key={job.title + job.country}>
              <div className="job-card-top">
                <h3 className="job-title">{job.title}</h3>
                <span className="job-badge">{job.type}</span>
              </div>
              <div className="job-meta">
                <span>{job.country}</span>
                <span>{job.industry}</span>
              </div>
              <p className="job-desc">{job.description}</p>
              <div className="job-salary">{job.salary}</div>
              <div className="job-card-bottom">
                <span className="job-posted">Posted {formatDate(job.posted)}</span>
                <Link href={applyHref(job.title, job.country)} className="btn btn-gold apply-btn">
                  Apply Now
                </Link>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="divider"></div>

      <div style={{ textAlign: "center" }}>
        <p style={{ color: "#5C5548" }}>Don&apos;t see a matching role? We add new positions regularly.</p>
        <Link href="/jobs/apply" className="btn btn-outline js-apply-general">
          Submit a General Application
        </Link>
      </div>
    </>
  );
}
