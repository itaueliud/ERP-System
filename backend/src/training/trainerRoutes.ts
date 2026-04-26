/**
 * Trainer Routes — Portal 4 (app.tst.com/gateway-nexus)
 * Doc §4, §7, §20
 */
import { Router, Request, Response } from 'express';
import { trainerService } from './trainerService';
import { requireRole } from '../auth/authorizationMiddleware';
import { Role } from '../auth/authorizationService';
import logger from '../utils/logger';

const router = Router();

router.get('/dashboard', requireRole(Role.TRAINER), async (req: Request, res: Response) => {
  try {
    const trainerId = (req as any).user.id;
    const data = await trainerService.getDashboard(trainerId);
    return res.json({ success: true, data });
  } catch (error: any) {
    logger.error('Trainer dashboard error', { error });
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/clients', requireRole(Role.TRAINER), async (req: Request, res: Response) => {
  try {
    const trainerId = (req as any).user.id;
    const { status, limit, offset } = req.query;
    const result = await trainerService.getMyClients(trainerId, {
      status: status as string,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });
    return res.json({ success: true, ...result });
  } catch (error: any) {
    logger.error('Trainer get clients error', { error });
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/clients/:clientId/negotiation', requireRole(Role.TRAINER), async (req: Request, res: Response) => {
  try {
    const trainerId = (req as any).user.id;
    const { clientId } = req.params;
    const result = await trainerService.startNegotiation(trainerId, clientId);
    return res.json({ success: true, data: result });
  } catch (error: any) {
    logger.error('Start negotiation error', { error });
    return res.status(400).json({ success: false, error: error.message });
  }
});

// Trainer-only: modify placement tier (doc §11)
router.patch('/properties/:propertyId/placement-tier', requireRole(Role.TRAINER), async (req: Request, res: Response) => {
  try {
    const trainerId = (req as any).user.id;
    const { propertyId } = req.params;
    const { tier } = req.body;
    if (!tier) return res.status(400).json({ success: false, error: 'tier is required' });
    const result = await trainerService.modifyPlacementTier(trainerId, propertyId, tier);
    return res.json({ success: true, data: result });
  } catch (error: any) {
    logger.error('Modify placement tier error', { error });
    return res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/country-achievements', requireRole(Role.TRAINER), async (req: Request, res: Response) => {
  try {
    const trainerId = (req as any).user.id;
    const data = await trainerService.getCountryAchievements(trainerId);
    return res.json({ success: true, data });
  } catch (error: any) {
    logger.error('Country achievements error', { error });
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/daily-report', requireRole(Role.TRAINER), async (req: Request, res: Response) => {
  try {
    const trainerId = (req as any).user.id;
    const { accomplishments, challenges, tomorrowPlan, hoursWorked } = req.body;
    if (!accomplishments) return res.status(400).json({ success: false, error: 'accomplishments is required' });
    const report = await trainerService.submitDailyReport(trainerId, {
      accomplishments, challenges, tomorrowPlan, hoursWorked,
    });
    return res.json({ success: true, data: report });
  } catch (error: any) {
    logger.error('Daily report error', { error });
    return res.status(400).json({ success: false, error: error.message });
  }
});

export default router;
