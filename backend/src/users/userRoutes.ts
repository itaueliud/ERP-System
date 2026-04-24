import { Router, Request, Response } from 'express';
import { userService } from './userService';
import { requireRole } from '../auth/authorizationMiddleware';
import { Role, INVITE_PERMISSIONS } from '../auth/authorizationService';
import logger from '../utils/logger';

const router = Router();

/**
 * Send invitation email to create new user
 * POST /api/v1/users/invite
 * Requirement 1.1: Create user accounts only through invitation emails
 * Requirement 1.2: Generate unique registration link valid for 72 hours
 *
 * Who can invite whom (Permissions Matrix):
 *   CEO              → CoS, CFO, COO, CTO, EA  (C-level accounts)
 *   CTO              → HEAD_OF_TRAINERS, TECHNOLOGY_USER, DEVELOPER
 *   HEAD_OF_TRAINERS → AGENT, TRAINER
 *   CFO              → CFO_ASSISTANT
 */
router.post(
  '/invite',
  requireRole(Role.CEO, Role.CTO, Role.HEAD_OF_TRAINERS, Role.CFO),
  async (req: Request, res: Response) => {
  try {
    const { email, roleId, departmentId } = req.body;

    if (!email || !roleId) {
      return res.status(400).json({ success: false, error: 'Email and roleId are required' });
    }

    const inviter = (req as any).user;
    if (!inviter?.id) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Resolve the target role name from the DB so we can enforce INVITE_PERMISSIONS
    const roleResult = await (await import('../database/connection')).db.query(
      'SELECT name FROM roles WHERE id = $1',
      [roleId]
    );
    if (roleResult.rows.length === 0) {
      return res.status(400).json({ success: false, error: 'Invalid roleId' });
    }
    const targetRole = roleResult.rows[0].name as Role;

    const allowedTargets = INVITE_PERMISSIONS[inviter.role as Role] ?? [];
    if (!allowedTargets.includes(targetRole)) {
      logger.warn('Invite permission denied', { inviterRole: inviter.role, targetRole });
      return res.status(403).json({
        success: false,
        error: `Your role (${inviter.role}) is not permitted to invite ${targetRole} accounts`,
      });
    }

    const invitation = await userService.sendInvitation({
      email,
      roleId,
      departmentId,
      invitedBy: inviter.id,
    });

    return res.status(201).json({
      success: true,
      data: { id: invitation.id, email: invitation.email, expiresAt: invitation.expiresAt },
    });
  } catch (error: any) {
    logger.error('Failed to send invitation', { error });
    return res.status(400).json({ success: false, error: error.message || 'Failed to send invitation' });
  }
});

/**
 * Validate invitation token
 * GET /api/v1/users/invite/validate/:token
 * Requirement 1.5: Display error message for expired registration links
 */
router.get('/invite/validate/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    const invitation = await userService.validateInvitationToken(token);

    if (!invitation) {
      return res.status(404).json({
        success: false,
        error: 'Invalid invitation token',
      });
    }

    return res.json({
      success: true,
      data: {
        email: invitation.email,
        expiresAt: invitation.expiresAt,
      },
    });
  } catch (error: any) {
    logger.error('Failed to validate invitation token', { error });
    return res.status(400).json({
      success: false,
      error: error.message || 'Failed to validate invitation token',
    });
  }
});

/**
 * Register user from invitation
 * POST /api/v1/users/register
 * Requirement 1.3: Display account setup form for valid registration link
 * Requirement 1.4: Create account with assigned role
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { token, email, password, fullName, phone, country, languagePreference, timezone } =
      req.body;

    // Validate required fields
    if (!token || !email || !password || !fullName || !phone || !country) {
      return res.status(400).json({
        success: false,
        error: 'All required fields must be provided',
      });
    }

    // Validate password complexity (Requirement 39.11)
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        success: false,
        error:
          'Password must be at least 12 characters and contain uppercase, lowercase, number, and special character',
      });
    }

    const user = await userService.createUserFromInvitation(token, {
      email,
      password,
      fullName,
      phone,
      country,
      roleId: '', // Will be set from invitation
      languagePreference,
      timezone,
    });

    return res.status(201).json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.roleName,
      },
    });
  } catch (error: any) {
    logger.error('Failed to register user', { error });
    return res.status(400).json({
      success: false,
      error: error.message || 'Failed to register user',
    });
  }
});

/**
 * Get current user profile
 * GET /api/v1/users/me
 * Requirement 39.1: Allow users to view profile information
 */
router.get('/me', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    const user = await userService.getUserById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    return res.json({
      success: true,
      data: user,
    });
  } catch (error: any) {
    logger.error('Failed to get user profile', { error });
    return res.status(500).json({
      success: false,
      error: 'Failed to get user profile',
    });
  }
});

