import { Request, Response, NextFunction } from 'express';
import { authorizationService, Role } from './authorizationService';
import { db } from '../database/connection';
import logger from '../utils/logger';

/**
 * Authorization Middleware
 * Enforces role-based access control at the middleware layer
 * Requirements: 2.1-2.10
 */

/**
 * Middleware to check if user has required role
 * Requirement 2.1: Enforce RBAC at middleware layer before processing requests
 * Requirement 2.3: Return 403 Forbidden if user lacks proper role permissions
 */
export const requireRole = (...allowedRoles: Role[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: 'Authentication required',
        });
      }

      // Check if user has any of the allowed roles
      const hasRole = allowedRoles.includes(req.user.role as Role);

      if (!hasRole) {
        // Log access control decision (Requirement 2.10)
        await logAccessDecision(
          req.user.id,
          'ROLE_CHECK_FAILED',
          req.path,
          'FAILURE',
          req.ip || 'unknown',
          req.get('user-agent') || '',
          {
            userRole: req.user.role,
            requiredRoles: allowedRoles,
          }
        );

        logger.warn('Unauthorized role access attempt', {
          userId: req.user.id,
          role: req.user.role,
          requiredRoles: allowedRoles,
          path: req.path,
        });

        return res.status(403).json({
          error: 'Insufficient permissions',
        });
      }

      // Log successful access (Requirement 2.10)
      await logAccessDecision(
        req.user.id,
        'ROLE_CHECK_PASSED',
        req.path,
        'SUCCESS',
        req.ip || 'unknown',
        req.get('user-agent') || '',
        {
          userRole: req.user.role,
          requiredRoles: allowedRoles,
        }
      );

      return next();
    } catch (error) {
      logger.error('Role check middleware error', { error });
      return res.status(500).json({
        error: 'Authorization error',
      });
    }
  };
};

/**
 * Middleware to check if user has required permissions
 * Requirement 2.1: Enforce RBAC at middleware layer before processing requests
 * Requirement 2.3: Return 403 Forbidden if user lacks proper permissions
 */
export const requirePermissions = (...requiredPermissions: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: 'Authentication required',
        });
      }

      // Check if user has all required permissions
      const hasPermissions = await authorizationService.hasPermissions(
        req.user.id,
        requiredPermissions
      );

      if (!hasPermissions) {
        // Log access control decision (Requirement 2.10)
        await logAccessDecision(
          req.user.id,
          'PERMISSION_CHECK_FAILED',
          req.path,
          'FAILURE',
          req.ip || 'unknown',
          req.get('user-agent') || '',
          {
            userPermissions: req.user.permissions,
            requiredPermissions,
          }
        );

        logger.warn('Unauthorized permission access attempt', {
          userId: req.user.id,
          userPermissions: req.user.permissions,
          requiredPermissions,
          path: req.path,
        });

        return res.status(403).json({
          error: 'Insufficient permissions',
        });
      }

      // Log successful access (Requirement 2.10)
      await logAccessDecision(
        req.user.id,
        'PERMISSION_CHECK_PASSED',
        req.path,
        'SUCCESS',
        req.ip || 'unknown',
        req.get('user-agent') || '',
        {
          requiredPermissions,
        }
      );

      return next();
    } catch (error) {
      logger.error('Permission check middleware error', { error });
      return res.status(500).json({
        error: 'Authorization error',
      });
    }
  };
};

/**
 * Middleware to check if user can access financial data
 * Requirement 2.8: Restrict financial data access to CEO, CoS, CFO, EA only
 * Requirement 2.3: Return 403 Forbidden if user lacks financial access
 */
export const requireFinancialAccess = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
      });
    }

    const canAccess = await authorizationService.canAccessFinancialData(req.user.id);

    if (!canAccess) {
      // Log access control decision (Requirement 2.10)
      await logAccessDecision(
        req.user.id,
        'FINANCIAL_ACCESS_DENIED',
        req.path,
        'FAILURE',
        req.ip || 'unknown',
        req.get('user-agent') || '',
        {
          userRole: req.user.role,
        }
      );

      logger.warn('Unauthorized financial data access attempt', {
        userId: req.user.id,
        role: req.user.role,
        path: req.path,
      });

      return res.status(403).json({
        error: 'Access to financial data is restricted',
      });
    }

    // Log successful access (Requirement 2.10)
    await logAccessDecision(
      req.user.id,
      'FINANCIAL_ACCESS_GRANTED',
      req.path,
      'SUCCESS',
      req.ip || 'unknown',
      req.get('user-agent') || '',
      {
        userRole: req.user.role,
      }
    );

    return next();
  } catch (error) {
    logger.error('Financial access check middleware error', { error });
    return res.status(500).json({
      error: 'Authorization error',
    });
  }
};

/**
 * Middleware to check if user can access resource
 * Requirement 2.2: Verify user's role permits access to resource
 * Requirement 2.7: Agents can only access their own data and assigned clients
 */
