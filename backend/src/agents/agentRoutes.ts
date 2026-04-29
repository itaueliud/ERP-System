/**
 * Agent Routes — Portal 6 (app.tst.com/gateway-pulse)
 * Doc §3, §6, §7
 * Agents see personal data only — enforced at API level (doc §6)
 */
import { Router, Request, Response } from 'express';
import { agentService, PaymentPlan } from './agentService';
import { requireRole } from '../auth/authorizationMiddleware';
import { Role } from '../auth/authorizationService';
import logger from '../utils/logger';

const router = Router();

// ── Dashboard metrics (personal only) ────────────────────────────────────────
router.get('/dashboard', requireRole(Role.AGENT), async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user.id;
    const metrics = await agentService.getDashboardMetrics(agentId);
    return res.json({ success: true, data: metrics });
  } catch (error: any) {
    logger.error('Agent dashboard error', { error });
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ── My clients list ───────────────────────────────────────────────────────────
router.get('/my-clients', requireRole(Role.AGENT), async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user.id;
    const { status, limit, offset } = req.query;
    const result = await agentService.getMyClients(agentId, {
      status: status as string,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });
    return res.json({ success: true, ...result });
  } catch (error: any) {
    logger.error('Get my clients error', { error });
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ── Step 1: Add new client (client capture form) ──────────────────────────────
router.post('/clients', requireRole(Role.AGENT), async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user.id;
    const { clientName, organizationName, phoneNumber, email, location, notes } = req.body;

    if (!clientName || !phoneNumber || !email || !location) {
      return res.status(400).json({
        success: false,
        error: 'clientName, phoneNumber, email, and location are required',
      });
    }

    const client = await agentService.captureClient({
      clientName, organizationName, phoneNumber, email, location, notes, agentId,
    });
    return res.status(201).json({ success: true, data: client });
  } catch (error: any) {
    logger.error('Client capture error', { error });
    return res.status(400).json({ success: false, error: error.message });
  }
});

// ── Step 2: Select product / services ────────────────────────────────────────
router.post('/clients/:clientId/services', requireRole(Role.AGENT), async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user.id;
    const { clientId } = req.params;
    const { productType, industryCategory, selectedServices } = req.body;

    if (!productType) {
      return res.status(400).json({ success: false, error: 'productType is required (SYSTEM or PLOTCONNECT)' });
    }

    // Ensure agent owns this client
    const { db } = await import('../database/connection');
    const check = await db.query(`SELECT agent_id FROM clients WHERE id = $1`, [clientId]);
    if (!check.rows.length || check.rows[0].agent_id !== agentId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const client = await agentService.selectServices({
      clientId, productType, industryCategory, selectedServices,
    });
    return res.json({ success: true, data: client });
  } catch (error: any) {
    logger.error('Service selection error', { error });
    return res.status(400).json({ success: false, error: error.message });
  }
});

// ── Step 3: Initiate commitment payment (M-Pesa STK Push) ────────────────────
router.post('/clients/:clientId/commitment-payment', requireRole(Role.AGENT), async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user.id;
    const { clientId } = req.params;
    const { paymentPlan, mpesaPhone } = req.body;

    if (!paymentPlan || !mpesaPhone) {
      return res.status(400).json({ success: false, error: 'paymentPlan and mpesaPhone are required' });
    }
    if (!Object.values(PaymentPlan).includes(paymentPlan)) {
      return res.status(400).json({
        success: false,
        error: `paymentPlan must be one of: ${Object.values(PaymentPlan).join(', ')}`,
      });
    }

    // Ensure agent owns this client
    const { db } = await import('../database/connection');
    const check = await db.query(`SELECT agent_id FROM clients WHERE id = $1`, [clientId]);
    if (!check.rows.length || check.rows[0].agent_id !== agentId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const result = await agentService.initiateCommitmentPayment({
      clientId, paymentPlan, mpesaPhone, agentId,
    });
    return res.json({ success: true, data: result });
  } catch (error: any) {
    logger.error('Commitment payment error', { error });
    return res.status(400).json({ success: false, error: error.message });
  }
});

