import { Request, Response, NextFunction } from 'express';
import { redis } from '../cache/connection';
import { randomUUID } from 'crypto';
import logger from '../utils/logger';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

// Role-based rate limit configurations
const RATE_LIMITS: Record<string, RateLimitConfig> = {
  CEO: { windowMs: 60000, maxRequests: 1000 },
  CFO: { windowMs: 60000, maxRequests: 500 },
  CoS: { windowMs: 60000, maxRequests: 500 },
  EA: { windowMs: 60000, maxRequests: 500 },
  COO: { windowMs: 60000, maxRequests: 300 },
  HEAD_OF_TRAINERS: { windowMs: 60000, maxRequests: 300 },
  TRAINER: { windowMs: 60000, maxRequests: 200 },
  OPERATIONS_USER: { windowMs: 60000, maxRequests: 200 },
  TECH_STAFF: { windowMs: 60000, maxRequests: 200 },
  DEVELOPER: { windowMs: 60000, maxRequests: 200 },
  AGENT: { windowMs: 60000, maxRequests: 150 },
  CFO_ASSISTANT: { windowMs: 60000, maxRequests: 200 },
  DEFAULT: { windowMs: 60000, maxRequests: 100 },
};

/**
 * Per-user rate limiting middleware
 * Tracks requests per user with role-based limits
 */
export function perUserRateLimit() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    
    // Skip rate limiting if no user (public endpoints)
    if (!user || !user.id) {
      return next();
    }

    const userId = user.id;
    const userRole = user.role || 'DEFAULT';
    const config = RATE_LIMITS[userRole] || RATE_LIMITS.DEFAULT;
    
    const key = `ratelimit:user:${userId}`;
    const now = Date.now();
    const windowStart = now - config.windowMs;

    try {
      // Use Redis sorted set to track requests with timestamps
      const client = redis.getClient();
      
      // Remove old entries outside the time window
      await client.zRemRangeByScore(key, 0, windowStart);
      
      // Count requests in current window
      const requestCount = await client.zCard(key);
      
      if (requestCount >= config.maxRequests) {
        logger.warn('Rate limit exceeded', {
          userId,
          userRole,
          requestCount,
          limit: config.maxRequests,
          path: req.path,
        });
        
        return res.status(429).json({
          error: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Please try again later.',
          retryAfter: Math.ceil(config.windowMs / 1000),
        });
      }
      
      // Add current request — unique value prevents deduplication under concurrent load
      await client.zAdd(key, { score: now, value: `${now}-${randomUUID()}` });
      
      // Set expiry on the key
      await client.expire(key, Math.ceil(config.windowMs / 1000));
      
      // Add rate limit headers
      res.setHeader('X-RateLimit-Limit', config.maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', (config.maxRequests - requestCount - 1).toString());
      res.setHeader('X-RateLimit-Reset', (now + config.windowMs).toString());
      
      next();
    } catch (error) {
      // If Redis fails, log but don't block the request
      logger.error('Rate limit check failed', { error, userId });
      next();
    }
  };
}

/**
 * Get rate limit stats for a user
 */
export async function getRateLimitStats(userId: string, userRole?: string): Promise<{
  requestCount: number;
  limit: number;
  remaining: number;
  resetAt: number;
}> {
  const key = `ratelimit:user:${userId}`;

  try {
    const client = redis.getClient();
    const requestCount = await client.zCard(key);
    const ttl = await client.ttl(key);

    const roleConfig = RATE_LIMITS[userRole || 'DEFAULT'] || RATE_LIMITS.DEFAULT;
    const limit = roleConfig.maxRequests;

    return {
      requestCount,
      limit,
      remaining: Math.max(0, limit - requestCount),
      resetAt: Date.now() + (ttl * 1000),
    };
  } catch (error) {
    logger.error('Failed to get rate limit stats', { error, userId });
    return {
      requestCount: 0,
      limit: RATE_LIMITS.DEFAULT.maxRequests,
      remaining: RATE_LIMITS.DEFAULT.maxRequests,
      resetAt: Date.now() + RATE_LIMITS.DEFAULT.windowMs,
    };
  }
}

/**
 * Reset rate limit for a user (admin function)
 */
export async function resetUserRateLimit(userId: string): Promise<void> {
  const key = `ratelimit:user:${userId}`;
  
  try {
    const client = redis.getClient();
    await client.del(key);
    logger.info('Rate limit reset', { userId });
  } catch (error) {
    logger.error('Failed to reset rate limit', { error, userId });
    throw error;
  }
}
