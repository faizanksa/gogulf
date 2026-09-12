import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import { hrefIn } from "@/lib/i18n/pages";
import { getTranslator } from "@/lib/i18n/server";
import { breadcrumbJsonLd, type Crumb } from "@/lib/seo";
import { Icon } from "./Icon";
import styles from "./Breadcrumbs.module.css";

/**
 * Visible breadcrumbs and the matching BreadcrumbList structured data, from one list —
 * so what search engines read is exactly what people see. `items` excludes Home, carry
 * translated names and English paths; each link goes to the reader's language where the
 * page exists in it.
 */
export async function Breadcrumbs({ items }: { items: Crumb[] }) {
  const t = await getTranslator();
  const home = { name: t("common.home"), path: hrefIn("/", t.locale) };
  const crumbs = items.map((c) => ({ name: c.name, path: hrefIn(c.path, t.locale) }));
  const trail = [home, ...crumbs];
  return (
    <>
      <nav aria-label={t("common.breadcrumb")} className={styles.nav}>
        <ol className={styles.list}>
          {trail.map((item, i) => {
            const last = i === trail.length - 1;
            return (
              <li key={item.path} className={styles.item}>
                {i > 0 ? <Icon name="chevron-right" size={16} className={styles.separator} /> : null}
                {last ? (
                  <span aria-current="page" className={styles.current}>
                    {item.name}
                  </span>
                ) : (
                  <Link href={item.path} className={styles.link}>
                    {item.name}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
      <JsonLd data={breadcrumbJsonLd(crumbs, home)} />
    </>
  );
}
