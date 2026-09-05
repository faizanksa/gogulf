import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { rateLimit, clientIp, __resetRateLimits } from "./rate-limit";

beforeEach(() => {
  __resetRateLimits();
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe("rateLimit", () => {
  it("allows up to the limit then blocks", () => {
    for (let i = 0; i < 5; i++) {
      expect(rateLimit("k", 5, 600).allowed, `request ${i + 1}`).toBe(true);
    }
    expect(rateLimit("k", 5, 600).allowed).toBe(false);
  });

  it("counts each key separately, so one abuser cannot block everyone", () => {
    for (let i = 0; i < 5; i++) rateLimit("a", 5, 600);
    expect(rateLimit("a", 5, 600).allowed).toBe(false);
    expect(rateLimit("b", 5, 600).allowed).toBe(true);
  });

  it("resets after the window elapses", () => {
    for (let i = 0; i < 5; i++) rateLimit("k", 5, 600);
    expect(rateLimit("k", 5, 600).allowed).toBe(false);

    vi.advanceTimersByTime(600_001);
    expect(rateLimit("k", 5, 600).allowed).toBe(true);
  });

  it("reports a retry-after that shrinks as the window elapses", () => {
    rateLimit("k", 1, 600);
    const first = rateLimit("k", 1, 600);
    expect(first.allowed).toBe(false);
    expect(first.retryAfterSeconds).toBeLessThanOrEqual(600);

    vi.advanceTimersByTime(300_000);
    const later = rateLimit("k", 1, 600);
    expect(later.retryAfterSeconds).toBeLessThan(first.retryAfterSeconds);
    expect(later.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("reports remaining allowance", () => {
    expect(rateLimit("k", 3, 60).remaining).toBe(2);
    expect(rateLimit("k", 3, 60).remaining).toBe(1);
    expect(rateLimit("k", 3, 60).remaining).toBe(0);
  });

  it("bounds memory rather than growing without limit", () => {
    // A busy instance must not accumulate keys until it runs out of memory.
    for (let i = 0; i < 12_000; i++) rateLimit(`key-${i}`, 5, 600);
    expect(rateLimit("fresh", 5, 600).allowed).toBe(true);
  });
});

describe("clientIp", () => {
  it("prefers the first x-forwarded-for entry", () => {
    const h = new Headers({ "x-forwarded-for": "203.0.113.5, 70.41.3.18" });
    expect(clientIp(h)).toBe("203.0.113.5");
  });

  it("falls back to x-real-ip", () => {
    expect(clientIp(new Headers({ "x-real-ip": "198.51.100.7" }))).toBe("198.51.100.7");
  });

  it("returns a stable placeholder when no header is present", () => {
    // Must never throw — a missing header is normal in local development.
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
