/**
 * Property-Based Tests for Rate Limit Enforcement
 *
 * Property 25: Rate Limit Enforcement
 * **Validates: Requirements 31.4**
 *
 * Uses random input generation (Math.random) to verify that:
 *   1. For any number of requests exceeding the limit, the (limit+1)th request always returns 429
 *   2. After the rate limit window resets, requests are accepted again
 *   3. The limit is consistent: exactly N requests are allowed, N+1 is rejected
 *   4. Covers unauthenticated (100/hour), authenticated (1000/hour), and payment (10/minute) limits
 *
 * Uses an in-memory rate limiter — no Redis or external services required.
 */

// ─── Constants ────────────────────────────────────────────────────────────────

/** Rate limit configurations matching Requirements 31.2, 31.3, 31.4 */
const RATE_LIMIT_CONFIGS = {
  unauthenticated: { limit: 100, windowSeconds: 3600 },   // 100 req/hour per IP
  authenticated:   { limit: 1000, windowSeconds: 3600 },  // 1000 req/hour per user
  payment:         { limit: 10, windowSeconds: 60 },       // 10 req/minute per user
} as const;

type LimitType = keyof typeof RATE_LIMIT_CONFIGS;

// ─── In-Memory Rate Limiter ───────────────────────────────────────────────────

interface RateLimitBucket {
  count: number;
  windowStartMs: number;
  windowEndMs: number;
}

interface RateLimitCheckResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAtMs: number;
  statusCode: 200 | 429;
}

/**
 * Minimal in-memory fixed-window rate limiter that mirrors the real
 * RateLimiterService behaviour (INCR + EXPIRE pattern).
 * All time values are injected so tests can control the clock without real delays.
 */
class InMemoryRateLimiter {
  private buckets = new Map<string, RateLimitBucket>();

  check(key: string, maxLimit: number, windowSeconds: number, nowMs: number): RateLimitCheckResult {
    const windowMs = windowSeconds * 1000;
    let bucket = this.buckets.get(key);

    // Start a new window if no bucket exists or the current window has expired
    if (!bucket || nowMs >= bucket.windowEndMs) {
      bucket = {
        count: 0,
        windowStartMs: nowMs,
        windowEndMs: nowMs + windowMs,
      };
      this.buckets.set(key, bucket);
    }

    bucket.count += 1;

    const allowed = bucket.count <= maxLimit;
    const remaining = Math.max(0, maxLimit - bucket.count);
    const statusCode: 200 | 429 = allowed ? 200 : 429;

    return {
      allowed,
      remaining,
      limit: maxLimit,
      resetAtMs: bucket.windowEndMs,
      statusCode,
    };
  }

