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

export default router;
