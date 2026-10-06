import { VisuallyHidden } from "@/components/ui/VisuallyHidden";
import { EMIGRATE_URL, PARTNER_DISPLAY, publicPartners, RA_LIST_URL, type RaPartner } from "@/content/partners";
import { formatDate } from "@/lib/i18n/format";
import type { AnyLocale } from "@/lib/i18n/locales";
import { getTranslator } from "@/lib/i18n/server";
import { RaPartnerList, type RaPartnerRow } from "./RaPartnerList";

/** The published partners, in the shape RaPartnerList displays. */
export function partnerRows(partners: RaPartner[], locale: AnyLocale): RaPartnerRow[] {
  return partners.map((p) => ({
    id: p.id,
    name: p.name,
    city: p.city,
    raNumber: p.raRegistrationNumber,
    validUntil: p.validUntil ? <time dateTime={p.validUntil}>{formatDate(p.validUntil, locale)}</time> : undefined,
    website: p.website,
  }));
}

/**
 * How Go Gulf works with registered recruiting agents, in the reader's language. While
 * partners are hidden (content/partners.ts PARTNER_DISPLAY, the client's decision) it shows
 * only the written-disclosure promise and the official list; partner data is not even
 * read, because publicPartners() returns none. The caller provides the section and heading.
 */
export async function RaPartners() {
  const t = await getTranslator();
  const opensInNewTab = t("common.opensInNewTab");
  const raList = (chunks: React.ReactNode[]) => (
    <a href={RA_LIST_URL} target="_blank" rel="noopener noreferrer">
      {chunks}
      <VisuallyHidden> {opensInNewTab}</VisuallyHidden>
    </a>
  );
  const emigrate = (chunks: React.ReactNode[]) => (
    <a href={EMIGRATE_URL} target="_blank" rel="noopener noreferrer">
      {chunks}
      <VisuallyHidden> {opensInNewTab}</VisuallyHidden>
    </a>
  );
  return (
    <RaPartnerList
      display={PARTNER_DISPLAY}
      partners={partnerRows(publicPartners(), t.locale)}
      text={{
        disclosure: t("partners.disclosure"),
        empty: t("partners.empty"),
        city: t("partners.city"),
        raNumber: t("partners.raNumber"),
        validUntil: t("partners.validUntil"),
        website: t("partners.website"),
        opensInNewTab,
        check: t.rich("partners.check", { list: raList, emigrate }),
      }}
    />
  );
}
