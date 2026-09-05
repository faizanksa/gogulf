/**
 * Phone normalisation — TypeScript mirror of the Postgres function
 * `public.normalize_phone_e164` in supabase/migrations/0003_identity.sql.
 *
 * WHY BOTH: the database function is authoritative, because it is the only
 * thing every write path (form, webhook, IVR, import) is guaranteed to pass
 * through. This mirror exists so the browser can validate and preview a number
 * before submitting, without a round trip.
 *
 * The two MUST agree. `lib/phone.test.ts` asserts the shared cases; if you
 * change one, change the other and extend the test.
 *
 * Returns null when the input is ambiguous. Callers must treat that as
 * "quarantine for human review", never as "guess something" — a wrong
 * normalisation silently merges two different people.
 */

export const DEFAULT_COUNTRY_CODE = "91"; // India

export function normalizePhoneE164(
  raw: string | null | undefined,
  defaultCountryCode: string = DEFAULT_COUNTRY_CODE,
): string | null {
  if (raw === null || raw === undefined) return null;
  if (raw.trim() === "") return null;

  let digits = raw.replace(/[^0-9]/g, "");

  // International dialling prefixes: 00XX…
  if (digits.startsWith("00") && digits.length > 4) {
    digits = digits.slice(2);
  }

  // Bare national mobile, e.g. 9936309015 -> +919936309015
  if (digits.length === 10 && /^[6-9]/.test(digits)) {
    return `+${defaultCountryCode}${digits}`;
  }

  // Leading trunk zero, e.g. 09936309015
  if (digits.length === 11 && digits.startsWith("0")) {
    return `+${defaultCountryCode}${digits.slice(1)}`;
  }

  // Already country-coded, e.g. 919936309015
  if (digits.length === 12 && digits.startsWith(defaultCountryCode)) {
    return `+${digits}`;
  }

  // Plausible international number carrying its own country code.
  if (digits.length >= 11 && digits.length <= 15) {
    return `+${digits}`;
  }

  // Too short, too long, or ambiguous.
  return null;
}

export function normalizeEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().toLowerCase();
  return trimmed === "" ? null : trimmed;
}

/** WhatsApp wa_id is digits without '+'; normalising to E.164 is what lets a
 *  WhatsApp message resolve to a contact created from a web form. */
export function normalizeWaId(raw: string | null | undefined): string | null {
  return normalizePhoneE164(raw);
}

/** True when a number normalises confidently. Use for form validation. */
export function isNormalizablePhone(raw: string | null | undefined): boolean {
  return normalizePhoneE164(raw) !== null;
}
