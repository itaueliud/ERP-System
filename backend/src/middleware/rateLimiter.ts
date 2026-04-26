import { Request, Response, NextFunction } from 'express';
import { redis } from '../cache/connection';
import logger from '../utils/logger';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  limit: number;
}

export class RateLimiterService {
  /**
   * Check rate limit using Redis sliding window counter (INCR + EXPIRE).
   * @param key   Unique key for this rate limit bucket
   * @param limit Maximum number of requests allowed in the window
   * @param windowSeconds Length of the window in seconds
   */
  async checkRateLimit(
    key: string,
    limit: number,
    windowSeconds: number
  ): Promise<RateLimitResult> {
    const client = redis.getClient();
    const redisKey = `rl:${key}`;

    try {
      const current = await client.incr(redisKey);

      // Set expiry only on first request in the window
      if (current === 1) {
        await client.expire(redisKey, windowSeconds);
      }

      // Get the actual TTL so resetAt is accurate
      const ttl = await client.ttl(redisKey);
      const resetAt = new Date(Date.now() + ttl * 1000);
      const remaining = Math.max(0, limit - current);
      const allowed = current <= limit;

      return { allowed, remaining, resetAt, limit };
    } catch (error) {
      // Fail open: if Redis is unavailable, allow the request
      logger.error('Rate limiter Redis error, failing open', { key, error });
      return {
        allowed: true,
        remaining: limit,
        resetAt: new Date(Date.now() + windowSeconds * 1000),
        limit,
      };
    }
  }

  /**
   * Build standard rate-limit response headers from a RateLimitResult.
   */
  getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
    return {
      'X-RateLimit-Limit': String(result.limit),
      'X-RateLimit-Remaining': String(result.remaining),
      'X-RateLimit-Reset': String(Math.floor(result.resetAt.getTime() / 1000)),
    };
  }
}

export const rateLimiterService = new RateLimiterService();

// ─── Middleware factories ────────────────────────────────────────────────────

/**
 * 100 requests / hour per IP (unauthenticated traffic).
 */
export function unauthenticatedRateLimiter() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    const key = `unauth:${ip}`;
    const result = await rateLimiterService.checkRateLimit(key, 100, 3600);

    const headers = rateLimiterService.getRateLimitHeaders(result);
    res.set(headers);

    if (!result.allowed) {
      logger.warn('Unauthenticated rate limit exceeded', { ip });
      res.status(429).json({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: Math.floor((result.resetAt.getTime() - Date.now()) / 1000),
      });
      return;
    }

    next();
  };
}

/**
 * 1,000 requests / hour per authenticated user.
 */
export function authenticatedRateLimiter() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const user = (req as any).user;
    if (!user?.id) {
      next();
      return;
    }

    const key = `auth:${user.id}`;
    const result = await rateLimiterService.checkRateLimit(key, 1000, 3600);

    const headers = rateLimiterService.getRateLimitHeaders(result);
    res.set(headers);

    if (!result.allowed) {
      logger.warn('Authenticated rate limit exceeded', { userId: user.id });
      res.status(429).json({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: Math.floor((result.resetAt.getTime() - Date.now()) / 1000),
      });
      return;
    }

    next();
  };
}

/**
 * 10 requests / minute per authenticated user (payment endpoints).
 */
export function paymentRateLimiter() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const user = (req as any).user;
    if (!user?.id) {
      next();
      return;
    }

    const key = `payment:${user.id}`;
    const result = await rateLimiterService.checkRateLimit(key, 10, 60);

    const headers = rateLimiterService.getRateLimitHeaders(result);
    res.set(headers);

    if (!result.allowed) {
      logger.warn('Payment rate limit exceeded', { userId: user.id });
      res.status(429).json({
        error: 'Too Many Requests',
        message: 'Payment rate limit exceeded. Please try again later.',
        retryAfter: Math.floor((result.resetAt.getTime() - Date.now()) / 1000),
      });
      return;
    }

    next();
  };
}
