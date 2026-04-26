import { redis } from '../cache/connection';
import logger from '../utils/logger';
import { auditService } from '../audit/auditService';
import { AuditAction, AuditResult } from '../audit/auditService';
import { sessionManagementService } from './sessionManagementService';
import type { Session } from './sessionManagementService';

const USER_SESSIONS_KEY_PREFIX = 'user_sessions:';

/**
 * Session Security Service
 * Handles concurrent session prevention, logout invalidation, and session audit logging.
 * Requirements: 33.6-33.10
 */
export class SessionSecurityService {
  private get client() {
    return redis.getClient();
  }

  private userSessionsKey(userId: string): string {
    return `${USER_SESSIONS_KEY_PREFIX}${userId}`;
  }

  /**
   * Register a session ID under a user's active session set.
   * Called internally after session creation.
   */
  async trackSession(userId: string, sessionId: string): Promise<void> {
    await this.client.sAdd(this.userSessionsKey(userId), sessionId);
  }

  /**
   * Remove a session ID from the user's active session set.
   */
  private async untrackSession(userId: string, sessionId: string): Promise<void> {
    await this.client.sRem(this.userSessionsKey(userId), sessionId);
  }

  /**
   * Invalidate a session on logout and log the event.
   * Requirement 33.6: Invalidate session tokens on logout
   * Requirement 33.10: Log all session creation and termination events
   */
  async logout(sessionId: string, userId: string): Promise<void> {
    await sessionManagementService.invalidateSession(sessionId);
    await this.untrackSession(userId, sessionId);

    await auditService.log({
      userId,
      action: AuditAction.LOGOUT,
      resourceType: 'session',
      resourceId: sessionId,
      ipAddress: 'system',
      result: AuditResult.SUCCESS,
      metadata: { reason: 'user_logout' },
    });

    logger.info('Session logged out', { sessionId, userId });
  }

  /**
   * Terminate all existing sessions for a user, create a new one, and log events.
   * Requirement 33.7: Prevent concurrent sessions from the same user account
   * Requirement 33.8: Terminate previous sessions when user logs in from new device
   * Requirement 33.10: Log all session creation and termination events
   */
  async loginNewDevice(userId: string, role: string, ipAddress: string): Promise<Session> {
    const terminated = await this.terminateAllUserSessions(userId, 'new_device_login');

    logger.info('Previous sessions terminated on new device login', { userId, terminated });

    const session = await sessionManagementService.createSession(userId, role, ipAddress);
    await this.trackSession(userId, session.id);

    await auditService.log({
      userId,
      action: AuditAction.LOGIN,
      resourceType: 'session',
      resourceId: session.id,
      ipAddress,
      result: AuditResult.SUCCESS,
      metadata: { role, previousSessionsTerminated: terminated },
    });

    logger.info('New session created on device login', { sessionId: session.id, userId });
    return session;
  }

  /**
   * Get all active sessions for a user.
   * Requirement 33.7: Support concurrent session prevention by exposing active sessions
   */
  async getUserActiveSessions(userId: string): Promise<Session[]> {
    const sessionIds = await this.client.sMembers(this.userSessionsKey(userId));

    const sessions: Session[] = [];
    for (const sessionId of sessionIds) {
      const session = await sessionManagementService.getSession(sessionId);
      if (session) {
        sessions.push(session);
      } else {
        // Session expired in Redis — clean up the tracking set
        await this.untrackSession(userId, sessionId);
      }
    }

    return sessions;
  }

  /**
   * Terminate all active sessions for a user and return the count terminated.
   * Requirement 33.7: Prevent concurrent sessions
   * Requirement 33.10: Log all session termination events
   */
  async terminateAllUserSessions(userId: string, reason: string): Promise<number> {
    const sessionIds = await this.client.sMembers(this.userSessionsKey(userId));
    let count = 0;

    for (const sessionId of sessionIds) {
      await sessionManagementService.invalidateSession(sessionId);

      await auditService.log({
        userId,
        action: AuditAction.LOGOUT,
        resourceType: 'session',
        resourceId: sessionId,
        ipAddress: 'system',
        result: AuditResult.SUCCESS,
        metadata: { reason },
      });

      count++;
    }

    await this.client.del(this.userSessionsKey(userId));
    logger.info('All user sessions terminated', { userId, count, reason });
    return count;
  }

  /**
   * Check if a session exists and has not expired.
   * Requirement 33.6: Support session validity checks
   */
  async isSessionValid(sessionId: string): Promise<boolean> {
    const session = await sessionManagementService.getSession(sessionId);
    return session !== null;
  }
}

export const sessionSecurityService = new SessionSecurityService();
export default sessionSecurityService;
