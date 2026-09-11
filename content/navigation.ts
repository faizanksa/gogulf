import { TRAVEL_PUBLISHED } from "./travel";

export interface NavItem {
  href: string;
  label: string;
}

/** Primary navigation. Travel appears only once a confirmed travel service exists. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/jobs", label: "Jobs" },
  { href: "/candidates", label: "Job seekers" },
  { href: "/employers", label: "Employers" },
  ...(TRAVEL_PUBLISHED ? [{ href: "/travel", label: "Travel" }] : []),
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

/** The one primary action in the header. */
export const PRIMARY_CTA: NavItem = { href: "/jobs", label: "Find a job" };

export const FOOTER_GROUPS: { heading: string; links: NavItem[] }[] = [
  {
    heading: "Job seekers",
    links: [
      { href: "/jobs", label: "Current jobs" },
      { href: "/candidates", label: "How it works" },
      { href: "/jobs/apply", label: "Apply online" },
      { href: "/pricing", label: "Pricing & fees" },
    ],
  },
  {
    heading: "Employers",
    links: [
      { href: "/employers", label: "Hire from India" },
      { href: "/services", label: "All services" },
    ],
  },
  {
    heading: "Company",
    links: [
      { href: "/about", label: "About Go Gulf" },
      { href: "/verify", label: "Verify Go Gulf" },
      { href: "/contact", label: "Contact" },
    ],
  },
];
