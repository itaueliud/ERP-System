/**
 * Property-Based Tests for Session Timeout Consistency
 *
 * Property 24: Session Timeout Consistency
 * Validates: Requirements 33.1
 *
 * Uses random input generation (Math.random) to verify that:
 *   1. Sessions always expire after exactly 8 hours (28800 seconds) of inactivity
 *   2. Sessions that are active (recently used) do not expire prematurely
 *   3. The timeout is consistent regardless of when the session was created
 *
 * Uses in-memory session management — no Redis or database required.
 */

// ─── Constants ────────────────────────────────────────────────────────────────

/** Session timeout in seconds: 8 hours (Requirement 33.1) */
const SESSION_TIMEOUT_SECONDS = 8 * 60 * 60; // 28800

// ─── Types ────────────────────────────────────────────────────────────────────

interface Session {
  sessionId: string;
  userId: string;
  role: string;
  createdAt: number;      // Unix timestamp (ms)
  lastActivity: number;   // Unix timestamp (ms)
}

// ─── In-Memory Session Manager ────────────────────────────────────────────────

/**
 * Minimal in-memory session manager that mirrors the real SessionCache behaviour.
 * All time values are injected so tests can control the clock without real delays.
 */
class InMemorySessionManager {
  private sessions = new Map<string, Session>();

  /** Create a new session at the given wall-clock time (ms). */
  createSession(sessionId: string, userId: string, role: string, nowMs: number): void {
    this.sessions.set(sessionId, {
      sessionId,
      userId,
      role,
      createdAt: nowMs,
      lastActivity: nowMs,
    });
  }

  /** Record activity for a session, resetting the inactivity clock. */
  updateActivity(sessionId: string, nowMs: number): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    session.lastActivity = nowMs;
    return true;
  }

  /**
   * Check whether a session is still valid at the given wall-clock time.
   * A session is expired when (nowMs - lastActivity) >= SESSION_TIMEOUT_SECONDS * 1000.
   */
  isValid(sessionId: string, nowMs: number): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    const inactiveMs = nowMs - session.lastActivity;
    return inactiveMs < SESSION_TIMEOUT_SECONDS * 1000;
  }

  /**
   * Return the remaining TTL in seconds for a session, or -1 if expired/missing.
   * Mirrors SessionCache.getSessionTTL().
   */
  getRemainingTTL(sessionId: string, nowMs: number): number {
    const session = this.sessions.get(sessionId);
    if (!session) return -1;
    const elapsedMs = nowMs - session.lastActivity;
    const remainingMs = SESSION_TIMEOUT_SECONDS * 1000 - elapsedMs;
    return remainingMs > 0 ? Math.floor(remainingMs / 1000) : -1;
  }

  /** Delete a session (logout). */
  deleteSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Random integer in [min, max] inclusive */
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Random alphanumeric string of given length */
function randStr(len = 8): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < len; i++) {
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  return s;
}

/** Generate a random session ID */
function randomSessionId(): string {
  return `sess-${randStr(12)}`;
}

/** Generate a random user ID */
function randomUserId(): string {
  return `user-${randStr(8)}`;
}

/** Pick a random role from the system roles */
function randomRole(): string {
  const roles = ['CEO', 'CoS', 'CFO', 'COO', 'CTO', 'EA', 'Agent', 'Trainer', 'Developer'];
  return roles[randInt(0, roles.length - 1)];
}

/**
 * Generate a random "creation time" spread across a wide range:
 * anywhere from 30 days in the past to "now" (represented as 0).
 * Returns milliseconds offset from a reference epoch.
 */
function randomCreationTimeMs(): number {
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  return Date.now() - randInt(0, thirtyDaysMs);
}

// ─── Property 24: Session Timeout Consistency ────────────────────────────────

/**
 * Validates: Requirements 33.1
 */
