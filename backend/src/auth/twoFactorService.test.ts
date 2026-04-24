import { TwoFactorService } from './twoFactorService';
import { db } from '../database/connection';
import speakeasy from 'speakeasy';

// Mock dependencies
jest.mock('../database/connection');
jest.mock('../utils/logger');

describe('TwoFactorService', () => {
  let service: TwoFactorService;

  beforeEach(() => {
    service = new TwoFactorService();
    jest.clearAllMocks();
  });

  describe('enable2FA', () => {
    it('should generate secret, QR code, and 10 backup codes', async () => {
      const userId = 'user-123';
      const userEmail = 'test@example.com';

      (db.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] }) // UPDATE users
        .mockResolvedValueOnce({ rows: [] }) // DELETE backup codes
        .mockResolvedValue({ rows: [] }); // INSERT backup codes

      const result = await service.enable2FA(userId, userEmail);

      expect(result.secret).toBeDefined();
      expect(result.secret.length).toBeGreaterThan(0);
      expect(result.qrCode).toBeDefined();
      expect(result.qrCode).toContain('data:image/png;base64');
      expect(result.backupCodes).toHaveLength(10);
      expect(result.backupCodes[0]).toHaveLength(8);

      // Verify database calls
      expect(db.query).toHaveBeenCalledWith(
        'UPDATE users SET two_fa_secret = $1, two_fa_enabled = FALSE WHERE id = $2',
        [expect.any(String), userId]
      );
      expect(db.query).toHaveBeenCalledWith('DELETE FROM two_fa_backup_codes WHERE user_id = $1', [
        userId,
      ]);
    });

    it('should store hashed backup codes in database', async () => {
      const userId = 'user-123';
      const userEmail = 'test@example.com';

      (db.query as jest.Mock).mockResolvedValue({ rows: [] });

      await service.enable2FA(userId, userEmail);

      // Verify 10 backup codes were inserted
      const insertCalls = (db.query as jest.Mock).mock.calls.filter(
        (call) =>
          call[0] ===
          'INSERT INTO two_fa_backup_codes (user_id, code_hash, used) VALUES ($1, $2, $3)'
      );
      expect(insertCalls).toHaveLength(10);

      // Verify code hashes are 64 characters (SHA-256)
      insertCalls.forEach((call) => {
        expect(call[1][1]).toHaveLength(64);
        expect(call[1][2]).toBe(false);
      });
    });
  });

  describe('verify2FASetup', () => {
    it('should verify valid TOTP token and enable 2FA', async () => {
      const userId = 'user-123';
      const secret = speakeasy.generateSecret({ length: 32 });
      const token = speakeasy.totp({
        secret: secret.base32,
        encoding: 'base32',
      });

      (db.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ two_fa_secret: secret.base32 }] })
        .mockResolvedValueOnce({ rows: [] }); // UPDATE to enable 2FA

      const result = await service.verify2FASetup(userId, token);

      expect(result).toBe(true);
      expect(db.query).toHaveBeenCalledWith(
        'UPDATE users SET two_fa_enabled = TRUE WHERE id = $1',
        [userId]
      );
    });

    it('should reject invalid TOTP token', async () => {
      const userId = 'user-123';
      const secret = speakeasy.generateSecret({ length: 32 });

      (db.query as jest.Mock).mockResolvedValue({
        rows: [{ two_fa_secret: secret.base32 }],
      });

      const result = await service.verify2FASetup(userId, '000000');

      expect(result).toBe(false);
    });

    it('should fail if user has no 2FA secret', async () => {
      const userId = 'user-123';

      (db.query as jest.Mock).mockResolvedValue({ rows: [{ two_fa_secret: null }] });

      const result = await service.verify2FASetup(userId, '123456');

      expect(result).toBe(false);
    });

    it('should allow 30-second time window for TOTP validation', async () => {
      const userId = 'user-123';
      const secret = speakeasy.generateSecret({ length: 32 });

      // Generate token for 30 seconds ago
      const token = speakeasy.totp({
        secret: secret.base32,
        encoding: 'base32',
        time: Math.floor(Date.now() / 1000) - 30,
      });

      (db.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ two_fa_secret: secret.base32 }] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await service.verify2FASetup(userId, token);

      // Should still be valid due to window parameter
      expect(result).toBe(true);
    });
  });

  describe('verify2FA', () => {
    it('should verify valid TOTP token during login', async () => {
      const userId = 'user-123';
      const ipAddress = '192.168.1.1';
      const secret = speakeasy.generateSecret({ length: 32 });
      const token = speakeasy.totp({
        secret: secret.base32,
        encoding: 'base32',
      });

      (db.query as jest.Mock)
        .mockResolvedValueOnce({
          rows: [{ two_fa_secret: secret.base32, two_fa_enabled: true }],
        })
        .mockResolvedValueOnce({ rows: [] }); // Audit log

      const result = await service.verify2FA(userId, token, ipAddress);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();

      // Verify audit log was created
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_logs'),
        expect.arrayContaining([userId, '2FA_VERIFICATION', 'USER', userId, ipAddress])
      );
    });

    it('should reject invalid TOTP token and log failure', async () => {
      const userId = 'user-123';
      const ipAddress = '192.168.1.1';
      const secret = speakeasy.generateSecret({ length: 32 });

      (db.query as jest.Mock)
        .mockResolvedValueOnce({
          rows: [{ two_fa_secret: secret.base32, two_fa_enabled: true }],
        })
        .mockResolvedValueOnce({ rows: [] }); // Audit log

      const result = await service.verify2FA(userId, '000000', ipAddress);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid 2FA code');

      // Verify failure was logged
      const auditCall = (db.query as jest.Mock).mock.calls.find((call) =>
        call[0].includes('INSERT INTO audit_logs')
      );
      expect(auditCall[1]).toContain('FAILURE');
    });

    it('should fail if 2FA is not enabled', async () => {
      const userId = 'user-123';
      const ipAddress = '192.168.1.1';

      (db.query as jest.Mock).mockResolvedValue({
        rows: [{ two_fa_secret: null, two_fa_enabled: false }],
      });

      const result = await service.verify2FA(userId, '123456', ipAddress);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('2FA not enabled');
    });
  });

  describe('verifyBackupCode', () => {
    it('should verify valid unused backup code', async () => {
      const userId = 'user-123';
      const ipAddress = '192.168.1.1';
      const backupCode = 'ABCD1234';

      (db.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ id: 'backup-code-id' }] }) // Find backup code
        .mockResolvedValueOnce({ rows: [] }) // Mark as used
        .mockResolvedValueOnce({ rows: [] }); // Audit log

      const result = await service.verifyBackupCode(userId, backupCode, ipAddress);

      expect(result.valid).toBe(true);

      // Verify backup code was marked as used
      expect(db.query).toHaveBeenCalledWith(
        'UPDATE two_fa_backup_codes SET used = TRUE, used_at = NOW() WHERE id = $1',
        ['backup-code-id']
      );

      // Verify success was logged
      const auditCall = (db.query as jest.Mock).mock.calls.find((call) =>
        call[0].includes('INSERT INTO audit_logs')
      );
      expect(auditCall[1]).toContain('SUCCESS');
    });

    it('should reject invalid or used backup code', async () => {
      const userId = 'user-123';
      const ipAddress = '192.168.1.1';
      const backupCode = 'INVALID1';

      (db.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] }) // No matching backup code
        .mockResolvedValueOnce({ rows: [] }); // Audit log

      const result = await service.verifyBackupCode(userId, backupCode, ipAddress);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid or already used backup code');

      // Verify failure was logged
      const auditCall = (db.query as jest.Mock).mock.calls.find((call) =>
        call[0].includes('INSERT INTO audit_logs')
      );
      expect(auditCall[1]).toContain('FAILURE');
    });

    it('should only allow single use of backup codes', async () => {
      const userId = 'user-123';
      const ipAddress = '192.168.1.1';
      const backupCode = 'ABCD1234';

      // First use - success
      (db.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ id: 'backup-code-id' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const result1 = await service.verifyBackupCode(userId, backupCode, ipAddress);
      expect(result1.valid).toBe(true);

      // Second use - should fail
      (db.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] }) // Code is now marked as used
        .mockResolvedValueOnce({ rows: [] });

      const result2 = await service.verifyBackupCode(userId, backupCode, ipAddress);
      expect(result2.valid).toBe(false);
    });
  });

  describe('disable2FA', () => {
    it('should disable 2FA and delete backup codes', async () => {
      const userId = 'user-123';
      const adminId = 'admin-456';

      (db.query as jest.Mock).mockResolvedValue({ rows: [] });

      await service.disable2FA(userId, adminId);

      expect(db.query).toHaveBeenCalledWith(
        'UPDATE users SET two_fa_enabled = FALSE, two_fa_secret = NULL WHERE id = $1',
        [userId]
      );
      expect(db.query).toHaveBeenCalledWith('DELETE FROM two_fa_backup_codes WHERE user_id = $1', [
        userId,
      ]);

      // Verify action was logged
      const auditCall = (db.query as jest.Mock).mock.calls.find((call) =>
        call[0].includes('INSERT INTO audit_logs')
      );
      expect(auditCall[1]).toContain('2FA_DISABLED');
      expect(auditCall[1]).toContain(adminId);
    });
  });

  describe('is2FARequired', () => {
    it('should return true for CEO role', async () => {
      const userId = 'user-123';

      (db.query as jest.Mock).mockResolvedValue({ rows: [{ role: 'CEO' }] });

      const result = await service.is2FARequired(userId);

      expect(result).toBe(true);
    });

    it('should return true for CFO role', async () => {
      const userId = 'user-123';

      (db.query as jest.Mock).mockResolvedValue({ rows: [{ role: 'CFO' }] });

      const result = await service.is2FARequired(userId);

      expect(result).toBe(true);
    });

    it('should return true for CoS role', async () => {
      const userId = 'user-123';

      (db.query as jest.Mock).mockResolvedValue({ rows: [{ role: 'CoS' }] });

      const result = await service.is2FARequired(userId);

      expect(result).toBe(true);
    });

    it('should return false for other roles', async () => {
      const userId = 'user-123';

      (db.query as jest.Mock).mockResolvedValue({ rows: [{ role: 'AGENT' }] });

      const result = await service.is2FARequired(userId);

      expect(result).toBe(false);
    });

    it('should return false for non-existent user', async () => {
      const userId = 'nonexistent';

      (db.query as jest.Mock).mockResolvedValue({ rows: [] });

      const result = await service.is2FARequired(userId);

      expect(result).toBe(false);
    });
  });

  describe('getRemainingBackupCodesCount', () => {
    it('should return count of unused backup codes', async () => {
      const userId = 'user-123';

      (db.query as jest.Mock).mockResolvedValue({ rows: [{ count: '7' }] });

      const count = await service.getRemainingBackupCodesCount(userId);

      expect(count).toBe(7);
      expect(db.query).toHaveBeenCalledWith(
        'SELECT COUNT(*) as count FROM two_fa_backup_codes WHERE user_id = $1 AND used = FALSE',
        [userId]
      );
    });

    it('should return 0 if all backup codes are used', async () => {
      const userId = 'user-123';

      (db.query as jest.Mock).mockResolvedValue({ rows: [{ count: '0' }] });

      const count = await service.getRemainingBackupCodesCount(userId);

      expect(count).toBe(0);
    });
  });

  describe('backup code generation', () => {
    it('should generate unique backup codes', async () => {
      const userId = 'user-123';
      const userEmail = 'test@example.com';

      (db.query as jest.Mock).mockResolvedValue({ rows: [] });

      const result = await service.enable2FA(userId, userEmail);

      // Check all codes are unique
      const uniqueCodes = new Set(result.backupCodes);
      expect(uniqueCodes.size).toBe(10);
    });

    it('should generate 8-character alphanumeric codes', async () => {
      const userId = 'user-123';
      const userEmail = 'test@example.com';

      (db.query as jest.Mock).mockResolvedValue({ rows: [] });

      const result = await service.enable2FA(userId, userEmail);

      result.backupCodes.forEach((code) => {
        expect(code).toHaveLength(8);
        expect(code).toMatch(/^[A-F0-9]{8}$/);
      });
    });
  });
});
