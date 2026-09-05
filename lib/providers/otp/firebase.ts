/**
 * Firebase OTP provider — DECLARED, NOT YET IMPLEMENTED.
 *
 * Firebase is the chosen first provider, but its credentials have not been
 * supplied. Rather than ship a partial implementation that looks like it works,
 * this throws a clear configuration error.
 *
 * When credentials arrive, implement send()/verify() here. Nothing outside this
 * file changes: application code depends on the OtpProvider interface, not on
 * Firebase.
 *
 * Implementation notes for whoever picks this up:
 *   - Firebase phone auth is normally client-driven (reCAPTCHA + confirmation
 *     result). Server-side verification means either the Admin SDK verifying an
 *     ID token, or moving to an SMS-API provider such as MSG91. Decide before
 *     building — it changes the client flow.
 *   - Never log or persist the submitted code.
 *   - India DLT registration is required before production SMS either way.
 */

import "server-only";

import { OtpError } from "./types";
import type {
  OtpProvider,
  SendOtpRequest,
  SendOtpResult,
  VerifyOtpRequest,
  VerifyOtpResult,
} from "./types";

function notConfigured(): never {
  throw new OtpError(
    "not_configured",
    "The Firebase OTP provider is not configured yet. Set FIREBASE_* in the environment and implement lib/providers/otp/firebase.ts.",
  );
}

export const firebaseOtpProvider: OtpProvider = {
  name: "firebase",
  async send(_request: SendOtpRequest): Promise<SendOtpResult> {
    notConfigured();
  },
  async verify(_request: VerifyOtpRequest): Promise<VerifyOtpResult> {
    notConfigured();
  },
};
