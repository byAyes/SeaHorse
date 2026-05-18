import { describe, it, expect, jest } from '@jest/globals';
import { checkRateLimit, getClientIp } from '../src/lib/rate-limiter';

describe('getClientIp', () => {
  it('should extract IP from x-forwarded-for header', () => {
    const request = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '203.0.113.42, 198.51.100.7, 10.0.0.1' },
    });
    expect(getClientIp(request)).toBe('203.0.113.42');
  });

  it('should extract IP from x-real-ip when x-forwarded-for is missing', () => {
    const request = new Request('http://localhost', {
      headers: { 'x-real-ip': '198.51.100.99' },
    });
    expect(getClientIp(request)).toBe('198.51.100.99');
  });

  it('should prefer x-forwarded-for over x-real-ip', () => {
    const request = new Request('http://localhost', {
      headers: {
        'x-forwarded-for': '203.0.113.1',
        'x-real-ip': '10.0.0.1',
      },
    });
    expect(getClientIp(request)).toBe('203.0.113.1');
  });

  it('should fall back to 127.0.0.1 when no IP headers are present', () => {
    const request = new Request('http://localhost');
    expect(getClientIp(request)).toBe('127.0.0.1');
  });
});

describe('checkRateLimit', () => {
  // Each test uses a unique IP to avoid cross-test interference
  // from the shared module-level store.

  it('should allow the first request', () => {
    const result = checkRateLimit('allow-first-01', { maxRequests: 5 });
    expect(result.allowed).toBe(true);
    // remaining is computed BEFORE pushing current timestamp, so first request shows max
    expect(result.remaining).toBe(5);
  });

  it('should allow requests up to the limit', () => {
    const ip = 'up-to-limit-02';
    // Exhaust 5 of 5 allowed requests
    checkRateLimit(ip, { maxRequests: 5 });
    checkRateLimit(ip, { maxRequests: 5 });
    checkRateLimit(ip, { maxRequests: 5 });
    checkRateLimit(ip, { maxRequests: 5 });
    checkRateLimit(ip, { maxRequests: 5 });

    // The 6th request should be blocked
    const result = checkRateLimit(ip, { maxRequests: 5 });
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('should block requests that exceed the limit', () => {
    const ip = 'exceed-limit-03';
    // Exhaust all 3 allowed requests
    checkRateLimit(ip, { maxRequests: 3 });
    checkRateLimit(ip, { maxRequests: 3 });
    checkRateLimit(ip, { maxRequests: 3 });

    // 4th request should be blocked
    const result = checkRateLimit(ip, { maxRequests: 3 });
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('should report correct remaining count', () => {
    const ip = 'remaining-count-04';
    const opts = { maxRequests: 10 };

    let result = checkRateLimit(ip, opts);
    // remaining = maxRequests - past_timestamps (before current push), so first = 10
    expect(result.remaining).toBe(10);

    result = checkRateLimit(ip, opts);
    // After 1 previous request, remaining = 10 - 1 = 9
    expect(result.remaining).toBe(9);

    result = checkRateLimit(ip, opts);
    expect(result.remaining).toBe(8);
  });

  it('should use default maxRequests of 30 when no options provided', () => {
    const ip = 'default-max-05';
    // Use up 30 of 30
    for (let i = 0; i < 30; i++) {
      checkRateLimit(ip);
    }
    // 31st request should be blocked
    const result = checkRateLimit(ip);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('should accept custom windowMs option', async () => {
    const ip = 'custom-window-06';
    const opts = { maxRequests: 2, windowMs: 100 };

    // First 2 requests should be allowed
    expect(checkRateLimit(ip, opts).allowed).toBe(true);
    expect(checkRateLimit(ip, opts).allowed).toBe(true);

    // 3rd request should be blocked (within 100ms window)
    expect(checkRateLimit(ip, opts).allowed).toBe(false);

    // Wait for window to expire
    await new Promise((resolve) => setTimeout(resolve, 110));

    // After window expires, requests should be allowed again
    expect(checkRateLimit(ip, opts).allowed).toBe(true);
  });

  it('should allow different IPs independently', () => {
    const ipA = 'independent-a-07';
    const ipB = 'independent-b-07';

    // Exhaust ipA
    checkRateLimit(ipA, { maxRequests: 2 });
    checkRateLimit(ipA, { maxRequests: 2 });
    expect(checkRateLimit(ipA, { maxRequests: 2 }).allowed).toBe(false);

    // ipB should still have all its quota
    expect(checkRateLimit(ipB, { maxRequests: 2 }).allowed).toBe(true);
    expect(checkRateLimit(ipB, { maxRequests: 2 }).allowed).toBe(true);
    expect(checkRateLimit(ipB, { maxRequests: 2 }).allowed).toBe(false);
  });

  it('should return a resetMs greater than 0 when rate limited', () => {
    const ip = 'reset-ms-08';
    const opts = { maxRequests: 1, windowMs: 30_000 };

    checkRateLimit(ip, opts);
    const result = checkRateLimit(ip, opts);

    expect(result.allowed).toBe(false);
    expect(result.resetMs).toBeGreaterThan(0);
  });
});
