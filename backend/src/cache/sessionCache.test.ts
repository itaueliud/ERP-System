import { redis } from './connection';
import { sessionCache, SessionData } from './sessionCache';
import { cacheService, CacheTTL } from './cacheService';

describe('SessionCache', () => {
  beforeAll(async () => {
    await redis.connect();
  });

  afterAll(async () => {
    await redis.close();
  });

  beforeEach(async () => {
    await cacheService.flush();
  });

  const mockSessionData: SessionData = {
    userId: 'user-123',
    role: 'AGENT',
    email: 'agent@test.com',
    permissions: ['client:create', 'client:read'],
    createdAt: new Date(),
    lastActivity: new Date(),
  };

  describe('setSession and getSession', () => {
    it('should store and retrieve session data', async () => {
      const sessionId = 'session-123';

      await sessionCache.setSession(sessionId, mockSessionData);
      const result = await sessionCache.getSession(sessionId);

      expect(result).toBeDefined();
      expect(result?.userId).toBe(mockSessionData.userId);
      expect(result?.role).toBe(mockSessionData.role);
      expect(result?.email).toBe(mockSessionData.email);
    });

    it('should set session with 8-hour TTL', async () => {
      const sessionId = 'session-ttl';

      await sessionCache.setSession(sessionId, mockSessionData);
      const ttl = await sessionCache.getSessionTTL(sessionId);

      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(CacheTTL.SESSION);
    });

    it('should return null for non-existent session', async () => {
      const result = await sessionCache.getSession('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('updateActivity', () => {
    it('should update last activity timestamp', async () => {
      const sessionId = 'session-activity';
      await sessionCache.setSession(sessionId, mockSessionData);

      // Wait a bit to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 100));

      await sessionCache.updateActivity(sessionId);
      const updated = await sessionCache.getSession(sessionId);

      expect(updated?.lastActivity).not.toEqual(mockSessionData.lastActivity);
    });
  });

  describe('deleteSession', () => {
    it('should delete a session', async () => {
      const sessionId = 'session-delete';
      await sessionCache.setSession(sessionId, mockSessionData);

      await sessionCache.deleteSession(sessionId);
      const result = await sessionCache.getSession(sessionId);

      expect(result).toBeNull();
    });
  });

  describe('exists', () => {
    it('should return true for existing session', async () => {
      const sessionId = 'session-exists';
      await sessionCache.setSession(sessionId, mockSessionData);

      const exists = await sessionCache.exists(sessionId);
      expect(exists).toBe(true);
    });

    it('should return false for non-existent session', async () => {
      const exists = await sessionCache.exists('non-existent');
      expect(exists).toBe(false);
    });
  });

  describe('extendSession', () => {
    it('should extend session TTL', async () => {
      const sessionId = 'session-extend';
      await sessionCache.setSession(sessionId, mockSessionData);

      // Wait a bit to reduce TTL
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const ttlBefore = await sessionCache.getSessionTTL(sessionId);
      await sessionCache.extendSession(sessionId);
      const ttlAfter = await sessionCache.getSessionTTL(sessionId);

      expect(ttlAfter).toBeGreaterThan(ttlBefore);
    });
  });
});
