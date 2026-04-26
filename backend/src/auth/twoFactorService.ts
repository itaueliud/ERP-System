import crypto from 'crypto';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { db } from '../database/connection';
import logger from '../utils/logger';

export interface TwoFactorSetup {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

export interface TwoFactorVerification {
  valid: boolean;
  error?: string;
}

/**
 * Two-Factor Authentication Service
 * Handles TOTP-based 2FA with QR codes and backup codes
 * Requirements: 48.1-48.11
 */
export class TwoFactorService {
  /**
   * Enable 2FA for a user
   * Requirement 48.2: Allow users to enable 2FA in profile settings
   * Requirement 48.3: Generate QR code for authenticator app setup
   * Requirement 48.4-48.5: Provide 10 backup codes when 2FA is enabled
   */
  async enable2FA(userId: string, userEmail: string): Promise<TwoFactorSetup> {
    try {
      // Generate TOTP secret
      const secret = speakeasy.generateSecret({
        name: `TechSwiftTrix (${userEmail})`,
        issuer: 'TechSwiftTrix ERP',
        length: 32,
      });

      // Generate QR code
      const qrCode = await QRCode.toDataURL(secret.otpauth_url!);

      // Generate 10 backup codes
      const backupCodes = this.generateBackupCodes(10);

      // Hash backup codes for storage
      const hashedBackupCodes = await Promise.all(
        backupCodes.map(async (code) => ({
          code_hash: crypto.createHash('sha256').update(code).digest('hex'),
          used: false,
        }))
      );

      // Store secret and backup codes in database
      await db.query('UPDATE users SET two_fa_secret = $1, two_fa_enabled = FALSE WHERE id = $2', [
        secret.base32,
        userId,
      ]);

      // Delete any existing backup codes
      await db.query('DELETE FROM two_fa_backup_codes WHERE user_id = $1', [userId]);

      // Insert new backup codes
      for (const { code_hash } of hashedBackupCodes) {
        await db.query(
          'INSERT INTO two_fa_backup_codes (user_id, code_hash, used) VALUES ($1, $2, $3)',
          [userId, code_hash, false]
        );
      }

      logger.info('2FA setup initiated for user', { userId });

      return {
        secret: secret.base32,
        qrCode,
        backupCodes,
      };
    } catch (error) {
      logger.error('Error enabling 2FA', { error, userId });
      throw error;
    }
  }

  /**
   * Verify TOTP code and complete 2FA setup
   * Requirement 48.6: Require 2FA code after password authentication
   * Requirement 48.7: Allow 30-second time window for TOTP code validation
   */
  async verify2FASetup(userId: string, token: string): Promise<boolean> {
    try {
      // Get user's 2FA secret
      const result = await db.query('SELECT two_fa_secret FROM users WHERE id = $1', [userId]);

      if (result.rows.length === 0 || !result.rows[0].two_fa_secret) {
        logger.warn('2FA verification attempted for user without secret', { userId });
        return false;
      }

      const secret = result.rows[0].two_fa_secret;

      // Verify TOTP token with 30-second window
      const verified = speakeasy.totp.verify({
        secret,
        encoding: 'base32',
        token,
        window: 1, // Allow 1 step before/after (30 seconds each direction)
      });

      if (verified) {
        // Enable 2FA for the user
        await db.query('UPDATE users SET two_fa_enabled = TRUE WHERE id = $1', [userId]);
        logger.info('2FA enabled successfully for user', { userId });
      } else {
        logger.warn('Invalid 2FA token during setup', { userId });
      }

      return verified;
    } catch (error) {
      logger.error('Error verifying 2FA setup', { error, userId });
      return false;
    }
  }