describe('Property 24: Session Timeout Consistency', () => {
  // ── Sub-property A: Sessions expire after exactly 8 hours of inactivity ──

  describe('A: Sessions expire after exactly 8 hours of inactivity', () => {
    it('session is invalid when inactivity exceeds 28800 seconds for 100 random sessions', () => {
      const manager = new InMemorySessionManager();
      const failures: string[] = [];

      for (let i = 0; i < 100; i++) {
        const sessionId = randomSessionId();
        const userId = randomUserId();
        const role = randomRole();
        const createdAt = randomCreationTimeMs();

        manager.createSession(sessionId, userId, role, createdAt);

        // Simulate inactivity: advance time by exactly SESSION_TIMEOUT_SECONDS seconds
        const exactTimeoutMs = createdAt + SESSION_TIMEOUT_SECONDS * 1000;

        // At exactly the timeout boundary the session should be expired
        const validAtTimeout = manager.isValid(sessionId, exactTimeoutMs);
        if (validAtTimeout) {
          failures.push(
            `iteration ${i}: session ${sessionId} should be expired at exactly ` +
              `${SESSION_TIMEOUT_SECONDS}s of inactivity but isValid returned true`,
          );
        }

        // One millisecond before the timeout the session should still be valid
        const validJustBefore = manager.isValid(sessionId, exactTimeoutMs - 1);
        if (!validJustBefore) {
          failures.push(
            `iteration ${i}: session ${sessionId} should still be valid 1ms before ` +
              `the ${SESSION_TIMEOUT_SECONDS}s timeout but isValid returned false`,
          );
        }

        // Well past the timeout (add a random extra 1–3600 seconds)
        const extraMs = randInt(1, 3600) * 1000;
        const validAfterTimeout = manager.isValid(sessionId, exactTimeoutMs + extraMs);
        if (validAfterTimeout) {
          failures.push(
            `iteration ${i}: session ${sessionId} should be expired ` +
              `${extraMs / 1000}s past the timeout but isValid returned true`,
          );
        }
      }

      expect(failures).toHaveLength(0);
    });
  });

  // ── Sub-property B: Active sessions do not expire prematurely ────────────

  describe('B: Active sessions do not expire prematurely', () => {
    it('session remains valid when activity is refreshed before timeout for 100 random sessions', () => {
      const manager = new InMemorySessionManager();
      const failures: string[] = [];

      for (let i = 0; i < 100; i++) {
        const sessionId = randomSessionId();
        const userId = randomUserId();
        const role = randomRole();
        const createdAt = randomCreationTimeMs();

        manager.createSession(sessionId, userId, role, createdAt);

        // Simulate N activity updates, each within the timeout window
        const activityCount = randInt(1, 10);
        let currentTime = createdAt;

        for (let j = 0; j < activityCount; j++) {
          // Advance time by a random amount strictly less than the full timeout
          const advanceMs = randInt(1, SESSION_TIMEOUT_SECONDS * 1000 - 1);
          currentTime += advanceMs;
          manager.updateActivity(sessionId, currentTime);

          // Session must still be valid immediately after activity update
          const valid = manager.isValid(sessionId, currentTime);
          if (!valid) {
            failures.push(
              `iteration ${i}, activity ${j}: session ${sessionId} should be valid ` +
                `immediately after activity update at +${advanceMs}ms but isValid returned false`,
            );
          }
        }

        // After the last activity update, the session should be valid for up to
        // SESSION_TIMEOUT_SECONDS - 1 more seconds
        const checkBeforeExpiry = currentTime + SESSION_TIMEOUT_SECONDS * 1000 - 1000;
        const validBeforeExpiry = manager.isValid(sessionId, checkBeforeExpiry);
        if (!validBeforeExpiry) {
          failures.push(
            `iteration ${i}: session ${sessionId} should still be valid 1s before ` +
              `expiry after last activity update but isValid returned false`,
          );
        }
      }

      expect(failures).toHaveLength(0);
    });
  });

  // ── Sub-property C: Timeout is consistent regardless of creation time ─────

  describe('C: Timeout is consistent regardless of session creation time', () => {
    it('timeout duration is always 28800 seconds regardless of creation time for 100 random sessions', () => {
      const manager = new InMemorySessionManager();
      const failures: string[] = [];

      for (let i = 0; i < 100; i++) {
        const sessionId = randomSessionId();
        const userId = randomUserId();
        const role = randomRole();

        // Use a wide variety of creation times (past, present, future-ish)
        const createdAt = randomCreationTimeMs();

        manager.createSession(sessionId, userId, role, createdAt);

        // The session should be valid for any time in [createdAt, createdAt + timeout - 1ms]
        const randomOffsetWithinWindow = randInt(0, SESSION_TIMEOUT_SECONDS * 1000 - 1);
        const timeWithinWindow = createdAt + randomOffsetWithinWindow;

        const validWithin = manager.isValid(sessionId, timeWithinWindow);
        if (!validWithin) {
          failures.push(
            `iteration ${i}: session created at ${createdAt} should be valid at ` +
              `+${randomOffsetWithinWindow}ms (within window) but isValid returned false`,
          );
        }

        // The session should be expired for any time >= createdAt + timeout
        const randomOffsetPastWindow = randInt(0, 3600 * 1000);
        const timePastWindow = createdAt + SESSION_TIMEOUT_SECONDS * 1000 + randomOffsetPastWindow;

        const validPast = manager.isValid(sessionId, timePastWindow);
        if (validPast) {
          failures.push(
            `iteration ${i}: session created at ${createdAt} should be expired at ` +
              `+${SESSION_TIMEOUT_SECONDS * 1000 + randomOffsetPastWindow}ms but isValid returned true`,
          );
        }

        // Verify the remaining TTL is consistent with the elapsed time
        const ttlAtCreation = manager.getRemainingTTL(sessionId, createdAt);
        if (ttlAtCreation !== SESSION_TIMEOUT_SECONDS) {
          failures.push(
            `iteration ${i}: TTL at creation should be ${SESSION_TIMEOUT_SECONDS}s ` +
              `but got ${ttlAtCreation}s`,
          );
        }
      }

      expect(failures).toHaveLength(0);
    });
  });

  // ── Sub-property D: TTL decreases monotonically with inactivity ──────────

  describe('D: Remaining TTL decreases monotonically as inactivity increases', () => {
    it('getRemainingTTL decreases as time advances without activity for 100 random sessions', () => {
      const manager = new InMemorySessionManager();
      const failures: string[] = [];

      for (let i = 0; i < 100; i++) {
        const sessionId = randomSessionId();
        const userId = randomUserId();
        const role = randomRole();
        const createdAt = randomCreationTimeMs();

        manager.createSession(sessionId, userId, role, createdAt);

        // Sample TTL at 3 increasing time points within the valid window
        const t1 = createdAt + randInt(0, SESSION_TIMEOUT_SECONDS * 333);
        const t2 = t1 + randInt(1, SESSION_TIMEOUT_SECONDS * 333);
        const t3 = t2 + randInt(1, SESSION_TIMEOUT_SECONDS * 333);

        // Only test if all three points are within the valid window
        if (t3 >= createdAt + SESSION_TIMEOUT_SECONDS * 1000) {
          // Skip this iteration — t3 is past the window
          continue;
        }

        const ttl1 = manager.getRemainingTTL(sessionId, t1);
        const ttl2 = manager.getRemainingTTL(sessionId, t2);
        const ttl3 = manager.getRemainingTTL(sessionId, t3);

        if (ttl1 < ttl2) {
          failures.push(
            `iteration ${i}: TTL at t1=${t1} (${ttl1}s) should be >= TTL at t2=${t2} (${ttl2}s)`,
          );
        }
        if (ttl2 < ttl3) {
          failures.push(
            `iteration ${i}: TTL at t2=${t2} (${ttl2}s) should be >= TTL at t3=${t3} (${ttl3}s)`,
          );
        }
      }

      expect(failures).toHaveLength(0);
    });
  });

  // ── Sub-property E: Deleted sessions are always invalid ──────────────────

  describe('E: Deleted sessions are always invalid regardless of timing', () => {
    it('session is invalid after deletion for 100 random sessions', () => {
      const manager = new InMemorySessionManager();
      const failures: string[] = [];

      for (let i = 0; i < 100; i++) {
        const sessionId = randomSessionId();
        const userId = randomUserId();
        const role = randomRole();
        const createdAt = randomCreationTimeMs();

        manager.createSession(sessionId, userId, role, createdAt);

        // Confirm it is valid before deletion
        const validBefore = manager.isValid(sessionId, createdAt);
        if (!validBefore) {
          failures.push(
            `iteration ${i}: session ${sessionId} should be valid immediately after creation`,
          );
          continue;
        }

        // Delete the session (logout)
        manager.deleteSession(sessionId);

        // Check at a time well within the original window — should be invalid
        const checkTime = createdAt + randInt(0, SESSION_TIMEOUT_SECONDS * 1000 - 1);
        const validAfter = manager.isValid(sessionId, checkTime);
        if (validAfter) {
          failures.push(
            `iteration ${i}: session ${sessionId} should be invalid after deletion ` +
              `but isValid returned true at +${checkTime - createdAt}ms`,
          );
        }
      }

      expect(failures).toHaveLength(0);
    });
  });
});
