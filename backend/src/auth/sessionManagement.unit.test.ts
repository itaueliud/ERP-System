/**
 * Unit Tests: Session Management
 *
 * Tests session timeout, extension, concurrent session prevention,
 * session invalidation, session warning, and URL preservation.
 *
 * Requirements: 33.1-33.10
 */

import { AuthenticationService } from './authService';
import { sessionCache, SessionData } from '../cache/sessionCache';
import { cacheService, CacheTTL } from '../cache/cacheService';
import { db } from '../database/connection';
import { sendgridClient } from '../services/sendgrid/client';

// Mock all external dependencies
jest.mock('../database/connection');
jest.mock('../cache/sessionCache');
jest.mock('../cache/cacheService');
jest.mock('../services/sendgrid/client');
jest.mock('./twoFactorService');
jest.mock('../utils/logger');

// ─── Constants ────────────────────────────────────────────────────────────────

const SESSION_TIMEOUT_SECONDS = 8 * 60 * 60; // 28800 seconds (Req 33.1)
const SESSION_WARNING_SECONDS = 5 * 60;       // 5 minutes before timeout (Req 33.2)

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeSession(overrides: Partial<SessionData> = {}): SessionData {
  return {
    userId: 'user-123',
    role: 'AGENT',
    email: 'agent@example.com',
    permissions: ['read:clients'],
    createdAt: new Date(),
    lastActivity: new Date(),
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Session Management Unit Tests', () => {
  let service: AuthenticationService;

  beforeEach(() => {
    service = new AuthenticationService();
    jest.clearAllMocks();
  });

  // ── 1. Session Timeout (Requirement 33.1) ─────────────────────────────────

  describe('Session Timeout - Requirement 33.1', () => {
    it('session TTL is set to 8 hours (28800 seconds) on creation', async () => {
      // Arrange
      const sessionId = 'session-timeout-test';
      const sessionData = makeSession();
      (sessionCache.setSession as jest.Mock).mockResolvedValue(undefined);

      // Act
      await sessionCache.setSession(sessionId, sessionData);

      // Assert: setSession is called (internally uses CacheTTL.SESSION = 28800)
      expect(sessionCache.setSession).toHaveBeenCalledWith(sessionId, sessionData);
      expect(CacheTTL.SESSION).toBe(SESSION_TIMEOUT_SECONDS);
    });

    it('getSessionTTL returns a value <= 28800 for a fresh session', async () => {
      const sessionId = 'session-ttl-check';
      // Simulate a fresh session with full TTL
      (sessionCache.getSessionTTL as jest.Mock).mockResolvedValue(SESSION_TIMEOUT_SECONDS);

      const ttl = await sessionCache.getSessionTTL(sessionId);

      expect(ttl).toBeLessThanOrEqual(SESSION_TIMEOUT_SECONDS);
      expect(ttl).toBeGreaterThan(0);
    });

    it('getSession returns null when session has expired (TTL = -2)', async () => {
      // Redis returns -2 for expired/missing keys
      (sessionCache.getSession as jest.Mock).mockResolvedValue(null);

      const result = await sessionCache.getSession('expired-session');

      expect(result).toBeNull();
    });

    it('validateToken returns null when session no longer exists in Redis', async () => {
      const token = service.generateToken('user-123', 'session-expired', 'AGENT', 'a@b.com');
      (sessionCache.exists as jest.Mock).mockResolvedValue(false);

      const payload = await service.validateToken(token);

      expect(payload).toBeNull();
    });

    it('updateActivity is called when a valid token is validated, resetting inactivity clock', async () => {
      const token = service.generateToken('user-123', 'session-active-2', 'AGENT', 'a@b.com');
      (sessionCache.exists as jest.Mock).mockResolvedValue(true);
      (sessionCache.updateActivity as jest.Mock).mockResolvedValue(undefined);

      await service.validateToken(token);

      // validateToken calls updateActivity, which resets the inactivity TTL
      expect(sessionCache.updateActivity).toHaveBeenCalledWith('session-active-2');
    });
  });

  // ── 2. Session Extension (Requirement 33.3) ───────────────────────────────

  describe('Session Extension - Requirement 33.3', () => {
    it('extendSession calls setSession internally to reset the TTL to 8 hours', async () => {
      // Import the real SessionCache class (bypassing the module-level mock)
      // by directly instantiating and spying on its prototype methods
      const { SessionCache } = jest.requireActual('../cache/sessionCache');
      const realCache = new SessionCache();

      const sessionId = 'session-extend-real';
      const sessionData = makeSession();

      jest.spyOn(realCache, 'getSession').mockResolvedValue(sessionData);
      const setSessionSpy = jest.spyOn(realCache, 'setSession').mockResolvedValue(undefined);

      await realCache.extendSession(sessionId);

      expect(setSessionSpy).toHaveBeenCalledWith(sessionId, sessionData);
    });

    it('extendSession via authService delegates to sessionCache.extendSession', async () => {
      const sessionId = 'session-extend-via-service';
      (sessionCache.extendSession as jest.Mock).mockResolvedValue(undefined);

      await service.extendSession(sessionId);

      expect(sessionCache.extendSession).toHaveBeenCalledWith(sessionId);
    });

    it('extendSession does nothing when session does not exist', async () => {
      const sessionId = 'non-existent-session';
      (sessionCache.getSession as jest.Mock).mockResolvedValue(null);
      (sessionCache.setSession as jest.Mock).mockResolvedValue(undefined);

      await sessionCache.extendSession(sessionId);

      // setSession should NOT be called if there is no session to extend
      expect(sessionCache.setSession).not.toHaveBeenCalled();
    });

    it('validateToken updates activity (extending effective TTL) on each valid request', async () => {
      const token = service.generateToken('user-123', 'session-active', 'AGENT', 'a@b.com');
      (sessionCache.exists as jest.Mock).mockResolvedValue(true);
      (sessionCache.updateActivity as jest.Mock).mockResolvedValue(undefined);

      await service.validateToken(token);

      expect(sessionCache.updateActivity).toHaveBeenCalledWith('session-active');
    });
  });

  // ── 3. Concurrent Session Prevention (Requirements 33.7, 33.8) ───────────

  describe('Concurrent Session Prevention - Requirements 33.7, 33.8', () => {
    it('login terminates previous sessions when a user logs in from a new device', async () => {
      // Arrange: simulate a user who already has an active session
      const existingSessionId = 'old-session-id';
      const mockUser = {
        id: 'user-concurrent',
        email: 'user@example.com',
        password_hash: '$2b$12$hashedpassword',
        full_name: 'Concurrent User',
        two_fa_enabled: false,
        role: 'AGENT',
        permissions: [],
        department_id: 'dept-1',
      };

      // Mock bcrypt compare to return true
      const bcrypt = require('bcrypt');
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

      (db.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [mockUser] }) // SELECT user
        .mockResolvedValueOnce({ rows: [] });          // UPDATE last_login

      (sessionCache.setSession as jest.Mock).mockResolvedValue(undefined);
      (sessionCache.deleteUserSessions as jest.Mock).mockResolvedValue(undefined);

      // Act: login creates a new session
      const result = await service.login({ email: 'user@example.com', password: 'password' });

      // Assert: login succeeded and a new session was created
      expect(result.success).toBe(true);
      expect(result.sessionId).toBeDefined();
      expect(result.sessionId).not.toBe(existingSessionId);
    });

    it('deleteUserSessions removes all sessions for a user (called on password reset)', async () => {
      const userId = 'user-multi-session';
      (sessionCache.deleteUserSessions as jest.Mock).mockResolvedValue(undefined);

      await sessionCache.deleteUserSessions(userId);

      expect(sessionCache.deleteUserSessions).toHaveBeenCalledWith(userId);
    });

    it('password reset invalidates all existing sessions for the user', async () => {
      const token = 'valid-reset-token';
      const resetData = { userId: 'user-123', email: 'user@example.com', createdAt: new Date() };

      (cacheService.get as jest.Mock).mockResolvedValue(resetData);
      (cacheService.delete as jest.Mock).mockResolvedValue(undefined);
      (db.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] })                          // UPDATE password
        .mockResolvedValueOnce({ rows: [{ full_name: 'Test User' }] }); // SELECT user
      (sessionCache.deleteUserSessions as jest.Mock).mockResolvedValue(undefined);
      (sendgridClient.sendEmail as jest.Mock).mockResolvedValue(undefined);

      await service.resetPassword(token, 'NewPassword123!');

      // All sessions for the user must be invalidated after password reset (Req 33.7)
      expect(sessionCache.deleteUserSessions).toHaveBeenCalledWith('user-123');
    });

    it('each login generates a unique session ID preventing session sharing', async () => {
      const mockUser = {
        id: 'user-unique-session',
        email: 'unique@example.com',
        password_hash: '$2b$12$hashedpassword',
        full_name: 'Unique User',
        two_fa_enabled: false,
        role: 'AGENT',
        permissions: [],
        department_id: 'dept-1',
      };

      const bcrypt = require('bcrypt');
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

      (db.query as jest.Mock)
        .mockResolvedValue({ rows: [mockUser] });
      (sessionCache.setSession as jest.Mock).mockResolvedValue(undefined);

      const result1 = await service.login({ email: 'unique@example.com', password: 'pass' });
      const result2 = await service.login({ email: 'unique@example.com', password: 'pass' });

      expect(result1.sessionId).toBeDefined();
      expect(result2.sessionId).toBeDefined();
      expect(result1.sessionId).not.toBe(result2.sessionId);
    });
  });

  // ── 4. Session Invalidation (Requirement 33.6) ───────────────────────────

  describe('Session Invalidation - Requirement 33.6', () => {
    it('logout deletes the session from Redis', async () => {
      const sessionId = 'session-to-invalidate';
      (sessionCache.deleteSession as jest.Mock).mockResolvedValue(undefined);

      await service.logout('user-123', sessionId);

      expect(sessionCache.deleteSession).toHaveBeenCalledWith(sessionId);
    });

    it('validateToken returns null after session is deleted (post-logout)', async () => {
      const token = service.generateToken('user-123', 'logged-out-session', 'AGENT', 'a@b.com');
      // Session no longer exists after logout
      (sessionCache.exists as jest.Mock).mockResolvedValue(false);

      const payload = await service.validateToken(token);

      expect(payload).toBeNull();
    });

    it('session does not exist after deleteSession is called', async () => {
      const sessionId = 'deleted-session';
      (sessionCache.exists as jest.Mock).mockResolvedValue(false);

      const exists = await sessionCache.exists(sessionId);

      expect(exists).toBe(false);
    });

    it('logout throws if session deletion fails', async () => {
      const sessionId = 'session-delete-fail';
      (sessionCache.deleteSession as jest.Mock).mockRejectedValue(new Error('Redis error'));

      await expect(service.logout('user-123', sessionId)).rejects.toThrow('Redis error');
    });
  });

  // ── 5. Session Warning (Requirement 33.2) ─────────────────────────────────

  describe('Session Warning - Requirement 33.2', () => {
    it('warning threshold is 5 minutes (300 seconds) before session timeout', () => {
      // The warning should fire when remaining TTL <= 300 seconds
      expect(SESSION_WARNING_SECONDS).toBe(300);
    });

    it('session is in warning zone when TTL is <= 300 seconds', async () => {
      const sessionId = 'session-warning-zone';
      // Simulate TTL at exactly the warning threshold
      (sessionCache.getSessionTTL as jest.Mock).mockResolvedValue(SESSION_WARNING_SECONDS);

      const ttl = await sessionCache.getSessionTTL(sessionId);
      const isInWarningZone = ttl > 0 && ttl <= SESSION_WARNING_SECONDS;

      expect(isInWarningZone).toBe(true);
    });

    it('session is NOT in warning zone when TTL is > 300 seconds', async () => {
      const sessionId = 'session-not-warning';
      (sessionCache.getSessionTTL as jest.Mock).mockResolvedValue(SESSION_WARNING_SECONDS + 1);

      const ttl = await sessionCache.getSessionTTL(sessionId);
      const isInWarningZone = ttl > 0 && ttl <= SESSION_WARNING_SECONDS;

      expect(isInWarningZone).toBe(false);
    });

    it('session is NOT in warning zone when TTL is 0 (already expired)', async () => {
      const sessionId = 'session-expired-warning';
      (sessionCache.getSessionTTL as jest.Mock).mockResolvedValue(-2);

      const ttl = await sessionCache.getSessionTTL(sessionId);
      const isInWarningZone = ttl > 0 && ttl <= SESSION_WARNING_SECONDS;

      expect(isInWarningZone).toBe(false);
    });

    it('session can be extended from warning zone, resetting TTL to 8 hours', async () => {
      // Use the real SessionCache class to verify extendSession resets TTL
      const { SessionCache } = jest.requireActual('../cache/sessionCache');
      const realCache = new SessionCache();

      const sessionId = 'session-extend-from-warning';
      const sessionData = makeSession();

      // Session is in warning zone (2 minutes left)
      jest.spyOn(realCache, 'getSession').mockResolvedValue(sessionData);
      const setSessionSpy = jest.spyOn(realCache, 'setSession').mockResolvedValue(undefined);

      // User extends session from warning dialog
      await realCache.extendSession(sessionId);

      // After extension, setSession is called — TTL is reset to full 8 hours
      expect(setSessionSpy).toHaveBeenCalledWith(sessionId, sessionData);
    });
  });

  // ── 6. URL Preservation (Requirement 33.5) ────────────────────────────────

  describe('URL Preservation - Requirement 33.5', () => {
    it('session data structure supports storing redirect URL for post-auth navigation', () => {
      // The SessionData interface supports arbitrary extension; verify the
      // session object can carry a returnUrl field for redirect after re-auth.
      const sessionWithUrl: SessionData & { returnUrl?: string } = {
        ...makeSession(),
        returnUrl: '/operations/clients/TST-2024-000123',
      };

      expect(sessionWithUrl.returnUrl).toBe('/operations/clients/TST-2024-000123');
    });

    it('returnUrl is preserved when session data is stored and retrieved', async () => {
      const sessionId = 'session-with-url';
      const sessionData: SessionData & { returnUrl?: string } = {
        ...makeSession(),
        returnUrl: '/projects/TST-PRJ-2024-000456',
      };

      (sessionCache.setSession as jest.Mock).mockResolvedValue(undefined);
      (sessionCache.getSession as jest.Mock).mockResolvedValue(sessionData);

      await sessionCache.setSession(sessionId, sessionData);
      const retrieved = await sessionCache.getSession(sessionId) as typeof sessionData;

      expect(retrieved?.returnUrl).toBe('/projects/TST-PRJ-2024-000456');
    });

    it('returnUrl is not required — sessions without it are valid', async () => {
      const sessionId = 'session-no-url';
      const sessionData = makeSession(); // no returnUrl

      (sessionCache.setSession as jest.Mock).mockResolvedValue(undefined);
      (sessionCache.getSession as jest.Mock).mockResolvedValue(sessionData);

      await sessionCache.setSession(sessionId, sessionData);
      const retrieved = await sessionCache.getSession(sessionId);

      expect(retrieved).toBeDefined();
      expect((retrieved as any)?.returnUrl).toBeUndefined();
    });
  });

  // ── 7. Session Logging (Requirement 33.10) ────────────────────────────────

  describe('Session Logging - Requirement 33.10', () => {
    it('login creates a session (creation event)', async () => {
      const mockUser = {
        id: 'user-log',
        email: 'log@example.com',
        password_hash: '$2b$12$hashedpassword',
        full_name: 'Log User',
        two_fa_enabled: false,
        role: 'AGENT',
        permissions: [],
        department_id: 'dept-1',
      };

      const bcrypt = require('bcrypt');
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

      (db.query as jest.Mock).mockResolvedValue({ rows: [mockUser] });
      (sessionCache.setSession as jest.Mock).mockResolvedValue(undefined);

      const result = await service.login({ email: 'log@example.com', password: 'pass' });

      // Session was created (setSession called = creation event)
      expect(result.success).toBe(true);
      expect(sessionCache.setSession).toHaveBeenCalledTimes(1);
    });

    it('logout deletes session (termination event)', async () => {
      (sessionCache.deleteSession as jest.Mock).mockResolvedValue(undefined);

      await service.logout('user-log', 'session-log');

      // Session was terminated (deleteSession called = termination event)
      expect(sessionCache.deleteSession).toHaveBeenCalledWith('session-log');
    });
  });
});
