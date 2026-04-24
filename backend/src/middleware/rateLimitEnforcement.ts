import { redis } from '../cache/connection';
import { auditService } from '../audit/auditService';
import logger from '../utils/logger';

// ============================================================================
// Types
// ============================================================================

export interface ViolationResult {
  violationCount: number;
  suspended: boolean;
  backoffSeconds: number;
}

// Redis key prefixes
const VIOLATION_KEY_PREFIX = 'rl:violations:';
const SUSPENSION_KEY_PREFIX = 'rl:suspended:';

// Constants
const VIOLATION_WINDOW_SECONDS = 3600; // 1 hour
const MAX_VIOLATIONS_BEFORE_SUSPEND = 5;
const SUSPENSION_DURATION_SECONDS = 3600; // 1 hour suspension
const MAX_BACKOFF_SECONDS = 3600;

// ============================================================================
// Service
// ============================================================================

/**
 * Rate Limit Enforcement Service
 * Tracks violations, applies exponential backoff, and suspends accounts.
 * Requirements: 31.6–31.10
 */
export class RateLimitEnforcementService {
  /**
   * Record a rate limit violation for a user/IP.
   * Logs to security monitoring and suspends the account after 5 violations in 1 hour.
   * Requirements: 31.6, 31.7, 31.8
   */
  async recordViolation(userId: string, ipAddress: string): Promise<ViolationResult> {
    const client = redis.getClient();
    const violationKey = `${VIOLATION_KEY_PREFIX}${userId}`;

    try {
      // Increment violation counter with sliding 1-hour window
      const count = await client.incr(violationKey);
      if (count === 1) {
        await client.expire(violationKey, VIOLATION_WINDOW_SECONDS);
      }

      const backoffSeconds = this.getBackoffDelay(count);
      const suspended = count >= MAX_VIOLATIONS_BEFORE_SUSPEND;

      // Log violation to security monitoring
      logger.warn('Rate limit violation recorded', {
        userId,
        ipAddress,
        violationCount: count,
        backoffSeconds,
        suspended,
      });

      await auditService.log({
        userId,
        action: 'RATE_LIMIT_VIOLATION',
        resourceType: 'security',
        ipAddress,
        result: 'FAILURE',
        metadata: { violationCount: count, backoffSeconds, suspended },
      });

      // Suspend account on reaching threshold
      if (suspended) {
        await this.suspendAccount(userId, `Exceeded ${MAX_VIOLATIONS_BEFORE_SUSPEND} rate limit violations within 1 hour`);
      }

      return { violationCount: count, suspended, backoffSeconds };
    } catch (error) {
      logger.error('Failed to record rate limit violation', { userId, ipAddress, error });
      return { violationCount: 0, suspended: false, backoffSeconds: 0 };
    }
  }

  /**
   * Get the current violation count for a user within the 1-hour window.
   * Requirements: 31.7
   */
  async getViolationCount(userId: string): Promise<number> {
    const client = redis.getClient();
    const violationKey = `${VIOLATION_KEY_PREFIX}${userId}`;

    try {
      const value = await client.get(violationKey);
      return value ? parseInt(value, 10) : 0;
    } catch (error) {
      logger.error('Failed to get violation count', { userId, error });
      return 0;
    }
  }

  /**
   * Check whether a user account is currently suspended.
   * Requirements: 31.8
   */
  async isAccountSuspended(userId: string): Promise<boolean> {
    const client = redis.getClient();
    const suspensionKey = `${SUSPENSION_KEY_PREFIX}${userId}`;

    try {
      const value = await client.get(suspensionKey);
      return value !== null;
    } catch (error) {
      logger.error('Failed to check account suspension', { userId, error });
      return false;
    }
  }

  /**
   * Suspend a user account for 1 hour and log the event.
   * Requirements: 31.8, 31.9
   */
  async suspendAccount(userId: string, reason: string): Promise<void> {
    const client = redis.getClient();
    const suspensionKey = `${SUSPENSION_KEY_PREFIX}${userId}`;

    try {
      await client.set(suspensionKey, reason, { EX: SUSPENSION_DURATION_SECONDS });

      logger.warn('Account suspended due to rate limit violations', { userId, reason });

      await auditService.log({
        userId,
        action: 'ACCOUNT_SUSPENDED',
        resourceType: 'security',
        ipAddress: 'system',
        result: 'SUCCESS',
        metadata: { reason, durationSeconds: SUSPENSION_DURATION_SECONDS },
      });
    } catch (error) {
      logger.error('Failed to suspend account', { userId, reason, error });
    }
  }

  /**
   * Calculate exponential backoff delay in seconds.
   * Formula: 2^(violationCount - 1), capped at 3600 seconds.
   * Requirements: 31.6
   */
  getBackoffDelay(violationCount: number): number {
    if (violationCount <= 0) return 0;
    const delay = Math.pow(2, violationCount - 1);
    return Math.min(delay, MAX_BACKOFF_SECONDS);
  }

  /**
   * Clear all violations for a user (e.g., after manual review or account reinstatement).
   * Requirements: 31.10
   */
  async clearViolations(userId: string): Promise<void> {
    const client = redis.getClient();
    const violationKey = `${VIOLATION_KEY_PREFIX}${userId}`;
    const suspensionKey = `${SUSPENSION_KEY_PREFIX}${userId}`;

    try {
      await client.del(violationKey);
      await client.del(suspensionKey);

      logger.info('Rate limit violations cleared', { userId });
    } catch (error) {
      logger.error('Failed to clear violations', { userId, error });
    }
  }
}

export const rateLimitEnforcementService = new RateLimitEnforcementService();
export default rateLimitEnforcementService;
