import { Request, Response, NextFunction } from 'express';
import { auditService, AuditResult } from './auditService';
import logger from '../utils/logger';

/**
 * Express middleware that automatically logs every authenticated request
 * to the audit log after the response is sent.
 *
 * Requirements: 15.1, 15.4, 15.5, 15.6
 */
export const auditMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // Only log requests from authenticated users
  if (!req.user) {
    next();
    return;
  }

  const originalEnd = res.end.bind(res);

  // Intercept response end to capture status code
  (res as any).end = function (
    chunk?: any,
    encoding?: BufferEncoding | (() => void),
    callback?: () => void
  ) {
    // Restore original end before calling it
    res.end = originalEnd;

    // Determine result based on HTTP status code
    const result: AuditResult =
      res.statusCode >= 200 && res.statusCode < 400 ? AuditResult.SUCCESS : AuditResult.FAILURE;

    // Derive action from HTTP method
    const action = httpMethodToAction(req.method);

    // Derive resource type from path (first meaningful segment)
    const resourceType = extractResourceType(req.path);

    // Derive resource ID from path params
    const resourceId = req.params?.id ?? null;

    // Fire-and-forget — do not block the response
    auditService
      .log({
        userId: req.user!.id,
        action,
        resourceType,
        resourceId,
        ipAddress: req.ip ?? req.socket?.remoteAddress ?? 'unknown',
        userAgent: req.get('user-agent') ?? '',
        result,
        metadata: {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
        },
      })
      .catch((err) => {
        logger.error('auditMiddleware: failed to write log', { err });
      });

    // Call original end
    if (typeof encoding === 'function') {
      return originalEnd(chunk, encoding);
    }
    return originalEnd(chunk, encoding as BufferEncoding, callback);
  };

  next();
};

// ============================================================================
// Helpers
// ============================================================================

function httpMethodToAction(method: string): string {
  switch (method.toUpperCase()) {
    case 'GET':
      return 'VIEW';
    case 'POST':
      return 'CREATE';
    case 'PUT':
    case 'PATCH':
      return 'UPDATE';
    case 'DELETE':
      return 'DELETE';
    default:
      return method.toUpperCase();
  }
}

function extractResourceType(path: string): string {
  // Strip leading slash and take the first path segment
  const segments = path.replace(/^\//, '').split('/');
  return segments[0] ?? 'unknown';
}
