import Link from "next/link";
import { LtrText } from "@/components/ui/LtrText";
import { COMPANY } from "@/content/company";
import { FOOTER_GROUPS, LEGAL_LINKS } from "@/content/navigation";
import { DEFAULT, LOCALES } from "@/lib/i18n/locales";
import { hrefIn } from "@/lib/i18n/pages";
import { getTranslator } from "@/lib/i18n/server";
import { OfficialChannels } from "./OfficialChannels";
import styles from "./SiteFooter.module.css";

/**
 * Server-rendered footer. Social profiles are omitted until the business confirms they
 * are its own (content/channels.ts). The operating-company line and GSTIN stay, as on
 * the current site.
 *
 * Identifiers are never translated: the legal name, CIN, GSTIN and registered address
 * appear exactly as registered, in every language (the address marked as English).
 */
export async function SiteFooter() {
  const t = await getTranslator();
  const href = (path: string) => hrefIn(path, t.locale);
  const englishText = t.locale === DEFAULT ? undefined : LOCALES[DEFAULT].tag;
  const year = String(new Date().getFullYear()); // a string, so ICU does not format it as 2,026
  const groups = [...FOOTER_GROUPS, { heading: "footer.groups.legal" as const, links: LEGAL_LINKS }];

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.top}>
          <div className={styles.brand}>
            <Link href={href("/")} className={styles.brandLink}>
              {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized static asset, as in SiteHeader: no next/image client code */}
              <img src="/brand/logo-96.png" alt="" width={44} height={44} className={styles.logo} loading="lazy" />
              <span className={styles.wordmark}>Go Gulf</span>
              <span className="visually-hidden">{t("common.homeSuffix")}</span>
            </Link>
            <p className={styles.tagline} lang={englishText}>
              {COMPANY.tagline}
            </p>
            <p className={styles.about}>{t("footer.about", { city: COMPANY.address.locality, region: COMPANY.address.region })}</p>
          </div>

          <nav aria-label={t("footer.label")} className={styles.groups}>
            {groups.map((group) => (
              <div key={group.heading} className={styles.group}>
                <h2 className={styles.groupHeading}>{t(group.heading)}</h2>
                <ul className={styles.links}>
                  {group.links.map((link) => (
                    <li key={link.href}>
                      <Link href={href(link.href)}>{t(link.label)}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>

          <div className={styles.channels}>
            <h2 className={styles.groupHeading}>{t("footer.officialContact")}</h2>
            <OfficialChannels tone="inverse" />
          </div>
        </div>

        <div className={styles.company}>
          <p>
            {t.rich("footer.brandOf", {
              b: (chunks) => <strong>{chunks}</strong>,
              brand: COMPANY.brand,
              legalName: COMPANY.legalName,
              companyType: COMPANY.companyType.toLowerCase(),
              cin: <LtrText>{COMPANY.cin}</LtrText>,
            })}
          </p>
          <address lang={englishText}>{COMPANY.addressLines.join(", ")}.</address>
          <p className={styles.gstin}>{t.rich("footer.gstin", { gstin: <LtrText>{COMPANY.gstin}</LtrText> })}</p>
        </div>

        <div className={styles.bottom}>
          <p>{t("footer.rights", { year, legalName: COMPANY.legalName })}</p>
          <a href="https://mail.google.com/a/gogulf.co/" target="_blank" rel="noopener noreferrer">
            {t("footer.staffWebmail")}
            <span className="visually-hidden"> {t("common.opensInNewTab")}</span>
          </a>
        </div>
      </div>
    </footer>
  );
}