export const requireResourceAccess = (resourceType: string, resourceIdParam: string = 'id') => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: 'Authentication required',
        });
      }

      const resourceId = req.params[resourceIdParam];

      if (!resourceId) {
        return res.status(400).json({
          error: 'Resource ID is required',
        });
      }

      const canAccess = await authorizationService.canAccessResource(
        req.user.id,
        resourceType,
        resourceId
      );

      if (!canAccess) {
        // Log access control decision (Requirement 2.10)
        await logAccessDecision(
          req.user.id,
          'RESOURCE_ACCESS_DENIED',
          req.path,
          'FAILURE',
          req.ip || 'unknown',
          req.get('user-agent') || '',
          {
            resourceType,
            resourceId,
            userRole: req.user.role,
          }
        );

        logger.warn('Unauthorized resource access attempt', {
          userId: req.user.id,
          role: req.user.role,
          resourceType,
          resourceId,
          path: req.path,
        });

        return res.status(403).json({
          error: 'Access to this resource is not permitted',
        });
      }

      // Log successful access (Requirement 2.10)
      await logAccessDecision(
        req.user.id,
        'RESOURCE_ACCESS_GRANTED',
        req.path,
        'SUCCESS',
        req.ip || 'unknown',
        req.get('user-agent') || '',
        {
          resourceType,
          resourceId,
        }
      );

      return next();
    } catch (error) {
      logger.error('Resource access check middleware error', { error });
      return res.status(500).json({
        error: 'Authorization error',
      });
    }
  };
};

/**
 * Middleware to check if user owns resource
 * Requirement 2.7: Agents can only access their own data and assigned clients
 */
export const requireResourceOwnership = (
  resourceType: string,
  resourceIdParam: string = 'id'
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: 'Authentication required',
        });
      }

      const resourceId = req.params[resourceIdParam];

      if (!resourceId) {
        return res.status(400).json({
          error: 'Resource ID is required',
        });
      }

      // CEO has access to all resources (Requirement 2.6)
      if (req.user.role === Role.CEO) {
        return next();
      }

      const ownsResource = await authorizationService.ownsResource(
        req.user.id,
        resourceType,
        resourceId
      );

      if (!ownsResource) {
        // Log access control decision (Requirement 2.10)
        await logAccessDecision(
          req.user.id,
          'OWNERSHIP_CHECK_FAILED',
          req.path,
          'FAILURE',
          req.ip || 'unknown',
          req.get('user-agent') || '',
          {
            resourceType,
            resourceId,
            userRole: req.user.role,
          }
        );

        logger.warn('Unauthorized resource ownership access attempt', {
          userId: req.user.id,
          role: req.user.role,
          resourceType,
          resourceId,
          path: req.path,
        });

        return res.status(403).json({
          error: 'You do not have permission to access this resource',
        });
      }

      // Log successful access (Requirement 2.10)
      await logAccessDecision(
        req.user.id,
        'OWNERSHIP_CHECK_PASSED',
        req.path,
        'SUCCESS',
        req.ip || 'unknown',
        req.get('user-agent') || '',
        {
          resourceType,
          resourceId,
        }
      );

      return next();
    } catch (error) {
      logger.error('Resource ownership check middleware error', { error });
      return res.status(500).json({
        error: 'Authorization error',
      });
    }
  };
};

/**
 * Log access control decision to audit log
 * Requirement 2.10: Log all access control decisions to audit log
 */
async function logAccessDecision(
  userId: string,
  action: string,
  _resource: string,
  result: 'SUCCESS' | 'FAILURE',
  ipAddress: string,
  userAgent: string,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    const query = `
      INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address, user_agent, result, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `;

    await db.query(query, [
      userId,
      action,
      'authorization',
      null,
      ipAddress,
      userAgent,
      result,
      JSON.stringify(metadata || {}),
    ]);
  } catch (error) {
    logger.error('Error logging access decision', { error, userId, action });
  }
}

/**
 * Example usage in routes:
 *
 * // Require specific role
 * router.get('/admin', authenticate, requireRole(Role.CEO, Role.CoS), (req, res) => {
 *   res.json({ message: 'Admin access granted' });
 * });
 *
 * // Require specific permissions
 * router.post('/clients', authenticate, requirePermissions('write:clients'), (req, res) => {
 *   // Create client
 * });
 *
 * // Require financial access
 * router.get('/payments', authenticate, requireFinancialAccess, (req, res) => {
 *   // Get payment data
 * });
 *
 * // Require resource access
 * router.get('/clients/:id', authenticate, requireResourceAccess('clients'), (req, res) => {
 *   // Get client
 * });
 *
 * // Require resource ownership
 * router.put('/clients/:id', authenticate, requireResourceOwnership('clients'), (req, res) => {
 *   // Update client
 * });
 */
