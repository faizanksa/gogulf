/**
 * Structured logging with redaction.
 *
 * The rule from the security model: OTP codes, passwords, API keys,
 * service-role keys, payment secrets, session tokens, full passport numbers and
 * document contents are NEVER logged.
 *
 * Redaction lives here rather than in each call site, because "remember not to
 * log that" is not a control. This is one of two layers — the other is the
 * Sentry `beforeSend` scrubber. Belt and braces, because this is the class of
 * mistake that ends up in a breach notification.
 */

const SENSITIVE_KEYS = [
  "password", "passwd", "password_hash",
  "otp", "otp_code", "code", "verification_code",
  "token", "access_token", "refresh_token", "id_token", "session",
  "api_key", "apikey", "secret", "client_secret",
  "service_role_key", "supabase_service_role_key",
  "key_secret", "webhook_secret", "signature",
  "authorization", "cookie", "set-cookie",
  "card", "card_number", "cvv", "upi_pin", "account_number",
  "private_key", "passport_number", "passport",
  "aadhaar", "pan",
];

const REDACTED = "[REDACTED]";
const MAX_DEPTH = 6;

function isSensitiveKey(key: string): boolean {
  const k = key.toLowerCase();
  return SENSITIVE_KEYS.some((s) => k === s || k.includes(s));
}

/** Deep-redacts by key name. Exported so tests can assert on it directly. */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return "[TRUNCATED]";
  if (value === null || value === undefined) return value;

  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));

  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }

  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = isSensitiveKey(k) ? REDACTED : redact(v, depth + 1);
    }
    return out;
  }

  return value;
}

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  [key: string]: unknown;
}

function emit(level: LogLevel, message: string, context?: LogContext) {
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(context ? { context: redact(context) } : {}),
  };

  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else if (level === "debug") console.debug(line);
  else console.info(line);
}

export const logger = {
  debug: (message: string, context?: LogContext) => {
    if (process.env.NODE_ENV !== "production") emit("debug", message, context);
  },
  info: (message: string, context?: LogContext) => emit("info", message, context),
  warn: (message: string, context?: LogContext) => emit("warn", message, context),
  error: (message: string, context?: LogContext) => emit("error", message, context),
};
