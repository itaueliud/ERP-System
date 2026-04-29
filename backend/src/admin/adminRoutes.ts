/**
 * CEO System Admin Panel Routes
 * Doc §6 Section 6 — CEO Exclusive, not visible to any other role
 * All routes require Role.CEO
 */
import { Router, Request, Response } from 'express';
import { adminService } from './adminService';
import { requireRole } from '../auth/authorizationMiddleware';
import { Role } from '../auth/authorizationService';
import logger from '../utils/logger';

const router = Router();

// All admin routes are CEO-only
router.use(requireRole(Role.CEO));

// ── User Management ───────────────────────────────────────────────────────────
router.get('/users', async (req: Request, res: Response) => {
  try {
    const { role, isActive, search, limit, offset } = req.query;
    const result = await adminService.listAllUsers({
      role: role as string,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      search: search as string,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });
    return res.json({ success: true, ...result });
  } catch (error: any) {
    logger.error('Admin list users error', { error });
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/users/:userId/deactivate', async (req: Request, res: Response) => {
  try {
    const ceoId = (req as any).user.id;
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ success: false, error: 'reason is required' });
    await adminService.deactivateUser(req.params.userId, ceoId, reason);
    return res.json({ success: true, message: 'User deactivated' });
  } catch (error: any) {
    logger.error('Admin deactivate user error', { error });
    return res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/users/:userId/reactivate', async (req: Request, res: Response) => {
  try {
    const ceoId = (req as any).user.id;
    await adminService.reactivateUser(req.params.userId, ceoId);
    return res.json({ success: true, message: 'User reactivated' });
  } catch (error: any) {
    logger.error('Admin reactivate user error', { error });
    return res.status(400).json({ success: false, error: error.message });
  }
});

