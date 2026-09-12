import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { hrefIn } from "@/lib/i18n/pages";
import { getTranslator } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translator";
import styles from "./NotFoundContent.module.css";

const LINKS: { path: string; label: MessageKey }[] = [
  { path: "/jobs", label: "notFound.links.jobs" },
  { path: "/candidates", label: "notFound.links.candidates" },
  { path: "/employers", label: "notFound.links.employers" },
  { path: "/verify", label: "notFound.links.verify" },
];

/**
 * The body of every 404, inside the site shell: app/(marketing)/not-found.tsx,
 * app/[locale]/not-found.tsx and app/global-not-found.tsx. Helpful, not a dead end —
 * and each link goes to the reader's language wherever that page exists in it.
 */
export async function NotFoundContent() {
  const t = await getTranslator();
  const href = (path: string) => hrefIn(path, t.locale);
  return (
    <div className={styles.wrap}>
      <p className={styles.code}>{t("notFound.code")}</p>
      <h1 className={styles.title}>{t("notFound.heading")}</h1>
      <p className={styles.lead}>{t("notFound.lead")}</p>
      <ul className={styles.links}>
        {LINKS.map((l) => (
          <li key={l.path}>
            <Link href={href(l.path)}>{t(l.label)}</Link>
          </li>
        ))}
      </ul>
      <div className={styles.actions}>
        <Button href={href("/")}>{t("notFound.home")}</Button>
        <Button href={href("/contact")} variant="secondary">
          {t("notFound.contact")}
        </Button>
      </div>
    </div>
  );
}
