import type { Metadata } from "next";
import type { ReactNode } from "react";

/**
 * The staff area. Never indexed. The sign-in page (login/) wears the minimal area shell;
 * the guarded workspace ((protected)/) wears the staff workspace shell.
 */
export const metadata: Metadata = {
  title: { default: "Staff", template: "%s — Go Gulf staff" },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
