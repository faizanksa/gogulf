"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { cx } from "@/components/ui/cx";
import styles from "./CopyButton.module.css";

const noSubscribe = () => () => {};
const canCopy = () => Boolean(window.isSecureContext && navigator.clipboard?.writeText);

/**
 * Copies one value — the CIN, so a visitor can paste it into the MCA search. Rendered only
 * where the Clipboard API exists (it is absent on plain http and some in-app browsers);
 * the value itself is always on the page beside it, so nothing depends on this.
 *
 * The label and icons are translated and rendered on the server; the result is announced
 * through a polite status region, and the label returns after a few seconds.
 */
export function CopyButton({
  value,
  label,
  done,
  icons,
  className,
}: {
  value: string;
  label: string;
  done: string;
  icons: { copy: ReactNode; done: ReactNode };
  className?: string;
}) {
  const supported = useSyncExternalStore(noSubscribe, canCopy, () => false);
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  if (!supported) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      return;
    }
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 3000);
  };

  return (
    <>
      <button type="button" className={cx(styles.button, copied && styles.copied, className)} onClick={copy}>
        {copied ? icons.done : icons.copy}
        <span>{copied ? done : label}</span>
      </button>
      <span className="visually-hidden" role="status">
        {copied ? done : ""}
      </span>
    </>
  );
}
