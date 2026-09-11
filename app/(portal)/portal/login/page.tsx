import type { Metadata } from "next";
import { Alert } from "@/components/ui/Alert";

export const metadata: Metadata = { title: "Sign in" };

const REASONS: Record<string, string> = {
  "customer-sign-in-required": "Please sign in with your mobile number to see your account.",
  "account-not-linked": "We could not find your records for this sign-in. Contact us and we will link your account.",
};

/**
 * Customer sign-in — reachable without a session (exempt from the proxy gate). Phone
 * OTP sign-in arrives with the portal (Phase 3).
 */
export default async function PortalLogin({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams;
  const message = reason ? REASONS[reason] : undefined;
  return (
    <>
      <h2>Sign in to your Go Gulf account</h2>
      {message ? <Alert tone="warning" title={message} /> : null}
      <p>Online accounts are not available yet. To ask about an application, contact us by phone, WhatsApp or email.</p>
    </>
  );
}
