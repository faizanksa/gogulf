import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AreaShell } from "@/components/site/AreaShell";

/** The staff area. Never indexed. Its sign-in page lives outside the guarded group. */
export const metadata: Metadata = {
  title: { default: "Staff", template: "%s — Go Gulf staff" },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AreaShell label="Staff workspace">{children}</AreaShell>;
}
