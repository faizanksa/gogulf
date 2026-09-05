/**
 * Mock OTP provider — development and automated tests only.
 *
 * Accepts a fixed code so the authentication flow can be exercised before a
 * real provider or DLT registration exists. getOtpProvider() refuses to select
 * it in production.
 *
 * The fixed code is a test fixture, not a credential, and it never reaches a
 * real phone.
 */

import "server-only";

import type {
  OtpProvider,
  SendOtpRequest,
  SendOtpResult,
  VerifyOtpRequest,
  VerifyOtpResult,
} from "./types";

const FIXED_CODE = "000000";
const TTL_MS = 5 * 60 * 1000;

const issued = new Map<string, { phoneE164: string; expiresAt: Date }>();

export const mockOtpProvider: OtpProvider = {
  name: "mock",

  async send({ phoneE164 }: SendOtpRequest): Promise<SendOtpResult> {
    const verificationId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + TTL_MS);
    issued.set(verificationId, { phoneE164, expiresAt });

    // Logs that a send happened and to which number — never the code, so the
    // mock behaves like the real thing with respect to what is loggable.
    console.info(`[otp:mock] verification issued for ${phoneE164}`);

    return { verificationId, expiresAt, providerRef: `mock-${verificationId}` };
  },

  async verify({ verificationId, code, phoneE164 }: VerifyOtpRequest): Promise<VerifyOtpResult> {
    const record = issued.get(verificationId);
    if (!record) return { verified: false, failureReason: "unknown" };
    if (record.expiresAt < new Date()) {
      issued.delete(verificationId);
      return { verified: false, failureReason: "expired" };
    }
    if (record.phoneE164 !== phoneE164) return { verified: false, failureReason: "unknown" };
    if (code !== FIXED_CODE) return { verified: false, failureReason: "incorrect" };

    issued.delete(verificationId);
    return { verified: true, phoneE164 };
  },
};