/**
 * Update user profile
 * PUT /api/v1/users/me
 * Requirement 39.1: Allow users to edit profile information
 */
router.put('/me', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    const { fullName, phone, country, departmentId, languagePreference, timezone, profilePhotoUrl } =
      req.body;

    const user = await userService.updateUser(userId, {
      fullName,
      phone,
      country,
      departmentId,
      languagePreference,
      timezone,
      profilePhotoUrl,
    });

    return res.json({
      success: true,
      data: user,
    });
  } catch (error: any) {
    logger.error('Failed to update user profile', { error });
    return res.status(400).json({
      success: false,
      error: error.message || 'Failed to update user profile',
    });
  }
});

/**
 * Change password
 * POST /api/v1/users/me/password
 * Requirement 39.9: Allow users to change their password
 * Requirement 39.10: Require current password verification
 */
router.post('/me/password', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Current password and new password are required',
      });
    }

    // Validate password complexity (Requirement 39.11)
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({
        success: false,
        error:
          'Password must be at least 12 characters and contain uppercase, lowercase, number, and special character',
      });
    }

    await userService.changePassword(userId, currentPassword, newPassword);

    return res.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error: any) {
    logger.error('Failed to change password', { error });
    return res.status(400).json({
      success: false,
      error: error.message || 'Failed to change password',
    });
  }
});

/**
 * Get user by ID
 * GET /api/v1/users/:id
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const user = await userService.getUserById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    return res.json({
      success: true,
      data: user,
    });
  } catch (error: any) {
    logger.error('Failed to get user', { error });
    return res.status(500).json({
      success: false,
      error: 'Failed to get user',
    });
  }
});

/**
 * List users with pagination and filtering
 * GET /api/v1/users
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { roleId, departmentId, search, limit, offset } = req.query;

    const result = await userService.listUsers({
      roleId: roleId as string,
      departmentId: departmentId as string,
      search: search as string,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });

    res.json({
      success: true,
      data: result.users,
      pagination: {
        total: result.total,
        limit: limit ? parseInt(limit as string) : 50,
        offset: offset ? parseInt(offset as string) : 0,
      },
    });
  } catch (error: any) {
    logger.error('Failed to list users', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to list users',
    });
  }
});

/**
 * Update user by ID
 * PUT /api/v1/users/:id
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { fullName, phone, country, departmentId, languagePreference, timezone, profilePhotoUrl } =
      req.body;

    const user = await userService.updateUser(id, {
      fullName,
      phone,
      country,
      departmentId,
      languagePreference,
      timezone,
      profilePhotoUrl,
    });

    res.json({
      success: true,
      data: user,
    });
  } catch (error: any) {
    logger.error('Failed to update user', { error });
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to update user',
    });
  }
});

/**
 * Delete user
 * DELETE /api/v1/users/:id
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await userService.deleteUser(id);

    res.json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error: any) {
    logger.error('Failed to delete user', { error });
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to delete user',
    });
  }
});

// ============================================================================
// Email verification (Req 39.5-39.6)
// ============================================================================

/**
 * POST /api/v1/users/me/email
 * Initiate email change — sends verification to new address
 */
router.post('/me/email', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const { newEmail } = req.body;
    if (!newEmail) return res.status(400).json({ success: false, error: 'newEmail is required' });

    await userService.initiateEmailChange(userId, newEmail);
    return res.json({ success: true, message: 'Verification email sent to new address' });
  } catch (error: any) {
    logger.error('Failed to initiate email change', { error });
    return res.status(400).json({ success: false, error: error.message || 'Failed to initiate email change' });
  }
});

/**
 * GET /api/v1/users/verify-email
 * Confirm email change via token
 */
router.get('/verify-email', async (req: Request, res: Response) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ success: false, error: 'token is required' });

    const user = await userService.confirmEmailChange(token as string);
    return res.json({ success: true, data: { email: user.email } });
  } catch (error: any) {
    logger.error('Failed to confirm email change', { error });
    return res.status(400).json({ success: false, error: error.message || 'Failed to verify email' });
  }
});

// ============================================================================
// Profile photo upload (Req 39.7-39.8)
// ============================================================================

/**
 * POST /api/v1/users/me/photo
 * Upload profile photo (base64 encoded in body)
 */
router.post('/me/photo', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const { imageBase64, mimetype } = req.body;
    if (!imageBase64) return res.status(400).json({ success: false, error: 'imageBase64 is required' });

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    const type = mimetype || 'image/jpeg';
    if (!allowedTypes.includes(type)) {
      return res.status(400).json({ success: false, error: 'Only JPEG and PNG images are allowed' });
    }

    const buffer = Buffer.from(imageBase64, 'base64');
    if (buffer.length > 5 * 1024 * 1024) {
      return res.status(400).json({ success: false, error: 'Profile photo must be under 5 MB' });
    }

    const url = await userService.uploadProfilePhoto(userId, buffer, type);
    return res.json({ success: true, data: { profilePhotoUrl: url } });
  } catch (error: any) {
    logger.error('Failed to upload profile photo', { error });
    return res.status(400).json({ success: false, error: error.message || 'Failed to upload photo' });
  }
});

