import type { ReactNode } from "react";
import { Alert } from "@/components/ui/Alert";

/**
 * The outcome of a submission. The live region is always rendered (empty when idle) so
 * that assistive technology is already listening when a message appears.
 */
export function FormStatus({ state, children }: { state: "idle" | "sending" | "success" | "error"; children?: ReactNode }) {
  return (
    <div role="status" aria-live="polite">
      {state === "success" && children ? <Alert tone="success" title={children} /> : null}
      {state === "error" && children ? <Alert tone="error" title={children} /> : null}
      {state === "sending" ? <span className="visually-hidden">Sending…</span> : null}
    </div>
  );
}
