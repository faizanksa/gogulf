/**
 * OTP provider interface.
 *
 * Firebase is the first implementation, but the authentication architecture
 * must not depend on it. Everything above this interface deals in phone numbers
 * and verification results; nothing above it imports a vendor SDK.
 *
 * Swapping Firebase for MSG91 or Twilio is then a new file in this directory
 * plus one line in the registry — not a rewrite of the auth flow.
 *
 * India DLT NOTE: production SMS to Indian numbers requires DLT registration of
 * the sender header and message templates. It has weeks of lead time and is a
 * hard prerequisite for going live — see docs/MIGRATION-PLAN.md §1.
 */

export type OtpProviderName = "firebase" | "msg91" | "twilio" | "mock";

export interface SendOtpRequest {
  /** E.164, already normalised by the database function. */
  phoneE164: string;
  /** For per-phone and per-IP rate limiting and abuse investigation. */
  ipAddress?: string;
  locale?: string;
}

export interface SendOtpResult {
  /**
   * Opaque handle correlating the send with the later verification. Never the
   * code itself — the code must not be representable in our own types, so it
   * cannot accidentally be logged, stored or returned.
   */
  verificationId: string;
  expiresAt: Date;
  /** Provider-side identifier, for support and reconciliation. */
  providerRef?: string;
}

export interface VerifyOtpRequest {
  verificationId: string;
  /**
   * The code the user typed. Read once, passed straight to the provider, never
   * logged, never stored, never included in an error.
   */
  code: string;
  phoneE164: string;
}

export interface VerifyOtpResult {
  verified: boolean;
  /** Set only when verified — the phone this session may now claim. */
  phoneE164?: string;
  failureReason?: "expired" | "incorrect" | "too_many_attempts" | "unknown";
}

export interface OtpProvider {
  readonly name: OtpProviderName;
  send(request: SendOtpRequest): Promise<SendOtpResult>;
  verify(request: VerifyOtpRequest): Promise<VerifyOtpResult>;
}

/** Never surfaces the submitted code, not even in its message. */
export class OtpError extends Error {
  readonly code: "rate_limited" | "provider_error" | "invalid_phone" | "not_configured";

  constructor(code: OtpError["code"], message: string) {
    super(message);
    this.name = "OtpError";
    this.code = code;
  }
}
