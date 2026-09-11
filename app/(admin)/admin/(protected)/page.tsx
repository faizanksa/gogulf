import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/States";

export const metadata: Metadata = { title: "Workspace" };

/** Placeholder behind both guard layers. The staff workspace is built in Phase 4. */
export default function AdminHome() {
  return (
    <EmptyState icon="building" title="The staff workspace is not available yet" headingLevel={2}>
      <p>You are signed in as Go Gulf staff. The workspace arrives in a later phase.</p>
    </EmptyState>
  );
}
