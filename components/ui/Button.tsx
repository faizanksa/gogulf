import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cx } from "./cx";
import { Icon, type IconName } from "./Icon";
import { VisuallyHidden } from "./VisuallyHidden";
import styles from "./Button.module.css";

/**
 * Buttons and button-styled links.
 *
 * Variants: primary (the one main action in a region), secondary, text, whatsapp,
 * inverse (on dark bands). 48px tall by default, 44px for `sm`.
 *
 * Loading keeps the control focusable and its label visible: it sets aria-disabled
 * and aria-busy rather than `disabled`, so focus is not thrown back to the page.
 * The form still guards against double submission.
 */

type Variant = "primary" | "secondary" | "text" | "whatsapp" | "inverse";

interface Common {
  variant?: Variant;
  size?: "md" | "sm";
  icon?: IconName;
  iconPosition?: "start" | "end";
  fullWidth?: boolean;
  className?: string;
  children: ReactNode;
}

type AsButton = Common &
  Omit<ComponentPropsWithoutRef<"button">, "className" | "children"> & {
    href?: undefined;
    loading?: boolean;
  };

type AsLink = Common &
  Omit<ComponentPropsWithoutRef<"a">, "className" | "children" | "href"> & {
    href: string;
    /**
     * Opens in a new tab; the value is what assistive technology hears, already
     * translated — e.g. t("common.opensInNewTab").
     */
    external?: string;
    /** Opens WhatsApp; the value is the translated announcement, t("common.opensWhatsApp"). */
    opensWhatsApp?: string;
  };

export type ButtonProps = AsButton | AsLink;

function content(props: Common & { loading?: boolean }) {
  const { icon, iconPosition = "start", children, loading } = props;
  const iconEl = loading ? <Icon name="spinner" size={18} /> : icon ? <Icon name={icon} size={18} /> : null;
  return (
    <>
      {iconPosition === "start" ? iconEl : null}
      <span>{children}</span>
      {iconPosition === "end" ? iconEl : null}
    </>
  );
}

export function Button(props: ButtonProps) {
  const { variant = "primary", size = "md", fullWidth, className } = props;
  const classes = cx(styles.button, styles[variant], size === "sm" && styles.sm, fullWidth && styles.fullWidth, className);

  if (typeof props.href === "string") {
    const { href, external, opensWhatsApp, variant: _v, size: _s, icon: _i, iconPosition: _p, fullWidth: _f, className: _c, children, ...rest } = props;
    const note = opensWhatsApp ?? external;
    const newTab = Boolean(note);
    const inner = (
      <>
        {content(props)}
        {note ? <VisuallyHidden> {note}</VisuallyHidden> : null}
      </>
    );
    void children;
    if (newTab || /^(https?:|mailto:|tel:)/.test(href)) {
      return (
        <a href={href} className={classes} {...(newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})} {...rest}>
          {inner}
        </a>
      );
    }
    return (
      <Link href={href} className={classes} {...rest}>
        {inner}
      </Link>
    );
  }

  const { loading, variant: _v, size: _s, icon: _i, iconPosition: _p, fullWidth: _f, className: _c, children, type = "button", onClick, ...rest } = props;
  void children;
  return (
    <button
      type={type}
      className={cx(classes, loading && styles.loading)}
      aria-disabled={loading || rest["aria-disabled"] ? true : undefined}
      aria-busy={loading || undefined}
      onClick={loading ? (e) => e.preventDefault() : onClick}
      {...rest}
    >
      {content({ ...props, loading })}
    </button>
  );
}
