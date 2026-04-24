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
   * Store session data
   */
  async setSession(sessionId: string, data: SessionData): Promise<void> {
    const key = `${CachePrefix.SESSION}${sessionId}`;
    await cacheService.set(key, data, CacheTTL.SESSION);
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
   * Update session last activity
   */
  async updateActivity(sessionId: string): Promise<void> {
    const key = `${CachePrefix.SESSION}${sessionId}`;
    const session = await this.getSession(sessionId);
    if (session) {
      session.lastActivity = new Date();
      await cacheService.set(key, session, CacheTTL.SESSION);
    }
  }

  /**
   * Delete session (logout)
   */
  async deleteSession(sessionId: string): Promise<void> {
    const key = `${CachePrefix.SESSION}${sessionId}`;
    await cacheService.delete(key);
    logger.info('Session deleted', { sessionId });
  }

  /**
   * Delete all sessions for a user
   */
  async deleteUserSessions(userId: string): Promise<void> {
    const pattern = `${CachePrefix.SESSION}*`;
    await cacheService.deletePattern(pattern);
    logger.info('User sessions deleted', { userId });
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
