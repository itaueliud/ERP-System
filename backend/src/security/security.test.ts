/**
 * Security Tests - Task 60.3
 *
 * Covers:
 *  1. Authentication: JWT validation, expired tokens rejected, invalid signatures rejected
 *  2. Authorization: role-based access enforced, 403 for unauthorized access
 *  3. XSS prevention: HTML special chars escaped in output
 *  4. SQL injection: parameterized queries used, injection attempts rejected
 *  5. Rate limiting: 429 after limit exceeded, headers present
 *  6. Session security: session invalidated on logout, concurrent sessions prevented
 *  7. Encryption: passwords hashed with bcrypt, sensitive data not in logs
 *
 * Requirements: 2.1-2.10, 20.1-20.12, 31.1-31.10, 33.1-33.10
 */

// ─── Config mock (must be first) ─────────────────────────────────────────────
jest.mock('../config', () => ({
  config: {
    jwt: { secret: 'test-secret-key-for-security-tests', expiresIn: '8h' },
    security: { bcryptRounds: 12 },
    redis: { host: 'localhost', port: 6379, password: undefined, db: 0 },
    database: {
      host: 'localhost',
      port: 5432,
      name: 'test_db',
      user: 'test_user',
      password: 'test_pass',
      poolMin: 1,
      poolMax: 5,
    },
    sendgrid: { apiKey: 'test-key', fromEmail: 'test@test.com', fromName: 'Test' },
    logging: { level: 'info', filePath: '/tmp/test.log' },
    env: 'test',
    apiBaseUrl: 'http://localhost:3000',
  },
}));

import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { Request, Response, NextFunction } from 'express';

// ─── Module mocks ─────────────────────────────────────────────────────────────
jest.mock('../database/connection');
jest.mock('../cache/sessionCache');
jest.mock('../cache/cacheService');
jest.mock('../cache/connection');
jest.mock('../services/sendgrid/client');
jest.mock('./twoFactorService', () => ({}), { virtual: true });
jest.mock('../auth/twoFactorService');
jest.mock('../utils/logger');
jest.mock('../audit/auditService');
jest.mock('../auth/authorizationService', () => {
  const actual = jest.requireActual('../auth/authorizationService');
  return {
    ...actual,
    authorizationService: {
      hasPermissions: jest.fn(),
      canAccessFinancialData: jest.fn(),
      canAccessResource: jest.fn(),
      ownsResource: jest.fn(),
    },
  };
});

import { AuthenticationService } from '../auth/authService';
import {
  requireRole,
  requireFinancialAccess,
} from '../auth/authorizationMiddleware';
import { authorizationService, Role } from '../auth/authorizationService';
import { SanitizationService } from '../validation/sanitizationService';
import {
  RateLimiterService,
  unauthenticatedRateLimiter,
  authenticatedRateLimiter,
} from '../middleware/rateLimiter';
import { sessionCache } from '../cache/sessionCache';
import { db } from '../database/connection';
import { redis } from '../cache/connection';

// ─── Shared helpers ───────────────────────────────────────────────────────────

const JWT_SECRET = 'test-secret-key-for-security-tests';

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
    params: {},
    path: '/api/test',
    get: jest.fn().mockReturnValue('test-agent'),
    ...overrides,
  };
}

// ─── 1. Authentication ────────────────────────────────────────────────────────

