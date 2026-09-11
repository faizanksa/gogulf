import { BUSINESS_EMAIL, CAREERS_EMAIL, PHONE, WHATSAPP } from "@/content/channels";
import { cx } from "@/components/ui/cx";
import { Icon } from "@/components/ui/Icon";
import { VisuallyHidden } from "@/components/ui/VisuallyHidden";
import styles from "./OfficialChannels.module.css";

/** The confirmed contact channels — the only ones Go Gulf publishes as its own. */
export function OfficialChannels({ tone = "default" }: { tone?: "default" | "inverse" }) {
  const rows = [
    { icon: "phone" as const, label: "Phone", value: PHONE.value, href: PHONE.href },
    { icon: "whatsapp" as const, label: "WhatsApp", value: WHATSAPP.value, href: WHATSAPP.href, whatsapp: true },
    { icon: "mail" as const, label: CAREERS_EMAIL.label, value: CAREERS_EMAIL.value, href: CAREERS_EMAIL.href },
    { icon: "mail" as const, label: BUSINESS_EMAIL.label, value: BUSINESS_EMAIL.value, href: BUSINESS_EMAIL.href },
  ];
  return (
    <dl className={cx(styles.list, tone === "inverse" && styles.inverse)}>
      {rows.map((r) => (
        <div key={`${r.label}-${r.value}`} className={styles.row}>
          <dt className={styles.label}>
            <Icon name={r.icon} size={18} />
            {r.label}
          </dt>
          <dd className={styles.value}>
            <a href={r.href} {...(r.whatsapp ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
              {r.value}
              {r.whatsapp ? <VisuallyHidden> (opens WhatsApp)</VisuallyHidden> : null}
            </a>
          </dd>
        </div>
      ))}
    </dl>
  );
}
