import { Router, Request, Response } from 'express';
import { dashboardService, DateRange, DateRangePeriod } from './dashboardService';
import { db } from '../database/connection';
import logger from '../utils/logger';

const router = Router();

/**
 * Parse date range from query params
 */
function parseDateRange(query: any): DateRange | undefined {
  const { from, to, period } = query;

  if (period && period !== 'custom') {
    return dashboardService.getDateRangeForPeriod(period as DateRangePeriod);
  }

  if (!from && !to) return undefined;
  return {
    from: from ? new Date(from as string) : undefined,
    to: to ? new Date(to as string) : undefined,
  };
}

/**
 * GET /api/dashboard/metrics
 * Get all company-wide KPIs
 * Requirements: 17.1, 17.2, 17.4
 */
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const dateRange = parseDateRange(req.query);
    const metrics = await dashboardService.getCompanyMetrics(dateRange);
    return res.json(metrics);
  } catch (error: any) {
    logger.error('Error fetching company metrics', { error });
    return res.status(500).json({ error: 'Failed to fetch company metrics' });
  }
});

/**
 * GET /api/dashboard/client-pipeline
 * Requirements: 17.3
 */
router.get('/client-pipeline', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const metrics = await dashboardService.getClientPipelineMetrics();
    return res.json(metrics);
  } catch (error: any) {
    logger.error('Error fetching client pipeline metrics', { error });
    return res.status(500).json({ error: 'Failed to fetch client pipeline metrics' });
  }
});

/**
 * GET /api/dashboard/projects
 * Requirements: 17.3
 */
router.get('/projects', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const metrics = await dashboardService.getProjectStatusMetrics();
    return res.json(metrics);
  } catch (error: any) {
    logger.error('Error fetching project status metrics', { error });
    return res.status(500).json({ error: 'Failed to fetch project status metrics' });
  }
});

/**
 * GET /api/dashboard/payments
 * Requirements: 17.3
 */
router.get('/payments', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const dateRange = parseDateRange(req.query);
    const metrics = await dashboardService.getPaymentMetrics(dateRange);
    return res.json(metrics);
  } catch (error: any) {
    logger.error('Error fetching payment metrics', { error });
    return res.status(500).json({ error: 'Failed to fetch payment metrics' });
  }
});

/**
 * GET /api/dashboard/team-performance
 * Requirements: 17.3
 */
router.get('/team-performance', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const managerId = (req.query.managerId as string) || undefined;
    const metrics = await dashboardService.getTeamPerformanceMetrics(managerId);
    return res.json(metrics);
  } catch (error: any) {
    logger.error('Error fetching team performance metrics', { error });
    return res.status(500).json({ error: 'Failed to fetch team performance metrics' });
  }
});

/**
 * GET /api/dashboard/properties
 * Requirements: 17.1
 */
router.get('/properties', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const metrics = await dashboardService.getPropertyMetrics();
    return res.json(metrics);
  } catch (error: any) {
    logger.error('Error fetching property metrics', { error });
    return res.status(500).json({ error: 'Failed to fetch property metrics' });
  }
});

/**
 * GET /api/dashboard/agent-metrics
 * Agent-specific KPIs: clients added, active leads, closed deals,
 * properties submitted, personal performance score.
 * Called by the Agents portal Overview section.
 */