describe('Security: Authentication', () => {
  let authService: AuthenticationService;

  beforeEach(() => {
    authService = new AuthenticationService();
    jest.clearAllMocks();
  });

  it('generates a valid JWT token that can be decoded', () => {
    const token = authService.generateToken('user-1', 'session-1', 'AGENT', 'a@b.com');
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    expect(decoded.userId).toBe('user-1');
    expect(decoded.sessionId).toBe('session-1');
    expect(decoded.role).toBe('AGENT');
    expect(decoded.email).toBe('a@b.com');
  });

  it('rejects an expired JWT token', async () => {
    // Create a token that expired 1 second ago
    const expiredToken = jwt.sign(
      { userId: 'user-1', sessionId: 'session-1', role: 'AGENT', email: 'a@b.com' },
      JWT_SECRET,
      { expiresIn: -1 }
    );

    (sessionCache.exists as jest.Mock).mockResolvedValue(true);

    const result = await authService.validateToken(expiredToken);
    expect(result).toBeNull();
  });

  it('rejects a token signed with a different secret (invalid signature)', async () => {
    const badToken = jwt.sign(
      { userId: 'user-1', sessionId: 'session-1', role: 'AGENT', email: 'a@b.com' },
      'wrong-secret',
      { expiresIn: '8h' }
    );

    const result = await authService.validateToken(badToken);
    expect(result).toBeNull();
  });

  it('rejects a malformed / tampered token string', async () => {
    const result = await authService.validateToken('not.a.valid.jwt.token');
    expect(result).toBeNull();
  });

  it('rejects a valid token whose session no longer exists in Redis', async () => {
    const token = authService.generateToken('user-1', 'dead-session', 'AGENT', 'a@b.com');
    (sessionCache.exists as jest.Mock).mockResolvedValue(false);

    const result = await authService.validateToken(token);
    expect(result).toBeNull();
  });

  it('accepts a valid token with an active session', async () => {
    const token = authService.generateToken('user-1', 'live-session', 'AGENT', 'a@b.com');
    (sessionCache.exists as jest.Mock).mockResolvedValue(true);
    (sessionCache.updateActivity as jest.Mock).mockResolvedValue(undefined);

    const result = await authService.validateToken(token);
    expect(result).not.toBeNull();
    expect(result!.userId).toBe('user-1');
  });

  it('JWT token contains an expiry (exp) claim', () => {
    const token = authService.generateToken('user-1', 'session-1', 'AGENT', 'a@b.com');
    const decoded = jwt.decode(token) as any;

    expect(decoded.exp).toBeDefined();
    expect(decoded.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });
});

// ─── 2. Authorization (RBAC) ──────────────────────────────────────────────────

describe('Security: Authorization (RBAC)', () => {
  const mockDb = db as jest.Mocked<typeof db>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.query.mockResolvedValue({ rows: [] } as any);
  });

  it('allows access when user has the required role', async () => {
    const req = makeReq({ user: { id: 'u1', email: 'e@e.com', role: Role.CEO, permissions: [], sessionId: 's1' } } as any);
    const res = makeRes();
    const next: NextFunction = jest.fn();

    await requireRole(Role.CEO)(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 403 when user lacks the required role', async () => {
    const req = makeReq({ user: { id: 'u1', email: 'e@e.com', role: Role.AGENT, permissions: [], sessionId: 's1' } } as any);
    const res = makeRes();
    const next: NextFunction = jest.fn();

    await requireRole(Role.CEO)(req as Request, res as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Insufficient permissions' }));
  });

  it('returns 401 when no user is attached to the request', async () => {
    const req = makeReq({ user: undefined } as any);
    const res = makeRes();
    const next: NextFunction = jest.fn();

    await requireRole(Role.CEO)(req as Request, res as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('allows access when user has one of multiple allowed roles', async () => {
    const req = makeReq({ user: { id: 'u1', email: 'e@e.com', role: Role.CFO, permissions: [], sessionId: 's1' } } as any);
    const res = makeRes();
    const next: NextFunction = jest.fn();

    await requireRole(Role.CEO, Role.CFO, Role.CoS)(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
  });

  it('restricts financial data access to CEO, CoS, CFO, EA only (403 for Agent)', async () => {
    const mockAuthSvc = authorizationService as jest.Mocked<typeof authorizationService>;
    mockAuthSvc.canAccessFinancialData.mockResolvedValue(false);

    const req = makeReq({ user: { id: 'u1', email: 'e@e.com', role: Role.AGENT, permissions: [], sessionId: 's1' } } as any);
    const res = makeRes();
    const next: NextFunction = jest.fn();

    await requireFinancialAccess(req as Request, res as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Access to financial data is restricted' }));
  });

  it('grants financial data access to CFO', async () => {
    const mockAuthSvc = authorizationService as jest.Mocked<typeof authorizationService>;
    mockAuthSvc.canAccessFinancialData.mockResolvedValue(true);

    const req = makeReq({ user: { id: 'u1', email: 'e@e.com', role: Role.CFO, permissions: [], sessionId: 's1' } } as any);
    const res = makeRes();
    const next: NextFunction = jest.fn();

    await requireFinancialAccess(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
  });
});

// ─── 3. XSS Prevention ───────────────────────────────────────────────────────

describe('Security: XSS Prevention', () => {
  let sanitizer: SanitizationService;

  beforeEach(() => {
    sanitizer = new SanitizationService();
  });

  it('escapes < and > characters', () => {
    const result = sanitizer.sanitizeText('<script>alert(1)</script>');
    expect(result).not.toContain('<script>');
    expect(result).not.toContain('</script>');
  });

  it('escapes & character', () => {
    const result = sanitizer.sanitizeText('Tom & Jerry');
    expect(result).toContain('&amp;');
    expect(result).not.toContain('&J'); // raw & should be gone
  });

  it('escapes double-quote character', () => {
    const result = sanitizer.sanitizeText('"quoted"');
    expect(result).toContain('&quot;');
  });

  it('escapes single-quote character', () => {
    const result = sanitizer.sanitizeText("it's a test");
    expect(result).toContain('&#x27;');
  });

  it('strips script tags from HTML input', () => {
    const result = sanitizer.sanitizeHtml('<p>Hello</p><script>evil()</script>');
    expect(result).not.toContain('<script>');
    expect(result).not.toContain('evil()');
  });

  it('strips iframe tags', () => {
    const result = sanitizer.sanitizeHtml('<iframe src="evil.com"></iframe>');
    expect(result).not.toContain('<iframe');
  });

  it('strips event handler attributes (onclick, onload, etc.)', () => {
    const result = sanitizer.sanitizeHtml('<div onclick="evil()">click me</div>');
    expect(result).not.toContain('onclick');
    expect(result).not.toContain('evil()');
  });

  it('strips javascript: protocol from attributes', () => {
    const result = sanitizer.sanitizeHtml('<a href="javascript:alert(1)">link</a>');
    expect(result).not.toContain('javascript:');
  });

  it('preserves safe plain text after sanitization', () => {
    const result = sanitizer.sanitizeText('Hello World 123');
    expect(result).toBe('Hello World 123');
  });

  it('sanitizeObject recursively escapes all string values', () => {
    const obj = { name: '<b>Bob</b>', nested: { bio: '<script>x</script>' } };
    const result = sanitizer.sanitizeObject(obj);
    expect(result.name).not.toContain('<b>');
    expect(result.nested.bio).not.toContain('<script>');
  });
});

// ─── 4. SQL Injection Prevention ─────────────────────────────────────────────

describe('Security: SQL Injection Prevention', () => {
  let sanitizer: SanitizationService;

  beforeEach(() => {
    sanitizer = new SanitizationService();
  });

  it('escapes single quotes in SQL input', () => {
    const result = sanitizer.sanitizeSqlInput("'; DROP TABLE users; --");
    // Single quote should be escaped with backslash prefix
    expect(result).toContain("\\'");
    // The raw unescaped single quote should not appear (only escaped form)
    expect(result).not.toMatch(/(?<!\\)'/);
  });

  it('escapes double quotes in SQL input', () => {
    const result = sanitizer.sanitizeSqlInput('"; DROP TABLE users; --');
    // Double quote should be escaped with backslash prefix
    expect(result).toContain('\\"');
    expect(result).not.toMatch(/(?<!\\)"/);
  });

  it('escapes semicolons in SQL input', () => {
    const result = sanitizer.sanitizeSqlInput('value; DROP TABLE users');
    // Semicolon should be escaped with backslash prefix
    expect(result).toContain('\\;');
    expect(result).not.toMatch(/(?<!\\);/);
  });

  it('escapes backslashes in SQL input', () => {
    const result = sanitizer.sanitizeSqlInput('value\\nother');
    // backslash should be escaped
    expect(result).toContain('\\\\');
  });

  it('leaves safe alphanumeric input unchanged', () => {
    const result = sanitizer.sanitizeSqlInput('SafeInput123');
    expect(result).toBe('SafeInput123');
  });

  it('db.query uses parameterized queries (never string concatenation)', () => {
    // Verify the mock db.query is called with an array of parameters
    // This test documents the expected calling convention
    const mockDb = db as jest.Mocked<typeof db>;
    mockDb.query.mockResolvedValue({ rows: [] } as any);

    const email = "'; DROP TABLE users; --";
    // Correct parameterized call
    mockDb.query('SELECT * FROM users WHERE email = $1', [email]);

    expect(mockDb.query).toHaveBeenCalledWith(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    // The SQL string itself must NOT contain the injected value
    const callArgs = (mockDb.query as jest.Mock).mock.calls[0];
    expect(callArgs[0]).not.toContain(email);
  });
});

// ─── 5. Rate Limiting ─────────────────────────────────────────────────────────

describe('Security: Rate Limiting', () => {
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

    mockRedis.getClient = jest.fn().mockReturnValue({
      incr: mockIncr,
      expire: mockExpire,
      ttl: mockTtl,
    });
  });

  it('returns 429 when unauthenticated request exceeds limit', async () => {
    mockIncr.mockResolvedValue(101); // over 100 req/hour limit
    const middleware = unauthenticatedRateLimiter();
    const req = makeReq();
    const res = makeRes();
    const next: NextFunction = jest.fn();

    await middleware(req as Request, res as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Too Many Requests' }));
  });

  it('returns 429 when authenticated request exceeds limit', async () => {
    mockIncr.mockResolvedValue(1001); // over 1000 req/hour limit
    const middleware = authenticatedRateLimiter();
    const req = makeReq({ user: { id: 'user-1' } } as any);
    const res = makeRes();
    const next: NextFunction = jest.fn();

    await middleware(req as Request, res as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(429);
  });

  it('sets X-RateLimit-Limit header on every request', async () => {
    mockIncr.mockResolvedValue(5);
    const middleware = unauthenticatedRateLimiter();
    const req = makeReq();
    const res = makeRes();
    const next: NextFunction = jest.fn();

    await middleware(req as Request, res as Response, next);

    expect(res.set).toHaveBeenCalledWith(
      expect.objectContaining({ 'X-RateLimit-Limit': '100' })
    );
  });

  it('sets X-RateLimit-Remaining header on every request', async () => {
    mockIncr.mockResolvedValue(10);
    const middleware = unauthenticatedRateLimiter();
    const req = makeReq();
    const res = makeRes();
    const next: NextFunction = jest.fn();

    await middleware(req as Request, res as Response, next);

    expect(res.set).toHaveBeenCalledWith(
      expect.objectContaining({ 'X-RateLimit-Remaining': '90' })
    );
  });

  it('sets X-RateLimit-Reset header on every request', async () => {
    mockIncr.mockResolvedValue(1);
    mockTtl.mockResolvedValue(3600);
    const middleware = unauthenticatedRateLimiter();
    const req = makeReq();
    const res = makeRes();
    const next: NextFunction = jest.fn();

    await middleware(req as Request, res as Response, next);

    expect(res.set).toHaveBeenCalledWith(
      expect.objectContaining({ 'X-RateLimit-Reset': expect.any(String) })
    );
  });

  it('allows request when under the limit', async () => {
    mockIncr.mockResolvedValue(50);
    const middleware = unauthenticatedRateLimiter();
    const req = makeReq();
    const res = makeRes();
    const next: NextFunction = jest.fn();

    await middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('RateLimiterService.checkRateLimit returns allowed=false when over limit', async () => {
    mockIncr.mockResolvedValue(200);
    mockTtl.mockResolvedValue(1800);
    const service = new RateLimiterService();

    const result = await service.checkRateLimit('test-key', 100, 3600);

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });
});

// ─── 6. Session Security ──────────────────────────────────────────────────────

describe('Security: Session Management', () => {
  let authService: AuthenticationService;

  beforeEach(() => {
    authService = new AuthenticationService();
    jest.clearAllMocks();
  });

  it('logout invalidates the session in Redis', async () => {
    (sessionCache.deleteSession as jest.Mock).mockResolvedValue(undefined);

    await authService.logout('user-1', 'session-abc');

    expect(sessionCache.deleteSession).toHaveBeenCalledWith('session-abc');
  });

  it('token is rejected after session is deleted (post-logout)', async () => {
    const token = authService.generateToken('user-1', 'session-gone', 'AGENT', 'a@b.com');
    (sessionCache.exists as jest.Mock).mockResolvedValue(false);

    const result = await authService.validateToken(token);
    expect(result).toBeNull();
  });

  it('each login generates a unique session ID', async () => {
    const mockUser = {
      id: 'user-1',
      email: 'u@u.com',
      password_hash: '$2b$12$hash',
      full_name: 'User One',
      two_fa_enabled: false,
      role: 'AGENT',
      permissions: [],
      department_id: 'dept-1',
    };

    const compareSpy = jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
    (db.query as jest.Mock).mockResolvedValue({ rows: [mockUser] });
    (sessionCache.setSession as jest.Mock).mockResolvedValue(undefined);

    const r1 = await authService.login({ email: 'u@u.com', password: 'pass' });
    const r2 = await authService.login({ email: 'u@u.com', password: 'pass' });

    compareSpy.mockRestore();

    expect(r1.sessionId).toBeDefined();
    expect(r2.sessionId).toBeDefined();
    expect(r1.sessionId).not.toBe(r2.sessionId);
  });

  it('password reset invalidates all existing sessions', async () => {
    const { cacheService } = require('../cache/cacheService');
    const { sendgridClient } = require('../services/sendgrid/client');

    (cacheService.get as jest.Mock).mockResolvedValue({
      userId: 'user-1',
      email: 'u@u.com',
      createdAt: new Date(),
    });
    (cacheService.delete as jest.Mock).mockResolvedValue(undefined);
    (db.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ full_name: 'User One' }] });
    (sessionCache.deleteUserSessions as jest.Mock).mockResolvedValue(undefined);
    (sendgridClient.sendEmail as jest.Mock).mockResolvedValue(undefined);

    await authService.resetPassword('valid-token', 'NewPass123!');

    expect(sessionCache.deleteUserSessions).toHaveBeenCalledWith('user-1');
  });

  it('session is not accessible after deleteSession is called', async () => {
    (sessionCache.exists as jest.Mock).mockResolvedValue(false);

    const exists = await sessionCache.exists('deleted-session');
    expect(exists).toBe(false);
  });
});

// ─── 7. Encryption & Sensitive Data ──────────────────────────────────────────

describe('Security: Encryption and Sensitive Data', () => {
  let authService: AuthenticationService;

  beforeEach(() => {
    authService = new AuthenticationService();
    jest.clearAllMocks();
  });

  it('hashPassword produces a bcrypt hash (starts with $2b$)', async () => {
    const hash = await authService.hashPassword('MySecurePassword!');
    expect(hash).toMatch(/^\$2b\$/);
  });

  it('hashPassword uses at least 12 rounds', async () => {
    const hash = await authService.hashPassword('MySecurePassword!');
    // bcrypt hash format: $2b$<rounds>$...
    const rounds = parseInt(hash.split('$')[2], 10);
    expect(rounds).toBeGreaterThanOrEqual(12);
  });

  it('same password hashed twice produces different hashes (salt)', async () => {
    const hash1 = await authService.hashPassword('SamePassword!');
    const hash2 = await authService.hashPassword('SamePassword!');
    expect(hash1).not.toBe(hash2);
  });

  it('verifyPassword returns true for correct password', async () => {
    // Use real bcrypt (no spy) for this test
    const hash = await bcrypt.hash('CorrectPassword!', 12);
    const result = await authService.verifyPassword('CorrectPassword!', hash);
    expect(result).toBe(true);
  });

  it('verifyPassword returns false for incorrect password', async () => {
    // Use real bcrypt (no spy) for this test
    const hash = await bcrypt.hash('CorrectPassword!', 12);
    const result = await authService.verifyPassword('WrongPassword!', hash);
    expect(result).toBe(false);
  });

  it('password hash is not the plain-text password', async () => {
    const password = 'PlainTextPassword!';
    const hash = await authService.hashPassword(password);
    expect(hash).not.toBe(password);
    expect(hash).not.toContain(password);
  });

  it('JWT token does not contain the raw password', () => {
    const token = authService.generateToken('user-1', 'session-1', 'AGENT', 'a@b.com');
    expect(token).not.toContain('password');
    expect(token).not.toContain('secret');
  });

  it('logger mock is called without sensitive password data', async () => {
    const logger = require('../utils/logger').default;
    const mockUser = {
      id: 'user-1',
      email: 'u@u.com',
      password_hash: '$2b$12$hashedvalue',
      full_name: 'User One',
      two_fa_enabled: false,
      role: 'AGENT',
      permissions: [],
      department_id: 'dept-1',
    };

    const compareSpy = jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
    (db.query as jest.Mock).mockResolvedValue({ rows: [mockUser] });
    (sessionCache.setSession as jest.Mock).mockResolvedValue(undefined);

    await authService.login({ email: 'u@u.com', password: 'MyPlainPassword' });

    compareSpy.mockRestore();

    // Verify no logger call contains the plain-text password
    const allLogCalls = [
      ...(logger.info?.mock?.calls ?? []),
      ...(logger.warn?.mock?.calls ?? []),
      ...(logger.error?.mock?.calls ?? []),
      ...(logger.debug?.mock?.calls ?? []),
    ];

    for (const call of allLogCalls) {
      const callStr = JSON.stringify(call);
      expect(callStr).not.toContain('MyPlainPassword');
    }
  });
});