  /**
   * Verify 2FA code during login
   * Requirement 48.6: Require 2FA code after password authentication
   * Requirement 48.7: Allow 30-second time window for TOTP code validation
   * Requirement 48.11: Log all 2FA authentication attempts
   */
  async verify2FA(userId: string, token: string, ipAddress: string): Promise<TwoFactorVerification> {
    try {
      // Get user's 2FA secret
      const result = await db.query(
        'SELECT two_fa_secret, two_fa_enabled FROM users WHERE id = $1',
        [userId]
      );

      if (result.rows.length === 0) {
        logger.warn('2FA verification attempted for non-existent user', { userId });
        // Log the failed attempt
        await db.query(
          `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address, user_agent, result, metadata, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
          [userId, '2FA_VERIFICATION', 'USER', userId, ipAddress, '2FA Service', 'FAILURE',
           JSON.stringify({ error: 'user_not_found' })]
        );
        return { valid: false, error: 'User not found' };
      }

      const { two_fa_secret, two_fa_enabled } = result.rows[0];

      if (!two_fa_enabled || !two_fa_secret) {
        logger.warn('2FA verification attempted for user without 2FA enabled', { userId });
        return { valid: false, error: '2FA not enabled' };
      }

      // Verify TOTP token with 30-second window
      const verified = speakeasy.totp.verify({
        secret: two_fa_secret,
        encoding: 'base32',
        token,
        window: 1, // Allow 1 step before/after (30 seconds each direction)
      });

      // Log authentication attempt
      await db.query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address, user_agent, result, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [
          userId,
          '2FA_VERIFICATION',
          'USER',
          userId,
          ipAddress,
          '2FA Service',
          verified ? 'SUCCESS' : 'FAILURE',
          JSON.stringify({ token_length: token.length }),
        ]
      );

      if (verified) {
        logger.info('2FA verification successful', { userId });
        return { valid: true };
      } else {
        logger.warn('Invalid 2FA token during login', { userId });
        return { valid: false, error: 'Invalid 2FA code' };
      }
    } catch (error) {
      logger.error('Error verifying 2FA', { error, userId });
      return { valid: false, error: 'Verification error' };
    }
  }

  /**
   * Verify backup code
   * Requirement 48.8: Allow authentication using backup codes if user loses access to 2FA device
   */
  async verifyBackupCode(userId: string, code: string, ipAddress: string): Promise<TwoFactorVerification> {
    try {
      const codeHash = crypto.createHash('sha256').update(code).digest('hex');

      // Find unused backup code
      const result = await db.query(
        'SELECT id FROM two_fa_backup_codes WHERE user_id = $1 AND code_hash = $2 AND used = FALSE',
        [userId, codeHash]
      );

      if (result.rows.length === 0) {
        logger.warn('Invalid or used backup code attempted', { userId });

        // Log failed attempt
        await db.query(
          `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address, user_agent, result, metadata, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
          [
            userId,
            '2FA_BACKUP_CODE_VERIFICATION',
            'USER',
            userId,
            ipAddress,
            '2FA Service',
            'FAILURE',
            JSON.stringify({ reason: 'invalid_or_used' }),
          ]
        );

        return { valid: false, error: 'Invalid or already used backup code' };
      }

      // Mark backup code as used
      await db.query('UPDATE two_fa_backup_codes SET used = TRUE, used_at = NOW() WHERE id = $1', [
        result.rows[0].id,
      ]);

      // Log successful attempt
      await db.query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address, user_agent, result, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [
          userId,
          '2FA_BACKUP_CODE_VERIFICATION',
          'USER',
          userId,
          ipAddress,
          '2FA Service',
          'SUCCESS',
          JSON.stringify({ backup_code_used: true }),
        ]
      );

      logger.info('Backup code verified successfully', { userId });
      return { valid: true };
    } catch (error) {
      logger.error('Error verifying backup code', { error, userId });
      return { valid: false, error: 'Verification error' };
    }
  }

  /**
   * Disable 2FA for a user
   * Requirement 48.9: Allow administrators to disable 2FA for users who lost access
   * doc §25: 2FA is MANDATORY for CEO, CoS, CFO, EA — cannot be disabled by anyone
   */
  async disable2FA(userId: string, adminId: string): Promise<void> {
    try {
      // doc §25: Block disabling 2FA for mandatory roles — even CEO cannot disable their own
      const MANDATORY_2FA_ROLES = ['CEO', 'CoS', 'CFO', 'EA'];
      const userResult = await db.query(
        `SELECT r.name AS role FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1`,
        [userId]
      );
      if (userResult.rows.length > 0 && MANDATORY_2FA_ROLES.includes(userResult.rows[0].role)) {
        throw new Error(`2FA cannot be disabled for ${userResult.rows[0].role} — it is mandatory for this role`);
      }

      // Disable 2FA
      await db.query(
        'UPDATE users SET two_fa_enabled = FALSE, two_fa_secret = NULL WHERE id = $1',
        [userId]
      );

      // Delete backup codes
      await db.query('DELETE FROM two_fa_backup_codes WHERE user_id = $1', [userId]);

      // Log the action
      await db.query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address, user_agent, result, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [
          adminId,
          '2FA_DISABLED',
          'USER',
          userId,
          '0.0.0.0',
          'Admin Action',
          'SUCCESS',
          JSON.stringify({ target_user_id: userId }),
        ]
      );

      logger.info('2FA disabled by admin', { userId, adminId });
    } catch (error) {
      logger.error('Error disabling 2FA', { error, userId, adminId });
      throw error;
    }
  }

  /**
   * Check if 2FA is required for user role
   * Requirement 48.10: Require 2FA for all users with CEO, CFO, and CoS roles
   */
  async is2FARequired(userId: string): Promise<boolean> {
    try {
      const result = await db.query(
        `SELECT r.name as role FROM users u
         JOIN roles r ON u.role_id = r.id
         WHERE u.id = $1`,
        [userId]
      );

      if (result.rows.length === 0) {
        return false;
      }

      const role = result.rows[0].role;
      return ['CEO', 'CFO', 'CoS'].includes(role);
    } catch (error) {
      logger.error('Error checking 2FA requirement', { error, userId });
      return false;
    }
  }

  /**
   * Generate backup codes
   * Requirement 48.5: Generate 10 single-use backup codes
   */
  private generateBackupCodes(count: number): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      // Generate 8-character alphanumeric code
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      codes.push(code);
    }
    return codes;
  }

  /**
   * Get remaining backup codes count
   */
  async getRemainingBackupCodesCount(userId: string): Promise<number> {
    try {
      const result = await db.query(
        'SELECT COUNT(*) as count FROM two_fa_backup_codes WHERE user_id = $1 AND used = FALSE',
        [userId]
      );
      return parseInt(result.rows[0].count, 10);
    } catch (error) {
      logger.error('Error getting backup codes count', { error, userId });
      return 0;
    }
  }
}

export const twoFactorService = new TwoFactorService();
export default twoFactorService;
