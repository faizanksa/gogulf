import type { Metadata } from "next";
import { Alert } from "@/components/ui/Alert";

export const metadata: Metadata = { title: "Staff sign-in" };

const REASONS: Record<string, string> = {
  "staff-sign-in-required": "This area is for Go Gulf staff, signed in with their Google Workspace account.",
  inactive: "This staff account is not active. Ask an administrator if you think this is wrong.",
};

/**
 * Staff sign-in — reachable without a session (exempt from the proxy gate). The Google
 * Workspace sign-in itself arrives with the staff workspace (Phase 4, decision D10).
 */
export default async function AdminLogin({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams;
  const message = reason ? REASONS[reason] : undefined;
  return (
    <>
      <h2>Staff sign-in</h2>
      {message ? <Alert tone="warning" title={message} /> : null}
      <p>Staff sign-in is not available yet. It arrives with the staff workspace.</p>
    </>
  );
}
