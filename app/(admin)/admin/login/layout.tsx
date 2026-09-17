import type { ReactNode } from "react";
import { AreaShell } from "@/components/site/AreaShell";

/** The staff sign-in page sits outside the guarded workspace, in the minimal area shell. */
export default function StaffLoginLayout({ children }: { children: ReactNode }) {
  return <AreaShell label="Staff workspace">{children}</AreaShell>;
}
