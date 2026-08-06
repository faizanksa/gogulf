"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/services", label: "Services" },
  { href: "/jobs", label: "Jobs" },
  { href: "/candidates", label: "Candidates" },
  { href: "/employers", label: "Employers" },
  { href: "/contact", label: "Contact" },
];

export default function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="site-header">
      <div className="nav-row">
        <Link href="/" className="brand" onClick={() => setOpen(false)}>
          <img src="/assets/logo-circle.png" alt="Go Gulf logo" />
          <span className="brand-text">
            <span className="brand-mark">
              GO <span>GULF</span>
            </span>
            <span className="brand-tag">Go Gulf. Get Hired.</span>
          </span>
        </Link>
        <nav className={`nav-links${open ? " open" : ""}`}>
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={pathname === link.href ? "active" : ""}
              onClick={() => setOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <a
            href="https://wa.me/919517108866"
            target="_blank"
            rel="noopener"
            className="nav-cta"
            onClick={() => setOpen(false)}
          >
            Apply for Job
          </a>
        </nav>
        <button
          type="button"
          className="nav-toggle"
          aria-label="Toggle menu"
          onClick={() => setOpen((v) => !v)}
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>
    </header>
  );
}
