import crypto from 'crypto';
import { db } from '../database/connection';
import { authService } from '../auth/authService';
import { sendgridClient } from '../services/sendgrid/client';
import { config } from '../config';
import logger from '../utils/logger';

export interface CreateUserInput {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  country: string;
  roleId: string;
  departmentId?: string;
  languagePreference?: string;
  timezone?: string;
}

export interface UpdateUserInput {
  fullName?: string;
  phone?: string;
  country?: string;
  departmentId?: string;
  languagePreference?: string;
  timezone?: string;
  profilePhotoUrl?: string;
  pendingEmail?: string;        // Requirement 39.5: staged email change
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  country: string;
  roleId: string;
  roleName: string;
  departmentId?: string;
  githubUsername?: string;
  languagePreference: string;
  timezone: string;
  twoFaEnabled: boolean;
  profilePhotoUrl?: string;
  lastLogin?: Date;
  isActive: boolean;
  suspendedAt?: Date;
  suspensionReason?: string;
  pendingEmail?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface InvitationInput {
  email: string;
  roleId: string;
  departmentId?: string;
  invitedBy: string;
}

export interface Invitation {
  id: string;
  email: string;
  token: string;
  roleId: string;
  departmentId?: string;
  expiresAt: Date;
  usedAt?: Date;
  createdBy: string;
  createdAt: Date;
}

/**
 * User Management Service
 * Handles user CRUD operations, invitations, and profile management
 * Requirements: 1.1-1.5, 39.1-39.12
 */
export class UserService {
  /**
   * Send invitation email to create new user account
   * Requirement 1.1: Create user accounts only through invitation emails
   * Requirement 1.2: Generate unique registration link valid for 72 hours
   */
  async sendInvitation(input: InvitationInput): Promise<Invitation> {
    try {
      // Check if user already exists
      const existingUser = await db.query('SELECT id FROM users WHERE email = $1', [input.email]);
      if (existingUser.rows.length > 0) {
        throw new Error('User with this email already exists');
      }

      // Enforce account limits per doc §4
      const roleResult = await db.query('SELECT name FROM roles WHERE id = $1', [input.roleId]);
      const targetRoleName: string = roleResult.rows[0]?.name;

      if (targetRoleName === 'CEO' || targetRoleName === 'CoS') {
        const existing = await db.query(
          `SELECT COUNT(*) FROM users u JOIN roles r ON u.role_id = r.id WHERE r.name = $1`,
          [targetRoleName]
        );
        if (parseInt(existing.rows[0].count, 10) >= 1) {
          throw new Error(`Only 1 ${targetRoleName} account is allowed in the system`);
        }
      }

      if (targetRoleName === 'CFO_ASSISTANT') {
        const existing = await db.query(
          `SELECT COUNT(*) FROM users u JOIN roles r ON u.role_id = r.id WHERE r.name = 'CFO_ASSISTANT'`
        );
        if (parseInt(existing.rows[0].count, 10) >= 3) {
          throw new Error('Maximum of 3 CFO Assistant accounts allowed');
        }
      }

      // Check if there's an active invitation
      const existingInvitation = await db.query(
        `SELECT id FROM invitation_tokens 
         WHERE email = $1 AND expires_at > NOW() AND used_at IS NULL`,
        [input.email]
      );
      if (existingInvitation.rows.length > 0) {
        throw new Error('Active invitation already exists for this email');
      }

      // Generate unique token
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 hours

      // Store invitation in database
      const result = await db.query(
        `INSERT INTO invitation_tokens (email, token, role_id, department_id, expires_at, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, email, token, role_id, department_id, expires_at, created_by, created_at`,
        [input.email, token, input.roleId, input.departmentId, expiresAt, input.invitedBy]
      );

      const invitation = result.rows[0];

      // Generate registration link — points to the frontend register page
      const registrationLink = `${config.frontendUrl}/register?token=${token}`;

      // Send invitation email (reuse targetRoleName already fetched above)
      const roleName = targetRoleName || 'User';
      await sendgridClient.sendInvitationEmail(input.email, registrationLink, roleName);

      logger.info('Invitation sent successfully', {
        email: input.email,
        invitedBy: input.invitedBy,
        expiresAt,
      });

      return {
        id: invitation.id,
        email: invitation.email,
        token: invitation.token,
        roleId: invitation.role_id,
        departmentId: invitation.department_id,
        expiresAt: invitation.expires_at,
        createdBy: invitation.created_by,
        createdAt: invitation.created_at,
      };
    } catch (error) {
      logger.error('Failed to send invitation', { error, input });
      throw error;
    }
  }

