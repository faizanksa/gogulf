import type { ReactNode } from "react";
import "@/styles/legacy.css";

/**
 * Pages not yet rebuilt on the design system (2C moves each one out of this group).
 *
 * Their stylesheet is scoped under `.legacy`, so it cannot restyle new pages — even
 * after a client-side navigation leaves it loaded in the document. When the last page
 * leaves this group, styles/legacy.css is deleted.
 */
export default function LegacyLayout({ children }: { children: ReactNode }) {
  return <div className="legacy">{children}</div>;
}
