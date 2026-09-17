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
  category: string;
  allCategories: string;
  type: string;
  allTypes: string;
  availability: string;
  allAvailability: string;
  ongoing: string;
  timeLimited: string;
  clear: string;
  /** `counts[n]` is the finished "n jobs" line, pluralised on the server for every n. */
  counts: string[];
  noMatchTitle: string;
  noMatchBody: string;
  sections: {
    featured: string;
    featuredLead: string;
    general: string;
    generalLead: string;
    professional: string;
    professionalLead: string;
  };
}

interface Filters {
  q: string;
  country: string;
  category: string;
  type: string;
  availability: string;
}

const EMPTY: Filters = { q: "", country: "", category: "", type: "", availability: "" };
const KEYS = Object.keys(EMPTY) as (keyof Filters)[];

function readFilters(): Filters {
  const p = new URLSearchParams(window.location.search);
  return Object.fromEntries(KEYS.map((k) => [k, p.get(k) ?? ""])) as unknown as Filters;
}

function options(jobs: JobCardData[], key: (j: JobCardData) => string, label: (j: JobCardData) => string) {
  const seen = new Map<string, string>();
  for (const j of jobs) if (key(j) && !seen.has(key(j))) seen.set(key(j), label(j));
  return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]));
}

/**
 * The filter island on /jobs. The server renders every job; this adds search and filters,
 * announces the count, and keeps the choice in the URL so a filtered list can be shared
 * on WhatsApp. Without JavaScript the full list is still there.
 *
 * Jobs are grouped into featured opportunities, ongoing and general hiring, and
 * professional opportunities. A featured job appears once, in the first group. A group
 * with nothing in it is not shown, and a filter is offered only when the jobs listed give
 * it at least two values to choose between.
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
  const categories = useMemo(() => options(jobs, (j) => j.categoryKey, (j) => j.category ?? ""), [jobs]);
  const types = useMemo(() => options(jobs, (j) => j.typeKey, (j) => j.type ?? ""), [jobs]);
  const availabilities = useMemo(
    () => options(jobs, (j) => j.availabilityKey, (j) => (j.availabilityKey === "ongoing" ? text.ongoing : text.timeLimited)),
    [jobs, text.ongoing, text.timeLimited],
  );

  const visible = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return jobs.filter(
      (j) =>
        (!q || j.searchText.includes(q)) &&
        (!filters.country || j.countryKey === filters.country) &&
        (!filters.category || j.categoryKey === filters.category) &&
        (!filters.type || j.typeKey === filters.type) &&
        (!filters.availability || j.availabilityKey === filters.availability),
    );
  }, [jobs, filters]);

  const groups = [
    { key: "featured", title: text.sections.featured, lead: text.sections.featuredLead, items: visible.filter((j) => j.featured) },
    { key: "general", title: text.sections.general, lead: text.sections.generalLead, items: visible.filter((j) => !j.featured && !j.professional) },
    { key: "professional", title: text.sections.professional, lead: text.sections.professionalLead, items: visible.filter((j) => !j.featured && j.professional) },
  ].filter((g) => g.items.length > 0);

  const active = Object.values(filters).some(Boolean);
  const set = (key: keyof Filters) => (value: string) => setFilters((f) => ({ ...f, [key]: value }));
  const clear = () => setFilters(EMPTY);

  const select = (key: keyof Filters, label: string, all: string, list: [string, string][]) =>
    list.length > 1 || filters[key] ? (
      <div className={styles.field}>
        <label htmlFor={`${id}-${key}`} className={styles.label}>
          {label}
        </label>
        <Select id={`${id}-${key}`} value={filters[key]} onChange={(e) => set(key)(e.target.value)}>
          <option value="">{all}</option>
          {list.map(([value, optionLabel]) => (
            <option key={value} value={value}>
              {optionLabel}
            </option>
          ))}
        </Select>
      </div>
    ) : null;

  return (
    <div className={styles.board}>
      <form role="search" aria-label={text.label} className={styles.filters} onSubmit={(e) => e.preventDefault()}>
        <div className={styles.field}>
          <label htmlFor={`${id}-q`} className={styles.label}>
            {text.search}
          </label>
          <Input id={`${id}-q`} type="search" value={filters.q} placeholder={text.searchPlaceholder} onChange={(e) => set("q")(e.target.value)} />
        </div>
        {select("category", text.category, text.allCategories, categories)}
        {select("country", text.country, text.allCountries, countries)}
        {select("type", text.type, text.allTypes, types)}
        {select("availability", text.availability, text.allAvailability, availabilities)}
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

      {groups.length ? (
        groups.map((group) => (
          <section key={group.key} className={styles.group} aria-labelledby={`${id}-${group.key}`}>
            <div className={styles.groupHeading}>
              <h2 id={`${id}-${group.key}`} className={styles.groupTitle}>
                {group.title}
              </h2>
              <p className={styles.groupLead}>{group.lead}</p>
            </div>
            <ul className={styles.list}>
              {group.items.map((job) => (
                <li key={job.slug}>
                  <JobCard job={job} text={cardText} />
                </li>
              ))}
            </ul>
          </section>
        ))
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
