import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/States";

export const metadata: Metadata = { title: "Overview" };

/** Placeholder behind both guard layers. The customer portal is built in Phase 3. */
export default function PortalHome() {
  return (
    <EmptyState icon="file" title="Your account is not available yet" headingLevel={2}>
      <p>Tracking applications and bookings arrives in a later phase.</p>
    </EmptyState>
  );
}
