import { Router, Request, Response } from 'express';
import passport from 'passport';
import rateLimit from 'express-rate-limit';
import { authService } from './authService';
import { authenticate } from './authMiddleware';
import { githubClient } from '../services/github/client';
import logger from '../utils/logger';

const router = Router();

// Strict rate limiter for login — 10 attempts per 15 minutes per IP
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for password reset — 5 requests per hour per IP
const passwordResetRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Too many password reset requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
// Initialize GitHub OAuth strategy
githubClient.configureOAuth();

/**
 * POST /auth/login
 * Authenticate user and return JWT token
 */
router.post('/login', loginRateLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required',
      });
    }

    // Attempt login
    const result = await authService.login({ email, password });

    if (!result.success) {
      return res.status(401).json({
        error: result.error,
        requires2FA: result.requires2FA,
      });
    }

    // Set token in httpOnly cookie
    res.cookie('auth_token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 8 * 60 * 60 * 1000, // 8 hours
    });

    // Return user profile + token in body (for SPA clients that can't read httpOnly cookies)
    return res.json({
      success: true,
      token: result.token,
      user: result.user,
      sessionId: result.sessionId,
    });
  } catch (error) {
    logger.error('Login route error', { error });
    return res.status(500).json({
      error: 'An error occurred during login',
    });
  }
});

/**
 * GET /auth/github
 * Initiate GitHub OAuth flow
 * Requirements: 1.8, 1.9, 12.1
 */
router.get('/github', passport.authenticate('github', { scope: ['user:email', 'read:user'] }));

/**
 * GET /auth/github/callback
 * GitHub OAuth callback handler
 * Requirements: 1.8, 1.9, 12.1, 12.2
 */
router.get(
  '/github/callback',
  passport.authenticate('github', { session: false, failureRedirect: '/login?error=github_auth_failed' }),
  async (req: Request, res: Response) => {
    try {
      // Extract GitHub user data and access token from passport
      const { user: githubUser, accessToken } = req.user as any;

      if (!githubUser || !accessToken) {
        logger.error('GitHub callback missing user data or access token');
        return res.redirect('/login?error=github_auth_failed');
      }

      // Authenticate with GitHub user data
      const result = await authService.loginWithGitHub(
        {
          id: githubUser.id,
          username: githubUser.username,
          email: githubUser.email,
        },
        accessToken
      );

      if (!result.success) {
        logger.warn('GitHub OAuth authentication failed', { error: result.error });
        return res.redirect(`/login?error=${encodeURIComponent(result.error || 'github_auth_failed')}`);
      }

      // Set token in httpOnly cookie
      res.cookie('auth_token', result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 8 * 60 * 60 * 1000, // 8 hours
      });

      // Redirect to technology portal (developer dashboard)
      return res.redirect('/technology?github_auth=success');
    } catch (error) {
      logger.error('GitHub callback error', { error });
      return res.redirect('/login?error=github_auth_failed');
    }
  }
);

/**
 * POST /auth/logout
 * Logout user and invalidate session — requires a valid JWT.
 * The session to invalidate is taken from the token itself, not the request body.
 */
router.post('/logout', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    await authService.logout(user.id, user.sessionId);

    // Clear cookie
    res.clearCookie('auth_token');

    return res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    logger.error('Logout route error', { error });
    return res.status(500).json({
      error: 'An error occurred during logout',
    });
  }
});

/**
 * POST /auth/forgot-password
 * Request password reset email
 */
router.post('/forgot-password', passwordResetRateLimiter, async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: 'Email is required',
      });
    }

    await authService.requestPasswordReset(email);

    // Always return success to prevent email enumeration
    return res.json({
      success: true,
      message: 'If an account exists with this email, a password reset link has been sent',
    });
  } catch (error) {
    logger.error('Forgot password route error', { error });
    return res.status(500).json({
      error: 'An error occurred processing your request',
    });
  }
});

/**
 * POST /auth/reset-password
 * Reset password with token — rate limited to prevent timing probes
 */
router.post('/reset-password', passwordResetRateLimiter, async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        error: 'Token and new password are required',
      });
    }

    // Validate password strength — same rules as registration
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({
        error: 'Password must be at least 12 characters and contain uppercase, lowercase, number, and special character',
      });
    }

    const success = await authService.resetPassword(token, newPassword);

    if (!success) {
      return res.status(400).json({
        error: 'Invalid or expired reset token',
      });
    }

    return res.json({
      success: true,
      message: 'Password reset successfully',
    });
  } catch (error) {
    logger.error('Reset password route error', { error });
    return res.status(500).json({
      error: 'An error occurred resetting your password',
    });
  }
});

/**
 * GET /auth/me
 * Get current user profile (requires authentication)
 */
router.get('/me', async (req: Request, res: Response) => {
  try {
    // Extract token from Authorization header or cookie
    const token = req.headers.authorization?.replace('Bearer ', '') || req.cookies.auth_token;

    if (!token) {
      return res.status(401).json({
        error: 'No authentication token provided',
      });
    }

    // Validate token
    const payload = await authService.validateToken(token);

    if (!payload) {
      return res.status(401).json({
        error: 'Invalid or expired token',
      });
    }

    // Get user profile
    const user = await authService.getUserById(payload.userId);

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
      });
    }

    return res.json({
      success: true,
      user,
    });
  } catch (error) {
    logger.error('Get user profile route error', { error });
    return res.status(500).json({
      error: 'An error occurred retrieving user profile',
    });
  }
});

/**
 * POST /auth/refresh
 * Extend session and refresh token
 */
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '') || req.cookies.auth_token;

    if (!token) {
      return res.status(401).json({
        error: 'No authentication token provided',
      });
    }

    const payload = await authService.validateToken(token);

    if (!payload) {
      return res.status(401).json({
        error: 'Invalid or expired token',
      });
    }

    // Extend session
    await authService.extendSession(payload.sessionId);

    // Generate new token
    const newToken = authService.generateToken(
      payload.userId,
      payload.sessionId,
      payload.role,
      payload.email
    );

    // Set new token in cookie
    res.cookie('auth_token', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 8 * 60 * 60 * 1000, // 8 hours
    });

    return res.json({
      success: true,
      token: newToken,
    });
  } catch (error) {
    logger.error('Refresh token route error', { error });
    return res.status(500).json({
      error: 'An error occurred refreshing your session',
    });
  }
});

export default router;
