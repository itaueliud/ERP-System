/**
 * Query Performance Monitoring Utility
 *
 * Wraps database queries to track execution time and log slow queries.
 * Requirement 21.7: Log a slow query warning when a query exceeds 1 second.
 */

import logger from './logger';

export const SLOW_QUERY_THRESHOLD_MS = 1000;

export interface QueryMetrics {
  query: string;
  durationMs: number;
  params?: unknown[];
  rowCount?: number;
  isSlow: boolean;
}

/**
 * Wraps a database query function with execution time monitoring.
 * Logs a warning if the query exceeds SLOW_QUERY_THRESHOLD_MS.
 */
export async function monitorQuery<T>(
  queryText: string,
  params: unknown[] | undefined,
  executor: () => Promise<T & { rowCount?: number | null }>
): Promise<T & { rowCount?: number | null }> {
  const start = Date.now();
  try {
    const result = await executor();
    const durationMs = Date.now() - start;

    const metrics: QueryMetrics = {
      query: queryText,
      durationMs,
      params,
      rowCount: result.rowCount ?? undefined,
      isSlow: durationMs > SLOW_QUERY_THRESHOLD_MS,
    };

    if (metrics.isSlow) {
      logger.warn('Slow query detected', {
        query: queryText,
        durationMs,
        params,
        rowCount: metrics.rowCount,
      });
    } else {
      logger.debug('Query executed', {
        query: queryText,
        durationMs,
        rowCount: metrics.rowCount,
      });
    }

    return result;
  } catch (error) {
    const durationMs = Date.now() - start;
    logger.error('Query execution failed', {
      query: queryText,
      durationMs,
      params,
      error,
    });
    throw error;
  }
}

/**
 * Express middleware that attaches query timing context to the request.
 * Useful for correlating slow queries with specific API endpoints.
 */
export function queryMonitorMiddleware() {
  return (req: import('express').Request, _res: import('express').Response, next: import('express').NextFunction): void => {
    (req as any).queryStartTime = Date.now();
    next();
  };
}
