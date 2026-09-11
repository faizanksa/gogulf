"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cx } from "@/components/ui/cx";
import styles from "./SiteNav.module.css";

interface Item {
  href: string;
  label: string;
}

/** Icons arrive pre-rendered from the server, so the icon set is never bundled here. */
export interface NavIcons {
  menu: ReactNode;
  close: ReactNode;
  chevron: ReactNode;
  whatsapp: ReactNode;
  phone: ReactNode;
}

/**
 * The shell's only client island: current-page marking and the mobile menu.
 *
 * Menu = disclosure pattern: the button owns aria-expanded / aria-controls; the panel
 * follows it in the DOM so Tab moves straight into it; Escape closes it and returns
 * focus to the button; choosing a link closes it. No focus trap — it is not a dialog.
 *
 * Anything that does not need the browser — the primary call to action and the icons —
 * is rendered by SiteHeader on the server and passed in as elements. That keeps this
 * island to the state it actually owns.
 */
export function SiteNav({
  items,
  cta,
  icons,
  whatsappHref,
  phone,
}: {
  items: Item[];
  cta: ReactNode;
  icons: NavIcons;
  whatsappHref: string;
  phone: { value: string; href: string };
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const isCurrent = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const close = () => setOpen(false);

  return (
    <>
      <nav aria-label="Main" className={styles.desktop}>
        <ul className={styles.desktopList}>
          {items.map((item) => (
            <li key={item.href}>
              <Link href={item.href} className={styles.desktopLink} aria-current={isCurrent(item.href) ? "page" : undefined}>
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className={styles.actions}>
        {cta}
        <button
          ref={buttonRef}
          type="button"
          className={styles.menuButton}
          aria-expanded={open}
          aria-controls="site-menu"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? icons.close : icons.menu}
          <span>{open ? "Close" : "Menu"}</span>
        </button>
      </div>

      <div id="site-menu" className={styles.panel} hidden={!open}>
        <nav aria-label="Main">
          <ul className={styles.panelList}>
            {items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cx(styles.panelLink, isCurrent(item.href) && styles.panelLinkCurrent)}
                  aria-current={isCurrent(item.href) ? "page" : undefined}
                  onClick={close}
                >
                  {item.label}
                  {icons.chevron}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className={styles.contact}>
          <p className={styles.contactHeading}>Talk to us</p>
          <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className={styles.contactLink} onClick={close}>
            {icons.whatsapp}
            WhatsApp {phone.value}
            <span className="visually-hidden"> (opens WhatsApp)</span>
          </a>
          <a href={phone.href} className={styles.contactLink} onClick={close}>
            {icons.phone}
            Call {phone.value}
          </a>
        </div>
      </div>
    </>
  );
}