router.delete('/users/:userId', async (req: Request, res: Response) => {
  try {
    const ceoId = (req as any).user.id;
    await adminService.hardDeleteUser(req.params.userId, ceoId);
    return res.json({ success: true, message: 'User permanently deleted' });
  } catch (error: any) {
    logger.error('Admin hard delete user error', { error });
    return res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/users/:userId/role', async (req: Request, res: Response) => {
  try {
    const ceoId = (req as any).user.id;
    const { role } = req.body;
    if (!role) return res.status(400).json({ success: false, error: 'role is required' });
    await adminService.changeUserRole(req.params.userId, role, ceoId);
    return res.json({ success: true, message: 'Role updated' });
  } catch (error: any) {
    logger.error('Admin change role error', { error });
    return res.status(400).json({ success: false, error: error.message });
  }
});

// ── Invitation Management ─────────────────────────────────────────────────────
router.get('/invitations', async (_req: Request, res: Response) => {
  try {
    const data = await adminService.listPendingInvitations();
    return res.json({ success: true, data });
  } catch (error: any) {
    logger.error('Admin list invitations error', { error });
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/invitations/:invitationId', async (req: Request, res: Response) => {
  try {
    const ceoId = (req as any).user.id;
    await adminService.revokeInvitation(req.params.invitationId, ceoId);
    return res.json({ success: true, message: 'Invitation revoked' });
  } catch (error: any) {
    logger.error('Admin revoke invitation error', { error });
    return res.status(400).json({ success: false, error: error.message });
  }
});

// ── Full Audit Log ────────────────────────────────────────────────────────────
router.get('/audit-log', async (req: Request, res: Response) => {
  try {
    const { userId, action, from, to, limit, offset } = req.query;
    const data = await adminService.getFullAuditLog({
      userId: userId as string,
      action: action as string,
      from: from as string,
      to: to as string,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });
    return res.json({ success: true, data });
  } catch (error: any) {
    logger.error('Admin audit log error', { error });
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ── System Configuration ──────────────────────────────────────────────────────
router.get('/config', async (_req: Request, res: Response) => {
  try {
    const data = await adminService.getSystemConfig();
    return res.json({ success: true, data });
  } catch (error: any) {
    logger.error('Admin get config error', { error });
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/config/:key', async (req: Request, res: Response) => {
  try {
    const ceoId = (req as any).user.id;
    const { value } = req.body;
    if (value === undefined) return res.status(400).json({ success: false, error: 'value is required' });
    await adminService.updateSystemConfig(req.params.key, value, ceoId);
    return res.json({ success: true, message: 'Config updated' });
  } catch (error: any) {
    logger.error('Admin update config error', { error });
    return res.status(400).json({ success: false, error: error.message });
  }
});

// ── Pricing Change Approvals ──────────────────────────────────────────────────
router.get('/pricing-changes', async (_req: Request, res: Response) => {
  try {
    const data = await adminService.getPendingPricingChanges();
    return res.json({ success: true, data });
  } catch (error: any) {
    logger.error('Admin pricing changes error', { error });
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/pricing-changes/:changeId/confirm', async (req: Request, res: Response) => {
  try {
    const ceoId = (req as any).user.id;
    await adminService.confirmPricingChange(req.params.changeId, ceoId);
    return res.json({ success: true, message: 'Pricing change confirmed' });
  } catch (error: any) {
    logger.error('Admin confirm pricing change error', { error });
    return res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/pricing-changes/:changeId/reject', async (req: Request, res: Response) => {
  try {
    const ceoId = (req as any).user.id;
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ success: false, error: 'reason is required' });
    await adminService.rejectPricingChange(req.params.changeId, ceoId, reason);
    return res.json({ success: true, message: 'Pricing change rejected' });
  } catch (error: any) {
    logger.error('Admin reject pricing change error', { error });
    return res.status(400).json({ success: false, error: error.message });
  }
});

// ── Session Management ────────────────────────────────────────────────────────
router.get('/sessions', async (_req: Request, res: Response) => {
  try {
    const data = await adminService.getActiveSessions();
    return res.json({ success: true, data });
  } catch (error: any) {
    logger.error('Admin get sessions error', { error });
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/sessions/:userId/force-logout', async (req: Request, res: Response) => {
  try {
    const ceoId = (req as any).user.id;
    await adminService.forceLogoutUser(req.params.userId, ceoId);
    return res.json({ success: true, message: 'User force-logged out' });
  } catch (error: any) {
    logger.error('Admin force logout error', { error });
    return res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/sessions/force-logout-all', async (req: Request, res: Response) => {
  try {
    const ceoId = (req as any).user.id;
    await adminService.forceLogoutAll(ceoId);
    return res.json({ success: true, message: 'All sessions terminated' });
  } catch (error: any) {
    logger.error('Admin force logout all error', { error });
    return res.status(400).json({ success: false, error: error.message });
  }
});

// ── Portal Access Control ─────────────────────────────────────────────────────
router.post('/portals/:portal/toggle', async (req: Request, res: Response) => {
  try {
    const ceoId = (req as any).user.id;
    const { enabled } = req.body;
    if (enabled === undefined) return res.status(400).json({ success: false, error: 'enabled is required' });
    await adminService.setPortalEnabled(req.params.portal, enabled, ceoId);
    return res.json({ success: true, message: `Portal ${req.params.portal} ${enabled ? 'enabled' : 'disabled'}` });
  } catch (error: any) {
    logger.error('Admin portal toggle error', { error });
    return res.status(400).json({ success: false, error: error.message });
  }
});

// ── Countries ─────────────────────────────────────────────────────────────────
router.get('/countries', async (_req: Request, res: Response) => {
  try {
    const data = await adminService.listCountries();
    return res.json({ success: true, data });
  } catch (error: any) {
    logger.error('Admin list countries error', { error });
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ── System Health Monitor (doc §6 Admin Panel) ────────────────────────────────
router.get('/health', async (_req: Request, res: Response) => {
  try {
    const { db } = await import('../database/connection');
    const { redis } = await import('../cache/connection');

    const dbStart = Date.now();
    let dbOk = false;
    try { await db.query('SELECT 1'); dbOk = true; } catch { /* fail */ }
    const dbMs = Date.now() - dbStart;

    const redisStart = Date.now();
    let redisOk = false;
    try { await redis.getClient().ping(); redisOk = true; } catch { /* fail */ }
    const redisMs = Date.now() - redisStart;

    const uptime = process.uptime();
    const memMb = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);

    return res.json({
      success: true,
      data: {
        status: dbOk && redisOk ? 'healthy' : 'degraded',
        uptime: Math.round(uptime),
        memoryMb: memMb,
        database: { ok: dbOk, responseMs: dbMs },
        cache: { ok: redisOk, responseMs: redisMs },
        checkedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    logger.error('Admin health check error', { error });
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ── API Key / Integration Settings (doc §6 Admin Panel) ───────────────────────
router.get('/integrations', async (_req: Request, res: Response) => {
  try {
    const { db } = await import('../database/connection');
    const keys = ['daraja_consumer_key', 'daraja_consumer_secret', 'daraja_shortcode',
                  'github_client_id', 'sendgrid_api_key', 'africas_talking_api_key',
                  'firebase_project_id'];
    const result = await db.query(
      `SELECT key, CASE WHEN value IS NOT NULL THEN '••••••••' ELSE NULL END AS masked,
              value IS NOT NULL AS is_set, updated_at
       FROM system_config WHERE key = ANY($1)`,
      [keys]
    );
    // Return masked values only — never expose actual keys
    return res.json({ success: true, data: result.rows });
  } catch (error: any) {
    logger.error('Admin get integrations error', { error });
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/integrations/:key', async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    const ceoId = (req as any).user.id;
    if (!value) return res.status(400).json({ success: false, error: 'value is required' });
    const { db } = await import('../database/connection');
    await db.query(
      `INSERT INTO system_config (key, value, updated_at) VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
      [key, value]
    );
    logger.info('Integration key updated by CEO', { key, ceoId });
    return res.json({ success: true, message: `${key} updated` });
  } catch (error: any) {
    logger.error('Admin update integration error', { error });
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ── Backup Management ─────────────────────────────────────────────────────────
router.get('/backups', async (_req: Request, res: Response) => {
  try {
    const { db } = await import('../database/connection');
    const result = await db.query(
      `SELECT id, type, status, started_at, completed_at, size_bytes, encryption_algorithm, checksum, error_message
       FROM backup_records ORDER BY started_at DESC LIMIT 50`
    );
    return res.json({ success: true, data: result.rows });
  } catch (error: any) {
    // Table may not exist yet — return empty gracefully
    logger.warn('Admin get backups error (table may not exist)', { error: error.message });
    return res.json({ success: true, data: [] });
  }
});

router.post('/backups/trigger', async (req: Request, res: Response) => {
  try {
    const ceoId = (req as any).user.id;
    const type: 'full' | 'incremental' = req.body.type === 'incremental' ? 'incremental' : 'full';
    const { db } = await import('../database/connection');
    const result = await db.query(
      `INSERT INTO backup_records (id, type, status, started_at, encryption_algorithm)
       VALUES (gen_random_uuid(), $1, 'pending', NOW(), 'AES-256')
       RETURNING *`,
      [type]
    );
    logger.info('Manual backup triggered by CEO', { type, ceoId });
    await import('../audit/auditService').then(({ auditService }) =>
      auditService.log({ userId: ceoId, action: 'TRIGGER_BACKUP', resourceType: 'backup_records', resourceId: result.rows[0]?.id, ipAddress: '0.0.0.0', result: 'SUCCESS', metadata: { type } })
    ).catch(() => {});
    return res.status(201).json({ success: true, data: result.rows[0], message: `${type} backup triggered` });
  } catch (error: any) {
    logger.error('Admin trigger backup error', { error });
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ── CEO Backup Email (doc §25 security alert) ─────────────────────────────────
router.get('/ceo-backup-email', async (_req: Request, res: Response) => {
  try {
    const { db } = await import('../database/connection');
    const result = await db.query(`SELECT value FROM system_config WHERE key = 'ceo_backup_email'`);
    return res.json({ success: true, data: { email: result.rows[0]?.value || null } });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/ceo-backup-email', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, error: 'email is required' });
    const { db } = await import('../database/connection');
    await db.query(
      `INSERT INTO system_config (key, value, updated_at) VALUES ('ceo_backup_email', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
      [email]
    );
    return res.json({ success: true, message: 'Backup email updated' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
