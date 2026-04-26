import { Request, Response, NextFunction } from 'express';
import { authService } from './authService';
import logger from '../utils/logger';

/**
 * JWT Authentication Middleware
 * Validates the Bearer token from Authorization header or auth_token cookie,
 * loads the user profile, and attaches it to req.user.
 * Returns 401 if token is missing, invalid, or user not found.
 */
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Extract token from Authorization header or cookie
    const authHeader = req.headers.authorization;
    const token =
      (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined) ||
      (req as any).cookies?.auth_token;

    if (!token) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Validate token and get payload
    const payload = await authService.validateToken(token);
    if (!payload) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Load user profile
    const user = await authService.getUserById(payload.userId);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Attach user to request
    (req as any).user = {
      id: user.id,
      email: user.email,
      role: user.role,
      permissions: user.permissions,
      sessionId: payload.sessionId,
    };

    next();
  } catch (error) {
    logger.error('Authentication middleware error', { error });
    res.status(401).json({ error: 'Unauthorized' });
  }
}
