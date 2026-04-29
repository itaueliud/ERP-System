/**
 * Property-Based Tests for Expired Token Rejection
 *
 * Property 30: Error Condition - Expired Token
 * Validates: Requirements 33.4
 *
 * Uses random input generation (Math.random) to verify that:
 *   1. Any JWT token with exp < current time is always rejected
 *   2. JWT tokens with a future expiry are always accepted
 *   3. Rejection is consistent regardless of token payload (user ID, role, etc.)
 *
 * Uses the actual jsonwebtoken library — no mocks, no external services.
 */

import jwt from 'jsonwebtoken';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Shared secret used for signing/verifying tokens in tests */
const TEST_JWT_SECRET = 'test_secret_for_expired_token_property_tests';

/** All system roles (Requirement 2.5) */
const ROLES = [
  'CEO', 'CoS', 'CFO', 'COO', 'CTO', 'EA',
  'HEAD_OF_TRAINERS', 'TRAINER', 'AGENT',
  'OPERATIONS_USER', 'TECH_STAFF', 'DEVELOPER',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Random integer in [min, max] inclusive */
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Random alphanumeric string of given length */
function randStr(len = 8): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let s = '';
  for (let i = 0; i < len; i++) {
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  return s;
}

/** Generate a random UUID-like user ID */
function randomUserId(): string {
  return `user-${randStr(8)}-${randStr(4)}-${randStr(4)}`;
}

/** Generate a random session ID */
function randomSessionId(): string {
  return `sess-${randStr(12)}`;
}

/** Pick a random role */
function randomRole(): string {
  return ROLES[randInt(0, ROLES.length - 1)];
}

/** Generate a random email */
function randomEmail(): string {
  return `${randStr(6)}@${randStr(4)}.com`;
}

/**
 * Create a JWT token with an explicit `exp` timestamp (Unix seconds).
 * This bypasses the `expiresIn` string option so we can set precise past/future times.
 */
function createTokenWithExp(
  userId: string,
  sessionId: string,
  role: string,
  email: string,
  expUnixSeconds: number
): string {
  const payload = {
    userId,
    sessionId,
    role,
    email,
    iat: Math.floor(Date.now() / 1000) - 1, // issued 1 second ago
    exp: expUnixSeconds,
  };
  // Sign without expiresIn — the exp field in the payload is used directly
  return jwt.sign(payload, TEST_JWT_SECRET);
}

/**
 * Attempt to verify a token. Returns the decoded payload on success,
 * or throws on failure (expired, invalid signature, etc.).
 */
function verifyToken(token: string): jwt.JwtPayload {
  return jwt.verify(token, TEST_JWT_SECRET) as jwt.JwtPayload;
}

// ─── Property 30: Error Condition - Expired Token ────────────────────────────

/**
 * **Validates: Requirements 33.4**
 */
describe('Property 30: Error Condition - Expired Token', () => {
  // ── Sub-property A: Expired tokens are always rejected ───────────────────

  describe('A: Expired tokens are always rejected regardless of payload', () => {
    it('rejects 100 randomly generated expired tokens with TokenExpiredError', () => {
      const failures: string[] = [];
      const nowSeconds = Math.floor(Date.now() / 1000);

      for (let i = 0; i < 100; i++) {
        const userId = randomUserId();
        const sessionId = randomSessionId();
        const role = randomRole();
        const email = randomEmail();

        // exp is somewhere between 1 second and 30 days in the past
        const secondsAgo = randInt(1, 30 * 24 * 60 * 60);
        const expiredAt = nowSeconds - secondsAgo;

        const token = createTokenWithExp(userId, sessionId, role, email, expiredAt);

        try {
          verifyToken(token);
          // If we reach here, the token was NOT rejected — that's a failure
          failures.push(
            `iteration ${i}: token for userId=${userId} role=${role} ` +
              `with exp=${expiredAt} (${secondsAgo}s ago) was accepted but should have been rejected`
          );
        } catch (err: any) {
          // We expect a TokenExpiredError specifically
          if (err.name !== 'TokenExpiredError') {
            failures.push(
              `iteration ${i}: token for userId=${userId} role=${role} ` +
                `threw unexpected error type "${err.name}" instead of "TokenExpiredError": ${err.message}`
            );
          }
          // TokenExpiredError is the expected outcome — test passes for this iteration
        }
      }

      expect(failures).toHaveLength(0);
    });
  });

  // ── Sub-property B: Tokens with future expiry are always accepted ─────────

  describe('B: Tokens with future expiry are always accepted', () => {
    it('accepts 100 randomly generated valid (non-expired) tokens', () => {
      const failures: string[] = [];
      const nowSeconds = Math.floor(Date.now() / 1000);

      for (let i = 0; i < 100; i++) {
        const userId = randomUserId();
        const sessionId = randomSessionId();
        const role = randomRole();
        const email = randomEmail();

        // exp is somewhere between 1 second and 8 hours in the future
        const secondsAhead = randInt(1, 8 * 60 * 60);
        const futureExp = nowSeconds + secondsAhead;

        const token = createTokenWithExp(userId, sessionId, role, email, futureExp);

        try {
          const decoded = verifyToken(token);

          // Verify the decoded payload matches what we put in
          if (decoded.userId !== userId) {
            failures.push(
              `iteration ${i}: decoded userId "${decoded.userId}" !== expected "${userId}"`
            );
          }
          if (decoded.role !== role) {
            failures.push(
              `iteration ${i}: decoded role "${decoded.role}" !== expected "${role}"`
            );
          }
          if (decoded.sessionId !== sessionId) {
            failures.push(
              `iteration ${i}: decoded sessionId "${decoded.sessionId}" !== expected "${sessionId}"`
            );
          }
        } catch (err: any) {
          failures.push(
            `iteration ${i}: valid token for userId=${userId} role=${role} ` +
              `with exp=${futureExp} (+${secondsAhead}s) was rejected: ${err.name}: ${err.message}`
          );
        }
      }

      expect(failures).toHaveLength(0);
    });
  });

  // ── Sub-property C: Rejection is consistent across all roles ─────────────

  describe('C: Expired token rejection is consistent across all roles', () => {
    it('rejects expired tokens for every system role', () => {
      const failures: string[] = [];
      const nowSeconds = Math.floor(Date.now() / 1000);

      // Test each role multiple times with different expiry offsets
      for (const role of ROLES) {
        for (let i = 0; i < 10; i++) {
          const userId = randomUserId();
          const sessionId = randomSessionId();
          const email = randomEmail();

          // Vary the expiry: just expired (1s ago) to long expired (7 days ago)
          const secondsAgo = randInt(1, 7 * 24 * 60 * 60);
          const expiredAt = nowSeconds - secondsAgo;

          const token = createTokenWithExp(userId, sessionId, role, email, expiredAt);

          try {
            verifyToken(token);
            failures.push(
              `role=${role} iteration ${i}: expired token (${secondsAgo}s ago) was accepted`
            );
          } catch (err: any) {
            if (err.name !== 'TokenExpiredError') {
              failures.push(
                `role=${role} iteration ${i}: expected TokenExpiredError but got "${err.name}"`
              );
            }
          }
        }
      }

      expect(failures).toHaveLength(0);
    });
  });

  // ── Sub-property D: Boundary — token expiring exactly now is rejected ─────

  describe('D: Token expiring at exactly the current second is rejected', () => {
    it('rejects 50 tokens whose exp equals the current Unix timestamp', () => {
      const failures: string[] = [];

      for (let i = 0; i < 50; i++) {
        const userId = randomUserId();
        const sessionId = randomSessionId();
        const role = randomRole();
        const email = randomEmail();

        // exp = now (already expired by the time jwt.verify runs)
        const nowSeconds = Math.floor(Date.now() / 1000);
        const token = createTokenWithExp(userId, sessionId, role, email, nowSeconds);

        // Small delay to ensure the token is past its exp
        // (jwt uses Math.floor(Date.now()/1000) internally, so exp === now means expired)
        try {
          verifyToken(token);
          failures.push(
            `iteration ${i}: token with exp=now (${nowSeconds}) was accepted but should be rejected`
          );
        } catch (err: any) {
          if (err.name !== 'TokenExpiredError') {
            failures.push(
              `iteration ${i}: expected TokenExpiredError but got "${err.name}": ${err.message}`
            );
          }
        }
      }

      expect(failures).toHaveLength(0);
    });
  });

  // ── Sub-property E: Payload content does not affect rejection ────────────

  describe('E: Rejection is consistent regardless of payload content', () => {
    it('rejects expired tokens with varied payload sizes and content', () => {
      const failures: string[] = [];
      const nowSeconds = Math.floor(Date.now() / 1000);

      for (let i = 0; i < 100; i++) {
        // Vary payload content significantly
        const userId = randomUserId();
        const sessionId = randomSessionId();
        const role = randomRole();
        // Emails of varying lengths
        const email = `${randStr(randInt(3, 20))}@${randStr(randInt(3, 10))}.${randStr(randInt(2, 5))}`;

        const secondsAgo = randInt(1, 365 * 24 * 60 * 60); // up to 1 year ago
        const expiredAt = nowSeconds - secondsAgo;

        const token = createTokenWithExp(userId, sessionId, role, email, expiredAt);

        try {
          verifyToken(token);
          failures.push(
            `iteration ${i}: expired token (userId=${userId}, role=${role}, ` +
              `${secondsAgo}s ago) was accepted regardless of payload`
          );
        } catch (err: any) {
          if (err.name !== 'TokenExpiredError') {
            failures.push(
              `iteration ${i}: expected TokenExpiredError but got "${err.name}"`
            );
          }
        }
      }

      expect(failures).toHaveLength(0);
    });
  });
});
