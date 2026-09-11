import type { ReactNode } from "react";
import { Alert } from "@/components/ui/Alert";
import { showsUnconfirmedContent } from "@/lib/deployment";

/**
 * Marks content that is not yet confirmed by the business. Renders on staging, previews
 * and local builds only; in production it renders nothing — and the content it marks
 * is excluded there by the content layer.
 */
export function DevNotice({ decision, children }: { decision?: string; children: ReactNode }) {
  if (!showsUnconfirmedContent()) return null;
  return (
    <Alert tone="warning" title={`Unconfirmed — not shown in production${decision ? ` (decision ${decision})` : ""}`}>
      <p>{children}</p>
    </Alert>
  );
}
