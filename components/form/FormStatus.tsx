import type { ReactNode } from "react";
import { AlertView } from "@/components/ui/AlertView";

/** FormStatus's own words, translated by the page and passed down. */
export interface FormStatusText {
  /** "Sending…", announced while the submission is in flight. */
  sending: string;
  /** Spoken tone labels: "Success", "Error". */
  success: string;
  error: string;
}

/**
 * The outcome of a submission. The live region is always rendered (empty when idle) so
 * that assistive technology is already listening when a message appears.
 */
export function FormStatus({
  state,
  text,
  children,
}: {
  state: "idle" | "sending" | "success" | "error";
  text: FormStatusText;
  children?: ReactNode;
}) {
  return (
    <div role="status" aria-live="polite">
      {state === "success" && children ? <AlertView tone="success" toneLabel={text.success} title={children} /> : null}
      {state === "error" && children ? <AlertView tone="error" toneLabel={text.error} title={children} /> : null}
      {state === "sending" ? <span className="visually-hidden">{text.sending}</span> : null}
    </div>
  );
}
