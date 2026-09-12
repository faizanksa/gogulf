import type { Metadata } from "next";
import { NotFoundContent } from "@/components/site/NotFoundContent";

export const metadata: Metadata = {
  robots: { index: false, follow: true },
};

/** notFound() under a language prefix — rendered in that language, inside its layout. */
export default function NotFound() {
  return <NotFoundContent />;
}
