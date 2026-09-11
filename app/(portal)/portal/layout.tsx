import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AreaShell } from "@/components/site/AreaShell";

/** The customer portal. Never indexed. Its sign-in page lives outside the guarded group. */
export const metadata: Metadata = {
  title: { default: "Your account", template: "%s — Go Gulf" },
  robots: { index: false, follow: false },
};

export default function PortalLayout({ children }: { children: ReactNode }) {
  return <AreaShell label="Your Go Gulf account">{children}</AreaShell>;
}
