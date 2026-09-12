import type { ReactNode } from "react";
import { Alert } from "@/components/ui/Alert";
import { showsUnconfirmedContent } from "@/lib/deployment";
import { getTranslator } from "@/lib/i18n/server";

/**
 * Marks content that is not yet confirmed by the business. Renders on staging, previews
 * and local builds only; in production it renders nothing — and the content it marks
 * is excluded there by the content layer.
 */
export async function DevNotice({ decision, children }: { decision?: string; children: ReactNode }) {
  if (!showsUnconfirmedContent()) return null;
  const t = await getTranslator();
  return (
    <Alert tone="warning" title={decision ? t("common.unconfirmedDecision", { decision }) : t("common.unconfirmed")}>
      <p>{children}</p>
    </Alert>
  );
}
