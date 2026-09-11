import { z } from "zod";
import { isoDate, validate } from "./schema";

/**
 * Official contact channels and social profiles.
 *
 * `confirmed`             supplied by the business and in use since Phase 1
 * `pending-confirmation`  resolves to a profile named GO GULF, but the business has not
 *                         confirmed ownership — kept out of structured data and the footer
 * `not-found`             the URL does not resolve to a profile
 *
 * Profile checks were read-only HTTP requests on 11 Sep 2026.
 */

const channel = z.object({
  id: z.string(),
  label: z.string(),
  kind: z.enum(["phone", "whatsapp", "email", "whatsapp-channel", "social"]),
  value: z.string(),
  href: z.string().url().or(z.string().startsWith("tel:")).or(z.string().startsWith("mailto:")),
  purpose: z.string().optional(),
  status: z.enum(["confirmed", "pending-confirmation", "not-found"]),
  checkedOn: isoDate.optional(),
  note: z.string().optional(),
});

export type Channel = z.infer<typeof channel>;

export const CHANNELS: Channel[] = validate(
  z.array(channel),
  [
    { id: "phone", label: "Phone", kind: "phone", value: "+91 99363 09015", href: "tel:+919936309015", purpose: "Enquiries", status: "confirmed" },
    { id: "whatsapp", label: "WhatsApp", kind: "whatsapp", value: "+91 99363 09015", href: "https://wa.me/919936309015", purpose: "Job seekers and enquiries", status: "confirmed" },
    { id: "careers-email", label: "Job seekers", kind: "email", value: "careers@gogulf.co", href: "mailto:careers@gogulf.co", purpose: "Applications and job-seeker questions", status: "confirmed" },
    { id: "business-email", label: "Employers and business", kind: "email", value: "business@gogulf.co", href: "mailto:business@gogulf.co", purpose: "Employers, billing and grievances", status: "confirmed" },
    { id: "whatsapp-channel", label: "WhatsApp channel", kind: "whatsapp-channel", value: "GO GULF", href: "https://whatsapp.com/channel/0029Vaa7XJ4FSAt7ri2W4W2J", status: "pending-confirmation", checkedOn: "2026-09-11", note: "Resolves to a channel named GO GULF" },
    { id: "youtube", label: "YouTube", kind: "social", value: "@GoGulf8866", href: "https://www.youtube.com/@GoGulf8866", status: "pending-confirmation", checkedOn: "2026-09-11", note: "Resolves to a channel named GO GULF" },
    { id: "facebook", label: "Facebook", kind: "social", value: "gogulf8866", href: "https://facebook.com/gogulf8866", status: "pending-confirmation", checkedOn: "2026-09-11", note: "Resolves to a page titled GO GULF | Lucknow" },
    { id: "instagram", label: "Instagram", kind: "social", value: "@gogulf8866", href: "https://instagram.com/gogulf8866", status: "pending-confirmation", checkedOn: "2026-09-11", note: "Resolves to GO GULF (@gogulf8866)" },
    { id: "x", label: "X", kind: "social", value: "@gogulf8866", href: "https://x.com/gogulf8866", status: "not-found", checkedOn: "2026-09-11", note: "Returns 'User Profile Not Found' — the live site links to it" },
    { id: "linkedin", label: "LinkedIn", kind: "social", value: "gogulf8866", href: "https://linkedin.com/company/gogulf8866", status: "pending-confirmation", checkedOn: "2026-09-11", note: "Could not be checked (sign-in wall)" },
    { id: "tiktok", label: "TikTok", kind: "social", value: "@gogulf8866", href: "https://tiktok.com/@gogulf8866", status: "pending-confirmation", checkedOn: "2026-09-11", note: "Could not be checked (timed out)" },
  ],
  "content/channels.ts",
);

const byId = (id: string): Channel => {
  const c = CHANNELS.find((x) => x.id === id);
  if (!c) throw new Error(`Unknown channel ${id}`);
  return c;
};

export const PHONE = byId("phone");
export const WHATSAPP = byId("whatsapp");
export const CAREERS_EMAIL = byId("careers-email");
export const BUSINESS_EMAIL = byId("business-email");

/** Only confirmed profiles may be linked as ours or listed in `sameAs`. */
export const CONFIRMED_SOCIAL = CHANNELS.filter((c) => (c.kind === "social" || c.kind === "whatsapp-channel") && c.status === "confirmed");

/** A wa.me link with a prefilled message — lets staff see what the person was looking at. */
export function whatsappLink(message?: string): string {
  return message ? `${WHATSAPP.href}?text=${encodeURIComponent(message)}` : WHATSAPP.href;
}
