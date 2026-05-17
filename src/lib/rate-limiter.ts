/**
 * Simple in-memory rate limiter for API routes.
 *
 * Uses a sliding window algorithm per IP address.
 * Data is stored in a Map and is NOT shared across serverless instances.
 * For multi-instance deployments, use a Redis-backed limiter instead.
 */

interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

// Periodically clean up stale entries (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    entry.timestamps = entry.timestamps.filter((t) => now - t < 60_000);
    if (entry.timestamps.length === 0) {
      store.delete(key);
    }
  }
}, 5 * 60_000).unref();

export interface RateLimitOptions {
  /** Max number of requests allowed within the window */
  maxRequests?: number;
  /** Window duration in milliseconds (default: 60s) */
  windowMs?: number;
}

const DEFAULT_OPTIONS: Required<RateLimitOptions> = {
  maxRequests: 30,
  windowMs: 60_000,
};

/**
 * Check if a request should be rate-limited.
 *
 * @param ip - The client IP to rate-limit by
 * @param options - Rate limit configuration
 * @returns Object with `allowed` boolean and rate limit headers
 */
export function checkRateLimit(
  ip: string,
  options: RateLimitOptions = {}
): { allowed: boolean; remaining: number; resetMs: number } {
  const { maxRequests, windowMs } = { ...DEFAULT_OPTIONS, ...options };
  const now = Date.now();

  let entry = store.get(ip);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(ip, entry);
  }

  // Remove timestamps outside the window
  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);

  const remaining = Math.max(0, maxRequests - entry.timestamps.length);
  const allowed = remaining > 0;

  if (allowed) {
    entry.timestamps.push(now);
  }

  return {
    allowed,
    remaining,
    resetMs: entry.timestamps.length > 0 ? entry.timestamps[0] + windowMs - now : 0,
  };
}

/**
 * Convenience function to extract client IP from a Next.js request.
 */
export function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "127.0.0.1"
  );
}
