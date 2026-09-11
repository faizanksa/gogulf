import type { ReactNode } from "react";

/** Text for assistive technology only (uses the .visually-hidden utility in styles/base.css). */
export function VisuallyHidden({ children }: { children: ReactNode }) {
  return <span className="visually-hidden">{children}</span>;
}
