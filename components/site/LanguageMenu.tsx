"use client";

import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { localizedPath, splitLocale, type AnyLocale } from "@/lib/i18n/paths";
import { rememberLocale } from "@/lib/i18n/preference";
import type { LanguageOption } from "@/lib/i18n/switcher";
import styles from "./LanguageMenu.module.css";

interface Props {
  /** "Language", in the page's language. */
  label: string;
  /** "(current)", in the page's language. */
  currentLabel: string;
  options: LanguageOption[];
  paths: Record<string, AnyLocale[]>;
  /**
   * "menu": a disclosure button in the desktop header. "list": plain links inside the
   * mobile menu panel — a phone header has no room for a fourth control.
   */
  variant: "menu" | "list";
  icon?: ReactNode;
}

/**
 * The language switcher: the languages the current page exists in. Hidden on pages that
 * exist in one language only. Each option is a plain link (another language is another
 * root layout, so a full page load either way), marked with its own lang and hreflang so
 * screen readers pronounce each language's name in that language. Choosing one remembers
 * it (lib/i18n/preference.ts); nothing redirects on it.
 */
export function LanguageMenu({ label, currentLabel, options, paths, variant, icon }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  const { locale, path } = splitLocale(pathname);
  const available = paths[path];
  const current = options.find((o) => o.code === locale);
  if (!available || available.length < 2 || !current) return null;

  const links = options
    .filter((o) => available.includes(o.code))
    .map((o) => (
      <li key={o.code}>
        <a
          href={localizedPath(path, o.code)}
          lang={o.tag}
          hrefLang={o.tag}
          className={styles.option}
          aria-current={o.code === locale ? "true" : undefined}
          onClick={() => rememberLocale(o.code)}
        >
          {o.autonym}
          {o.code === locale ? <span className="visually-hidden"> {currentLabel}</span> : null}
        </a>
      </li>
    ));

  if (variant === "list") {
    return (
      <div className={styles.inline}>
        <p className={styles.inlineHeading}>{label}</p>
        <ul className={styles.inlineList}>{links}</ul>
      </div>
    );
  }

  return (
    <div ref={rootRef} className={styles.menu}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.button}
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
      >
        {icon}
        <span className="visually-hidden">{label}: </span>
        <span lang={current.tag}>{current.autonym}</span>
      </button>
      <ul id={listId} className={styles.list} hidden={!open}>
        {links}
      </ul>
    </div>
  );
}
