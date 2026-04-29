/**
 * Daily Report Routes
 * Doc §20 Reporting Structure:
 *  - All COO dept members: daily report by 10 PM → COO + CoS
 *  - Marketing & Biz Ops: evening report by 10 PM → COO
 *  - Client Success team: morning briefing at 9 AM → COO
 *  - Automated alerts if not submitted by deadline
 */
import { Router, Request, Response } from 'express';
import { requireRole } from '../auth/authorizationMiddleware';
import { Role } from '../auth/authorizationService';
import { db } from '../database/connection';
import logger from '../utils/logger';

const router = Router();

const REPORT_SUBMITTERS = [
  Role.TRAINER, Role.HEAD_OF_TRAINERS, 'OPERATIONS_USER', 'TECH_STAFF', 'DEVELOPER',
  Role.COO, Role.CTO,
];

// ── Submit daily report ───────────────────────────────────────────────────────
router.post('/', requireRole(...(REPORT_SUBMITTERS as any[])), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { accomplishments, challenges, tomorrowPlan, hoursWorked, reportType } = req.body;

    if (!accomplishments) return res.status(400).json({ success: false, error: 'accomplishments is required' });

    const today = new Date().toISOString().split('T')[0];
    const type = reportType || 'DAILY';

    const result = await db.query(
      `INSERT INTO daily_reports
         (user_id, report_date, accomplishments, challenges, tomorrow_plan, hours_worked, report_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (user_id, report_date) DO UPDATE SET
         accomplishments = EXCLUDED.accomplishments,
         challenges = EXCLUDED.challenges,
         tomorrow_plan = EXCLUDED.tomorrow_plan,
         hours_worked = EXCLUDED.hours_worked,
         report_type = EXCLUDED.report_type,
         submitted_at = NOW()
       RETURNING *`,
      [userId, today, accomplishments, challenges || null, tomorrowPlan || null, hoursWorked || null, type]
    );

    logger.info('Daily report submitted', { userId, date: today, type });
    return res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    logger.error('Submit daily report error', { error });
    return res.status(400).json({ success: false, error: error.message });
  }
});

// ── Get my reports ────────────────────────────────────────────────────────────
router.get('/mine', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { from, to, limit, offset } = req.query;

    const conditions = ['user_id = $1'];
    const values: any[] = [userId];
    let p = 2;

    if (from) { conditions.push(`report_date >= $${p++}`); values.push(from); }
    if (to) { conditions.push(`report_date <= $${p++}`); values.push(to); }

    const where = `WHERE ${conditions.join(' AND ')}`;
    values.push(limit ? parseInt(limit as string) : 30, offset ? parseInt(offset as string) : 0);

    const result = await db.query(
      `SELECT * FROM daily_reports ${where} ORDER BY report_date DESC LIMIT $${p} OFFSET $${p + 1}`,
      values
    );
    return res.json({ success: true, data: result.rows });
  } catch (error: any) {
    logger.error('Get my reports error', { error });
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ── COO/CEO: View team reports ────────────────────────────────────────────────
router.get('/team', requireRole(Role.COO, Role.CEO, Role.CoS, Role.CTO, Role.OPERATIONS_USER), async (req: Request, res: Response) => {
  try {
    const { date, departmentId, limit, offset } = req.query;

    const conditions: string[] = [];
    const values: any[] = [];
    let p = 1;

    if (date) { conditions.push(`dr.report_date = $${p++}`); values.push(date); }
    if (departmentId) { conditions.push(`u.department_id = $${p++}`); values.push(departmentId); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    values.push(limit ? parseInt(limit as string) : 50, offset ? parseInt(offset as string) : 0);

    const result = await db.query(
      `SELECT dr.*, u.full_name, r.name AS role, u.department_id
       FROM daily_reports dr
       JOIN users u ON u.id = dr.user_id
       JOIN roles r ON r.id = u.role_id
       ${where}
       ORDER BY dr.submitted_at DESC LIMIT $${p} OFFSET $${p + 1}`,
      values
    );
    return res.json({ success: true, data: result.rows });
  } catch (error: any) {
    logger.error('Get team reports error', { error });
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ── Check who hasn't submitted today (for automated alerts — doc §20) ─────────
router.get('/missing', requireRole(Role.COO, Role.CEO, Role.CoS, Role.CTO), async (_req: Request, res: Response) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Find all active COO/CTO dept users who haven't submitted today
    const result = await db.query(
      `SELECT u.id, u.full_name, u.email, r.name AS role, u.department_id
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.is_active = TRUE
         AND r.name IN ('TRAINER','HEAD_OF_TRAINERS','OPERATIONS_USER','TECH_STAFF','DEVELOPER')
         AND u.id NOT IN (
           SELECT user_id FROM daily_reports WHERE report_date = $1
         )
       ORDER BY r.name, u.full_name`,
      [today]
    );

    return res.json({ success: true, date: today, missing: result.rows, count: result.rows.length });
  } catch (error: any) {
    logger.error('Get missing reports error', { error });
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
