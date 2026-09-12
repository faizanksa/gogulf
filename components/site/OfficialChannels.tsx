import { BUSINESS_EMAIL, CAREERS_EMAIL, PHONE, WHATSAPP } from "@/content/channels";
import { cx } from "@/components/ui/cx";
import { Icon } from "@/components/ui/Icon";
import { LtrText } from "@/components/ui/LtrText";
import { VisuallyHidden } from "@/components/ui/VisuallyHidden";
import { getTranslator } from "@/lib/i18n/server";
import styles from "./OfficialChannels.module.css";

/** The confirmed contact channels — the only ones Go Gulf publishes as its own. */
export async function OfficialChannels({ tone = "default" }: { tone?: "default" | "inverse" }) {
  const t = await getTranslator();
  const rows = [
    { icon: "phone" as const, label: t("channels.phone"), value: PHONE.value, href: PHONE.href },
    { icon: "whatsapp" as const, label: t("channels.whatsapp"), value: WHATSAPP.value, href: WHATSAPP.href, whatsapp: true },
    { icon: "mail" as const, label: t("channels.careers"), value: CAREERS_EMAIL.value, href: CAREERS_EMAIL.href },
    { icon: "mail" as const, label: t("channels.business"), value: BUSINESS_EMAIL.value, href: BUSINESS_EMAIL.href },
  ];
  return (
    <dl className={cx(styles.list, tone === "inverse" && styles.inverse)}>
      {rows.map((r) => (
        <div key={`${r.icon}-${r.value}`} className={styles.row}>
          <dt className={styles.label}>
            <Icon name={r.icon} size={18} />
            {r.label}
          </dt>
          <dd className={styles.value}>
            <a href={r.href} {...(r.whatsapp ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
              <LtrText>{r.value}</LtrText>
              {r.whatsapp ? <VisuallyHidden> {t("common.opensWhatsApp")}</VisuallyHidden> : null}
            </a>
          </dd>
        </div>
      ))}
    </dl>
  );
}
