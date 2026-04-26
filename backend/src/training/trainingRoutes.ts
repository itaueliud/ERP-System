import { Router, Request, Response } from 'express';
import logger from '../utils/logger';

const router = Router();

/**
 * GET /api/v1/training/courses
 */
router.get('/courses', async (_req: Request, res: Response) => {
  try {
    const { db } = await import('../database/connection');
    const result = await db.query(
      `SELECT id, title, description, duration_hours as "durationHours",
              status, created_at as "createdAt", created_by as "createdBy"
       FROM training_courses ORDER BY created_at DESC`
    );
    return res.json({ success: true, data: result.rows });
  } catch {
    return res.json({ success: true, data: [] });
  }
});

/**
 * POST /api/v1/training/courses
 */
router.post('/courses', async (req: Request, res: Response) => {
  try {
    const { title, description, durationHours } = req.body;
    if (!title || !description) {
      return res.status(400).json({ success: false, error: 'title and description are required' });
    }
    const createdBy = (req as any).user?.id;
    const { db } = await import('../database/connection');
    const result = await db.query(
      `INSERT INTO training_courses (title, description, duration_hours, status, created_by, created_at)
       VALUES ($1, $2, $3, 'active', $4, NOW())
       RETURNING id, title, description, duration_hours as "durationHours", status, created_at as "createdAt"`,
      [title, description, durationHours || null, createdBy]
    );
    return res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    logger.error('Failed to create course', { error });
    return res.status(400).json({ success: false, error: error.message || 'Failed to create course' });
  }
});

export default router;
