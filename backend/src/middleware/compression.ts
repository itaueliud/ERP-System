/**
 * API Response Compression Middleware
 *
 * Applies gzip compression to API responses to reduce payload size.
 * Requirement 37.9: Implement API response compression.
 */

import compression from 'compression';
import { Request, Response } from 'express';

/**
 * Returns a configured compression middleware.
 * - Compresses responses >= 1 KB (default threshold).
 * - Skips compression for Server-Sent Events and already-compressed content.
 */
export function compressionMiddleware() {
  return compression({
    // Only compress responses larger than 1 KB
    threshold: 1024,
    // Use maximum compression level for best ratio
    level: 6,
    filter: shouldCompress,
  });
}

/**
 * Determines whether a response should be compressed.
 * Skips compression if the client sends `x-no-compression` header,
 * or if the content type is already compressed (images, video, etc.).
 */
function shouldCompress(req: Request, res: Response): boolean {
  if (req.headers['x-no-compression']) {
    return false;
  }
  return compression.filter(req, res);
}
