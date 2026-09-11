import Link from "next/link";
import { COMPANY } from "@/content/company";
import { FOOTER_GROUPS } from "@/content/navigation";
import { LEGAL_PAGES } from "@/lib/legal";
import { OfficialChannels } from "./OfficialChannels";
import styles from "./SiteFooter.module.css";

/**
 * Server-rendered footer. Social profiles are omitted until the business confirms they
 * are its own (content/channels.ts). The operating-company line and GSTIN stay, as on
 * the current site.
 */
export function SiteFooter() {
  const year = new Date().getFullYear();
  const groups = [...FOOTER_GROUPS, { heading: "Legal", links: LEGAL_PAGES.map((p) => ({ href: p.path, label: p.label })) }];

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.top}>
          <div className={styles.brand}>
            <Link href="/" className={styles.brandLink}>
              {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized static asset, as in SiteHeader: no next/image client code */}
              <img src="/brand/logo-96.png" alt="" width={44} height={44} className={styles.logo} loading="lazy" />
              <span className={styles.wordmark}>Go Gulf</span>
              <span className="visually-hidden">, home</span>
            </Link>
            <p className={styles.tagline}>{COMPANY.tagline}</p>
            <p className={styles.about}>
              Gulf job openings and enquiries from job seekers and employers, handled from {COMPANY.address.locality},{" "}
              {COMPANY.address.region}.
            </p>
          </div>

          <nav aria-label="Footer" className={styles.groups}>
            {groups.map((group) => (
              <div key={group.heading} className={styles.group}>
                <h2 className={styles.groupHeading}>{group.heading}</h2>
                <ul className={styles.links}>
                  {group.links.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href}>{link.label}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>

          <div className={styles.channels}>
            <h2 className={styles.groupHeading}>Official contact</h2>
            <OfficialChannels tone="inverse" />
          </div>
        </div>

        <div className={styles.company}>
          <p>
            <strong>{COMPANY.brand}</strong> is a brand of <strong>{COMPANY.legalName}</strong>, a{" "}
            {COMPANY.companyType.toLowerCase()} registered in India (CIN {COMPANY.cin}).
          </p>
          <address>{COMPANY.addressLines.join(", ")}.</address>
          <p className={styles.gstin}>GSTIN: {COMPANY.gstin}</p>
        </div>

        <div className={styles.bottom}>
          <p>
            © {year} {COMPANY.legalName}. All rights reserved.
          </p>
          <a href="https://mail.google.com/a/gogulf.co/" target="_blank" rel="noopener noreferrer">
            Staff webmail<span className="visually-hidden"> (opens in a new tab)</span>
          </a>
        </div>
      </div>
    </footer>
  );
}