  /**
   * Validate invitation token
   * Requirement 1.5: Display error message for expired registration links
   */
  async validateInvitationToken(token: string): Promise<Invitation | null> {
    try {
      const result = await db.query(
        `SELECT id, email, token, role_id, department_id, expires_at, used_at, created_by, created_at
         FROM invitation_tokens
         WHERE token = $1`,
        [token]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const invitation = result.rows[0];

      // Check if already used
      if (invitation.used_at) {
        throw new Error('This invitation has already been used');
      }

      // Check if expired
      if (new Date(invitation.expires_at) < new Date()) {
        throw new Error('This invitation has expired');
      }

      return {
        id: invitation.id,
        email: invitation.email,
        token: invitation.token,
        roleId: invitation.role_id,
        departmentId: invitation.department_id,
        expiresAt: invitation.expires_at,
        usedAt: invitation.used_at,
        createdBy: invitation.created_by,
        createdAt: invitation.created_at,
      };
    } catch (error) {
      logger.error('Failed to validate invitation token', { error, token });
      throw error;
    }
  }

  /**
   * Create user account from invitation
   * Requirement 1.3: Display account setup form for valid registration link
   * Requirement 1.4: Create account with assigned role
   * Requirement 1.6: Hash passwords using bcrypt with minimum 12 rounds
   */
  async createUserFromInvitation(token: string, userData: CreateUserInput): Promise<User> {
    try {
      // Validate invitation
      const invitation = await this.validateInvitationToken(token);
      if (!invitation) {
        throw new Error('Invalid invitation token');
      }

      // Verify email matches invitation
      if (invitation.email !== userData.email) {
        throw new Error('Email does not match invitation');
      }

      // Hash password
      const passwordHash = await authService.hashPassword(userData.password);

      // Create user
      const result = await db.query(
        `INSERT INTO users (
          email, password_hash, full_name, phone, country, 
          role_id, department_id, language_preference, timezone
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id, email, full_name, phone, country, role_id, department_id, 
                  language_preference, timezone, two_fa_enabled, profile_photo_url,
                  last_login, created_at, updated_at`,
        [
          userData.email,
          passwordHash,
          userData.fullName,
          userData.phone,
          userData.country,
          invitation.roleId,
          invitation.departmentId,
          userData.languagePreference || 'en',
          userData.timezone || 'UTC',
        ]
      );

      const user = result.rows[0];

      // Mark invitation as used
      await db.query('UPDATE invitation_tokens SET used_at = NOW() WHERE token = $1', [token]);

      // Get role name
      const roleResult = await db.query('SELECT name FROM roles WHERE id = $1', [user.role_id]);

      logger.info('User created from invitation', {
        userId: user.id,
        email: user.email,
        roleId: user.role_id,
      });

      return this.mapUserFromDb(user, roleResult.rows[0]?.name || '');
    } catch (error) {
      logger.error('Failed to create user from invitation', { error, token });
      throw error;
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<User | null> {
    try {
      const result = await db.query(
        `SELECT u.id, u.email, u.full_name, u.phone, u.country, u.role_id, u.department_id,
                u.github_username, u.language_preference, u.timezone, u.two_fa_enabled,
                u.profile_photo_url, u.last_login, u.is_active, u.suspended_at,
                u.suspension_reason, u.pending_email, u.created_at, u.updated_at,
                r.name as role_name
         FROM users u
         JOIN roles r ON u.role_id = r.id
         WHERE u.id = $1`,
        [userId]
      );

      if (result.rows.length === 0) return null;
      const user = result.rows[0];
      return this.mapUserFromDb(user, user.role_name);
    } catch (error) {
      logger.error('Failed to get user by ID', { error, userId });
      throw error;
    }
  }

  /**
   * Update user profile
   * Requirement 39.1: Allow users to view and edit profile information
   */
  async updateUser(userId: string, updates: UpdateUserInput): Promise<User> {
    try {
      const fields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (updates.fullName !== undefined) {
        fields.push(`full_name = $${paramIndex++}`);
        values.push(updates.fullName);
      }
      if (updates.phone !== undefined) {
        fields.push(`phone = $${paramIndex++}`);
        values.push(updates.phone);
      }
      if (updates.country !== undefined) {
        fields.push(`country = $${paramIndex++}`);
        values.push(updates.country);
      }
      if (updates.departmentId !== undefined) {
        fields.push(`department_id = $${paramIndex++}`);
        values.push(updates.departmentId);
      }
      if (updates.languagePreference !== undefined) {
        fields.push(`language_preference = $${paramIndex++}`);
        values.push(updates.languagePreference);
      }
      if (updates.timezone !== undefined) {
        fields.push(`timezone = $${paramIndex++}`);
        values.push(updates.timezone);
      }
      if (updates.profilePhotoUrl !== undefined) {
        fields.push(`profile_photo_url = $${paramIndex++}`);
        values.push(updates.profilePhotoUrl);
      }

      if (fields.length === 0) {
        throw new Error('No fields to update');
      }

      fields.push(`updated_at = NOW()`);
      values.push(userId);

      const query = `
        UPDATE users
        SET ${fields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING id, email, full_name, phone, country, role_id, department_id,
                  github_username, language_preference, timezone, two_fa_enabled,
                  profile_photo_url, last_login, created_at, updated_at
      `;

      const result = await db.query(query, values);
      if (result.rows.length === 0) throw new Error('User not found');

      const user = result.rows[0];
      const roleResult = await db.query('SELECT name FROM roles WHERE id = $1', [user.role_id]);
      logger.info('User updated successfully', { userId, updates });
      return this.mapUserFromDb(user, roleResult.rows[0]?.name || '');
    } catch (error) {
      logger.error('Failed to update user', { error, userId, updates });
      throw error;
    }
  }

  /**
   * Delete user
   */
  async deleteUser(userId: string): Promise<void> {
    try {
      const result = await db.query('DELETE FROM users WHERE id = $1 RETURNING id', [userId]);

      if (result.rows.length === 0) {
        throw new Error('User not found');
      }

      logger.info('User deleted successfully', { userId });
    } catch (error) {
      logger.error('Failed to delete user', { error, userId });
      throw error;
    }
  }

  /**
   * List users with pagination and filtering
   */
  async listUsers(filters: {
    roleId?: string;
    departmentId?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ users: User[]; total: number }> {
    try {
      const conditions: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (filters.roleId) {
        conditions.push(`u.role_id = $${paramIndex++}`);
        values.push(filters.roleId);
      }

      if (filters.departmentId) {
        conditions.push(`u.department_id = $${paramIndex++}`);
        values.push(filters.departmentId);
      }

      if (filters.search) {
        conditions.push(
          `(u.full_name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex})`
        );
        values.push(`%${filters.search}%`);
        paramIndex++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Get total count
      const countQuery = `SELECT COUNT(*) FROM users u ${whereClause}`;
      const countResult = await db.query(countQuery, values);
      const total = parseInt(countResult.rows[0].count);

      // Get users
      const limit = filters.limit || 50;
      const offset = filters.offset || 0;

      const query = `
        SELECT u.id, u.email, u.full_name, u.phone, u.country, u.role_id, u.department_id,
               u.github_username, u.language_preference, u.timezone, u.two_fa_enabled,
               u.profile_photo_url, u.last_login, u.is_active, u.suspended_at,
               u.suspension_reason, u.pending_email, u.created_at, u.updated_at,
               r.name as role_name
        FROM users u
        JOIN roles r ON u.role_id = r.id
        ${whereClause}
        ORDER BY u.created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      values.push(limit, offset);
      const result = await db.query(query, values);

      const users = result.rows.map((row) => this.mapUserFromDb(row, row.role_name));
      return { users, total };
    } catch (error) {
      logger.error('Failed to list users', { error, filters });
      throw error;
    }
  }

  /**
   * Change user password
   * Requirement 39.9: Allow users to change their password
   * Requirement 39.10: Require current password verification
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    try {
      // Get user's current password hash
      const result = await db.query('SELECT password_hash FROM users WHERE id = $1', [userId]);

      if (result.rows.length === 0) {
        throw new Error('User not found');
      }

      const currentHash = result.rows[0].password_hash;

      // Verify current password
      const isValid = await authService.verifyPassword(currentPassword, currentHash);
      if (!isValid) {
        throw new Error('Current password is incorrect');
      }

      // Hash new password
      const newHash = await authService.hashPassword(newPassword);

      // Update password
      await db.query(
        'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
        [newHash, userId]
      );

      logger.info('Password changed successfully', { userId });
    } catch (error) {
      logger.error('Failed to change password', { error, userId });
      throw error;
    }
  }

  // ============================================================================
  // Email verification for profile email changes (Req 39.5-39.6)
  // ============================================================================

  /**
   * Initiate email change — sends verification to new address
   * Requirement 39.5: Require email verification for profile email changes
   */
  async initiateEmailChange(userId: string, newEmail: string): Promise<void> {
    try {
      // Check new email not already taken
      const existing = await db.query('SELECT id FROM users WHERE email = $1', [newEmail]);
      if (existing.rows.length > 0) throw new Error('Email already in use');

      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      await db.query(
        `UPDATE users SET pending_email = $1, email_change_token = $2, email_change_expires_at = $3 WHERE id = $4`,
        [newEmail, token, expiresAt, userId]
      );

      const verifyLink = `${config.apiBaseUrl}/users/verify-email?token=${token}`;
      await sendgridClient.sendEmail({
        to: newEmail,
        subject: 'Verify your new email address — TechSwiftTrix',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Verify Your New Email Address</h2>
            <p>Click the button below to confirm your new email address.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verifyLink}"
                 style="background-color: #4CAF50; color: white; padding: 14px 28px; text-decoration: none; border-radius: 4px; display: inline-block;">
                Verify Email
              </a>
            </div>
            <p>This link expires in 24 hours. If you did not request this change, ignore this email.</p>
          </div>
        `,
      });

      logger.info('Email change initiated', { userId, newEmail });
    } catch (error) {
      logger.error('Failed to initiate email change', { error, userId });
      throw error;
    }
  }

  /**
   * Confirm email change via token
   * Requirement 39.6: Apply new email after verification
   */
  async confirmEmailChange(token: string): Promise<User> {
    try {
      const result = await db.query(
        `SELECT id, pending_email, email_change_expires_at FROM users
         WHERE email_change_token = $1`,
        [token]
      );

      if (result.rows.length === 0) throw new Error('Invalid or expired email verification token');

      const user = result.rows[0];
      if (new Date(user.email_change_expires_at) < new Date()) {
        throw new Error('Email verification token has expired');
      }

      await db.query(
        `UPDATE users SET email = $1, pending_email = NULL, email_change_token = NULL,
         email_change_expires_at = NULL, updated_at = NOW() WHERE id = $2`,
        [user.pending_email, user.id]
      );

      logger.info('Email changed successfully', { userId: user.id, newEmail: user.pending_email });
      return (await this.getUserById(user.id))!;
    } catch (error) {
      logger.error('Failed to confirm email change', { error });
      throw error;
    }
  }

  // ============================================================================
  // Profile photo upload (Req 39.7-39.8)
  // ============================================================================

  /**
   * Upload and process profile photo
   * Requirement 39.7-39.8: Upload profile photo with processing
   */
  async uploadProfilePhoto(userId: string, buffer: Buffer, _mimetype: string): Promise<string> {
    try {
      const { fileStorageService } = await import('../files/fileService');

      const result = await fileStorageService.uploadFile({
        filename: `profile-${userId}.jpg`,
        mimetype: 'image/jpeg',
        size: buffer.length,
        buffer,
        uploadedBy: userId,
        entityType: 'user_profile',
        entityId: userId,
        description: 'Profile photo',
      });

      await db.query(
        `UPDATE users SET profile_photo_url = $1, updated_at = NOW() WHERE id = $2`,
        [result.url, userId]
      );

      logger.info('Profile photo uploaded', { userId, url: result.url });
      return result.url;
    } catch (error) {
      logger.error('Failed to upload profile photo', { error, userId });
      throw error;
    }
  }

  // ============================================================================
  // Account suspension / deactivation
  // ============================================================================

  /**
   * Suspend a user account
   */
  async suspendUser(userId: string, reason: string, suspendedBy: string): Promise<void> {
    try {
      const result = await db.query(
        `UPDATE users SET is_active = false, suspended_at = NOW(), suspension_reason = $1,
         updated_at = NOW() WHERE id = $2 RETURNING id`,
        [reason, userId]
      );
      if (result.rows.length === 0) throw new Error('User not found');

      logger.info('User suspended', { userId, reason, suspendedBy });
    } catch (error) {
      logger.error('Failed to suspend user', { error, userId });
      throw error;
    }
  }

  /**
   * Reactivate a suspended user account
   */
  async reactivateUser(userId: string, reactivatedBy: string): Promise<void> {
    try {
      const result = await db.query(
        `UPDATE users SET is_active = true, suspended_at = NULL, suspension_reason = NULL,
         updated_at = NOW() WHERE id = $1 RETURNING id`,
        [userId]
      );
      if (result.rows.length === 0) throw new Error('User not found');

      logger.info('User reactivated', { userId, reactivatedBy });
    } catch (error) {
      logger.error('Failed to reactivate user', { error, userId });
      throw error;
    }
  }

  // ============================================================================
  // User activity tracking
  // ============================================================================

  /**
   * Log a user activity event
   */
  async trackActivity(userId: string, action: string, metadata?: Record<string, any>): Promise<void> {
    try {
      await db.query(
        `INSERT INTO user_activity_log (user_id, action, metadata) VALUES ($1, $2, $3)`,
        [userId, action, metadata ? JSON.stringify(metadata) : null]
      );
    } catch (error) {
      // Non-fatal — log but don't throw
      logger.error('Failed to track user activity', { error, userId, action });
    }
  }

  /**
   * Get activity log for a user
   */
  async getActivityLog(
    userId: string,
    limit = 50,
    offset = 0
  ): Promise<{ activities: any[]; total: number }> {
    try {
      const countResult = await db.query(
        `SELECT COUNT(*) FROM user_activity_log WHERE user_id = $1`,
        [userId]
      );
      const total = parseInt(countResult.rows[0].count);

      const result = await db.query(
        `SELECT id, user_id, action, metadata, created_at
         FROM user_activity_log WHERE user_id = $1
         ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      );

      return {
        activities: result.rows.map((r) => ({
          id: r.id,
          userId: r.user_id,
          action: r.action,
          metadata: r.metadata ? JSON.parse(r.metadata) : null,
          createdAt: r.created_at,
        })),
        total,
      };
    } catch (error) {
      logger.error('Failed to get activity log', { error, userId });
      throw error;
    }
  }

  // ============================================================================
  // Bulk CSV import
  // ============================================================================

  /**
   * Initiate bulk user import via CSV
   */
  async bulkImportUsers(csvContent: string, requestedBy: string): Promise<{ jobId: string }> {
    try {
      const { bulkImportService } = await import('../bulk/bulkImportService');
      const job = await bulkImportService.startImport('users', csvContent, requestedBy);
      logger.info('Bulk user import initiated', { jobId: job.id, requestedBy });
      return { jobId: job.id };
    } catch (error) {
      logger.error('Failed to initiate bulk user import', { error });
      throw error;
    }
  }

  // ============================================================================
  // Password reset via invitation resend
  // ============================================================================

  /**
   * Resend invitation as password reset (for users who haven't logged in yet)
   */
  async resendInvitationAsPasswordReset(email: string, requestedBy: string): Promise<void> {
    try {
      const userResult = await db.query(
        `SELECT u.id, u.full_name, u.role_id FROM users u WHERE u.email = $1`,
        [email]
      );
      if (userResult.rows.length === 0) throw new Error('User not found');

      const user = userResult.rows[0];

      // Expire any existing invitation tokens for this email
      await db.query(
        `UPDATE invitation_tokens SET expires_at = NOW() WHERE email = $1 AND used_at IS NULL`,
        [email]
      );

      // Create a fresh invitation token
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

      await db.query(
        `INSERT INTO invitation_tokens (email, token, role_id, expires_at, created_by)
         VALUES ($1, $2, $3, $4, $5)`,
        [email, token, user.role_id, expiresAt, requestedBy]
      );

      const resetLink = `${config.frontendUrl}/register?token=${token}`;
      await sendgridClient.sendPasswordResetEmail(email, resetLink, user.full_name);

      logger.info('Invitation resent as password reset', { email, requestedBy });
    } catch (error) {
      logger.error('Failed to resend invitation as password reset', { error, email });
      throw error;
    }
  }

  // ============================================================================
  // Helper: map DB row to User
  // ============================================================================

  private mapUserFromDb(row: any, roleName: string): User {
    return {
      id: row.id,
      email: row.email,
      fullName: row.full_name,
      phone: row.phone,
      country: row.country,
      roleId: row.role_id,
      roleName,
      departmentId: row.department_id,
      githubUsername: row.github_username,
      languagePreference: row.language_preference,
      timezone: row.timezone,
      twoFaEnabled: row.two_fa_enabled,
      profilePhotoUrl: row.profile_photo_url,
      lastLogin: row.last_login,
      isActive: row.is_active ?? true,
      suspendedAt: row.suspended_at,
      suspensionReason: row.suspension_reason,
      pendingEmail: row.pending_email,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export const userService = new UserService();
export default userService;
