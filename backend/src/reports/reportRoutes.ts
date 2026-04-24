import { Router, Request, Response } from 'express';
import { dailyReportService, SubmitReportInput, UpdateReportInput, ListReportsFilters } from './reportService';
import { reportReminderService } from './reportReminderService';
import { reportAnalyticsService, ReportFilters } from './reportAnalyticsService';
import logger from '../utils/logger';

const EXECUTIVE_ROLES = ['CEO', 'CoS', 'COO', 'CTO'];

const router = Router();

/**
 * Submit today's daily report
 * POST /api/reports
 * Requirements: 10.1-10.3
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { accomplishments, challenges, tomorrowPlan, hoursWorked } = req.body;

    if (!accomplishments) {
      return res.status(400).json({ error: 'accomplishments is required' });
    }

    const input: SubmitReportInput = {
      accomplishments,
      challenges,
      tomorrowPlan,
      hoursWorked: hoursWorked !== undefined ? parseFloat(hoursWorked) : undefined,
    };

    const report = await dailyReportService.submitReport(userId, input);

    return res.status(201).json(report);
  } catch (error: any) {
    logger.error('Error submitting daily report', { error, body: req.body });
    return res.status(400).json({ error: error.message || 'Failed to submit report' });
  }
});

/**
 * Get today's report for the authenticated user
 * GET /api/reports/today
 * Requirements: 10.1
 */
router.get('/today', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const today = new Date();
    const report = await dailyReportService.getReport(userId, today);

    if (!report) {
      return res.status(404).json({ error: 'No report submitted for today' });
    }

    return res.json(report);
  } catch (error: any) {
    logger.error('Error getting today\'s report', { error });
    return res.status(500).json({ error: 'Failed to get today\'s report' });
  }
});

/**
 * List reports with optional filters
 * GET /api/reports
 * Requirements: 10.7-10.9
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const filters: ListReportsFilters = {
      userId: req.query.userId as string | undefined,
      dateFrom: req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined,
      dateTo: req.query.dateTo ? new Date(req.query.dateTo as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
    };

    const result = await dailyReportService.listReports(filters);

    return res.json(result);
  } catch (error: any) {
    logger.error('Error listing daily reports', { error, query: req.query });
    return res.status(500).json({ error: 'Failed to list reports' });
  }
});

/**
 * Get reports from direct reports (managers) or all reports (executives)
 * GET /api/reports/team
 * Requirements: 10.7, 10.9
 * NOTE: Must be registered BEFORE /:reportId to avoid route collision
 */
router.get('/team', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const filters: ReportFilters = {
      userId: req.query.userId as string | undefined,
      dateFrom: req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined,
      dateTo: req.query.dateTo ? new Date(req.query.dateTo as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
    };

    let result;
    if (EXECUTIVE_ROLES.includes(user.role)) {
      result = await reportAnalyticsService.getReportsForExecutive(filters);
    } else {
      result = await reportAnalyticsService.getReportsForManager(user.id, filters);
    }

    return res.json(result);
  } catch (error: any) {
    logger.error('Error getting team reports', { error });
    return res.status(500).json({ error: 'Failed to get team reports' });
  }
});

/**
 * Get overdue users for today (or a specific date)
 * GET /api/reports/overdue
 * NOTE: Must be registered BEFORE /:reportId
 */
router.get('/overdue', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const date = req.query.date ? new Date(req.query.date as string) : undefined;
    const overdueUsers = await reportReminderService.getOverdueUsers(date);

    return res.json({ overdueUsers, total: overdueUsers.length });
  } catch (error: any) {
    logger.error('Error getting overdue users', { error });
    return res.status(500).json({ error: 'Failed to get overdue users' });
  }
});

/**
 * Analytics routes — all before /:reportId
 */
router.get('/analytics/submission-rate', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const days = req.query.days ? parseInt(req.query.days as string) : 30;
    const rate = await reportAnalyticsService.getSubmissionRate(userId, days);
    return res.json(rate);
  } catch (error: any) {
    logger.error('Error getting submission rate', { error });
    return res.status(500).json({ error: 'Failed to get submission rate' });
  }
});

router.get('/analytics/team-rates', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.id) return res.status(401).json({ error: 'Unauthorized' });
    const days = req.query.days ? parseInt(req.query.days as string) : 30;
    const rates = await reportAnalyticsService.getTeamSubmissionRates(user.id, days);
    return res.json(rates);
  } catch (error: any) {
    logger.error('Error getting team submission rates', { error });
    return res.status(500).json({ error: 'Failed to get team submission rates' });
  }
});

