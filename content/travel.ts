import { z } from "zod";
import { slug, validate, verification } from "./schema";

/**
 * Travel and tour services. EMPTY on purpose: the business has not yet confirmed which
 * travel services it sells (decision D2), and nothing is invented to fill the gap.
 *
 * /travel stays a 404, the navigation hides Travel, the sitemap omits it and the
 * Organization schema does not claim TravelAgency until at least one confirmed service
 * is listed here.
 */

const travelService = z.object({
  slug,
  name: z.string().min(2),
  summary: z.string().min(20),
  pricing: z.literal("quoted-in-writing"),
  verification,
});

export type TravelService = z.infer<typeof travelService>;

export const TRAVEL_SERVICES: TravelService[] = validate(z.array(travelService), [], "content/travel.ts");

export const TRAVEL_PUBLISHED: boolean = TRAVEL_SERVICES.some((s) => s.verification === "confirmed");
