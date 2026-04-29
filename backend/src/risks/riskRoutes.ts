import { Router, Request, Response } from 'express';
import { db } from '../database/connection';
import logger from '../utils/logger';

const router = Router();

/**
 * Get all risks
 * GET /api/v1/risks
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { projectId, status, limit, offset } = req.query;
    
    let query = `
      SELECT r.id, r.project_id as "projectId", r.title, r.description,
             r.probability, r.impact, r.mitigation_plan as "mitigationPlan",
             r.status, r.owner_id as "ownerId",
             r.created_at as "createdAt", r.updated_at as "updatedAt",
             u.full_name as "ownerName",
             p.reference_number as "projectReference"
      FROM risks r
      LEFT JOIN users u ON u.id = r.owner_id
      LEFT JOIN projects p ON p.id = r.project_id
      WHERE 1=1
    `;
    
    const params: any[] = [];
    let paramIndex = 1;
    
    if (projectId) {
      query += ` AND r.project_id = $${paramIndex}`;
      params.push(projectId);
      paramIndex++;
    }
    
    if (status) {
      query += ` AND r.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    
    query += ` ORDER BY r.created_at DESC`;
    
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
    logger.error('Failed to get risks', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get risks',
    });
  }
});

/**
 * Create risk
 * POST /api/v1/risks
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { projectId, title, description, probability, impact, mitigationPlan, ownerId } = req.body;
    
    if (!title || !description || !probability || !impact) {
      return res.status(400).json({
        success: false,
        error: 'title, description, probability, and impact are required',
      });
    }
    
    const result = await db.query(
      `INSERT INTO risks (project_id, title, description, probability, impact, mitigation_plan, status, owner_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'IDENTIFIED', $7, NOW(), NOW())
       RETURNING id, title, probability, impact, status, created_at as "createdAt"`,
      [projectId || null, title, description, probability, impact, mitigationPlan || null, ownerId || null]
    );
    
    return res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error: any) {
    logger.error('Failed to create risk', { error });
    return res.status(400).json({
      success: false,
      error: error.message || 'Failed to create risk',
    });
  }
});

/**
 * Update risk
 * PUT /api/v1/risks/:id
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, description, probability, impact, mitigationPlan, status, ownerId } = req.body;
    
    const result = await db.query(
      `UPDATE risks
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           probability = COALESCE($3, probability),
           impact = COALESCE($4, impact),
           mitigation_plan = COALESCE($5, mitigation_plan),
           status = COALESCE($6, status),
           owner_id = COALESCE($7, owner_id),
           updated_at = NOW()
       WHERE id = $8
       RETURNING id, title, status, updated_at as "updatedAt"`,
      [title, description, probability, impact, mitigationPlan, status, ownerId, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Risk not found',
      });
    }
    
    return res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error: any) {
    logger.error('Failed to update risk', { error });
    return res.status(400).json({
      success: false,
      error: error.message || 'Failed to update risk',
    });
  }
});

export default router;
