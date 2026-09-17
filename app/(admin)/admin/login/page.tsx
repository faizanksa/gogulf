import type { Metadata } from "next";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { safeStaffNext } from "@/lib/admin/params";
import { getStaffContext } from "@/lib/auth/staff";
import { signInWithGoogle } from "./actions";
import styles from "./login.module.css";

export const metadata: Metadata = { title: "Staff sign-in" };
export const dynamic = "force-dynamic";

const REASONS: Record<string, { tone: "warning" | "info" | "error"; text: string }> = {
  "staff-sign-in-required": {
    tone: "warning",
    text: "This area is for Go Gulf staff, signed in with their Google Workspace account.",
  },
  inactive: { tone: "warning", text: "This staff account is not active. Ask an administrator if you think this is wrong." },
  "sign-in-failed": {
    tone: "error",
    text: "Google sign-in did not complete. Use your @gogulf.co account, and ask an administrator if it keeps failing.",
  },
  "sign-in-unavailable": { tone: "error", text: "Staff sign-in is not available on this deployment right now." },
  "signed-out": { tone: "info", text: "You have signed out." },
};

/**
 * Staff sign-in — reachable without a session (exempt from the proxy gate).
 *
 * One way in: Google Workspace (decision D10). There is no password form. A signed-in
 * staff member who lands here is offered the way back to the workspace instead.
 */
export default async function AdminLogin({ searchParams }: { searchParams: Promise<{ reason?: string; next?: string }> }) {
  const { reason, next } = await searchParams;
  const message = reason ? REASONS[reason] : undefined;
  const destination = safeStaffNext(next);
  const staff = await getStaffContext();

  return (
    <div className={styles.panel}>
      <h2 className={styles.title}>Staff sign-in</h2>
      {message ? <Alert tone={message.tone} title={message.text} /> : null}
      {staff ? (
        <>
          <p>
            You are signed in as <strong>{staff.email}</strong> ({staff.roleLabel}).
          </p>
          <div>
            <Button href={destination} icon="arrow-right" iconPosition="end">
              Go to the staff workspace
            </Button>
          </div>
        </>
      ) : (
        <>
          <p>Sign in with your Go Gulf Google Workspace account (an @gogulf.co address).</p>
          <form action={signInWithGoogle}>
            <input type="hidden" name="next" value={destination} />
            <Button type="submit" icon="arrow-right" iconPosition="end">
              Sign in with Google
            </Button>
          </form>
          <p className={styles.note}>
            Only people who have been added as staff can use the workspace. Signing in with any other Google account does not give
            access.
          </p>
        </>
      )}
    </div>
  );
}