// ── Get service catalogue (for Step 2 UI) ────────────────────────────────────
router.get('/service-catalogue', requireRole(Role.AGENT), async (_req: Request, res: Response) => {
  try {
    const { db } = await import('../database/connection');
    const result = await db.query(
      `SELECT category, category_name, service_key, service_name, base_amount, currency
       FROM service_catalogue WHERE is_active = TRUE ORDER BY category, service_name`
    );
    // Group by category
    const grouped: Record<string, any> = {};
    for (const row of result.rows) {
      if (!grouped[row.category]) {
        grouped[row.category] = { category: row.category, name: row.category_name, services: [] };
      }
      grouped[row.category].services.push({
        key: row.service_key,
        name: row.service_name,
        amount: parseFloat(row.base_amount),
        currency: row.currency,
      });
    }
    return res.json({ success: true, data: Object.values(grouped) });
  } catch (error: any) {
    logger.error('Service catalogue error', { error });
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ── Get commitment amounts (for Step 3 UI) ────────────────────────────────────
router.get('/commitment-amounts', requireRole(Role.AGENT), async (_req: Request, res: Response) => {
  try {
    const { db } = await import('../database/connection');
    const result = await db.query(`SELECT payment_plan, amount, currency FROM commitment_amounts`);
    return res.json({ success: true, data: result.rows });
  } catch (error: any) {
    logger.error('Commitment amounts error', { error });
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ── HoT: Create agent account (doc §5 Who Creates Who) ───────────────────────
router.post('/create', requireRole(Role.HEAD_OF_TRAINERS), async (req: Request, res: Response) => {
  try {
    const createdBy = (req as any).user.id;
    const { phone, idNumber, coverPhotoUrl } = req.body;

    if (!phone || !idNumber) {
      return res.status(400).json({ success: false, error: 'phone and idNumber are required' });
    }

    const { db } = await import('../database/connection');

    // Get AGENT role id
    const roleResult = await db.query(`SELECT id FROM roles WHERE name = 'AGENT'`);
    if (!roleResult.rows.length) throw new Error('AGENT role not found');
    const roleId = roleResult.rows[0].id;

    // Get HoT's country to assign to agent
    const hotResult = await db.query(`SELECT country FROM users WHERE id = $1`, [createdBy]);
    const country = hotResult.rows[0]?.country || '';

    // Create minimal agent user (agent completes own profile later — doc §5)
    const result = await db.query(
      `INSERT INTO users
         (email, password_hash, full_name, phone, country, role_id, national_id_number,
          cover_photo_url, is_active, created_at, updated_at)
       VALUES ($1, $2, 'Pending', $3, $4, $5, $6, $7, TRUE, NOW(), NOW())
       RETURNING id, phone, national_id_number, cover_photo_url, created_at`,
      [
        `agent-${phone}@pending.tst`,  // placeholder email until agent completes profile
        'PENDING_SETUP',
        phone,
        country,
        roleId,
        idNumber,
        coverPhotoUrl || null,
      ]
    );

    logger.info('Agent account created by HoT', { agentId: result.rows[0].id, createdBy });
    return res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    logger.error('Create agent error', { error });
    return res.status(400).json({ success: false, error: error.message });
  }
});

// ── HoT: Reassign agent to different trainer (doc §18) ───────────────────────
router.post('/:agentId/reassign', requireRole(Role.HEAD_OF_TRAINERS), async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const { trainerId } = req.body;
    if (!trainerId) return res.status(400).json({ success: false, error: 'trainerId is required' });

    const { db } = await import('../database/connection');
    await db.query(`UPDATE users SET updated_at = NOW() WHERE id = $1`, [agentId]);
    // Store trainer assignment in clients table for all this agent's active leads
    await db.query(
      `UPDATE clients SET trainer_id = $1, updated_at = NOW()
       WHERE agent_id = $2 AND status NOT IN ('CLOSED_WON')`,
      [trainerId, agentId]
    );
    return res.json({ success: true, message: 'Agent reassigned to new trainer' });
  } catch (error: any) {
    logger.error('Reassign agent error', { error });
    return res.status(400).json({ success: false, error: error.message });
  }
});

// ── HoT: Assign converted client to Account Executive (doc §18) ──────────────
router.post('/clients/:clientId/assign-account-exec', requireRole(Role.HEAD_OF_TRAINERS), async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    // Accept both field names for compatibility
    const trainerId: string | undefined = req.body.trainerId || req.body.accountExecId || req.body.accountExecutiveId;
    if (!trainerId) return res.status(400).json({ success: false, error: 'trainerId is required' });

    const { db } = await import('../database/connection');

    // Verify client exists and is in an assignable status
    const clientResult = await db.query(`SELECT id, status, name FROM clients WHERE id = $1`, [clientId]);
    if (!clientResult.rows.length) return res.status(404).json({ success: false, error: 'Client not found' });

    const assignableStatuses = ['CONVERTED', 'LEAD_ACTIVATED', 'LEAD_QUALIFIED', 'CLOSED_WON'];
    if (!assignableStatuses.includes(clientResult.rows[0].status)) {
      return res.status(400).json({
        success: false,
        error: `Client must be CONVERTED, LEAD_ACTIVATED, or LEAD_QUALIFIED to assign a trainer (current: ${clientResult.rows[0].status})`,
      });
    }

    // Verify trainer exists and has the right role
    const trainerResult = await db.query(
      `SELECT u.id, u.full_name, r.name AS role
       FROM users u JOIN roles r ON r.id = u.role_id
       WHERE u.id = $1`,
      [trainerId]
    );
    if (!trainerResult.rows.length) return res.status(404).json({ success: false, error: 'Trainer not found' });
    if (!['TRAINER', 'HEAD_OF_TRAINERS'].includes(trainerResult.rows[0].role)) {
      return res.status(400).json({ success: false, error: 'Assigned user must be a TRAINER or HEAD_OF_TRAINERS' });
    }

    // Assign trainer to client
    await db.query(
      `UPDATE clients SET trainer_id = $1, status = 'NEGOTIATION', updated_at = NOW() WHERE id = $2`,
      [trainerId, clientId]
    );

    // Also update project if one exists
    await db.query(
      `UPDATE projects SET assigned_to = $1, updated_at = NOW() WHERE client_id = $2`,
      [trainerId, clientId]
    ).catch(() => { /* no project yet — non-fatal */ });

    logger.info('Client assigned to trainer by HoT', {
      clientId,
      trainerId,
      trainerName: trainerResult.rows[0].full_name,
      clientName: clientResult.rows[0].name,
    });
    return res.json({
      success: true,
      message: `Client "${clientResult.rows[0].name}" assigned to trainer "${trainerResult.rows[0].full_name}"`,
    });
  } catch (error: any) {
    logger.error('Assign trainer error', { error });
    return res.status(400).json({ success: false, error: error.message });
  }
});

// ── Trainer: Modify agent priority listing (doc §17) ─────────────────────────
router.post('/:agentId/priority-listing', requireRole(Role.TRAINER, Role.HEAD_OF_TRAINERS), async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const { tier } = req.body;
    if (!['Top', 'Medium', 'Basic'].includes(tier)) {
      return res.status(400).json({ success: false, error: 'tier must be Top, Medium, or Basic' });
    }
    const { db } = await import('../database/connection');
    await db.query(
      `UPDATE users SET priority_listing_tier = $1, updated_at = NOW() WHERE id = $2`,
      [tier, agentId]
    );
    logger.info('Agent priority listing updated', { agentId, tier });
    return res.json({ success: true, message: 'Priority listing updated' });
  } catch (error: any) {
    logger.error('Priority listing update error', { error });
    return res.status(400).json({ success: false, error: error.message });
  }
});

export default router;
