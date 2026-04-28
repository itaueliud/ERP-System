import { cacheService, CacheTTL, CachePrefix } from './cacheService';
import logger from '../utils/logger';

export interface SessionData {
  userId: string;
  role: string;
  email: string;
  permissions: string[];
  createdAt: Date;
  lastActivity: Date;
}

/**
 * Session caching service
 * Requirement 21.3: Cache user session data in Redis with 8-hour TTL
 */
export class SessionCache {
  /**
   * Store session data and register it in the per-user session index.
   */
  async setSession(sessionId: string, data: SessionData): Promise<void> {
    const key = `${CachePrefix.SESSION}${sessionId}`;
    const indexKey = `session:user:${data.userId}`;
    await cacheService.set(key, data, CacheTTL.SESSION);
    // Track this sessionId under the user's index (TTL slightly longer than session)
    const client = (await import('./cacheService')).cacheService['client'];
    await client.sAdd(indexKey, sessionId);
    await client.expire(indexKey, CacheTTL.SESSION + 60);
    logger.info('Session cached', { sessionId, userId: data.userId });
  }

  /**
   * Get session data
   */
  async getSession(sessionId: string): Promise<SessionData | null> {
    const key = `${CachePrefix.SESSION}${sessionId}`;
    return await cacheService.get<SessionData>(key);
  }

  /**
   * Update session last activity.
   * Extends the sliding TTL only if the session hasn't exceeded its absolute
   * maximum lifetime (8 hours from createdAt). This prevents a stolen token
   * from living forever by continuously refreshing.
   */
  async updateActivity(sessionId: string): Promise<void> {
    const key = `${CachePrefix.SESSION}${sessionId}`;
    const session = await this.getSession(sessionId);
    if (!session) return;

    const createdAt = new Date(session.createdAt).getTime();
    const absoluteMaxMs = CacheTTL.SESSION * 1000; // 8 hours in ms
    if (Date.now() - createdAt >= absoluteMaxMs) {
      // Session has exceeded its absolute lifetime — force expiry
      await cacheService.delete(key);
      logger.info('Session expired (absolute lifetime exceeded)', { sessionId });
      return;
    }

    session.lastActivity = new Date();
    await cacheService.set(key, session, CacheTTL.SESSION);
  }

  /**
   * Delete session (logout) and remove from per-user index.
   */
  async deleteSession(sessionId: string): Promise<void> {
    const key = `${CachePrefix.SESSION}${sessionId}`;
    // Retrieve userId before deleting so we can clean the index
    const session = await this.getSession(sessionId);
    await cacheService.delete(key);
    if (session?.userId) {
      try {
        const client = (await import('./cacheService')).cacheService['client'];
        await client.sRem(`session:user:${session.userId}`, sessionId);
      } catch { /* non-fatal */ }
    }
    logger.info('Session deleted', { sessionId });
  }

  /**
   * Delete all sessions for a user.
   * Maintains a per-user session index at `session:user:{userId}` (a Redis Set)
   * so we can delete only that user's sessions without a full keyspace scan.
   */
  async deleteUserSessions(userId: string): Promise<void> {
    const indexKey = `session:user:${userId}`;
    try {
      const client = (await import('./cacheService')).cacheService['client'];
      // Retrieve all session IDs belonging to this user
      const sessionIds: string[] = await client.sMembers(indexKey);
      if (sessionIds.length > 0) {
        const sessionKeys = sessionIds.map((sid) => `${CachePrefix.SESSION}${sid}`);
        await client.del([...sessionKeys, indexKey]);
      } else {
        // Index may not exist (legacy sessions) — delete the index key anyway
        await client.del(indexKey);
      }
      logger.info('User sessions deleted', { userId, count: sessionIds.length });
    } catch (error) {
      logger.error('Failed to delete user sessions', { error, userId });
      throw error;
    }
  }

  /**
   * Check if session exists
   */
  async exists(sessionId: string): Promise<boolean> {
    const key = `${CachePrefix.SESSION}${sessionId}`;
    return await cacheService.exists(key);
  }

  /**
   * Get remaining session TTL
   */
  async getSessionTTL(sessionId: string): Promise<number> {
    const key = `${CachePrefix.SESSION}${sessionId}`;
    return await cacheService.ttl(key);
  }

  /**
   * Extend session TTL
   */
  async extendSession(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (session) {
      await this.setSession(sessionId, session);
      logger.debug('Session extended', { sessionId });
    }
  }
}

export const sessionCache = new SessionCache();
export default sessionCache;