// ============================================================================
// Account suspension / deactivation
// ============================================================================

/**
 * POST /api/v1/users/:id/suspend
 */
router.post('/:id/suspend', async (req: Request, res: Response) => {
  try {
    const suspendedBy = (req as any).user?.id;
    if (!suspendedBy) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const { reason } = req.body;
    if (!reason) return res.status(400).json({ success: false, error: 'reason is required' });

    await userService.suspendUser(req.params.id, reason, suspendedBy);
    return res.json({ success: true, message: 'User suspended' });
  } catch (error: any) {
    logger.error('Failed to suspend user', { error });
    return res.status(400).json({ success: false, error: error.message || 'Failed to suspend user' });
  }
});

/**
 * POST /api/v1/users/:id/reactivate
 */
router.post('/:id/reactivate', async (req: Request, res: Response) => {
  try {
    const reactivatedBy = (req as any).user?.id;
    if (!reactivatedBy) return res.status(401).json({ success: false, error: 'Unauthorized' });

    await userService.reactivateUser(req.params.id, reactivatedBy);
    return res.json({ success: true, message: 'User reactivated' });
  } catch (error: any) {
    logger.error('Failed to reactivate user', { error });
    return res.status(400).json({ success: false, error: error.message || 'Failed to reactivate user' });
  }
});

// ============================================================================
// Activity tracking
// ============================================================================

/**
 * GET /api/v1/users/:id/activity
 */
router.get('/:id/activity', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;

    const result = await userService.getActivityLog(req.params.id, limit, offset);
    return res.json({ success: true, data: result.activities, total: result.total });
  } catch (error: any) {
    logger.error('Failed to get activity log', { error });
    return res.status(500).json({ success: false, error: 'Failed to get activity log' });
  }
});

// ============================================================================
// Bulk CSV import
// ============================================================================

/**
 * POST /api/v1/users/bulk/import
 * CEO only
 */
router.post('/bulk/import', requireRole(Role.CEO), async (req: Request, res: Response) => {
  try {
    const requestedBy = (req as any).user?.id;
    if (!requestedBy) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const { csvContent } = req.body;
    if (!csvContent) return res.status(400).json({ success: false, error: 'csvContent is required' });

    const result = await userService.bulkImportUsers(csvContent, requestedBy);
    return res.status(202).json({ success: true, data: result });
  } catch (error: any) {
    logger.error('Failed to bulk import users', { error });
    return res.status(400).json({ success: false, error: error.message || 'Failed to initiate import' });
  }
});

// ============================================================================
// Password reset via invitation resend
// ============================================================================

/**
 * POST /api/v1/users/resend-invitation
 * Resend invitation as password reset link
 */
router.post('/resend-invitation', async (req: Request, res: Response) => {
  try {
    const requestedBy = (req as any).user?.id;
    if (!requestedBy) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, error: 'email is required' });

    await userService.resendInvitationAsPasswordReset(email, requestedBy);
    return res.json({ success: true, message: 'Password reset invitation sent' });
  } catch (error: any) {
    logger.error('Failed to resend invitation', { error });
    return res.status(400).json({ success: false, error: error.message || 'Failed to resend invitation' });
  }
});

/**
 * POST /api/v1/users/:id/role
 * Update a user's role (CEO only)
 */
router.post('/:id/role', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    if (!role) return res.status(400).json({ success: false, error: 'role is required' });
    const { db } = await import('../database/connection');
    const roleResult = await db.query('SELECT id FROM roles WHERE name = $1', [role]);
    if (roleResult.rows.length === 0) {
      return res.status(400).json({ success: false, error: `Role "${role}" not found` });
    }
    await db.query('UPDATE users SET role_id = $1 WHERE id = $2', [roleResult.rows[0].id, id]);
    return res.json({ success: true, message: 'Role updated' });
  } catch (error: any) {
    logger.error('Failed to update user role', { error });
    return res.status(400).json({ success: false, error: error.message || 'Failed to update role' });
  }
});

/**
 * GET /api/v1/users/roles
 * Returns all roles with their IDs — used by frontend invite forms
 */
router.get('/roles', async (_req: Request, res: Response) => {
  try {
    const { db } = await import('../database/connection');
    const result = await db.query('SELECT id, name FROM roles ORDER BY name');
    return res.json({ success: true, data: result.rows });
  } catch (error: any) {
    logger.error('Failed to get roles', { error });
    return res.status(500).json({ success: false, error: 'Failed to get roles' });
  }
});

export default router;
