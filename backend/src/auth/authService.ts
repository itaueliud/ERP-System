import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config';
import { db } from '../database/connection';
import { sessionCache, SessionData } from '../cache/sessionCache';
import { cacheService } from '../cache/cacheService';
import { sendgridClient } from '../services/sendgrid/client';
import { twoFactorService } from './twoFactorService';
import logger from '../utils/logger';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResult {
  success: boolean;
  token?: string;
  sessionId?: string;
  user?: UserProfile;
  requires2FA?: boolean;
  tempUserId?: string;
  error?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: string;
  permissions: string[];
  departmentId?: string;
}

export interface TokenPayload {
  userId: string;
  sessionId: string;
  role: string;
  email: string;
  iat: number;
  exp: number;
}

export interface PasswordResetRequest {
  email: string;
  token: string;
  expiresAt: Date;
}

/**
 * Authentication Service
 * Handles user authentication, JWT tokens, password hashing, and session management
 * Requirements: 1.1, 1.6, 1.7, 47.1-47.11
 */
export class AuthenticationService {
  private readonly bcryptRounds = config.security.bcryptRounds;
  private readonly jwtSecret = config.jwt.secret;
  private readonly jwtExpiresIn = config.jwt.expiresIn;

  /**
   * Authenticate user with email and password
   * Requirement 1.6: Hash passwords using bcrypt with 12 rounds
   * Requirement 1.7: Generate JWT session token valid for 8 hours
   */
  async login(credentials: LoginCredentials): Promise<AuthResult> {
    try {
      // Fetch user from database
      const userQuery = `
        SELECT u.id, u.email, u.password_hash, u.full_name, u.two_fa_enabled, u.two_fa_mandatory, u.is_active,
               r.name as role, r.permissions, u.department_id
        FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE u.email = $1
      `;
      const result = await db.query(userQuery, [credentials.email]);

      if (result.rows.length === 0) {
        logger.warn('Login attempt with non-existent email', { email: credentials.email });
        return {
          success: false,
          error: 'Invalid email or password',
        };
      }

      const user = result.rows[0];

      // Check if account is suspended (doc §5: CEO can deactivate/suspend any account)
      if (user.is_active === false) {
        logger.warn('Login attempt on suspended account', { email: credentials.email });
        return { success: false, error: 'Your account has been suspended. Contact the system administrator.' };
      }

      // Verify password
      const passwordMatch = await bcrypt.compare(credentials.password, user.password_hash);
      if (!passwordMatch) {
        logger.warn('Login attempt with incorrect password', { email: credentials.email });
        return {
          success: false,
          error: 'Invalid email or password',
        };
      }

      // Check if 2FA is enabled OR mandatory for this role (doc §21: 2FA mandatory for CEO, CoS, CFO, EA)
      // In development mode, skip 2FA enforcement so all roles can log in without setup
      const MANDATORY_2FA_ROLES = ['CEO', 'CoS', 'CFO', 'EA'];
      const isDev = process.env.NODE_ENV === 'development';
      const requires2FA = !isDev && (user.two_fa_enabled || MANDATORY_2FA_ROLES.includes(user.role));

      if (requires2FA) {
        // If 2FA is mandatory but not yet set up, force setup
        if (MANDATORY_2FA_ROLES.includes(user.role) && !user.two_fa_enabled) {
          logger.warn('Executive role login without 2FA — forcing 2FA setup', { email: credentials.email, role: user.role });
          return {
            success: false,
            requires2FA: true,
            tempUserId: user.id,
            error: '2FA is mandatory for your role. Please set up 2FA before logging in.',
          };
        }

        // Store temporary authentication state in Redis (5 minutes)
        const tempAuthKey = `temp_auth:${user.id}`;
        await cacheService.set(
          tempAuthKey,
          {
            userId: user.id,
            email: user.email,
            role: user.role,
            permissions: user.permissions || [],
            fullName: user.full_name,
            departmentId: user.department_id,
          },
          300 // 5 minutes
        );

        return {
          success: false,
          requires2FA: true,
          tempUserId: user.id,
          error: '2FA verification required',
        };
      }

      // Generate session ID
      const sessionId = crypto.randomUUID();

      // Create session data
      const sessionData: SessionData = {
        userId: user.id,
        role: user.role,
        email: user.email,
        permissions: user.permissions || [],
        createdAt: new Date(),
        lastActivity: new Date(),
      };

      // Store session in Redis (8-hour TTL)
      await sessionCache.setSession(sessionId, sessionData);

      // Generate JWT token
      const token = this.generateToken(user.id, sessionId, user.role, user.email);

      // Update last login timestamp
      await db.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

      // doc §25: CEO login triggers immediate security alert to registered backup email
      if (user.role === 'CEO') {
        const backupEmailResult = await db.query(
          `SELECT value FROM system_config WHERE key = 'ceo_backup_email' LIMIT 1`
        );
        const backupEmail: string | null = backupEmailResult.rows[0]?.value || null;
        if (backupEmail) {
          sendgridClient.sendEmail({
            to: backupEmail,
            subject: 'Security Alert: CEO Account Login',
            html: `<p>A login to the CEO account (<strong>${user.email}</strong>) was detected at <strong>${new Date().toUTCString()}</strong>.</p><p>If this was not you, contact your system administrator immediately.</p>`,
          }).catch((err: any) => logger.error('CEO login security alert email failed', { err }));
        }
        logger.warn('CEO login — security alert triggered', { userId: user.id, email: user.email });
      }

      logger.info('User logged in successfully', { userId: user.id, email: user.email });

      return {
        success: true,
        token,
        sessionId,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          role: user.role,
          permissions: user.permissions || [],
          departmentId: user.department_id,
        },
      };
    } catch (error) {
      logger.error('Login error', { error, email: credentials.email });
      return {
        success: false,
        error: 'An error occurred during login',
      };
    }
  }

  /**
   * Generate JWT token with 8-hour expiry
   * Requirement 1.7: JWT token valid for 8 hours
   */
  generateToken(userId: string, sessionId: string, role: string, email: string): string {
    const payload = {
      userId,
      sessionId,
      role,
      email,
    };

    const options: jwt.SignOptions = {
      expiresIn: this.jwtExpiresIn as jwt.SignOptions['expiresIn'], // 8h from config
    };
    
    return jwt.sign(payload, this.jwtSecret, options);
  }

  /**
   * Validate JWT token and return payload
   */
  async validateToken(token: string): Promise<TokenPayload | null> {
    try {
      const payload = jwt.verify(token, this.jwtSecret) as TokenPayload;

      // Check if session exists in Redis
      const sessionExists = await sessionCache.exists(payload.sessionId);
      if (!sessionExists) {
        logger.warn('Token validation failed: session not found', { sessionId: payload.sessionId });
        return null;
      }

      // Update session activity
      await sessionCache.updateActivity(payload.sessionId);

      return payload;
    } catch (error) {
      logger.warn('Token validation failed', { error });
      return null;
    }
  }

  /**
   * Hash password using bcrypt with 12 rounds
   * Requirement 1.6: bcrypt with minimum 12 rounds
   */
  async hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, this.bcryptRounds);
  }

  /**
   * Verify password against hash
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(password, hash);
  }

  /**
   * Logout user and invalidate session
   */
  async logout(userId: string, sessionId: string): Promise<void> {
    try {
      await sessionCache.deleteSession(sessionId);
      logger.info('User logged out', { userId, sessionId });
    } catch (error) {
      logger.error('Logout error', { error, userId, sessionId });
      throw error;
    }
  }

  /**
   * Initiate password reset workflow
   * Requirement 47.2: Send reset link to registered email
   * Requirement 47.3: Generate password reset tokens valid for 1 hour
   */
  async requestPasswordReset(email: string): Promise<void> {
    try {
      // Check if user exists
      const userQuery = 'SELECT id, full_name FROM users WHERE email = $1';
      const result = await db.query(userQuery, [email]);

      if (result.rows.length === 0) {
        // Don't reveal if email exists or not for security
        logger.warn('Password reset requested for non-existent email', { email });
        return;
      }

      const user = result.rows[0];

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

      // Store reset token in Redis with 1-hour TTL
      const resetKey = `password_reset:${tokenHash}`;
      await cacheService.set(
        resetKey,
        {
          userId: user.id,
          email,
          createdAt: new Date(),
        },
        3600 // 1 hour in seconds
      );

      // Generate reset link
      const resetLink = `${config.apiBaseUrl}/auth/reset-password?token=${resetToken}`;

      // Send reset email
      await sendgridClient.sendPasswordResetEmail(email, resetLink, user.full_name);

      logger.info('Password reset email sent', { userId: user.id, email });
    } catch (error) {
      logger.error('Password reset request error', { error, email });
      throw error;
    }
  }

  /**
   * Complete password reset with token
   * Requirement 47.6: Display password reset form for valid token
   * Requirement 47.8: Invalidate all existing sessions after password reset
   */
  async resetPassword(token: string, newPassword: string): Promise<boolean> {
    try {
      // Hash the token to look it up
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const resetKey = `password_reset:${tokenHash}`;

      // Get reset data from Redis
      const resetData = await cacheService.get<{
        userId: string;
        email: string;
        createdAt: Date;
      }>(resetKey);

      if (!resetData) {
        logger.warn('Password reset attempted with invalid token');
        return false;
      }

      // Hash new password
      const passwordHash = await this.hashPassword(newPassword);

      // Update password in database
      await db.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [
        passwordHash,
        resetData.userId,
      ]);

      // Delete the reset token
      await cacheService.delete(resetKey);

      // Invalidate all user sessions
      await sessionCache.deleteUserSessions(resetData.userId);

      // Send confirmation email
      const userQuery = 'SELECT full_name FROM users WHERE id = $1';
      const userResult = await db.query(userQuery, [resetData.userId]);
      if (userResult.rows.length > 0) {
        await sendgridClient.sendEmail({
          to: resetData.email,
          subject: 'Password Reset Successful',
          html: `
            <p>Hello ${userResult.rows[0].full_name},</p>
            <p>Your password has been successfully reset.</p>
            <p>If you did not make this change, please contact support immediately.</p>
          `,
        });
      }

      logger.info('Password reset successful', { userId: resetData.userId });
      return true;
    } catch (error) {
      logger.error('Password reset error', { error });
      return false;
    }
  }

  /**
   * Complete login with 2FA verification
   * Requirement 48.6: Require 2FA code after password authentication
   * Requirement 48.7: Allow 30-second time window for TOTP code validation
   * Requirement 48.8: Allow authentication using backup codes
   */
  async loginWith2FA(
    userId: string,
    code: string,
    isBackupCode: boolean,
    ipAddress: string
  ): Promise<AuthResult> {
    try {
      // Get temporary auth data
      const tempAuthKey = `temp_auth:${userId}`;
      const tempAuthData = await cacheService.get<{
        userId: string;
        email: string;
        role: string;
        permissions: string[];
        fullName: string;
        departmentId?: string;
      }>(tempAuthKey);

      if (!tempAuthData) {
        logger.warn('2FA login attempted without valid temp auth', { userId });
        return {
          success: false,
          error: 'Authentication session expired. Please login again.',
        };
      }

      // Verify 2FA code or backup code
      let verification;
      if (isBackupCode) {
        verification = await twoFactorService.verifyBackupCode(userId, code, ipAddress);
      } else {
        verification = await twoFactorService.verify2FA(userId, code, ipAddress);
      }

      if (!verification.valid) {
        return {
          success: false,
          error: verification.error || 'Invalid 2FA code',
        };
      }

      // Delete temporary auth data
      await cacheService.delete(tempAuthKey);

      // Generate session ID
      const sessionId = crypto.randomUUID();

      // Create session data
      const sessionData: SessionData = {
        userId: tempAuthData.userId,
        role: tempAuthData.role,
        email: tempAuthData.email,
        permissions: tempAuthData.permissions,
        createdAt: new Date(),
        lastActivity: new Date(),
      };

      // Store session in Redis (8-hour TTL)
      await sessionCache.setSession(sessionId, sessionData);

      // Generate JWT token
      const token = this.generateToken(
        tempAuthData.userId,
        sessionId,
        tempAuthData.role,
        tempAuthData.email
      );

      // Update last login timestamp
      await db.query('UPDATE users SET last_login = NOW() WHERE id = $1', [tempAuthData.userId]);

      logger.info('User logged in successfully with 2FA', {
        userId: tempAuthData.userId,
        email: tempAuthData.email,
        usedBackupCode: isBackupCode,
      });

      return {
        success: true,
        token,
        sessionId,
        user: {
          id: tempAuthData.userId,
          email: tempAuthData.email,
          fullName: tempAuthData.fullName,
          role: tempAuthData.role,
          permissions: tempAuthData.permissions,
          departmentId: tempAuthData.departmentId,
        },
      };
    } catch (error) {
      logger.error('2FA login error', { error, userId });
      return {
        success: false,
        error: 'An error occurred during 2FA verification',
      };
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<UserProfile | null> {
    try {
      const query = `
        SELECT u.id, u.email, u.full_name, r.name as role, r.permissions, u.department_id
        FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE u.id = $1
      `;
      const result = await db.query(query, [userId]);

      if (result.rows.length === 0) {
        return null;
      }

      const user = result.rows[0];
      return {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        permissions: user.permissions || [],
        departmentId: user.department_id,
      };
    } catch (error) {
      logger.error('Get user by ID error', { error, userId });
      return null;
    }
  }

  /**
   * Get session data
   */
  async getSession(sessionId: string): Promise<SessionData | null> {
    return await sessionCache.getSession(sessionId);
  }

  /**
   * Extend session TTL
   */
  async extendSession(sessionId: string): Promise<void> {
    await sessionCache.extendSession(sessionId);
  }

  /**
   * Authenticate developer with GitHub OAuth
   * Requirement 1.8: Support OAuth2 authentication via GitHub
   * Requirement 1.9: Require GitHub OAuth for developers
   * Requirement 12.1: Require GitHub OAuth for authentication
   * Requirement 12.2: Store GitHub username after successful authentication
   */
  async loginWithGitHub(
    githubUser: { id: string; username: string; email: string },
    accessToken: string
  ): Promise<AuthResult> {
    try {
      // Find user by email
      const userQuery = `
        SELECT u.id, u.email, u.full_name, u.github_username,
               r.name as role, r.permissions, u.department_id
        FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE u.email = $1
      `;
      const result = await db.query(userQuery, [githubUser.email]);

      if (result.rows.length === 0) {
        logger.warn('GitHub OAuth attempt with non-existent email', { email: githubUser.email });
        return {
          success: false,
          error: 'No account found with this GitHub email. Please contact your administrator.',
        };
      }

      const user = result.rows[0];

      // Check if user is a developer (requirement 1.9)
      if (user.role !== 'DEVELOPER') {
        logger.warn('GitHub OAuth attempt by non-developer user', {
          email: githubUser.email,
          role: user.role,
        });
        return {
          success: false,
          error: 'GitHub authentication is only available for developers',
        };
      }

      // Update GitHub username if not set or changed
      if (user.github_username !== githubUser.username) {
        await db.query('UPDATE users SET github_username = $1, updated_at = NOW() WHERE id = $2', [
          githubUser.username,
          user.id,
        ]);
        logger.info('Updated GitHub username for user', {
          userId: user.id,
          githubUsername: githubUser.username,
        });
      }

      // Generate session ID
      const sessionId = crypto.randomUUID();

      // Create session data
      const sessionData: SessionData = {
        userId: user.id,
        role: user.role,
        email: user.email,
        permissions: user.permissions || [],
        createdAt: new Date(),
        lastActivity: new Date(),
      };

      // Store session in Redis (8-hour TTL)
      await sessionCache.setSession(sessionId, sessionData);

      // Store GitHub access token in cache for API calls (8-hour TTL)
      await cacheService.set(`github_token:${user.id}`, accessToken, 8 * 60 * 60);

      // Generate JWT token
      const token = this.generateToken(user.id, sessionId, user.role, user.email);

      // Update last login timestamp
      await db.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

      logger.info('Developer logged in successfully via GitHub OAuth', {
        userId: user.id,
        email: user.email,
        githubUsername: githubUser.username,
      });

      return {
        success: true,
        token,
        sessionId,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          role: user.role,
          permissions: user.permissions || [],
          departmentId: user.department_id,
        },
      };
    } catch (error) {
      logger.error('GitHub OAuth login error', { error, githubUser });
      return {
        success: false,
        error: 'An error occurred during GitHub authentication',
      };
    }
  }

  /**
   * Get GitHub access token for user
   */
  async getGitHubAccessToken(userId: string): Promise<string | null> {
    try {
      return await cacheService.get<string>(`github_token:${userId}`);
    } catch (error) {
      logger.error('Error retrieving GitHub access token', { error, userId });
      return null;
    }
  }
}

export const authService = new AuthenticationService();
export default authService;