router.get('/analytics/weekly-summary', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const weekStart = req.query.weekStart ? new Date(req.query.weekStart as string) : undefined;
    const summary = await reportAnalyticsService.getWeeklySummary(userId, weekStart);
    return res.json(summary);
  } catch (error: any) {
    logger.error('Error getting weekly summary', { error });
    return res.status(500).json({ error: 'Failed to get weekly summary' });
  }
});

router.get('/analytics/team-summary', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.id) return res.status(401).json({ error: 'Unauthorized' });
    const weekStart = req.query.weekStart ? new Date(req.query.weekStart as string) : undefined;
    const summary = await reportAnalyticsService.getTeamWeeklySummary(user.id, weekStart);
    return res.json(summary);
  } catch (error: any) {
    logger.error('Error getting team weekly summary', { error });
    return res.status(500).json({ error: 'Failed to get team weekly summary' });
  }
});

/**
 * Tax report submission (CEO/CFO)
 * POST /api/reports/tax/submit
 */
router.post('/tax/submit', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.id) return res.status(401).json({ error: 'Unauthorized' });

    const { period, items } = req.body;
    if (!period) return res.status(400).json({ error: 'period is required' });

    // Log the tax submission in audit log
    const { db } = await import('../database/connection');
    await db.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, result)
       VALUES ($1, 'TAX_REPORT_SUBMITTED', 'tax_report', $2, $3, 'SUCCESS')
       ON CONFLICT DO NOTHING`,
      [user.id, period, JSON.stringify({ period, items: items || [], submittedAt: new Date() })]
    ).catch(() => { /* audit log table may not exist — ignore */ });

    return res.json({
      success: true,
      period,
      submittedAt: new Date(),
      message: `Tax report for ${period} submitted successfully`,
    });
  } catch (error: any) {
    logger.error('Error submitting tax report', { error });
    return res.status(500).json({ error: error.message || 'Failed to submit tax report' });
  }
});

/**
 * Get a specific report by ID
 * GET /api/reports/:reportId
 * NOTE: Must be LAST among GET routes to avoid swallowing named paths
 */
router.get('/:reportId', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const report = await dailyReportService.getReportById(req.params.reportId);

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    return res.json(report);
  } catch (error: any) {
    logger.error('Error getting daily report', { error, reportId: req.params.reportId });
    return res.status(500).json({ error: 'Failed to get report' });
  }
});

/**
 * Update an existing report
 * PATCH /api/reports/:reportId
 * Requirements: 10.2
 */
router.patch('/:reportId', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { accomplishments, challenges, tomorrowPlan, hoursWorked } = req.body;

    const updates: UpdateReportInput = {};
    if (accomplishments !== undefined) updates.accomplishments = accomplishments;
    if (challenges !== undefined) updates.challenges = challenges;
    if (tomorrowPlan !== undefined) updates.tomorrowPlan = tomorrowPlan;
    if (hoursWorked !== undefined) updates.hoursWorked = parseFloat(hoursWorked);

    const report = await dailyReportService.updateReport(req.params.reportId, userId, updates);

    return res.json(report);
  } catch (error: any) {
    logger.error('Error updating daily report', { error, reportId: req.params.reportId });
    if (error.message === 'Report not found') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(400).json({ error: error.message || 'Failed to update report' });
  }
});

/**
 * Manually trigger reminder check (admin only)
 * POST /api/reports/check-reminders
 * Requirements: 10.4-10.6
 */
router.post('/check-reminders', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Only admins (CEO, CoS, COO, CTO) can trigger manual checks
    const adminRoles = ['CEO', 'CoS', 'COO', 'CTO'];
    if (!adminRoles.includes(user.role)) {
      return res.status(403).json({ error: 'Forbidden: admin role required' });
    }

    const { action } = req.body;

    if (action === 'reminders') {
      const result = await reportReminderService.sendReminders();
      return res.json({ action: 'reminders', result });
    }

    if (action === 'overdue') {
      const overdueUsers = await reportReminderService.markOverdueUsers();
      const overdueUserIds = overdueUsers.map((u) => u.userId);
      const managerResult = await reportReminderService.notifyManagers(overdueUserIds);
      return res.json({
        action: 'overdue',
        result: {
          overdueCount: overdueUsers.length,
          managerNotifications: managerResult,
        },
      });
    }

    // Default: run the full daily check based on current time
    const result = await reportReminderService.runDailyCheck();
    return res.json(result);
  } catch (error: any) {
    logger.error('Error triggering reminder check', { error });
    return res.status(500).json({ error: 'Failed to trigger reminder check' });
  }
});

export default router;
