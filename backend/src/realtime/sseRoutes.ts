import { Router, Request, Response } from 'express';
import { sseService } from './sseService';
import { randomUUID } from 'crypto';
import logger from '../utils/logger';

const router = Router();

/**
 * SSE endpoint for real-time updates
 * GET /api/v1/sse/stream
 */
router.get('/stream', (req: Request, res: Response) => {
  const user = (req as any).user;
  
  if (!user || !user.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const clientId = randomUUID();
  const userId = user.id;

  logger.info('SSE stream requested', { clientId, userId });

  // Register client — response is kept open; no explicit return needed
  sseService.addClient(clientId, userId, res);
  return; // satisfy TypeScript's "all code paths return a value" check
});

/**
 * Get SSE connection stats (admin only)
 * GET /api/v1/sse/stats
 */
router.get('/stats', (req: Request, res: Response) => {
  const user = (req as any).user;
  
  // TODO: Add admin role check
  if (!user || !user.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const stats = {
    totalClients: sseService.getClientCount(),
    timestamp: new Date().toISOString(),
  };

  return res.json(stats);
});

export default router;
