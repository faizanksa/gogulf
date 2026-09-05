/**
 * OTP provider registry.
 *
 * Application code calls `getOtpProvider()` and never names a vendor. Adding
 * MSG91 or Twilio later is a new module plus one entry here.
 *
 * Firebase credentials are not yet available, so the Firebase adapter is a
 * declared stub that throws a clear "not configured" error rather than a
 * half-working implementation that appears to send messages.
 */

import "server-only";

import { serverEnv } from "@/lib/env";
import { mockOtpProvider } from "./mock";
import { firebaseOtpProvider } from "./firebase";
import type { OtpProvider, OtpProviderName } from "./types";

const providers: Record<OtpProviderName, () => OtpProvider> = {
  mock: () => mockOtpProvider,
  firebase: () => firebaseOtpProvider,
  msg91: () => {
    throw new Error("MSG91 OTP provider is not implemented yet.");
  },
  twilio: () => {
    throw new Error("Twilio OTP provider is not implemented yet.");
  },
};

export function getOtpProvider(): OtpProvider {
  const configured = serverEnv().OTP_PROVIDER;

  // Default to the mock in development so the auth flow can be built and
  // tested before credentials or DLT registration exist. In production an
  // unset provider is a configuration error, not something to paper over.
  if (!configured) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "OTP_PROVIDER is not set. Refusing to fall back to the mock provider in production.",
      );
    }
    return mockOtpProvider;
  }

  return providers[configured]();
}

export type {
  OtpProvider,
  OtpProviderName,
  SendOtpRequest,
  SendOtpResult,
  VerifyOtpRequest,
  VerifyOtpResult,
} from "./types";
export { OtpError } from "./types";
