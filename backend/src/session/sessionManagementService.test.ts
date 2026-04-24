/**
 * Unit tests for SessionManagementService
 * Requirements: 33.1-33.5
 */

// ---------------------------------------------------------------------------
// Mock Redis connection before any imports
// ---------------------------------------------------------------------------

const mockSetEx = jest.fn();
const mockGet = jest.fn();
const mockDel = jest.fn();
const mockTtl = jest.fn();

jest.mock('../cache/connection', () => ({
  redis: {
    getClient: () => ({
      setEx: mockSetEx,
      get: mockGet,
      del: mockDel,
      ttl: mockTtl,
    }),
  },
}));

jest.mock('../utils/logger', () => ({
  __esModule: true,
  default: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// ---------------------------------------------------------------------------

import {
  SessionManagementService,
  Session,
  SESSION_TIMEOUT_HOURS,
  WARNING_THRESHOLD_MINUTES,
} from './sessionManagementService';

const SESSION_TIMEOUT_SECONDS = SESSION_TIMEOUT_HOURS * 60 * 60;
const WARNING_THRESHOLD_SECONDS = WARNING_THRESHOLD_MINUTES * 60;

function makeSession(overrides: Partial<Session> = {}): Session {
  const now = new Date();
  return {
    id: 'test-session-id',
    userId: 'user-1',
    role: 'AGENT',
    ipAddress: '127.0.0.1',
    createdAt: now,
    expiresAt: new Date(now.getTime() + SESSION_TIMEOUT_SECONDS * 1000),
    lastActivityAt: now,
    ...overrides,
  };
}

describe('SessionManagementService', () => {
  let service: SessionManagementService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SessionManagementService();
  });

  // -------------------------------------------------------------------------
  // createSession
  // -------------------------------------------------------------------------
  describe('createSession', () => {
    it('should create a session with correct fields', async () => {
      mockSetEx.mockResolvedValue('OK');

      const session = await service.createSession('user-1', 'AGENT', '127.0.0.1');

      expect(session.userId).toBe('user-1');
      expect(session.role).toBe('AGENT');
      expect(session.ipAddress).toBe('127.0.0.1');
      expect(session.id).toBeDefined();
      expect(session.createdAt).toBeInstanceOf(Date);
      expect(session.expiresAt).toBeInstanceOf(Date);
      expect(session.lastActivityAt).toBeInstanceOf(Date);
    });

    it('should set expiry 8 hours from creation (Requirement 33.1)', async () => {
      mockSetEx.mockResolvedValue('OK');

      const before = Date.now();
      const session = await service.createSession('user-1', 'AGENT', '127.0.0.1');
      const after = Date.now();

      const expectedMs = SESSION_TIMEOUT_HOURS * 60 * 60 * 1000;
      expect(session.expiresAt.getTime()).toBeGreaterThanOrEqual(before + expectedMs - 1000);
      expect(session.expiresAt.getTime()).toBeLessThanOrEqual(after + expectedMs + 1000);
    });

    it('should store session in Redis with 8-hour TTL', async () => {
      mockSetEx.mockResolvedValue('OK');

      const session = await service.createSession('user-1', 'AGENT', '127.0.0.1');

      expect(mockSetEx).toHaveBeenCalledWith(
        `session_mgmt:${session.id}`,
        SESSION_TIMEOUT_SECONDS,
        expect.any(String)
      );
    });

    it('should generate unique session IDs', async () => {
      mockSetEx.mockResolvedValue('OK');

      const s1 = await service.createSession('user-1', 'AGENT', '127.0.0.1');
      const s2 = await service.createSession('user-1', 'AGENT', '127.0.0.1');

      expect(s1.id).not.toBe(s2.id);
    });
  });

  // -------------------------------------------------------------------------
  // getSession
  // -------------------------------------------------------------------------
  describe('getSession', () => {
    it('should retrieve and deserialize an existing session', async () => {
      const stored = makeSession();
      mockGet.mockResolvedValue(JSON.stringify(stored));

      const result = await service.getSession('test-session-id');

      expect(result).not.toBeNull();
      expect(result!.id).toBe(stored.id);
      expect(result!.userId).toBe(stored.userId);
      expect(result!.createdAt).toBeInstanceOf(Date);
      expect(result!.expiresAt).toBeInstanceOf(Date);
      expect(result!.lastActivityAt).toBeInstanceOf(Date);
    });

    it('should return null for a non-existent session', async () => {
      mockGet.mockResolvedValue(null);

      const result = await service.getSession('missing-id');
      expect(result).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // refreshSession
  // -------------------------------------------------------------------------
  describe('refreshSession', () => {
    it('should extend session expiry by 8 hours from now (Requirement 33.3)', async () => {
      const original = makeSession();
      mockGet.mockResolvedValue(JSON.stringify(original));
      mockSetEx.mockResolvedValue('OK');

      const before = Date.now();
      const refreshed = await service.refreshSession('test-session-id');
      const after = Date.now();

      const expectedMs = SESSION_TIMEOUT_HOURS * 60 * 60 * 1000;
      expect(refreshed.expiresAt.getTime()).toBeGreaterThanOrEqual(before + expectedMs - 1000);
      expect(refreshed.expiresAt.getTime()).toBeLessThanOrEqual(after + expectedMs + 1000);
    });

    it('should update lastActivityAt on refresh', async () => {
      const original = makeSession({
        lastActivityAt: new Date(Date.now() - 60_000),
      });
      mockGet.mockResolvedValue(JSON.stringify(original));
      mockSetEx.mockResolvedValue('OK');

      const before = Date.now();
      const refreshed = await service.refreshSession('test-session-id');

      expect(refreshed.lastActivityAt.getTime()).toBeGreaterThanOrEqual(before - 100);
    });

    it('should persist the refreshed session with 8-hour TTL', async () => {
      const original = makeSession();
      mockGet.mockResolvedValue(JSON.stringify(original));
      mockSetEx.mockResolvedValue('OK');

      await service.refreshSession('test-session-id');

      expect(mockSetEx).toHaveBeenCalledWith(
        'session_mgmt:test-session-id',
        SESSION_TIMEOUT_SECONDS,
        expect.any(String)
      );
    });

    it('should throw when session does not exist', async () => {
      mockGet.mockResolvedValue(null);

      await expect(service.refreshSession('ghost-session')).rejects.toThrow(
        'Session not found: ghost-session'
      );
    });
  });

  // -------------------------------------------------------------------------
  // isSessionExpiringSoon
  // -------------------------------------------------------------------------
  describe('isSessionExpiringSoon', () => {
    it('should return false for a session with plenty of time remaining', async () => {
      // TTL well above 5-minute threshold
      mockTtl.mockResolvedValue(SESSION_TIMEOUT_SECONDS);

      const result = await service.isSessionExpiringSoon('test-session-id');
      expect(result).toBe(false);
    });

    it('should return true when TTL is within 5-minute warning threshold (Requirement 33.2)', async () => {
      // TTL of 60 seconds — within the 300-second warning window
      mockTtl.mockResolvedValue(60);

      const result = await service.isSessionExpiringSoon('test-session-id');
      expect(result).toBe(true);
    });

    it('should return true when TTL equals the warning threshold exactly', async () => {
      mockTtl.mockResolvedValue(WARNING_THRESHOLD_SECONDS);

      const result = await service.isSessionExpiringSoon('test-session-id');
      expect(result).toBe(true);
    });

    it('should return false for a non-existent session (TTL = -2)', async () => {
      mockTtl.mockResolvedValue(-2);

      const result = await service.isSessionExpiringSoon('missing-session');
      expect(result).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // getTimeUntilExpiry
  // -------------------------------------------------------------------------
  describe('getTimeUntilExpiry', () => {
    it('should return the TTL in seconds for a valid session', async () => {
      mockTtl.mockResolvedValue(3600);

      const ttl = await service.getTimeUntilExpiry('test-session-id');
      expect(ttl).toBe(3600);
    });

    it('should return 0 when session does not exist (TTL = -2)', async () => {
      mockTtl.mockResolvedValue(-2);

      const ttl = await service.getTimeUntilExpiry('missing-session');
      expect(ttl).toBe(0);
    });

    it('should return 0 when key has no TTL set (TTL = -1)', async () => {
      mockTtl.mockResolvedValue(-1);

      const ttl = await service.getTimeUntilExpiry('no-ttl-session');
      expect(ttl).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // invalidateSession
  // -------------------------------------------------------------------------
  describe('invalidateSession', () => {
    it('should delete the session key from Redis (Requirement 33.4)', async () => {
      mockDel.mockResolvedValue(1);

      await service.invalidateSession('test-session-id');

      expect(mockDel).toHaveBeenCalledWith('session_mgmt:test-session-id');
    });

    it('should also delete the redirect URL key', async () => {
      mockDel.mockResolvedValue(1);

      await service.invalidateSession('test-session-id');

      expect(mockDel).toHaveBeenCalledWith('session_redirect:test-session-id');
    });

    it('should not throw when invalidating a non-existent session', async () => {
      mockDel.mockResolvedValue(0);

      await expect(service.invalidateSession('ghost')).resolves.not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // getRedirectUrl / setRedirectUrl
  // -------------------------------------------------------------------------
  describe('getRedirectUrl and setRedirectUrl', () => {
    it('should store a redirect URL with session TTL (Requirement 33.5)', async () => {
      mockSetEx.mockResolvedValue('OK');

      await service.setRedirectUrl('test-session-id', '/dashboard/clients');

      expect(mockSetEx).toHaveBeenCalledWith(
        'session_redirect:test-session-id',
        SESSION_TIMEOUT_SECONDS,
        '/dashboard/clients'
      );
    });

    it('should retrieve a stored redirect URL', async () => {
      mockGet.mockResolvedValue('/projects/123/details');

      const url = await service.getRedirectUrl('test-session-id');
      expect(url).toBe('/projects/123/details');
    });

    it('should return null when no redirect URL is stored', async () => {
      mockGet.mockResolvedValue(null);

      const url = await service.getRedirectUrl('test-session-id');
      expect(url).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Constants
  // -------------------------------------------------------------------------
  describe('constants', () => {
    it('SESSION_TIMEOUT_HOURS should be 8 (Requirement 33.1)', () => {
      expect(SESSION_TIMEOUT_HOURS).toBe(8);
    });

    it('WARNING_THRESHOLD_MINUTES should be 5 (Requirement 33.2)', () => {
      expect(WARNING_THRESHOLD_MINUTES).toBe(5);
    });
  });
});