router.get('/agent-metrics', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const [clientsRes, propsRes, commissionsRes] = await Promise.all([
      db.query(
        `SELECT status, COUNT(*) AS count FROM clients WHERE agent_id = $1 GROUP BY status`,
        [userId]
      ),
      db.query(
        `SELECT COUNT(*) AS total,
                COUNT(*) FILTER (WHERE payment_status = 'PAID') AS paid
         FROM marketer_properties WHERE submitted_by = $1`,
        [userId]
      ),
      db.query(
        `SELECT COALESCE(SUM(amount), 0) AS total
         FROM commissions WHERE agent_id = $1 AND status = 'PAID'`,
        [userId]
      ),
    ]);

    const byStatus: Record<string, number> = {};
    for (const r of clientsRes.rows) byStatus[r.status] = parseInt(r.count);

    const totalClients = clientsRes.rows.reduce((s: number, r: any) => s + parseInt(r.count), 0);
    const activeLeads = (byStatus['NEW_LEAD'] || 0) + (byStatus['CONVERTED'] || 0) +
      (byStatus['LEAD_ACTIVATED'] || 0) + (byStatus['LEAD_QUALIFIED'] || 0) + (byStatus['NEGOTIATION'] || 0);
    const closedDeals = byStatus['CLOSED_WON'] || 0;
    const propertiesSubmitted = parseInt(propsRes.rows[0]?.total || '0');
    const totalCommissions = parseFloat(commissionsRes.rows[0]?.total || '0');

    // Simple KPI score: weighted average of conversion rate + report compliance
    const conversionRate = totalClients > 0 ? Math.round((closedDeals / totalClients) * 100) : 0;

    return res.json({
      data: {
        totalClients,
        activeLeads,
        closedDeals,
        propertiesSubmitted,
        totalCommissions,
        kpiScore: conversionRate,
        trainingProgress: null,
        clientSatisfaction: null,
      },
    });
  } catch (error: any) {
    logger.error('Error fetching agent metrics', { error });
    return res.status(500).json({ error: 'Failed to fetch agent metrics' });
  }
});

/**
 * GET /api/dashboard/role
 * Requirements: 17.1, 17.4, 17.5, 3.1-3.10
 */
router.get('/role', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.id) return res.status(401).json({ error: 'Unauthorized' });
    const dateRange = parseDateRange(req.query);
    const dashboard = await dashboardService.getRoleDashboard(user.id, user.role, dateRange);
    return res.json(dashboard);
  } catch (error: any) {
    logger.error('Error fetching role dashboard', { error });
    return res.status(500).json({ error: 'Failed to fetch role dashboard' });
  }
});

/**
 * GET /api/dashboard/metrics/trend
 * Get metrics with trend indicators vs previous period
 * Requirement 17.9
 */
router.get('/metrics/trend', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const dateRange = parseDateRange(req.query);
    const metrics = await dashboardService.getMetricsWithTrend(dateRange);
    return res.json(metrics);
  } catch (error: any) {
    logger.error('Error fetching metrics with trend', { error });
    return res.status(500).json({ error: 'Failed to fetch metrics with trend' });
  }
});

/**
 * GET /api/dashboard/export/pdf
 * Export dashboard to PDF
 * Requirement 17.8
 */
router.get('/export/pdf', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.id) return res.status(401).json({ error: 'Unauthorized' });
    const dateRange = parseDateRange(req.query);
    const result = await dashboardService.exportDashboardToPDF(user.id, user.role, dateRange);
    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
    return res.send(result.data);
  } catch (error: any) {
    logger.error('Error exporting dashboard to PDF', { error });
    return res.status(500).json({ error: 'Failed to export dashboard to PDF' });
  }
});

/**
 * GET /api/dashboard/export/excel
 * Export dashboard to Excel
 * Requirement 17.8
 */
router.get('/export/excel', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.id) return res.status(401).json({ error: 'Unauthorized' });
    const dateRange = parseDateRange(req.query);
    const result = await dashboardService.exportDashboardToExcel(user.id, user.role, dateRange);
    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
    return res.send(result.data);
  } catch (error: any) {
    logger.error('Error exporting dashboard to Excel', { error });
    return res.status(500).json({ error: 'Failed to export dashboard to Excel' });
  }
});

/**
 * POST /api/dashboard/layout
 * Save widget layout
 * Requirement 17.6
 */
router.post('/layout', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { widgets } = req.body;
    if (!Array.isArray(widgets)) {
      return res.status(400).json({ error: 'widgets must be an array' });
    }
    const layout = await dashboardService.saveWidgetLayout(userId, widgets);
    return res.json(layout);
  } catch (error: any) {
    logger.error('Error saving widget layout', { error });
    return res.status(500).json({ error: 'Failed to save widget layout' });
  }
});

/**
 * GET /api/dashboard/layout
 * Get widget layout
 * Requirement 17.6
 */
router.get('/layout', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const layout = await dashboardService.getWidgetLayout(userId);
    if (!layout) return res.status(404).json({ error: 'No layout found' });
    return res.json(layout);
  } catch (error: any) {
    logger.error('Error fetching widget layout', { error });
    return res.status(500).json({ error: 'Failed to fetch widget layout' });
  }
});

export default router;
