import { AuthenticationService } from './authService';
import { db } from '../database/connection';
import { sessionCache } from '../cache/sessionCache';
import { cacheService } from '../cache/cacheService';
import { sendgridClient } from '../services/sendgrid/client';
import { twoFactorService } from './twoFactorService';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// Mock dependencies
jest.mock('../database/connection');
jest.mock('../cache/sessionCache');
jest.mock('../cache/cacheService');
jest.mock('../services/sendgrid/client');
jest.mock('./twoFactorService');
jest.mock('../utils/logger');

describe('AuthenticationService', () => {
  let service: AuthenticationService;

  beforeEach(() => {
    service = new AuthenticationService();
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('should successfully login with valid credentials', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        password_hash: await bcrypt.hash('password123', 12),
        full_name: 'Test User',
        two_fa_enabled: false,
        role: 'AGENT',
        permissions: ['read:clients', 'write:clients'],
        department_id: 'dept-123',
      };

      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [mockUser] });
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] }); // Update last_login
      (sessionCache.setSession as jest.Mock).mockResolvedValue(undefined);

      const result = await service.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.success).toBe(true);
      expect(result.token).toBeDefined();
      expect(result.sessionId).toBeDefined();
      expect(result.user).toMatchObject({
        id: 'user-123',
        email: 'test@example.com',
        fullName: 'Test User',
        role: 'AGENT',
      });
      expect(sessionCache.setSession).toHaveBeenCalled();
    });

    it('should fail login with invalid email', async () => {
      (db.query as jest.Mock).mockResolvedValue({ rows: [] });

      const result = await service.login({
        email: 'nonexistent@example.com',
        password: 'password123',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid email or password');
    });

    it('should fail login with incorrect password', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        password_hash: await bcrypt.hash('correctpassword', 12),
        full_name: 'Test User',
        two_fa_enabled: false,
        role: 'AGENT',
        permissions: [],
      };

      (db.query as jest.Mock).mockResolvedValue({ rows: [mockUser] });

      const result = await service.login({
        email: 'test@example.com',
        password: 'wrongpassword',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid email or password');
    });

    it('should require 2FA when enabled', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        password_hash: await bcrypt.hash('password123', 12),
        full_name: 'Test User',
        two_fa_enabled: true,
        role: 'AGENT',
        permissions: [],
        department_id: 'dept-123',
      };

      (db.query as jest.Mock).mockResolvedValue({ rows: [mockUser] });
      (cacheService.set as jest.Mock).mockResolvedValue(undefined);

      const result = await service.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.success).toBe(false);
      expect(result.requires2FA).toBe(true);
      expect(result.tempUserId).toBe('user-123');

      // Verify temp auth data was stored
      expect(cacheService.set).toHaveBeenCalledWith(
        'temp_auth:user-123',
        expect.objectContaining({
          userId: 'user-123',
          email: 'test@example.com',
        }),
        300
      );
    });
  });

  describe('loginWith2FA', () => {
    it('should complete login with valid 2FA code', async () => {
      const userId = 'user-123';
      const code = '123456';
      const ipAddress = '192.168.1.1';

      const mockTempAuth = {
        userId: 'user-123',
        email: 'test@example.com',
        role: 'AGENT',
        permissions: ['read:clients'],
        fullName: 'Test User',
        departmentId: 'dept-123',
      };

      (cacheService.get as jest.Mock).mockResolvedValue(mockTempAuth);
      (twoFactorService.verify2FA as jest.Mock).mockResolvedValue({ valid: true });
      (cacheService.delete as jest.Mock).mockResolvedValue(undefined);
      (sessionCache.setSession as jest.Mock).mockResolvedValue(undefined);
      (db.query as jest.Mock).mockResolvedValue({ rows: [] });

      const result = await service.loginWith2FA(userId, code, false, ipAddress);

      expect(result.success).toBe(true);
      expect(result.token).toBeDefined();
      expect(result.sessionId).toBeDefined();
      expect(result.user?.id).toBe('user-123');

      // Verify temp auth was deleted
      expect(cacheService.delete).toHaveBeenCalledWith('temp_auth:user-123');

      // Verify 2FA was verified
      expect(twoFactorService.verify2FA).toHaveBeenCalledWith(userId, code, ipAddress);
    });

    it('should complete login with valid backup code', async () => {
      const userId = 'user-123';
      const backupCode = 'ABCD1234';
      const ipAddress = '192.168.1.1';

      const mockTempAuth = {
        userId: 'user-123',
        email: 'test@example.com',
        role: 'AGENT',
        permissions: [],
        fullName: 'Test User',
      };

      (cacheService.get as jest.Mock).mockResolvedValue(mockTempAuth);
      (twoFactorService.verifyBackupCode as jest.Mock).mockResolvedValue({ valid: true });
      (cacheService.delete as jest.Mock).mockResolvedValue(undefined);
      (sessionCache.setSession as jest.Mock).mockResolvedValue(undefined);
      (db.query as jest.Mock).mockResolvedValue({ rows: [] });

      const result = await service.loginWith2FA(userId, backupCode, true, ipAddress);

      expect(result.success).toBe(true);
      expect(twoFactorService.verifyBackupCode).toHaveBeenCalledWith(
        userId,
        backupCode,
        ipAddress
      );
    });

    it('should fail with invalid 2FA code', async () => {
      const userId = 'user-123';
      const code = '000000';
      const ipAddress = '192.168.1.1';

      const mockTempAuth = {
        userId: 'user-123',
        email: 'test@example.com',
        role: 'AGENT',
        permissions: [],
        fullName: 'Test User',
      };

      (cacheService.get as jest.Mock).mockResolvedValue(mockTempAuth);
      (twoFactorService.verify2FA as jest.Mock).mockResolvedValue({
        valid: false,
        error: 'Invalid 2FA code',
      });

      const result = await service.loginWith2FA(userId, code, false, ipAddress);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid 2FA code');
    });

    it('should fail if temp auth session expired', async () => {
      const userId = 'user-123';
      const code = '123456';
      const ipAddress = '192.168.1.1';

      (cacheService.get as jest.Mock).mockResolvedValue(null);

      const result = await service.loginWith2FA(userId, code, false, ipAddress);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Authentication session expired');
    });
  });

  describe('generateToken', () => {
    it('should generate valid JWT token', () => {
      const token = service.generateToken('user-123', 'session-456', 'AGENT', 'test@example.com');

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      // Verify token structure
      const decoded = jwt.decode(token) as any;
      expect(decoded.userId).toBe('user-123');
      expect(decoded.sessionId).toBe('session-456');
      expect(decoded.role).toBe('AGENT');
      expect(decoded.email).toBe('test@example.com');
    });
  });

  describe('validateToken', () => {
    it('should validate valid token with active session', async () => {
      const token = service.generateToken('user-123', 'session-456', 'AGENT', 'test@example.com');

      (sessionCache.exists as jest.Mock).mockResolvedValue(true);
      (sessionCache.updateActivity as jest.Mock).mockResolvedValue(undefined);

      const payload = await service.validateToken(token);

      expect(payload).toBeDefined();
      expect(payload?.userId).toBe('user-123');
      expect(payload?.sessionId).toBe('session-456');
      expect(sessionCache.updateActivity).toHaveBeenCalledWith('session-456');
    });

    it('should reject token with no active session', async () => {
      const token = service.generateToken('user-123', 'session-456', 'AGENT', 'test@example.com');

      (sessionCache.exists as jest.Mock).mockResolvedValue(false);

      const payload = await service.validateToken(token);

      expect(payload).toBeNull();
    });

    it('should reject invalid token', async () => {
      const payload = await service.validateToken('invalid-token');

      expect(payload).toBeNull();
    });
  });

  describe('hashPassword', () => {
    it('should hash password with bcrypt', async () => {
      const password = 'mySecurePassword123';
      const hash = await service.hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(50);

      // Verify it's a valid bcrypt hash
      const isValid = await bcrypt.compare(password, hash);
      expect(isValid).toBe(true);
    });

    it('should generate different hashes for same password', async () => {
      const password = 'mySecurePassword123';
      const hash1 = await service.hashPassword(password);
      const hash2 = await service.hashPassword(password);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verifyPassword', () => {
    it('should verify correct password', async () => {
      const password = 'mySecurePassword123';
      const hash = await bcrypt.hash(password, 12);

      const isValid = await service.verifyPassword(password, hash);

      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'mySecurePassword123';
      const hash = await bcrypt.hash(password, 12);

      const isValid = await service.verifyPassword('wrongPassword', hash);

      expect(isValid).toBe(false);
    });
  });

  describe('logout', () => {
    it('should delete session on logout', async () => {
      (sessionCache.deleteSession as jest.Mock).mockResolvedValue(undefined);

      await service.logout('user-123', 'session-456');

      expect(sessionCache.deleteSession).toHaveBeenCalledWith('session-456');
    });
  });

  describe('requestPasswordReset', () => {
    it('should send reset email for existing user', async () => {
      const mockUser = {
        id: 'user-123',
        full_name: 'Test User',
      };

      (db.query as jest.Mock).mockResolvedValue({ rows: [mockUser] });
      (cacheService.set as jest.Mock).mockResolvedValue(undefined);
      (sendgridClient.sendPasswordResetEmail as jest.Mock).mockResolvedValue(undefined);

      await service.requestPasswordReset('test@example.com');

      expect(sendgridClient.sendPasswordResetEmail).toHaveBeenCalled();
    });

    it('should not reveal if email does not exist', async () => {
      (db.query as jest.Mock).mockResolvedValue({ rows: [] });

      // Should not throw error
      await expect(service.requestPasswordReset('nonexistent@example.com')).resolves.not.toThrow();
    });
  });

  describe('resetPassword', () => {
    it('should reset password with valid token', async () => {
      const token = crypto.randomBytes(32).toString('hex');

      const mockResetData = {
        userId: 'user-123',
        email: 'test@example.com',
        createdAt: new Date(),
      };

      (cacheService.get as jest.Mock).mockResolvedValue(mockResetData);
      (cacheService.delete as jest.Mock).mockResolvedValue(undefined);
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] }); // Update password
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [{ full_name: 'Test User' }] }); // Get user
      (sessionCache.deleteUserSessions as jest.Mock).mockResolvedValue(undefined);
      (sendgridClient.sendEmail as jest.Mock).mockResolvedValue(undefined);

      const result = await service.resetPassword(token, 'newPassword123');

      expect(result).toBe(true);
      expect(sessionCache.deleteUserSessions).toHaveBeenCalledWith('user-123');
    });

    it('should fail with invalid token', async () => {
      (cacheService.get as jest.Mock).mockResolvedValue(null);

      const result = await service.resetPassword('invalid-token', 'newPassword123');

      expect(result).toBe(false);
    });
  });

  describe('getUserById', () => {
    it('should return user profile', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        full_name: 'Test User',
        role: 'AGENT',
        permissions: ['read:clients'],
        department_id: 'dept-123',
      };

      (db.query as jest.Mock).mockResolvedValue({ rows: [mockUser] });

      const user = await service.getUserById('user-123');

      expect(user).toMatchObject({
        id: 'user-123',
        email: 'test@example.com',
        fullName: 'Test User',
        role: 'AGENT',
      });
    });

    it('should return null for non-existent user', async () => {
      (db.query as jest.Mock).mockResolvedValue({ rows: [] });

      const user = await service.getUserById('nonexistent');

      expect(user).toBeNull();
    });
  });

  describe('session management', () => {
    it('should get session data', async () => {
      const mockSession = {
        userId: 'user-123',
        role: 'AGENT',
        email: 'test@example.com',
        permissions: [],
        createdAt: new Date(),
        lastActivity: new Date(),
      };

      (sessionCache.getSession as jest.Mock).mockResolvedValue(mockSession);

      const session = await service.getSession('session-456');

      expect(session).toEqual(mockSession);
    });

    it('should extend session', async () => {
      (sessionCache.extendSession as jest.Mock).mockResolvedValue(undefined);

      await service.extendSession('session-456');

      expect(sessionCache.extendSession).toHaveBeenCalledWith('session-456');
    });
  });
});
