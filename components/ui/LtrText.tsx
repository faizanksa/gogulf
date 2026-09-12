import type { ReactNode } from "react";

/**
 * Text that always runs left to right — phone numbers, references, codes — isolated from
 * the text around it. In a right-to-left paragraph the Unicode bidi algorithm would
 * otherwise reorder "+91 99363 09015" into "09015 99363 91+".
 */
export function LtrText({ children }: { children: ReactNode }) {
  return <bdi dir="ltr">{children}</bdi>;
}
