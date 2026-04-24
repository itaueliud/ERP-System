/**
 * 2FA Enforcement Middleware
 * Doc §21: 2FA mandatory for CEO, CoS, CFO, EA — cannot be disabled
 * Doc §21: CEO login generates immediate security notification
 */
import { Request, Response, NextFunction } from 'express';
import { Role } from '../auth/authorizationService';
import logger from '../utils/logger';

const MANDATORY_2FA_ROLES: string[] = [Role.CEO, Role.CoS, Role.CFO, Role.EA];

/**
 * Enforces that executive roles have 2FA enabled before accessing protected routes.
 * Must be placed after `authenticate` middleware.
 */
export function enforce2FA(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  if (MANDATORY_2FA_ROLES.includes(user.role) && !user.twoFaVerified) {
    logger.warn('2FA required but not verified', { userId: user.id, role: user.role });
    return res.status(403).json({
      error: '2FA_REQUIRED',
      message: 'Two-factor authentication is mandatory for your role. Please complete 2FA verification.',
    });
  }

  return next();
}

/**
 * Middleware to check if a portal is enabled (doc §6 Portal Access Control).
 * Reads from system_config table.
 */
export function requirePortalEnabled(portalName: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { db } = await import('../database/connection');
      const key = `portal_${portalName.toLowerCase()}_enabled`;
      const result = await db.query(`SELECT value FROM system_config WHERE key = $1`, [key]);

      if (result.rows.length && result.rows[0].value === false) {
        return res.status(503).json({ error: 'This portal is currently disabled' });
      }

      return next();
    } catch (err) {
      logger.error('Portal check error', { err });
      return next(); // fail open — don't block on config read error
    }
  };
}

/**
 * Portal-to-role mapping (doc §3)
 * Validates that the user's role is allowed to access the portal they're logging into.
 */
export const PORTAL_ROLE_MAP: Record<string, string[]> = {
  alpha:  [Role.CEO],
  delta:  [Role.CoS, Role.CFO, Role.EA],
  sigma:  [Role.COO, Role.CTO],
  nexus:  [Role.COO, 'OPERATIONS_USER', Role.HEAD_OF_TRAINERS, Role.TRAINER],
  vertex: [Role.CTO, 'TECHNOLOGY_USER', 'DEVELOPER'],
  pulse:  [Role.AGENT],
};

export function requirePortalAccess(portal: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const allowedRoles = PORTAL_ROLE_MAP[portal.toLowerCase()];
    if (!allowedRoles) return res.status(400).json({ error: 'Unknown portal' });

    if (!allowedRoles.includes(user.role)) {
      logger.warn('Portal access denied', { userId: user.id, role: user.role, portal });
      return res.status(403).json({
        error: 'PORTAL_ACCESS_DENIED',
        message: 'Your role does not have access to this portal',
      });
    }

    return next();
  };
}
