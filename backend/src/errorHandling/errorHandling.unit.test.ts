/**
 * Unit tests for error handling, validation errors, retry logic, and rate limiting.
 * Requirements: 31.1-31.10, 32.1-32.11
 */

// ─── Mock setup (must come before imports) ───────────────────────────────────

jest.mock('../config', () => ({
  config: {
    env: 'test',
    redis: { host: 'localhost', port: 6379, password: undefined, db: 0 },
    logging: { level: 'info', filePath: '/tmp/test.log' },
  },
}));

jest.mock('../utils/logger', () => ({
  __esModule: true,
  default: { warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

jest.mock('../cache/connection');
jest.mock('../audit/auditService', () => ({
  auditService: { log: jest.fn().mockResolvedValue(undefined) },
}));

// ─── Imports ──────────────────────────────────────────────────────────────────

import { Request, Response } from 'express';
import {
  AppError,
  ErrorCode,
  ErrorResponse,
  FieldError,
  errorHandlerMiddleware,
} from '../middleware/errorHandler';
import { RateLimiterService, RateLimitResult } from '../middleware/rateLimiter';
import { RateLimitEnforcementService } from '../middleware/rateLimitEnforcement';
import { withRetry } from '../utils/retryHandler';
import { redis } from '../cache/connection';
import { config } from '../config';

const mockRedis = redis as jest.Mocked<typeof redis>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    method: 'GET',
    path: '/api/test',
    ip: '127.0.0.1',
    headers: {},
    socket: { remoteAddress: '127.0.0.1' },
    ...overrides,
  } as unknown as Request;
}

function makeRes(): { res: Response; json: jest.Mock; status: jest.Mock; set: jest.Mock } {
  const json = jest.fn();
  const set = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const res = { status, json, set } as unknown as Response;
  return { res, json, status, set };
}

function makeError(overrides: Record<string, any> = {}): Error & Record<string, any> {
  return Object.assign(new Error('test error'), overrides);
}

// ─── 1. Error Response Format ─────────────────────────────────────────────────
// Requirements: 32.1, 32.2, 32.10, 32.11

describe('Error response format', () => {
  beforeEach(() => jest.clearAllMocks());

  it('always includes success:false, errorCode, message, and requestId', () => {
    const { res, json, status } = makeRes();
    errorHandlerMiddleware(AppError.notFound('Client'), makeReq(), res, jest.fn());

    expect(status).toHaveBeenCalledWith(404);
    const body: ErrorResponse = json.mock.calls[0][0];
    expect(body.success).toBe(false);
    expect(body.errorCode).toBeDefined();
    expect(typeof body.message).toBe('string');
    expect(body.message.length).toBeGreaterThan(0);
    expect(typeof body.requestId).toBe('string');
    expect(body.requestId.length).toBeGreaterThan(0);
  });

  it('does not expose stack traces in the response body (Req 32.2)', () => {
    const { res, json } = makeRes();
    const err = new Error('Internal crash');
    err.stack = 'Error: Internal crash\n    at Object.<anonymous> (/app/src/index.ts:10:5)';

    errorHandlerMiddleware(err, makeReq(), res, jest.fn());

    const body = json.mock.calls[0][0];
    expect(JSON.stringify(body)).not.toContain('at Object.<anonymous>');
    expect(body).not.toHaveProperty('stack');
  });

  it('does not expose stack traces in production (Req 32.2)', () => {
    (config as any).env = 'production';
    const { res, json } = makeRes();
    errorHandlerMiddleware(new Error('crash'), makeReq(), res, jest.fn());
    const body = json.mock.calls[0][0];
    expect(body).not.toHaveProperty('detail');
    (config as any).env = 'test';
  });

  it('includes an error code for support reference (Req 32.11)', () => {
    const { res, json } = makeRes();
    errorHandlerMiddleware(AppError.forbidden(), makeReq(), res, jest.fn());
    const body: ErrorResponse = json.mock.calls[0][0];
    expect(Object.values(ErrorCode)).toContain(body.errorCode);
  });

  it('uses x-request-id header when provided', () => {
    const { res, json } = makeRes();
    const req = makeReq({ headers: { 'x-request-id': 'req-abc-123' } });
    errorHandlerMiddleware(AppError.notFound(), req, res, jest.fn());
    expect(json.mock.calls[0][0].requestId).toBe('req-abc-123');
  });

  it('generates a requestId when header is absent', () => {
    const { res, json } = makeRes();
    errorHandlerMiddleware(AppError.notFound(), makeReq(), res, jest.fn());
    const { requestId } = json.mock.calls[0][0];
    // UUID v4 pattern
    expect(requestId).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it('maps 401 status errors to UNAUTHORIZED error code', () => {
    const { res, json, status } = makeRes();
    errorHandlerMiddleware(makeError({ status: 401 }), makeReq(), res, jest.fn());
    expect(status).toHaveBeenCalledWith(401);
    expect(json.mock.calls[0][0].errorCode).toBe(ErrorCode.UNAUTHORIZED);
  });

  it('maps 403 status errors to FORBIDDEN error code', () => {
    const { res, json, status } = makeRes();
    errorHandlerMiddleware(makeError({ status: 403 }), makeReq(), res, jest.fn());
    expect(status).toHaveBeenCalledWith(403);
    expect(json.mock.calls[0][0].errorCode).toBe(ErrorCode.FORBIDDEN);
  });

  it('maps unknown errors to 500 INTERNAL_ERROR without leaking details', () => {
    const { res, json, status } = makeRes();
    errorHandlerMiddleware(new Error('db connection pool exhausted'), makeReq(), res, jest.fn());
    expect(status).toHaveBeenCalledWith(500);
    const body = json.mock.calls[0][0];
    expect(body.errorCode).toBe(ErrorCode.INTERNAL_ERROR);
    expect(body.message).not.toContain('db connection pool exhausted');
  });

  it('logs detailed error information server-side for 5xx errors (Req 32.10)', () => {
    const logger = require('../utils/logger').default;
    const { res } = makeRes();
    const err = new Error('secret db error');
    errorHandlerMiddleware(err, makeReq(), res, jest.fn());
    expect(logger.error).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ stack: expect.stringContaining('secret db error') })
    );
  });
});

// ─── 2. Validation Error Messages ────────────────────────────────────────────
// Requirements: 32.3, 32.4, 32.5

describe('Validation error messages', () => {
  beforeEach(() => jest.clearAllMocks());

  it('includes fieldErrors array for validation errors (Req 32.3)', () => {
    const { res, json, status } = makeRes();
    const fieldErrors: FieldError[] = [
      { field: 'email', message: 'Invalid email format' },
      { field: 'phone', message: 'Phone number is required' },
    ];
    errorHandlerMiddleware(AppError.validation(fieldErrors), makeReq(), res, jest.fn());

    expect(status).toHaveBeenCalledWith(422);
    const body = json.mock.calls[0][0];
    expect(body.fieldErrors).toEqual(fieldErrors);
  });

  it('each field error identifies the specific field (Req 32.3)', () => {
    const { res, json } = makeRes();
    const fieldErrors: FieldError[] = [
      { field: 'country', message: 'Country must be one of 51 African countries' },
      { field: 'industry', message: 'Industry must be one of: Schools, Churches, Hotels' },
    ];
    errorHandlerMiddleware(AppError.validation(fieldErrors), makeReq(), res, jest.fn());

    const body = json.mock.calls[0][0];
    const fields = body.fieldErrors.map((e: FieldError) => e.field);
    expect(fields).toContain('country');
    expect(fields).toContain('industry');
  });

  it('validation error messages are user-friendly (Req 32.1, 32.5)', () => {
    const { res, json } = makeRes();
    const fieldErrors: FieldError[] = [
      { field: 'email', message: 'Please enter a valid email address' },
    ];
    errorHandlerMiddleware(AppError.validation(fieldErrors), makeReq(), res, jest.fn());

    const body = json.mock.calls[0][0];
    // Should not contain raw technical terms like "TypeError" or stack references
    const bodyStr = JSON.stringify(body);
    expect(bodyStr).not.toContain('TypeError');
    expect(bodyStr).not.toContain('at ');
  });

  it('omits fieldErrors when there are no field-level errors', () => {
    const { res, json } = makeRes();
    errorHandlerMiddleware(AppError.notFound('Project'), makeReq(), res, jest.fn());
    const body = json.mock.calls[0][0];
    expect(body).not.toHaveProperty('fieldErrors');
  });

  it('converts Joi validation errors to field-specific errors (Req 32.3)', () => {
    const { res, json, status } = makeRes();
    const joiError = {
      name: 'ValidationError',
      isJoi: true,
      details: [
        {
          message: '"name" is not allowed to be empty',
          path: ['name'],
          context: { value: '' },
        },
        {
          message: '"serviceAmount" must be a positive number',
          path: ['serviceAmount'],
          context: { value: -100 },
        },
      ],
    };

    errorHandlerMiddleware(joiError as any, makeReq(), res, jest.fn());

    expect(status).toHaveBeenCalledWith(422);
    const body = json.mock.calls[0][0];
    expect(body.errorCode).toBe(ErrorCode.VALIDATION_ERROR);
    expect(body.fieldErrors).toHaveLength(2);
    expect(body.fieldErrors[0].field).toBe('name');
    expect(body.fieldErrors[1].field).toBe('serviceAmount');
  });

  it('validation error message provides actionable guidance (Req 32.5)', () => {
    const { res, json } = makeRes();
    const fieldErrors: FieldError[] = [
      { field: 'phone', message: 'Phone must be in E.164 format (e.g. +254712345678)' },
    ];
    errorHandlerMiddleware(AppError.validation(fieldErrors), makeReq(), res, jest.fn());

    const body = json.mock.calls[0][0];
    // Top-level message should guide the user
    expect(body.message).toMatch(/correct|invalid|please/i);
  });
});

// ─── 3. Retry Logic ───────────────────────────────────────────────────────────
// Requirements: 14.8, 32.6

const FAST_OPTS = { baseDelayMs: 1, maxDelayMs: 5 };

describe('Retry logic', () => {
  beforeEach(() => jest.clearAllMocks());

  it('succeeds immediately without retrying when no error occurs', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    await expect(withRetry(fn, FAST_OPTS)).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on network error ECONNREFUSED', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(makeError({ code: 'ECONNREFUSED' }))
      .mockResolvedValue('success');
    await expect(withRetry(fn, FAST_OPTS)).resolves.toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries on network error ETIMEDOUT', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(makeError({ code: 'ETIMEDOUT' }))
      .mockResolvedValue('done');
    await expect(withRetry(fn, FAST_OPTS)).resolves.toBe('done');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries on network error ENOTFOUND', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(makeError({ code: 'ENOTFOUND' }))
      .mockResolvedValue('done');
    await expect(withRetry(fn, FAST_OPTS)).resolves.toBe('done');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries on HTTP 500 server error', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(makeError({ response: { status: 500 } }))
      .mockResolvedValue('ok');
    await expect(withRetry(fn, FAST_OPTS)).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries on HTTP 503 server error', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(makeError({ response: { status: 503 } }))
      .mockResolvedValue('ok');
    await expect(withRetry(fn, FAST_OPTS)).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does NOT retry on HTTP 4xx client errors', async () => {
    const fn = jest.fn().mockRejectedValue(makeError({ response: { status: 400 } }));
    await expect(withRetry(fn, FAST_OPTS)).rejects.toBeDefined();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does NOT retry on generic application errors', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('validation failed'));
    await expect(withRetry(fn, FAST_OPTS)).rejects.toThrow('validation failed');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('stops after max 3 attempts by default', async () => {
    const fn = jest.fn().mockRejectedValue(makeError({ code: 'ECONNREFUSED' }));
    await expect(withRetry(fn, FAST_OPTS)).rejects.toBeDefined();
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('respects custom maxAttempts option', async () => {
    const fn = jest.fn().mockRejectedValue(makeError({ code: 'ETIMEDOUT' }));
    await expect(withRetry(fn, { ...FAST_OPTS, maxAttempts: 2 })).rejects.toBeDefined();
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws the last error after exhausting all attempts', async () => {
    const err = makeError({ code: 'ECONNREFUSED' });
    const fn = jest.fn().mockRejectedValue(err);
    await expect(withRetry(fn, { ...FAST_OPTS, maxAttempts: 3 })).rejects.toBe(err);
  });

  it('applies exponential backoff between retries (delay grows with each attempt)', async () => {
    jest.useFakeTimers();
    try {
      const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
      const fn = jest
        .fn()
        .mockRejectedValueOnce(makeError({ code: 'ECONNREFUSED' }))
        .mockRejectedValueOnce(makeError({ code: 'ECONNREFUSED' }))
        .mockResolvedValue('ok');

      const promise = withRetry(fn, { baseDelayMs: 100, maxDelayMs: 10000, maxAttempts: 3 });
      await jest.runAllTimersAsync();
      await expect(promise).resolves.toBe('ok');

      const delays = setTimeoutSpy.mock.calls
        .filter((c) => typeof c[1] === 'number' && (c[1] as number) > 0)
        .map((c) => c[1] as number);

      // Second delay should be >= first delay (exponential growth)
      expect(delays.length).toBeGreaterThanOrEqual(2);
      expect(delays[1]).toBeGreaterThanOrEqual(delays[0]);

      setTimeoutSpy.mockRestore();
    } finally {
      jest.useRealTimers();
    }
  });
});

// ─── 4. Rate Limiting ─────────────────────────────────────────────────────────
// Requirements: 31.1-31.6

describe('Rate limiting', () => {
  let service: RateLimiterService;
  let mockIncr: jest.Mock;
  let mockExpire: jest.Mock;
  let mockTtl: jest.Mock;

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
    jest.clearAllMocks();
    mockRedis.getClient = jest.fn().mockReturnValue({
      incr: mockIncr,
      expire: mockExpire,
      ttl: mockTtl,
    });
  });

  it('returns HTTP 429 when rate limit is exceeded (Req 31.5)', async () => {
    mockIncr.mockResolvedValue(101);
    mockTtl.mockResolvedValue(3600);
    const result = await service.checkRateLimit('test', 100, 3600);
    expect(result.allowed).toBe(false);
  });

  it('allows request when under the limit', async () => {
    mockIncr.mockResolvedValue(50);
    mockTtl.mockResolvedValue(3600);
    const result = await service.checkRateLimit('test', 100, 3600);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(50);
  });

  it('allows request exactly at the limit boundary', async () => {
    mockIncr.mockResolvedValue(100);
    mockTtl.mockResolvedValue(3600);
    const result = await service.checkRateLimit('test', 100, 3600);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(0);
  });

  it('includes X-RateLimit-Limit header in response (Req 31.6)', () => {
    const resetAt = new Date(Date.now() + 3600_000);
    const result: RateLimitResult = { allowed: true, remaining: 42, resetAt, limit: 100 };
    const headers = service.getRateLimitHeaders(result);
    expect(headers).toHaveProperty('X-RateLimit-Limit', '100');
  });

  it('includes X-RateLimit-Remaining header in response (Req 31.6)', () => {
    const resetAt = new Date(Date.now() + 3600_000);
    const result: RateLimitResult = { allowed: true, remaining: 42, resetAt, limit: 100 };
    const headers = service.getRateLimitHeaders(result);
    expect(headers).toHaveProperty('X-RateLimit-Remaining', '42');
  });

  it('includes X-RateLimit-Reset header as Unix timestamp (Req 31.6)', () => {
    const resetAt = new Date(1_700_000_000_000);
    const result: RateLimitResult = { allowed: false, remaining: 0, resetAt, limit: 100 };
    const headers = service.getRateLimitHeaders(result);
    expect(headers).toHaveProperty(
      'X-RateLimit-Reset',
      String(Math.floor(resetAt.getTime() / 1000))
    );
  });

  it('sets X-RateLimit-Remaining to 0 when blocked', () => {
    const result: RateLimitResult = {
      allowed: false,
      remaining: 0,
      resetAt: new Date(),
      limit: 10,
    };
    const headers = service.getRateLimitHeaders(result);
    expect(headers['X-RateLimit-Remaining']).toBe('0');
  });

  it('limits unauthenticated requests to 100/hour per IP (Req 31.2)', async () => {
    // At count=100 it should still be allowed; at 101 it should be blocked
    mockIncr.mockResolvedValue(100);
    mockTtl.mockResolvedValue(3600);
    const atLimit = await service.checkRateLimit('unauth:1.2.3.4', 100, 3600);
    expect(atLimit.allowed).toBe(true);

    mockIncr.mockResolvedValue(101);
    const overLimit = await service.checkRateLimit('unauth:1.2.3.4', 100, 3600);
    expect(overLimit.allowed).toBe(false);
  });

  it('limits authenticated requests to 1000/hour per user (Req 31.3)', async () => {
    mockIncr.mockResolvedValue(1000);
    mockTtl.mockResolvedValue(3600);
    const atLimit = await service.checkRateLimit('auth:user-1', 1000, 3600);
    expect(atLimit.allowed).toBe(true);

    mockIncr.mockResolvedValue(1001);
    const overLimit = await service.checkRateLimit('auth:user-1', 1000, 3600);
    expect(overLimit.allowed).toBe(false);
  });

  it('limits payment requests to 10/minute per user (Req 31.4)', async () => {
    mockIncr.mockResolvedValue(10);
    mockTtl.mockResolvedValue(60);
    const atLimit = await service.checkRateLimit('payment:user-1', 10, 60);
    expect(atLimit.allowed).toBe(true);

    mockIncr.mockResolvedValue(11);
    const overLimit = await service.checkRateLimit('payment:user-1', 10, 60);
    expect(overLimit.allowed).toBe(false);
  });

  it('fails open (allows request) when Redis is unavailable', async () => {
    mockIncr.mockRejectedValue(new Error('Redis connection refused'));
    const result = await service.checkRateLimit('test', 100, 3600);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(100);
  });
});

// ─── 5. Account Suspension After Violations ───────────────────────────────────
// Requirements: 31.7, 31.8, 31.9

describe('Account suspension after rate limit violations', () => {
  let service: RateLimitEnforcementService;
  const mockStore: Record<string, { value: string }> = {};

  const mockClient = {
    incr: jest.fn(async (key: string) => {
      const current = mockStore[key] ? parseInt(mockStore[key].value, 10) : 0;
      const next = current + 1;
      mockStore[key] = { value: String(next) };
      return next;
    }),
    expire: jest.fn().mockResolvedValue(1),
    get: jest.fn(async (key: string) => mockStore[key]?.value ?? null),
    set: jest.fn(async (key: string, value: string) => {
      mockStore[key] = { value };
      return 'OK';
    }),
    del: jest.fn(async (...keys: string[]) => {
      keys.forEach((k) => delete mockStore[k]);
      return keys.length;
    }),
  };

  beforeEach(() => {
    service = new RateLimitEnforcementService();
    Object.keys(mockStore).forEach((k) => delete mockStore[k]);
    jest.clearAllMocks();
    mockRedis.getClient = jest.fn().mockReturnValue(mockClient);
  });

  it('records violation and returns violation count', async () => {
    const result = await service.recordViolation('user-1', '127.0.0.1');
    expect(result.violationCount).toBe(1);
    expect(result.suspended).toBe(false);
  });

  it('applies exponential backoff on violations (Req 31.7)', () => {
    expect(service.getBackoffDelay(1)).toBe(1);   // 2^0
    expect(service.getBackoffDelay(2)).toBe(2);   // 2^1
    expect(service.getBackoffDelay(3)).toBe(4);   // 2^2
    expect(service.getBackoffDelay(4)).toBe(8);   // 2^3
    expect(service.getBackoffDelay(5)).toBe(16);  // 2^4
  });

  it('caps exponential backoff at 3600 seconds', () => {
    expect(service.getBackoffDelay(100)).toBe(3600);
  });

  it('suspends account after 5 violations in 1 hour (Req 31.9)', async () => {
    // Pre-seed 4 violations
    mockStore['rl:violations:user-suspend'] = { value: '4' };
    const result = await service.recordViolation('user-suspend', '10.0.0.1');
    expect(result.violationCount).toBe(5);
    expect(result.suspended).toBe(true);
    expect(mockClient.set).toHaveBeenCalledWith(
      'rl:suspended:user-suspend',
      expect.any(String),
      { EX: 3600 }
    );
  });

  it('suspension lasts 1 hour (3600 seconds) (Req 31.9)', async () => {
    await service.suspendAccount('user-2', 'Too many violations');
    expect(mockClient.set).toHaveBeenCalledWith(
      'rl:suspended:user-2',
      expect.any(String),
      { EX: 3600 }
    );
  });

  it('isAccountSuspended returns true for suspended accounts', async () => {
    mockStore['rl:suspended:user-3'] = { value: 'suspended' };
    expect(await service.isAccountSuspended('user-3')).toBe(true);
  });

  it('isAccountSuspended returns false for non-suspended accounts', async () => {
    expect(await service.isAccountSuspended('user-clean')).toBe(false);
  });

  it('logs violation to audit service (Req 31.8)', async () => {
    const { auditService } = require('../audit/auditService');
    await service.recordViolation('user-audit', '192.168.1.1');
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-audit',
        action: 'RATE_LIMIT_VIOLATION',
        resourceType: 'security',
        ipAddress: '192.168.1.1',
        result: 'FAILURE',
      })
    );
  });

  it('logs account suspension to audit service (Req 31.8)', async () => {
    const { auditService } = require('../audit/auditService');
    await service.suspendAccount('user-log', 'Exceeded violations');
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-log',
        action: 'ACCOUNT_SUSPENDED',
        resourceType: 'security',
      })
    );
  });

  it('clearViolations removes both violation and suspension records', async () => {
    mockStore['rl:violations:user-clear'] = { value: '5' };
    mockStore['rl:suspended:user-clear'] = { value: 'reason' };
    await service.clearViolations('user-clear');
    expect(mockStore['rl:violations:user-clear']).toBeUndefined();
    expect(mockStore['rl:suspended:user-clear']).toBeUndefined();
  });

  it('returns safe defaults when Redis is unavailable', async () => {
    mockClient.incr.mockRejectedValueOnce(new Error('Redis down'));
    const result = await service.recordViolation('user-err', '1.2.3.4');
    expect(result).toEqual({ violationCount: 0, suspended: false, backoffSeconds: 0 });
  });
});
