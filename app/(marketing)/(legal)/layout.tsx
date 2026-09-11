import type { ReactNode } from "react";
import "@/styles/legacy.css";

/**
 * The five policy pages. Their wording is untouched; their styling moves onto the design
 * system in 2C-4. Until then they use the scoped legacy stylesheet (see the (legacy)
 * group's layout).
 */
export default function LegalLayout({ children }: { children: ReactNode }) {
  return <div className="legacy">{children}</div>;
}
