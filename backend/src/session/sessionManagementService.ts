import crypto from 'crypto';
import { redis } from '../cache/connection';
import logger from '../utils/logger';

export interface Session {
  id: string;
  userId: string;
  role: string;
  ipAddress: string;
  createdAt: Date;
  expiresAt: Date;
  lastActivityAt: Date;
}

export const SESSION_TIMEOUT_HOURS = 8;
export const WARNING_THRESHOLD_MINUTES = 5;

const SESSION_TIMEOUT_SECONDS = SESSION_TIMEOUT_HOURS * 60 * 60;
const WARNING_THRESHOLD_SECONDS = WARNING_THRESHOLD_MINUTES * 60;

const SESSION_KEY_PREFIX = 'session_mgmt:';
const REDIRECT_KEY_PREFIX = 'session_redirect:';

/**
 * Session Management Service
 * Handles session lifecycle: creation, refresh, expiry, and redirect URL preservation
 * Requirements: 33.1-33.5
 */
export class SessionManagementService {
  private get client() {
    return redis.getClient();
  }

  private sessionKey(sessionId: string): string {
    return `${SESSION_KEY_PREFIX}${sessionId}`;
  }

  private redirectKey(sessionId: string): string {
    return `${REDIRECT_KEY_PREFIX}${sessionId}`;
  }

  /**
   * Create a new session for a user
   * Requirement 33.1: Set session timeout to 8 hours of inactivity
   */
  async createSession(userId: string, role: string, ipAddress: string): Promise<Session> {
    const sessionId = crypto.randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_TIMEOUT_SECONDS * 1000);

    const session: Session = {
      id: sessionId,
      userId,
      role,
      ipAddress,
      createdAt: now,
      expiresAt,
      lastActivityAt: now,
    };

    await this.client.setEx(
      this.sessionKey(sessionId),
      SESSION_TIMEOUT_SECONDS,
      JSON.stringify(session)
    );

    logger.info('Session created', { sessionId, userId, role });
    return session;
  }

  /**
   * Retrieve a session by ID
   */
  async getSession(sessionId: string): Promise<Session | null> {
    const raw = await this.client.get(this.sessionKey(sessionId));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    return {
      ...parsed,
      createdAt: new Date(parsed.createdAt),
      expiresAt: new Date(parsed.expiresAt),
      lastActivityAt: new Date(parsed.lastActivityAt),
    };
  }

  /**
   * Refresh a session, extending it by 8 hours from now
   * Requirement 33.3: Allow users to extend their session from the timeout warning
   */
  async refreshSession(sessionId: string): Promise<Session> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_TIMEOUT_SECONDS * 1000);

    const updated: Session = {
      ...session,
      expiresAt,
      lastActivityAt: now,
    };

    await this.client.setEx(
      this.sessionKey(sessionId),
      SESSION_TIMEOUT_SECONDS,
      JSON.stringify(updated)
    );

    logger.info('Session refreshed', { sessionId, userId: session.userId });
    return updated;
  }

  /**
   * Check if a session is expiring within the warning threshold (5 minutes)
   * Requirement 33.2: Display warning 5 minutes before timeout
   */
  async isSessionExpiringSoon(sessionId: string): Promise<boolean> {
    const ttl = await this.client.ttl(this.sessionKey(sessionId));
    if (ttl < 0) {
      return false;
    }
    return ttl <= WARNING_THRESHOLD_SECONDS;
  }

  /**
   * Get seconds remaining until session expires
   * Returns 0 if session does not exist or has already expired
   */
  async getTimeUntilExpiry(sessionId: string): Promise<number> {
    const ttl = await this.client.ttl(this.sessionKey(sessionId));
    return ttl > 0 ? ttl : 0;
  }

  /**
   * Invalidate (delete) a session
   * Requirement 33.4: Redirect to login page when session expires (session removal)
   */
  async invalidateSession(sessionId: string): Promise<void> {
    await this.client.del(this.sessionKey(sessionId));
    await this.client.del(this.redirectKey(sessionId));
    logger.info('Session invalidated', { sessionId });
  }

  /**
   * Get the redirect URL stored for a session
   * Requirement 33.5: Preserve current page URL for redirect after re-authentication
   */
  async getRedirectUrl(sessionId: string): Promise<string | null> {
    return await this.client.get(this.redirectKey(sessionId));
  }

  /**
   * Store a redirect URL for a session
   * Requirement 33.5: Preserve current page URL for redirect after re-authentication
   */
  async setRedirectUrl(sessionId: string, url: string): Promise<void> {
    // Store redirect URL with same TTL as session timeout so it auto-cleans
    await this.client.setEx(this.redirectKey(sessionId), SESSION_TIMEOUT_SECONDS, url);
    logger.debug('Redirect URL stored', { sessionId, url });
  }
}

export const sessionManagementService = new SessionManagementService();
export default sessionManagementService;
