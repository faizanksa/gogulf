import type { Metadata } from "next";
import { NotFoundContent } from "@/components/site/NotFoundContent";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: true },
};

/** notFound() in the English site — an unknown job, an unpublished page. Helpful, not a dead end. */
export default function NotFound() {
  return <NotFoundContent />;
}