  reset(): void {
    this.buckets.clear();
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randStr(len = 8): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < len; i++) {
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  return s;
}

function randomIp(): string {
  return `${randInt(1, 254)}.${randInt(0, 255)}.${randInt(0, 255)}.${randInt(1, 254)}`;
}

function randomUserId(): string {
  return `user-${randStr(8)}`;
}

function randomLimitType(): LimitType {
  const types: LimitType[] = ['unauthenticated', 'authenticated', 'payment'];
  return types[randInt(0, types.length - 1)];
}

function buildKey(type: LimitType, identifier: string): string {
  switch (type) {
    case 'unauthenticated': return `unauth:${identifier}`;
    case 'authenticated':   return `auth:${identifier}`;
    case 'payment':         return `payment:${identifier}`;
  }
}

// ─── Property 25: Rate Limit Enforcement ─────────────────────────────────────

/**
 * **Validates: Requirements 31.4**
 */
describe('Property 25: Rate Limit Enforcement', () => {
  let limiter: InMemoryRateLimiter;
  const BASE_TIME_MS = Date.now();

  beforeEach(() => {
    limiter = new InMemoryRateLimiter();
  });

  // ── Sub-property A: (limit+1)th request always returns 429 ───────────────

  describe('A: The (limit+1)th request always returns 429', () => {
    it('returns 429 on the request immediately after the limit for 50 random identifiers', () => {
      const failures: string[] = [];

      for (let i = 0; i < 50; i++) {
        const type = randomLimitType();
        const { limit, windowSeconds } = RATE_LIMIT_CONFIGS[type];
        const identifier = type === 'unauthenticated' ? randomIp() : randomUserId();
        const key = buildKey(type, identifier);
        const nowMs = BASE_TIME_MS + i * 1000;

        // Send exactly `limit` requests — all must be allowed
        for (let req = 1; req <= limit; req++) {
          const result = limiter.check(key, limit, windowSeconds, nowMs);
          if (!result.allowed || result.statusCode !== 200) {
            failures.push(
              `[${type}] iteration ${i}: request ${req}/${limit} should be allowed ` +
              `(statusCode 200) but got statusCode=${result.statusCode}, allowed=${result.allowed}`
            );
          }
        }

        // The (limit+1)th request must be rejected with 429
        const overLimitResult = limiter.check(key, limit, windowSeconds, nowMs);
        if (overLimitResult.allowed || overLimitResult.statusCode !== 429) {
          failures.push(
            `[${type}] iteration ${i}: request ${limit + 1} (over limit) should return 429 ` +
            `but got statusCode=${overLimitResult.statusCode}, allowed=${overLimitResult.allowed}`
          );
        }
      }

      expect(failures).toHaveLength(0);
    });
  });

  // ── Sub-property B: Access restored after window reset ───────────────────

  describe('B: Access is restored after the rate limit window resets', () => {
    it('allows requests again after window expiry for 50 random identifiers', () => {
      const failures: string[] = [];

      for (let i = 0; i < 50; i++) {
        const type = randomLimitType();
        const { limit, windowSeconds } = RATE_LIMIT_CONFIGS[type];
        const identifier = type === 'unauthenticated' ? randomIp() : randomUserId();
        const key = buildKey(type, identifier);
        const nowMs = BASE_TIME_MS + i * 10_000;

        // Exhaust the limit
        for (let req = 1; req <= limit; req++) {
          limiter.check(key, limit, windowSeconds, nowMs);
        }

        // Confirm the next request is blocked
        const blockedResult = limiter.check(key, limit, windowSeconds, nowMs);
        if (blockedResult.allowed) {
          failures.push(
            `[${type}] iteration ${i}: request after limit should be blocked but was allowed`
          );
          continue;
        }

        // Simulate window reset by advancing time past the window end
        const afterWindowMs = nowMs + windowSeconds * 1000 + 1;

        // First request in the new window must be allowed
        const restoredResult = limiter.check(key, limit, windowSeconds, afterWindowMs);
        if (!restoredResult.allowed || restoredResult.statusCode !== 200) {
          failures.push(
            `[${type}] iteration ${i}: first request after window reset should be allowed ` +
            `but got statusCode=${restoredResult.statusCode}, allowed=${restoredResult.allowed}`
          );
        }

        // Remaining count should be reset to limit - 1
        if (restoredResult.remaining !== limit - 1) {
          failures.push(
            `[${type}] iteration ${i}: remaining after window reset should be ${limit - 1} ` +
            `but got ${restoredResult.remaining}`
          );
        }
      }

      expect(failures).toHaveLength(0);
    });
  });

  // ── Sub-property C: Exactly N requests allowed, N+1 rejected ─────────────

  describe('C: Exactly N requests are allowed and N+1 is rejected', () => {
    it('enforces the exact limit boundary for all three limit types', () => {
      const failures: string[] = [];
      const ITERATIONS_PER_TYPE = 30;

      for (const type of Object.keys(RATE_LIMIT_CONFIGS) as LimitType[]) {
        const { limit, windowSeconds } = RATE_LIMIT_CONFIGS[type];

        for (let i = 0; i < ITERATIONS_PER_TYPE; i++) {
          const identifier = type === 'unauthenticated' ? randomIp() : randomUserId();
          const key = buildKey(type, identifier);
          const nowMs = BASE_TIME_MS + i * 5_000;

          let allowedCount = 0;
          let firstRejectedAt = -1;

          const extra = randInt(1, 10);
          const totalRequests = limit + extra;

          for (let req = 1; req <= totalRequests; req++) {
            const result = limiter.check(key, limit, windowSeconds, nowMs);
            if (result.allowed) {
              allowedCount++;
            } else if (firstRejectedAt === -1) {
              firstRejectedAt = req;
            }
          }

          if (allowedCount !== limit) {
            failures.push(
              `[${type}] iteration ${i}: expected exactly ${limit} allowed requests ` +
              `but got ${allowedCount}`
            );
          }

          if (firstRejectedAt !== limit + 1) {
            failures.push(
              `[${type}] iteration ${i}: first rejection should be at request ${limit + 1} ` +
              `but was at request ${firstRejectedAt}`
            );
          }
        }
      }

      expect(failures).toHaveLength(0);
    });
  });

  // ── Sub-property D: Unauthenticated limit (100/hour) ─────────────────────

  describe('D: Unauthenticated limit — 100 requests per hour per IP', () => {
    it('enforces 100 req/hour for 30 random IP addresses', () => {
      const failures: string[] = [];
      const { limit, windowSeconds } = RATE_LIMIT_CONFIGS.unauthenticated;

      for (let i = 0; i < 30; i++) {
        const ip = randomIp();
        const key = buildKey('unauthenticated', ip);
        const nowMs = BASE_TIME_MS + i * 1_000;

        for (let req = 1; req <= limit; req++) {
          const result = limiter.check(key, limit, windowSeconds, nowMs);
          if (!result.allowed) {
            failures.push(
              `[unauth] IP=${ip} iteration ${i}: request ${req} should be allowed but was rejected`
            );
          }
        }

        const result101 = limiter.check(key, limit, windowSeconds, nowMs);
        if (result101.allowed) {
          failures.push(
            `[unauth] IP=${ip} iteration ${i}: 101st request should be rejected (429) but was allowed`
          );
        }
        if (result101.statusCode !== 429) {
          failures.push(
            `[unauth] IP=${ip} iteration ${i}: expected statusCode 429 but got ${result101.statusCode}`
          );
        }

        // Different IP must have its own independent counter
        const otherIp = randomIp();
        const otherKey = buildKey('unauthenticated', otherIp);
        const otherResult = limiter.check(otherKey, limit, windowSeconds, nowMs);
        if (!otherResult.allowed) {
          failures.push(
            `[unauth] iteration ${i}: different IP ${otherIp} should not be affected ` +
            `by ${ip}'s rate limit`
          );
        }
      }

      expect(failures).toHaveLength(0);
    });
  });

  // ── Sub-property E: Authenticated limit (1000/hour) ──────────────────────

  describe('E: Authenticated limit — 1000 requests per hour per user', () => {
    it('enforces 1000 req/hour for 20 random user IDs', () => {
      const failures: string[] = [];
      const { limit, windowSeconds } = RATE_LIMIT_CONFIGS.authenticated;

      for (let i = 0; i < 20; i++) {
        const userId = randomUserId();
        const key = buildKey('authenticated', userId);
        const nowMs = BASE_TIME_MS + i * 1_000;

        for (let req = 1; req <= limit; req++) {
          const result = limiter.check(key, limit, windowSeconds, nowMs);
          if (!result.allowed) {
            failures.push(
              `[auth] userId=${userId} iteration ${i}: request ${req} should be allowed but was rejected`
            );
          }
        }

        const result1001 = limiter.check(key, limit, windowSeconds, nowMs);
        if (result1001.allowed) {
          failures.push(
            `[auth] userId=${userId} iteration ${i}: 1001st request should be rejected (429) but was allowed`
          );
        }

        // Remaining should be 0 when over limit
        const overResult = limiter.check(key, limit, windowSeconds, nowMs);
        if (overResult.remaining !== 0) {
          failures.push(
            `[auth] userId=${userId} iteration ${i}: remaining should be 0 when over limit ` +
            `but got ${overResult.remaining}`
          );
        }
      }

      expect(failures).toHaveLength(0);
    });
  });

  // ── Sub-property F: Payment limit (10/minute) ────────────────────────────

  describe('F: Payment limit — 10 requests per minute per user', () => {
    it('enforces 10 req/minute for 30 random user IDs', () => {
      const failures: string[] = [];
      const { limit, windowSeconds } = RATE_LIMIT_CONFIGS.payment;

      for (let i = 0; i < 30; i++) {
        const userId = randomUserId();
        const key = buildKey('payment', userId);
        const nowMs = BASE_TIME_MS + i * 1_000;

        for (let req = 1; req <= limit; req++) {
          const result = limiter.check(key, limit, windowSeconds, nowMs);
          if (!result.allowed) {
            failures.push(
              `[payment] userId=${userId} iteration ${i}: request ${req} should be allowed but was rejected`
            );
          }
        }

        const result11 = limiter.check(key, limit, windowSeconds, nowMs);
        if (result11.allowed) {
          failures.push(
            `[payment] userId=${userId} iteration ${i}: 11th request should be rejected (429) but was allowed`
          );
        }
        if (result11.statusCode !== 429) {
          failures.push(
            `[payment] userId=${userId} iteration ${i}: expected statusCode 429 but got ${result11.statusCode}`
          );
        }

        // After 60 seconds (window reset), requests should be allowed again
        const afterWindowMs = nowMs + windowSeconds * 1000 + 1;
        const restoredResult = limiter.check(key, limit, windowSeconds, afterWindowMs);
        if (!restoredResult.allowed) {
          failures.push(
            `[payment] userId=${userId} iteration ${i}: first request after 60s window reset ` +
            `should be allowed but was rejected`
          );
        }
      }

      expect(failures).toHaveLength(0);
    });
  });

  // ── Sub-property G: Rate limit response metadata is correct ──────────────

  describe('G: Rate limit response metadata is correct', () => {
    it('returns correct limit, remaining, and resetAt for 50 random requests', () => {
      const failures: string[] = [];

      for (let i = 0; i < 50; i++) {
        const type = randomLimitType();
        const { limit, windowSeconds } = RATE_LIMIT_CONFIGS[type];
        const identifier = type === 'unauthenticated' ? randomIp() : randomUserId();
        const key = buildKey(type, identifier);
        const nowMs = BASE_TIME_MS + i * 2_000;

        const requestCount = randInt(1, limit);
        let lastResult: RateLimitCheckResult | null = null;

        for (let req = 1; req <= requestCount; req++) {
          lastResult = limiter.check(key, limit, windowSeconds, nowMs);
        }

        if (!lastResult) continue;

        if (lastResult.limit !== limit) {
          failures.push(
            `[${type}] iteration ${i}: result.limit should be ${limit} but got ${lastResult.limit}`
          );
        }

        const expectedRemaining = limit - requestCount;
        if (lastResult.remaining !== expectedRemaining) {
          failures.push(
            `[${type}] iteration ${i}: remaining should be ${expectedRemaining} ` +
            `(limit=${limit} - requests=${requestCount}) but got ${lastResult.remaining}`
          );
        }

        if (lastResult.resetAtMs <= nowMs) {
          failures.push(
            `[${type}] iteration ${i}: resetAtMs (${lastResult.resetAtMs}) should be ` +
            `after nowMs (${nowMs})`
          );
        }

        const expectedResetMs = nowMs + windowSeconds * 1000;
        if (lastResult.resetAtMs !== expectedResetMs) {
          failures.push(
            `[${type}] iteration ${i}: resetAtMs should be ${expectedResetMs} ` +
            `but got ${lastResult.resetAtMs}`
          );
        }
      }

      expect(failures).toHaveLength(0);
    });
  });

  // ── Sub-property H: Independent keys do not interfere ────────────────────

  describe('H: Rate limits are independent per key (IP or user)', () => {
    it('different identifiers have independent counters for 50 random pairs', () => {
      const failures: string[] = [];

      for (let i = 0; i < 50; i++) {
        const type = randomLimitType();
        const { limit, windowSeconds } = RATE_LIMIT_CONFIGS[type];
        const nowMs = BASE_TIME_MS + i * 1_000;

        const id1 = type === 'unauthenticated' ? randomIp() : randomUserId();
        const id2 = type === 'unauthenticated' ? randomIp() : randomUserId();

        if (id1 === id2) continue;

        const key1 = buildKey(type, id1);
        const key2 = buildKey(type, id2);

        // Exhaust key1's limit
        for (let req = 1; req <= limit + 1; req++) {
          limiter.check(key1, limit, windowSeconds, nowMs);
        }

        // key2 should still have its full limit available
        const key2Result = limiter.check(key2, limit, windowSeconds, nowMs);
        if (!key2Result.allowed) {
          failures.push(
            `[${type}] iteration ${i}: exhausting ${id1}'s limit should not affect ${id2}'s limit`
          );
        }
        if (key2Result.remaining !== limit - 1) {
          failures.push(
            `[${type}] iteration ${i}: ${id2}'s remaining should be ${limit - 1} ` +
            `(unaffected by ${id1}) but got ${key2Result.remaining}`
          );
        }
      }

      expect(failures).toHaveLength(0);
    });
  });
});
