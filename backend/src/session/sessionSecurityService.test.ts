// Mock config and logger before any imports that trigger them
jest.mock('../config', () => ({
  config: {
    redis: { host: 'localhost', port: 6379, password: undefined, db: 0 },
    database: { url: 'postgres://localhost/test' },
    jwt: { secret: 'test-secret', expiresIn: '8h' },
    server: { port: 3000, nodeEnv: 'test' },
  },
}));

jest.mock('../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { SessionSecurityService } from './sessionSecurityService';
import { sessionManagementService } from './sessionManagementService';
import { auditService } from '../audit/auditService';

// Mock dependencies
jest.mock('./sessionManagementService', () => ({
  sessionManagementService: {
    createSession: jest.fn(),
    getSession: jest.fn(),
    invalidateSession: jest.fn(),
  },
}));

jest.mock('../audit/auditService', () => ({
  auditService: { log: jest.fn() },
  AuditAction: { LOGIN: 'LOGIN', LOGOUT: 'LOGOUT' },
  AuditResult: { SUCCESS: 'SUCCESS', FAILURE: 'FAILURE' },
}));

jest.mock('../cache/connection', () => ({
  redis: {
    getClient: jest.fn(),
  },
}));

import { redis } from '../cache/connection';

const mockRedisClient = {
  sAdd: jest.fn(),
  sRem: jest.fn(),
  sMembers: jest.fn(),
  del: jest.fn(),
};

const mockSession = {
  id: 'session-1',
  userId: 'user-1',
  role: 'Agent',
  ipAddress: '127.0.0.1',
  createdAt: new Date(),
  expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
  lastActivityAt: new Date(),
};

beforeEach(() => {
  jest.clearAllMocks();
  (redis.getClient as jest.Mock).mockReturnValue(mockRedisClient);
  mockRedisClient.sAdd.mockResolvedValue(1);
  mockRedisClient.sRem.mockResolvedValue(1);
  mockRedisClient.sMembers.mockResolvedValue([]);
  mockRedisClient.del.mockResolvedValue(1);
});

describe('SessionSecurityService', () => {
  let service: SessionSecurityService;

  beforeEach(() => {
    service = new SessionSecurityService();
  });

  // -------------------------------------------------------------------------
  // logout
  // -------------------------------------------------------------------------
  describe('logout', () => {
    it('invalidates the session and removes it from the user tracking set', async () => {
      (sessionManagementService.invalidateSession as jest.Mock).mockResolvedValue(undefined);

      await service.logout('session-1', 'user-1');

      expect(sessionManagementService.invalidateSession).toHaveBeenCalledWith('session-1');
      expect(mockRedisClient.sRem).toHaveBeenCalledWith('user_sessions:user-1', 'session-1');
    });

    it('logs a LOGOUT audit event on logout', async () => {
      (sessionManagementService.invalidateSession as jest.Mock).mockResolvedValue(undefined);

      await service.logout('session-1', 'user-1');

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          action: 'LOGOUT',
          resourceType: 'session',
          resourceId: 'session-1',
          result: 'SUCCESS',
        })
      );
    });
  });

  // -------------------------------------------------------------------------
  // loginNewDevice
  // -------------------------------------------------------------------------
  describe('loginNewDevice', () => {
    it('terminates existing sessions before creating a new one', async () => {
      mockRedisClient.sMembers.mockResolvedValue(['old-session']);
      (sessionManagementService.invalidateSession as jest.Mock).mockResolvedValue(undefined);
      (sessionManagementService.createSession as jest.Mock).mockResolvedValue(mockSession);

      await service.loginNewDevice('user-1', 'Agent', '10.0.0.1');

      expect(sessionManagementService.invalidateSession).toHaveBeenCalledWith('old-session');
      expect(sessionManagementService.createSession).toHaveBeenCalledWith(
        'user-1',
        'Agent',
        '10.0.0.1'
      );
    });

    it('returns the newly created session', async () => {
      mockRedisClient.sMembers.mockResolvedValue([]);
      (sessionManagementService.createSession as jest.Mock).mockResolvedValue(mockSession);

      const result = await service.loginNewDevice('user-1', 'Agent', '10.0.0.1');

      expect(result).toEqual(mockSession);
    });

    it('tracks the new session under the user', async () => {
      mockRedisClient.sMembers.mockResolvedValue([]);
      (sessionManagementService.createSession as jest.Mock).mockResolvedValue(mockSession);

      await service.loginNewDevice('user-1', 'Agent', '10.0.0.1');

      expect(mockRedisClient.sAdd).toHaveBeenCalledWith('user_sessions:user-1', 'session-1');
    });

    it('logs a LOGIN audit event', async () => {
      mockRedisClient.sMembers.mockResolvedValue([]);
      (sessionManagementService.createSession as jest.Mock).mockResolvedValue(mockSession);

      await service.loginNewDevice('user-1', 'Agent', '10.0.0.1');

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          action: 'LOGIN',
          resourceType: 'session',
          result: 'SUCCESS',
        })
      );
    });
  });

  // -------------------------------------------------------------------------
  // getUserActiveSessions
  // -------------------------------------------------------------------------
  describe('getUserActiveSessions', () => {
    it('returns active sessions for a user', async () => {
      mockRedisClient.sMembers.mockResolvedValue(['session-1', 'session-2']);
      (sessionManagementService.getSession as jest.Mock).mockResolvedValue(mockSession);

      const sessions = await service.getUserActiveSessions('user-1');

      expect(sessions).toHaveLength(2);
    });

    it('cleans up expired sessions from the tracking set', async () => {
      mockRedisClient.sMembers.mockResolvedValue(['expired-session', 'session-1']);
      (sessionManagementService.getSession as jest.Mock)
        .mockResolvedValueOnce(null) // expired
        .mockResolvedValueOnce(mockSession);

      const sessions = await service.getUserActiveSessions('user-1');

      expect(mockRedisClient.sRem).toHaveBeenCalledWith('user_sessions:user-1', 'expired-session');
      expect(sessions).toHaveLength(1);
    });

    it('returns empty array when user has no sessions', async () => {
      mockRedisClient.sMembers.mockResolvedValue([]);

      const sessions = await service.getUserActiveSessions('user-1');

      expect(sessions).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // terminateAllUserSessions
  // -------------------------------------------------------------------------
  describe('terminateAllUserSessions', () => {
    it('invalidates all sessions and returns the count', async () => {
      mockRedisClient.sMembers.mockResolvedValue(['s1', 's2', 's3']);
      (sessionManagementService.invalidateSession as jest.Mock).mockResolvedValue(undefined);

      const count = await service.terminateAllUserSessions('user-1', 'admin_action');

      expect(count).toBe(3);
      expect(sessionManagementService.invalidateSession).toHaveBeenCalledTimes(3);
    });

    it('deletes the user sessions tracking key', async () => {
      mockRedisClient.sMembers.mockResolvedValue(['s1']);
      (sessionManagementService.invalidateSession as jest.Mock).mockResolvedValue(undefined);

      await service.terminateAllUserSessions('user-1', 'admin_action');

      expect(mockRedisClient.del).toHaveBeenCalledWith('user_sessions:user-1');
    });

    it('logs a LOGOUT audit event for each terminated session', async () => {
      mockRedisClient.sMembers.mockResolvedValue(['s1', 's2']);
      (sessionManagementService.invalidateSession as jest.Mock).mockResolvedValue(undefined);

      await service.terminateAllUserSessions('user-1', 'admin_action');

      expect(auditService.log).toHaveBeenCalledTimes(2);
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'LOGOUT', result: 'SUCCESS' })
      );
    });

    it('returns 0 when user has no active sessions', async () => {
      mockRedisClient.sMembers.mockResolvedValue([]);

      const count = await service.terminateAllUserSessions('user-1', 'admin_action');

      expect(count).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // isSessionValid
  // -------------------------------------------------------------------------
  describe('isSessionValid', () => {
    it('returns true when session exists', async () => {
      (sessionManagementService.getSession as jest.Mock).mockResolvedValue(mockSession);

      const valid = await service.isSessionValid('session-1');

      expect(valid).toBe(true);
    });

    it('returns false when session does not exist or is expired', async () => {
      (sessionManagementService.getSession as jest.Mock).mockResolvedValue(null);

      const valid = await service.isSessionValid('expired-session');

      expect(valid).toBe(false);
    });
  });
});
