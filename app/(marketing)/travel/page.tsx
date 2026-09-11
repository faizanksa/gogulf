import { notFound } from "next/navigation";
import { TRAVEL_PUBLISHED } from "@/content/travel";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("/travel");

/**
 * Reserved for the travel hub. It stays a 404 until the business confirms which travel
 * services it sells (decision D2) — nothing is invented to fill it. The hub itself is
 * built in 2C-5, from content/travel.ts.
 */
export default function TravelPage() {
  if (!TRAVEL_PUBLISHED) notFound();
  return null;
}
