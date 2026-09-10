/**
 * In-memory fixed-window rate limiter.
 *
 * HONEST LIMITATIONS — read before relying on this:
 *
 *   * Per-instance. Vercel runs several serverless instances, so the effective
 *     limit is roughly (limit x instances). It raises the cost of abuse; it
 *     does not impose a hard ceiling.
 *   * Lost on cold start.
 *   * Not a defence against a distributed attacker.
 *
 * It is deliberately still worth having: the public form endpoints currently
 * have NO limit at all, and this stops casual scripted abuse and accidental
 * double-submits without adding infrastructure.
 *
 * Phase 7 replaces it with a Postgres- or Redis-backed limiter, which is also
 * when OTP endpoints arrive and a real ceiling becomes non-negotiable.
 */

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Seconds until the window resets. Suitable for a Retry-After header. */
  retryAfterSeconds: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** Bound memory: a busy instance must not accumulate keys indefinitely. */
const MAX_KEYS = 10_000;

function sweep(now: number) {
  if (buckets.size < MAX_KEYS) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  // Still oversized after clearing expired entries — drop oldest-first.
  if (buckets.size >= MAX_KEYS) {
    const excess = buckets.size - Math.floor(MAX_KEYS * 0.9);
    let dropped = 0;
    for (const key of buckets.keys()) {
      buckets.delete(key);
      if (++dropped >= excess) break;
    }
  }
}

export function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: windowSeconds };
  }

  const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));

  if (existing.count >= limit) {
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: Math.max(0, limit - existing.count),
    retryAfterSeconds,
  };
}

/**
 * Best-effort client IP.
 *
 * On Vercel the platform sets x-forwarded-for itself. Verified on staging
 * (10 Sep 2026): requests carrying spoofed x-forwarded-for values were all
 * counted against the caller's real address, and the limiter fired as expected.
 * So on Vercel this key cannot be chosen by the client.
 *
 * Off Vercel — local development, or any self-hosted proxy that forwards the
 * header untouched — x-forwarded-for IS client-controlled and can be spoofed.
 * Either way the limiter is per-instance, which is why it is described above as
 * raising the cost of abuse rather than imposing a ceiling.
 */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip") ?? "unknown";
}

/** Test seam. */
export function __resetRateLimits() {
  buckets.clear();
}
