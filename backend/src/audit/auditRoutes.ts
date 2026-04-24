import { Router, Request, Response } from 'express';
import { auditService, AuditLogFilters, AuditResult } from './auditService';
import { fraudDetectionService, SecurityAlertFilters, SecurityAlertType, SecurityAlertSeverity, SecurityAlertStatus } from './fraudDetection';
import { requireRole } from '../auth/authorizationMiddleware';
import { Role } from '../auth/authorizationService';
import logger from '../utils/logger';

/**
 * Audit Log Routes
 *
 * All routes are restricted to CEO and CoS roles (Requirement 15.9).
 *
 * GET  /api/audit-logs          — query logs with optional filters
 * GET  /api/audit-logs/export   — export filtered logs as CSV
 * GET  /api/audit-logs/:id      — get a specific log entry
 * GET  /api/audit-logs/retention-policy — get retention policy info
 *
 * Requirements: 15.9, 15.10, 15.11, 15.12
 */

const router = Router();

// All audit log routes require CEO or CoS role (Requirement 15.9)
router.use(requireRole(Role.CEO, Role.CoS));

/**
 * GET /api/audit-logs/retention-policy
 * Return the audit log retention policy.
 * Must be declared BEFORE /:id to avoid route shadowing.
 * Requirements: 15.12
 */
router.get('/retention-policy', (_req: Request, res: Response) => {
  const policy = auditService.getRetentionPolicy();
  return res.json({ success: true, data: policy });
});

/**
 * GET /api/audit-logs/export
 * Export audit logs to CSV.
 * Must be declared BEFORE /:id to avoid route shadowing.
 * Requirements: 15.11
 */
router.get('/export', async (req: Request, res: Response) => {
  try {
    const filters = buildFilters(req);

    const csv = await auditService.exportToCSV(filters);

    const filename = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Log the export action
    if (req.user) {
      const user = req.user as { id: string; role: string };
      await auditService.log({
        userId: user.id,
        action: 'EXPORT',
        resourceType: 'audit_logs',
        ipAddress: req.ip ?? 'unknown',
        userAgent: req.get('user-agent') ?? '',
        result: AuditResult.SUCCESS,
        metadata: { filters },
      });
    }

    return res.send(csv);
  } catch (error) {
    logger.error('Audit log export error', { error });
    return res.status(500).json({ error: 'Failed to export audit logs' });
  }
});

/**
 * GET /api/audit-logs
 * Query audit logs with optional filters.
 * Requirements: 15.9, 15.10
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const filters = buildFilters(req);

    const result = await auditService.query(filters);

    return res.json({
      success: true,
      data: result.logs,
      pagination: {
        total: result.total,
        limit: result.limit,
        offset: result.offset,
      },
    });
  } catch (error) {
    logger.error('Audit log query error', { error });
    return res.status(500).json({ error: 'Failed to query audit logs' });
  }
});

/**
 * GET /api/audit-logs/security-alerts
 * Get security alerts (CEO/CoS only).
 * Must be declared BEFORE /:id to avoid route shadowing.
 * Requirements: 36.6, 36.7
 */
router.get('/security-alerts', async (req: Request, res: Response) => {
  try {
    const filters = buildAlertFilters(req);
    const result = await fraudDetectionService.getSecurityAlerts(filters);
    return res.json({
      success: true,
      data: result.alerts,
      pagination: {
        total: result.total,
        limit: result.limit,
        offset: result.offset,
      },
    });
  } catch (error) {
    logger.error('Security alerts query error', { error });
    return res.status(500).json({ error: 'Failed to retrieve security alerts' });
  }
});

/**
 * POST /api/audit-logs/security-alerts/analyze
 * Manually trigger fraud analysis on a provided audit log entry.
 * Must be declared BEFORE /:id to avoid route shadowing.
 * Requirements: 36.1, 36.6
 */
router.post('/security-alerts/analyze', async (req: Request, res: Response) => {
  try {
    const logEntry = req.body;
    if (!logEntry || !logEntry.userId || !logEntry.action || !logEntry.resourceType) {
      return res.status(400).json({ error: 'Invalid audit log entry: userId, action, and resourceType are required' });
    }

    const alerts = await fraudDetectionService.analyzeAuditLog(logEntry);
    return res.json({ success: true, data: alerts });
  } catch (error) {
    logger.error('Security alert analysis error', { error });
    return res.status(500).json({ error: 'Failed to analyze audit log entry' });
  }
});

/**
 * GET /api/audit-logs/:id
 * Get a specific audit log entry.
 * Requirements: 15.9
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const log = await auditService.getLogById(id);

    if (!log) {
      return res.status(404).json({ error: 'Audit log entry not found' });
    }

    return res.json({ success: true, data: log });
  } catch (error) {
    logger.error('Get audit log error', { error, id: req.params.id });
    return res.status(500).json({ error: 'Failed to retrieve audit log entry' });
  }
});

// ============================================================================
// Helpers
// ============================================================================

function buildAlertFilters(req: Request): SecurityAlertFilters {
  const { type, severity, status, affectedUserId, startDate, endDate, limit, offset } =
    req.query as Record<string, string | undefined>;

  const filters: SecurityAlertFilters = {};

  if (type && Object.values(SecurityAlertType).includes(type as SecurityAlertType)) {
    filters.type = type as SecurityAlertType;
  }
  if (severity && Object.values(SecurityAlertSeverity).includes(severity as SecurityAlertSeverity)) {
    filters.severity = severity as SecurityAlertSeverity;
  }
  if (status && Object.values(SecurityAlertStatus).includes(status as SecurityAlertStatus)) {
    filters.status = status as SecurityAlertStatus;
  }
  if (affectedUserId) filters.affectedUserId = affectedUserId;
  if (startDate) filters.startDate = new Date(startDate);
  if (endDate) filters.endDate = new Date(endDate);
  if (limit) filters.limit = parseInt(limit, 10);
  if (offset) filters.offset = parseInt(offset, 10);

  return filters;
}

function buildFilters(req: Request): AuditLogFilters {
  const {
    userId,
    action,
    resourceType,
    resourceId,
    result,
    startDate,
    endDate,
    limit,
    offset,
  } = req.query as Record<string, string | undefined>;

  const filters: AuditLogFilters = {};

  if (userId) filters.userId = userId;
  if (action) filters.action = action;
  if (resourceType) filters.resourceType = resourceType;
  if (resourceId) filters.resourceId = resourceId;
  if (result && (result === 'SUCCESS' || result === 'FAILURE')) {
    filters.result = result as AuditResult;
  }
  if (startDate) filters.startDate = new Date(startDate);
  if (endDate) filters.endDate = new Date(endDate);
  if (limit) filters.limit = parseInt(limit, 10);
  if (offset) filters.offset = parseInt(offset, 10);

  return filters;
}

export default router;
