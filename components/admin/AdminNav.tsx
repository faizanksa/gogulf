"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui/cx";
import styles from "./admin.module.css";

export interface AdminNavItem {
  href: string;
  label: string;
  /** Indented under the item before it on wide screens. */
  sub?: boolean;
}

/** The workspace navigation. The current section is the longest matching link. */
export function AdminNav({ items }: { items: AdminNavItem[] }) {
  const pathname = usePathname();
  const current = items
    .filter((i) => pathname === i.href || (i.href !== "/admin" && pathname.startsWith(`${i.href}/`)))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <nav className={styles.nav} aria-label="Staff workspace">
      <ul className={styles.navList}>
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className={cx(styles.navLink, item.sub && styles.navSub)}
              aria-current={item.href === current ? "page" : undefined}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
