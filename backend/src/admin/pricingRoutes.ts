/**
 * Pricing / Amount Management Routes
 * Doc §1, §7, §8, §11, §21
 * EA, CFO, CoS, CEO can propose changes.
 * CEO must confirm before any change takes effect (enforced at DB level via pricing_change_requests).
 */
import { Router, Request, Response } from 'express';
import { requireRole } from '../auth/authorizationMiddleware';
import { Role } from '../auth/authorizationService';
import { db } from '../database/connection';
import logger from '../utils/logger';

const router = Router();

const PRICING_EDITORS = [Role.CEO, Role.CoS, Role.CFO, Role.EA];

// ── View all service amounts ──────────────────────────────────────────────────
router.get('/services', requireRole(...PRICING_EDITORS), async (_req: Request, res: Response) => {
  try {
    const result = await db.query(
      `SELECT id, category, category_name, service_key, service_name, base_amount, currency, is_active
       FROM service_catalogue ORDER BY category, service_name`
    );
    return res.json({ success: true, data: result.rows });
  } catch (error: any) {
    logger.error('Get service amounts error', { error });
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ── Propose service amount change (held as PENDING until CEO confirms) ────────
router.post('/services/:serviceId/propose-change', requireRole(...PRICING_EDITORS), async (req: Request, res: Response) => {
  try {
    const proposedBy = (req as any).user.id;
    const { serviceId } = req.params;
    const { newAmount, justification } = req.body;

    if (!newAmount || newAmount <= 0) return res.status(400).json({ success: false, error: 'newAmount must be > 0' });

    const svc = await db.query(`SELECT id, base_amount, service_key FROM service_catalogue WHERE id = $1`, [serviceId]);
    if (!svc.rows.length) return res.status(404).json({ success: false, error: 'Service not found' });

    const result = await db.query(
      `INSERT INTO pricing_change_requests
         (change_type, target_id, target_key, old_amount, new_amount, justification, proposed_by, status)
       VALUES ('SERVICE_CATALOGUE', $1, $2, $3, $4, $5, $6, 'PENDING')
       RETURNING *`,
      [serviceId, svc.rows[0].service_key, svc.rows[0].base_amount, newAmount, justification || null, proposedBy]
    );

    logger.info('Service amount change proposed', { serviceId, newAmount, proposedBy });
    return res.status(201).json({ success: true, data: result.rows[0], message: 'Change pending CEO confirmation' });
  } catch (error: any) {
    logger.error('Propose service change error', { error });
    return res.status(400).json({ success: false, error: error.message });
  }
});

// ── View commitment amounts ───────────────────────────────────────────────────
router.get('/commitment', requireRole(...PRICING_EDITORS), async (_req: Request, res: Response) => {
  try {
    const result = await db.query(`SELECT * FROM commitment_amounts ORDER BY payment_plan`);
    return res.json({ success: true, data: result.rows });
  } catch (error: any) {
    logger.error('Get commitment amounts error', { error });
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ── Propose commitment amount change ─────────────────────────────────────────
router.post('/commitment/:plan/propose-change', requireRole(...PRICING_EDITORS), async (req: Request, res: Response) => {
  try {
    const proposedBy = (req as any).user.id;
    const { plan } = req.params;
    const { newAmount, justification } = req.body;

    if (!newAmount || newAmount <= 0) return res.status(400).json({ success: false, error: 'newAmount must be > 0' });

    const ca = await db.query(`SELECT id, amount FROM commitment_amounts WHERE payment_plan = $1`, [plan]);
    if (!ca.rows.length) return res.status(404).json({ success: false, error: 'Payment plan not found' });

    const result = await db.query(
      `INSERT INTO pricing_change_requests
         (change_type, target_id, target_key, old_amount, new_amount, justification, proposed_by, status)
       VALUES ('COMMITMENT_AMOUNT', $1, $2, $3, $4, $5, $6, 'PENDING')
       RETURNING *`,
      [ca.rows[0].id, plan, ca.rows[0].amount, newAmount, justification || null, proposedBy]
    );

    return res.status(201).json({ success: true, data: result.rows[0], message: 'Change pending CEO confirmation' });
  } catch (error: any) {
    logger.error('Propose commitment change error', { error });
    return res.status(400).json({ success: false, error: error.message });
  }
});

// ── View pending pricing changes (for proposers to track status) ──────────────
router.get('/pending', requireRole(...PRICING_EDITORS), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const userRole = (req as any).user.role;

    // CEO sees all; others see only their own proposals
    const where = userRole === Role.CEO ? '' : `WHERE pcr.proposed_by = '${userId}'`;

    const result = await db.query(
      `SELECT pcr.*, u.full_name AS proposed_by_name
       FROM pricing_change_requests pcr
       JOIN users u ON u.id = pcr.proposed_by
       ${where}
       ORDER BY pcr.created_at DESC`
    );
    return res.json({ success: true, data: result.rows });
  } catch (error: any) {
    logger.error('Get pending pricing changes error', { error });
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
