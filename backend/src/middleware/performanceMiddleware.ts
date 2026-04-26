/**
 * Performance Middleware
 *
 * Consolidates performance-related middleware:
 * - Query execution time monitoring (Requirement 21.7)
 * - API response compression via gzip (Requirement 37.9)
 * - Request timing headers
 *
 * Requirements: 37.7-37.9, 21.6, 21.7
 */

import { Request, Response, NextFunction } from 'express';
import { compressionMiddleware } from './compression';
import { queryMonitorMiddleware, SLOW_QUERY_THRESHOLD_MS } from '../utils/queryMonitor';
import logger from '../utils/logger';

export { compressionMiddleware } from './compression';
export { queryMonitorMiddleware, SLOW_QUERY_THRESHOLD_MS } from '../utils/queryMonitor';

/**
 * Middleware that records request start time and appends an
 * X-Response-Time header (in ms) to every response.
 * Logs a warning for requests that take longer than the slow query threshold.
 */
export function requestTimingMiddleware() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const start = Date.now();

    res.on('finish', () => {
      const durationMs = Date.now() - start;
      // Guard: headers may already be sent
      if (!res.headersSent) {
        res.setHeader('X-Response-Time', `${durationMs}ms`);
      }

      if (durationMs > SLOW_QUERY_THRESHOLD_MS) {
        logger.warn('Slow request detected', {
          method: req.method,
          path: req.path,
          durationMs,
          statusCode: res.statusCode,
        });
      } else {
        logger.debug('Request completed', {
          method: req.method,
          path: req.path,
          durationMs,
          statusCode: res.statusCode,
        });
      }
    });

    next();
  };
}

/**
 * Applies all performance middleware to an Express app in the correct order:
 * 1. gzip compression
 * 2. query monitor context
 * 3. request timing
 */
export function applyPerformanceMiddleware(app: import('express').Application): void {
  app.use(compressionMiddleware());
  app.use(queryMonitorMiddleware());
  app.use(requestTimingMiddleware());
}
