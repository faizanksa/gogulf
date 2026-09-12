"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { Input, Select } from "@/components/form/Controls";
import { EmptyState } from "@/components/ui/States";
import { JobCard } from "./JobCard";
import type { JobCardData, JobCardText } from "./job-data";
import styles from "./JobBoard.module.css";

export interface JobBoardText {
  label: string;
  search: string;
  searchPlaceholder: string;
  country: string;
  allCountries: string;
  industry: string;
  allIndustries: string;
  type: string;
  allTypes: string;
  clear: string;
  /** `counts[n]` is the finished "n jobs" line, pluralised on the server for every n. */
  counts: string[];
  noMatchTitle: string;
  noMatchBody: string;
}

interface Filters {
  q: string;
  country: string;
  industry: string;
  type: string;
}

const EMPTY: Filters = { q: "", country: "", industry: "", type: "" };

function readFilters(): Filters {
  const p = new URLSearchParams(window.location.search);
  return { q: p.get("q") ?? "", country: p.get("country") ?? "", industry: p.get("industry") ?? "", type: p.get("type") ?? "" };
}

function options(jobs: JobCardData[], key: (j: JobCardData) => string, label: (j: JobCardData) => string) {
  const seen = new Map<string, string>();
  for (const j of jobs) if (!seen.has(key(j))) seen.set(key(j), label(j));
  return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]));
}

/**
 * The filter island on /jobs. The server renders every job; this adds search and three
 * filters, announces the count, and keeps the choice in the URL so a filtered list can
 * be shared on WhatsApp. Without JavaScript the full list is still there.
 */
export function JobBoard({ jobs, cardText, text }: { jobs: JobCardData[]; cardText: JobCardText; text: JobBoardText }) {
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const id = useId();

  useEffect(() => {
    // The query string exists only in the browser, so filters from a shared link are
    // applied after hydration rather than during render (which the server shares).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFilters(readFilters());
  }, []);

  useEffect(() => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) if (v) p.set(k, v);
    const query = p.toString();
    const url = `${window.location.pathname}${query ? `?${query}` : ""}`;
    if (url !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(null, "", url);
  }, [filters]);

  const countries = useMemo(() => options(jobs, (j) => j.countryKey, (j) => j.country), [jobs]);
  const industries = useMemo(() => options(jobs, (j) => j.industryKey, (j) => j.industry), [jobs]);
  const types = useMemo(() => options(jobs, (j) => j.typeKey, (j) => j.type), [jobs]);

  const visible = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return jobs.filter(
      (j) =>
        (!q || j.title.toLowerCase().includes(q) || j.industry.toLowerCase().includes(q)) &&
        (!filters.country || j.countryKey === filters.country) &&
        (!filters.industry || j.industryKey === filters.industry) &&
        (!filters.type || j.typeKey === filters.type),
    );
  }, [jobs, filters]);

  const active = Object.values(filters).some(Boolean);
  const set = (key: keyof Filters) => (value: string) => setFilters((f) => ({ ...f, [key]: value }));
  const clear = () => setFilters(EMPTY);

  return (
    <div className={styles.board}>
      <form role="search" aria-label={text.label} className={styles.filters} onSubmit={(e) => e.preventDefault()}>
        <div className={styles.field}>
          <label htmlFor={`${id}-q`} className={styles.label}>
            {text.search}
          </label>
          <Input id={`${id}-q`} type="search" value={filters.q} placeholder={text.searchPlaceholder} onChange={(e) => set("q")(e.target.value)} />
        </div>
        <div className={styles.field}>
          <label htmlFor={`${id}-country`} className={styles.label}>
            {text.country}
          </label>
          <Select id={`${id}-country`} value={filters.country} onChange={(e) => set("country")(e.target.value)}>
            <option value="">{text.allCountries}</option>
            {countries.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <div className={styles.field}>
          <label htmlFor={`${id}-industry`} className={styles.label}>
            {text.industry}
          </label>
          <Select id={`${id}-industry`} value={filters.industry} onChange={(e) => set("industry")(e.target.value)}>
            <option value="">{text.allIndustries}</option>
            {industries.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <div className={styles.field}>
          <label htmlFor={`${id}-type`} className={styles.label}>
            {text.type}
          </label>
          <Select id={`${id}-type`} value={filters.type} onChange={(e) => set("type")(e.target.value)}>
            <option value="">{text.allTypes}</option>
            {types.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
      </form>

      <div className={styles.summary}>
        <p className={styles.count} role="status">
          {text.counts[visible.length] ?? String(visible.length)}
        </p>
        {active ? (
          <button type="button" className={styles.clear} onClick={clear}>
            {text.clear}
          </button>
        ) : null}
      </div>

      {visible.length ? (
        <ul className={styles.list}>
          {visible.map((job) => (
            <li key={job.slug}>
              <JobCard job={job} text={cardText} headingLevel={2} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title={text.noMatchTitle}
          action={
            <button type="button" className={styles.clear} onClick={clear}>
              {text.clear}
            </button>
          }
        >
          <p>{text.noMatchBody}</p>
        </EmptyState>
      )}
    </div>
  );
}
