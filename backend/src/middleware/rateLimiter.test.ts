// Mock config before any imports that trigger it
jest.mock('../config', () => ({
  config: {
    redis: { host: 'localhost', port: 6379, password: undefined, db: 0 },
    logging: { level: 'info', filePath: '/tmp/test.log' },
    env: 'test',
  },
}));

import { Request, Response, NextFunction } from 'express';
import {
  RateLimiterService,
  RateLimitResult,
  unauthenticatedRateLimiter,
  authenticatedRateLimiter,
  paymentRateLimiter,
} from './rateLimiter';

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock('../cache/connection');
jest.mock('../utils/logger');

import { redis } from '../cache/connection';

const mockRedis = redis as jest.Mocked<typeof redis>;

let mockIncr: jest.Mock;
let mockExpire: jest.Mock;
let mockTtl: jest.Mock;

beforeEach(() => {
  mockIncr = jest.fn();
  mockExpire = jest.fn().mockResolvedValue(1);
  mockTtl = jest.fn().mockResolvedValue(3600);

  mockRedis.getClient = jest.fn().mockReturnValue({
    incr: mockIncr,
    expire: mockExpire,
    ttl: mockTtl,
  });

  jest.clearAllMocks();
  // Re-apply after clearAllMocks
  mockRedis.getClient = jest.fn().mockReturnValue({
    incr: mockIncr,
    expire: mockExpire,
    ttl: mockTtl,
  });
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRes(): Partial<Response> {
  return {
    set: jest.fn(),
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

function makeReq(overrides: Partial<Request> = {}): Partial<Request> {
  return {
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' } as any,
    ...overrides,
  };
}

// ─── RateLimiterService ───────────────────────────────────────────────────────

describe('RateLimiterService', () => {
  let service: RateLimiterService;

  beforeEach(() => {
    service = new RateLimiterService();
    mockIncr = jest.fn();
    mockExpire = jest.fn().mockResolvedValue(1);
    mockTtl = jest.fn().mockResolvedValue(3600);
    mockRedis.getClient = jest.fn().mockReturnValue({
      incr: mockIncr,
      expire: mockExpire,
      ttl: mockTtl,
    });
  });

  describe('checkRateLimit', () => {
    it('allows request when under limit', async () => {
      mockIncr.mockResolvedValue(1);
      mockTtl.mockResolvedValue(3600);

      const result = await service.checkRateLimit('test-key', 100, 3600);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(99);
      expect(result.limit).toBe(100);
    });

    it('allows request exactly at limit', async () => {
      mockIncr.mockResolvedValue(100);
      mockTtl.mockResolvedValue(3600);

      const result = await service.checkRateLimit('test-key', 100, 3600);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(0);
    });

    it('blocks request when over limit', async () => {
      mockIncr.mockResolvedValue(101);
      mockTtl.mockResolvedValue(3600);

      const result = await service.checkRateLimit('test-key', 100, 3600);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('sets expire only on first request (count === 1)', async () => {
      mockIncr.mockResolvedValue(1);
      mockTtl.mockResolvedValue(3600);

      await service.checkRateLimit('test-key', 100, 3600);

      expect(mockExpire).toHaveBeenCalledWith('rl:test-key', 3600);
    });

    it('does not set expire on subsequent requests', async () => {
      mockIncr.mockResolvedValue(5);
      mockTtl.mockResolvedValue(3595);

      await service.checkRateLimit('test-key', 100, 3600);

      expect(mockExpire).not.toHaveBeenCalled();
    });

    it('prefixes Redis key with "rl:"', async () => {
      mockIncr.mockResolvedValue(1);
      mockTtl.mockResolvedValue(60);

      await service.checkRateLimit('my-key', 10, 60);

      expect(mockIncr).toHaveBeenCalledWith('rl:my-key');
    });

    it('fails open when Redis throws', async () => {
      mockIncr.mockRejectedValue(new Error('Redis down'));

      const result = await service.checkRateLimit('test-key', 100, 3600);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(100);
      expect(result.limit).toBe(100);
    });

    it('returns a resetAt date in the future', async () => {
      mockIncr.mockResolvedValue(1);
      mockTtl.mockResolvedValue(60);

      const before = Date.now();
      const result = await service.checkRateLimit('test-key', 10, 60);
      const after = Date.now();

      expect(result.resetAt.getTime()).toBeGreaterThanOrEqual(before + 59_000);
      expect(result.resetAt.getTime()).toBeLessThanOrEqual(after + 61_000);
    });
  });

  describe('getRateLimitHeaders', () => {
    it('returns correct header names and values', () => {
      const resetAt = new Date(1_700_000_000_000);
      const result: RateLimitResult = { allowed: true, remaining: 42, resetAt, limit: 100 };

      const headers = service.getRateLimitHeaders(result);

      expect(headers['X-RateLimit-Limit']).toBe('100');
      expect(headers['X-RateLimit-Remaining']).toBe('42');
      expect(headers['X-RateLimit-Reset']).toBe(String(Math.floor(resetAt.getTime() / 1000)));
    });

    it('returns remaining as 0 when blocked', () => {
      const result: RateLimitResult = {
        allowed: false,
        remaining: 0,
        resetAt: new Date(),
        limit: 10,
      };

      const headers = service.getRateLimitHeaders(result);

      expect(headers['X-RateLimit-Remaining']).toBe('0');
    });
  });
});

// ─── unauthenticatedRateLimiter ───────────────────────────────────────────────

describe('unauthenticatedRateLimiter', () => {
  beforeEach(() => {
    mockIncr = jest.fn();
    mockExpire = jest.fn().mockResolvedValue(1);
    mockTtl = jest.fn().mockResolvedValue(3600);
    mockRedis.getClient = jest.fn().mockReturnValue({
      incr: mockIncr,
      expire: mockExpire,
      ttl: mockTtl,
    });
  });

  it('calls next() when under limit', async () => {
    mockIncr.mockResolvedValue(1);
    const middleware = unauthenticatedRateLimiter();
    const req = makeReq();
    const res = makeRes();
    const next: NextFunction = jest.fn();

    await middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 429 when over limit', async () => {
    mockIncr.mockResolvedValue(101);
    const middleware = unauthenticatedRateLimiter();
    const req = makeReq();
    const res = makeRes();
    const next: NextFunction = jest.fn();

    await middleware(req as Request, res as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Too Many Requests' })
    );
  });

  it('sets rate limit headers on every request', async () => {
    mockIncr.mockResolvedValue(50);
    const middleware = unauthenticatedRateLimiter();
    const req = makeReq();
    const res = makeRes();
    const next: NextFunction = jest.fn();

    await middleware(req as Request, res as Response, next);

    expect(res.set).toHaveBeenCalledWith(
      expect.objectContaining({
        'X-RateLimit-Limit': '100',
        'X-RateLimit-Remaining': '50',
      })
    );
  });

  it('uses IP as the rate limit key', async () => {
    mockIncr.mockResolvedValue(1);
    const middleware = unauthenticatedRateLimiter();
    const req = makeReq({ ip: '10.0.0.1' });
    const res = makeRes();
    const next: NextFunction = jest.fn();

    await middleware(req as Request, res as Response, next);

    expect(mockIncr).toHaveBeenCalledWith('rl:unauth:10.0.0.1');
  });
});

// ─── authenticatedRateLimiter ─────────────────────────────────────────────────

describe('authenticatedRateLimiter', () => {
  beforeEach(() => {
    mockIncr = jest.fn();
    mockExpire = jest.fn().mockResolvedValue(1);
    mockTtl = jest.fn().mockResolvedValue(3600);
    mockRedis.getClient = jest.fn().mockReturnValue({
      incr: mockIncr,
      expire: mockExpire,
      ttl: mockTtl,
    });
  });

  it('calls next() when under limit', async () => {
    mockIncr.mockResolvedValue(1);
    const middleware = authenticatedRateLimiter();
    const req = makeReq({ user: { id: 'user-1' } } as any);
    const res = makeRes();
    const next: NextFunction = jest.fn();

    await middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
  });

  it('returns 429 when over limit', async () => {
    mockIncr.mockResolvedValue(1001);
    const middleware = authenticatedRateLimiter();
    const req = makeReq({ user: { id: 'user-1' } } as any);
    const res = makeRes();
    const next: NextFunction = jest.fn();

    await middleware(req as Request, res as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(429);
  });

  it('skips rate limiting when no user is present', async () => {
    const middleware = authenticatedRateLimiter();
    const req = makeReq();
    const res = makeRes();
    const next: NextFunction = jest.fn();

    await middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
    expect(mockIncr).not.toHaveBeenCalled();
  });

  it('uses user ID as the rate limit key', async () => {
    mockIncr.mockResolvedValue(1);
    const middleware = authenticatedRateLimiter();
    const req = makeReq({ user: { id: 'user-42' } } as any);
    const res = makeRes();
    const next: NextFunction = jest.fn();

    await middleware(req as Request, res as Response, next);

    expect(mockIncr).toHaveBeenCalledWith('rl:auth:user-42');
  });

  it('applies 1000 req/hour limit', async () => {
    mockIncr.mockResolvedValue(1000);
    const middleware = authenticatedRateLimiter();
    const req = makeReq({ user: { id: 'user-1' } } as any);
    const res = makeRes();
    const next: NextFunction = jest.fn();

    await middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
    expect(res.set).toHaveBeenCalledWith(
      expect.objectContaining({ 'X-RateLimit-Limit': '1000' })
    );
  });
});

// ─── paymentRateLimiter ───────────────────────────────────────────────────────

describe('paymentRateLimiter', () => {
  beforeEach(() => {
    mockIncr = jest.fn();
    mockExpire = jest.fn().mockResolvedValue(1);
    mockTtl = jest.fn().mockResolvedValue(60);
    mockRedis.getClient = jest.fn().mockReturnValue({
      incr: mockIncr,
      expire: mockExpire,
      ttl: mockTtl,
    });
  });

  it('calls next() when under limit', async () => {
    mockIncr.mockResolvedValue(1);
    const middleware = paymentRateLimiter();
    const req = makeReq({ user: { id: 'user-1' } } as any);
    const res = makeRes();
    const next: NextFunction = jest.fn();

    await middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
  });

  it('returns 429 when over limit', async () => {
    mockIncr.mockResolvedValue(11);
    const middleware = paymentRateLimiter();
    const req = makeReq({ user: { id: 'user-1' } } as any);
    const res = makeRes();
    const next: NextFunction = jest.fn();

    await middleware(req as Request, res as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Too Many Requests' })
    );
  });

  it('applies 10 req/minute limit', async () => {
    mockIncr.mockResolvedValue(10);
    const middleware = paymentRateLimiter();
    const req = makeReq({ user: { id: 'user-1' } } as any);
    const res = makeRes();
    const next: NextFunction = jest.fn();

    await middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
    expect(res.set).toHaveBeenCalledWith(
      expect.objectContaining({ 'X-RateLimit-Limit': '10' })
    );
  });

  it('sets 60-second window on first payment request', async () => {
    mockIncr.mockResolvedValue(1);
    const middleware = paymentRateLimiter();
    const req = makeReq({ user: { id: 'user-1' } } as any);
    const res = makeRes();
    const next: NextFunction = jest.fn();

    await middleware(req as Request, res as Response, next);

    expect(mockExpire).toHaveBeenCalledWith('rl:payment:user-1', 60);
  });

  it('skips rate limiting when no user is present', async () => {
    const middleware = paymentRateLimiter();
    const req = makeReq();
    const res = makeRes();
    const next: NextFunction = jest.fn();

    await middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
    expect(mockIncr).not.toHaveBeenCalled();
  });

  it('uses user ID as the payment rate limit key', async () => {
    mockIncr.mockResolvedValue(1);
    const middleware = paymentRateLimiter();
    const req = makeReq({ user: { id: 'user-99' } } as any);
    const res = makeRes();
    const next: NextFunction = jest.fn();

    await middleware(req as Request, res as Response, next);

    expect(mockIncr).toHaveBeenCalledWith('rl:payment:user-99');
  });
});
