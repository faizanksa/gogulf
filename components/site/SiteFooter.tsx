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
 * Server-rendered footer, on a daylight surface.
 *
 * Three parts: where to go (navigation groups beside the brand and the official
 * channels), the company record (legal name, CIN, GSTIN, registered office — laid out
 * like a document so it reads as something to check), and the closing line.
 *
 * Social profiles are omitted until the business confirms they are its own
 * (content/channels.ts). Identifiers are never translated: the legal name, CIN, GSTIN
 * and registered address appear exactly as registered, in every language (marked as
 * English). The GSTIN stays on the page and out of structured data (decision D8).
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
            <OfficialChannels />
          </div>
        </div>

        <section className={styles.record} aria-labelledby="footer-record">
          <div className={styles.recordIntro}>
            <h2 id="footer-record" className={styles.groupHeading}>
              {t("footer.record.heading")}
            </h2>
            <p className={styles.recordLead}>
              {t.rich("footer.record.lead", { verify: (chunks) => <Link href={href("/verify")}>{chunks}</Link> })}
            </p>
          </div>
          <dl className={styles.recordList}>
            <div>
              <dt>{t("footer.record.legalName")}</dt>
              <dd lang={englishText}>{COMPANY.legalName}</dd>
            </div>
            <div>
              <dt>{t("footer.record.cin")}</dt>
              <dd className={styles.mono}>
                <LtrText>{COMPANY.cin}</LtrText>
              </dd>
            </div>
            <div>
              <dt>{t("footer.record.gstin")}</dt>
              <dd className={styles.mono}>
                <LtrText>{COMPANY.gstin}</LtrText>
              </dd>
            </div>
            <div>
              <dt>{t("footer.record.office")}</dt>
              <dd>
                <address lang={englishText}>{COMPANY.addressLines.join(", ")}</address>
              </dd>
            </div>
          </dl>
          <p className={styles.brandOf}>
            {t.rich("footer.brandOf", {
              b: (chunks) => <strong>{chunks}</strong>,
              brand: COMPANY.brand,
              legalName: COMPANY.legalName,
              companyType: COMPANY.companyType.toLowerCase(),
              cin: <LtrText>{COMPANY.cin}</LtrText>,
            })}
          </p>
        </section>

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
