import type { ReactNode } from "react";
import { LtrText } from "@/components/ui/LtrText";
import { VisuallyHidden } from "@/components/ui/VisuallyHidden";
import type { PartnerDisplay } from "@/content/partners";
import styles from "./RaPartners.module.css";

/** One partner as displayed: finished strings, nothing left to look up. */
export interface RaPartnerRow {
  id: string;
  name: string;
  city: string;
  raNumber: string;
  /** Already formatted for the reader's language. */
  validUntil?: ReactNode;
  website?: string;
}

export interface RaPartnerListText {
  /**
   * The written-disclosure promise, shown in both modes: the agent's name, registration
   * number and the split of responsibilities are given in writing before any payment.
   */
  disclosure: string;
  /** Named mode with no published partner yet: honest, never a placeholder partner. */
  empty: string;
  city: string;
  raNumber: string;
  validUntil: string;
  website: string;
  opensInNewTab: string;
  /** How to check an agent independently — carries the official links. */
  check: ReactNode;
}

/**
 * How Go Gulf works with registered recruiting agents. Pure and synchronous so it renders
 * the same on every page and in unit tests; RaPartners (the server wrapper) supplies the
 * public partners and the translated words.
 *
 *   hidden  (the client's decision) the written-disclosure promise and the official list
 *           only. `partners` is ignored entirely, so no name, number, city or website can
 *           render even if a caller passes some by mistake.
 *   named   each published partner with its RA registration number directly under its
 *           name (or the honest empty state), then the same promise and links.
 */
export function RaPartnerList({ display, partners, text }: { display: PartnerDisplay; partners: RaPartnerRow[]; text: RaPartnerListText }) {
  const shown = display === "named" ? partners : [];
  return (
    <div className={styles.partners}>
      {display === "named" ? (
        shown.length ? (
          <ul className={styles.list}>
            {shown.map((p) => (
              <li key={p.id} className={styles.partner}>
                <p className={styles.name}>{p.name}</p>
                <p className={styles.number}>
                  {text.raNumber}: <LtrText>{p.raNumber}</LtrText>
                </p>
                <dl className={styles.facts}>
                  <div>
                    <dt>{text.city}</dt>
                    <dd>{p.city}</dd>
                  </div>
                  {p.validUntil ? (
                    <div>
                      <dt>{text.validUntil}</dt>
                      <dd>{p.validUntil}</dd>
                    </div>
                  ) : null}
                  {p.website ? (
                    <div>
                      <dt>{text.website}</dt>
                      <dd>
                        <a href={p.website} target="_blank" rel="noopener noreferrer">
                          <LtrText>{p.website.replace(/^https:\/\//, "").replace(/\/$/, "")}</LtrText>
                          <VisuallyHidden> {text.opensInNewTab}</VisuallyHidden>
                        </a>
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.empty}>{text.empty}</p>
        )
      ) : null}
      <p className={styles.disclosure}>{text.disclosure}</p>
      <p className={styles.check}>{text.check}</p>
    </div>
  );
}
