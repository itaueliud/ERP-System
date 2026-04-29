import { Router, Request, Response } from 'express';
import { db } from '../database/connection';
import logger from '../utils/logger';

const router = Router();

/**
 * @swagger
 * /api/v1/incidents:
 *   get:
 *     summary: Get all incidents
 *     tags: [Incidents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [OPEN, IN_PROGRESS, RESOLVED, CLOSED]
 *         description: Filter by incident status
 *       - in: query
 *         name: severity
 *         schema:
 *           type: string
 *           enum: [LOW, MEDIUM, HIGH, CRITICAL]
 *         description: Filter by incident severity
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Maximum number of results
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *         description: Number of results to skip
 *     responses:
 *       200:
 *         description: List of incidents
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Incident'
 *                 total:
 *                   type: integer
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { status, severity, limit, offset } = req.query;
    
    let query = `
      SELECT i.id, i.title, i.description, i.severity, i.status,
             i.reported_by as "reportedBy", i.assigned_to as "assignedTo",
             i.resolved_at as "resolvedAt", i.created_at as "createdAt",
             i.updated_at as "updatedAt",
             u1.full_name as "reportedByName",
             u2.full_name as "assignedToName"
      FROM incidents i
      LEFT JOIN users u1 ON u1.id = i.reported_by
      LEFT JOIN users u2 ON u2.id = i.assigned_to
      WHERE 1=1
    `;
    
    const params: any[] = [];
    let paramIndex = 1;
    
    if (status) {
      query += ` AND i.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    
    if (severity) {
      query += ` AND i.severity = $${paramIndex}`;
      params.push(severity);
      paramIndex++;
    }
    
    query += ` ORDER BY i.created_at DESC`;
    
    if (limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(parseInt(limit as string));
      paramIndex++;
    }
    
    if (offset) {
      query += ` OFFSET $${paramIndex}`;
      params.push(parseInt(offset as string));
    }
    
    const result = await db.query(query, params);
    
    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error: any) {
    logger.error('Failed to get incidents', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get incidents',
    });
  }
});

/**
 * Create incident
 * POST /api/v1/incidents
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { title, description, severity, assignedTo } = req.body;
    const reportedBy = (req as any).user?.id;
    
    if (!title || !description) {
      return res.status(400).json({
        success: false,
        error: 'title and description are required',
      });
    }
    
    const result = await db.query(
      `INSERT INTO incidents (title, description, severity, status, reported_by, assigned_to, created_at, updated_at)
       VALUES ($1, $2, $3, 'OPEN', $4, $5, NOW(), NOW())
       RETURNING id, title, severity, status, created_at as "createdAt"`,
      [title, description, severity || 'MEDIUM', reportedBy, assignedTo || null]
    );
    
    return res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error: any) {
    logger.error('Failed to create incident', { error });
    return res.status(400).json({
      success: false,
      error: error.message || 'Failed to create incident',
    });
  }
});

/**
 * Update incident
 * PUT /api/v1/incidents/:id
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, description, severity, status, assignedTo } = req.body;
    
    const result = await db.query(
      `UPDATE incidents
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           severity = COALESCE($3, severity),
           status = COALESCE($4, status),
           assigned_to = COALESCE($5, assigned_to),
           resolved_at = CASE WHEN $4 IN ('RESOLVED', 'CLOSED') THEN NOW() ELSE resolved_at END,
           updated_at = NOW()
       WHERE id = $6
       RETURNING id, title, status, updated_at as "updatedAt"`,
      [title, description, severity, status, assignedTo, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Incident not found',
      });
    }
    
    return res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error: any) {
    logger.error('Failed to update incident', { error });
    return res.status(400).json({
      success: false,
      error: error.message || 'Failed to update incident',
    });
  }
});

export default router;
