import type { ReactNode } from "react";
import { LtrText } from "@/components/ui/LtrText";
import { VisuallyHidden } from "@/components/ui/VisuallyHidden";
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
  /** Shown when no partner is published: honest, never a placeholder partner. */
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
 * The registered recruiting-agent partners, or the honest empty state. Pure and
 * synchronous so it renders the same on every page and in unit tests; RaPartners
 * (the server wrapper) supplies the published partners and the translated words.
 *
 * Every partner shows its RA registration number directly under its name — a partner
 * without one cannot exist (content/partners.ts) — and the reader is always pointed at
 * the official list, so nothing here has to be taken on our word.
 */
export function RaPartnerList({ partners, text }: { partners: RaPartnerRow[]; text: RaPartnerListText }) {
  return (
    <div className={styles.partners}>
      {partners.length ? (
        <ul className={styles.list}>
          {partners.map((p) => (
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
      )}
      <p className={styles.check}>{text.check}</p>
    </div>
  );
}
