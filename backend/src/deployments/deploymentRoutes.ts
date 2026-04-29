import { Router, Request, Response } from 'express';
import { db } from '../database/connection';
import logger from '../utils/logger';

const router = Router();

/**
 * Get all deployments
 * GET /api/v1/deployments
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { projectId, environment, status, limit, offset } = req.query;
    
    let query = `
      SELECT d.id, d.project_id as "projectId", d.version, d.environment,
             d.status, d.deployed_by as "deployedBy", d.deployment_notes as "deploymentNotes",
             d.started_at as "startedAt", d.completed_at as "completedAt",
             d.created_at as "createdAt",
             u.full_name as "deployedByName",
             p.reference_number as "projectReference"
      FROM deployments d
      LEFT JOIN users u ON u.id = d.deployed_by
      LEFT JOIN projects p ON p.id = d.project_id
      WHERE 1=1
    `;
    
    const params: any[] = [];
    let paramIndex = 1;
    
    if (projectId) {
      query += ` AND d.project_id = $${paramIndex}`;
      params.push(projectId);
      paramIndex++;
    }
    
    if (environment) {
      query += ` AND d.environment = $${paramIndex}`;
      params.push(environment);
      paramIndex++;
    }
    
    if (status) {
      query += ` AND d.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    
    query += ` ORDER BY d.created_at DESC`;
    
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
    logger.error('Failed to get deployments', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get deployments',
    });
  }
});

/**
 * Create deployment
 * POST /api/v1/deployments
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { projectId, version, environment, deploymentNotes } = req.body;
    const deployedBy = (req as any).user?.id;
    
    if (!version || !environment) {
      return res.status(400).json({
        success: false,
        error: 'version and environment are required',
      });
    }
    
    const result = await db.query(
      `INSERT INTO deployments (project_id, version, environment, status, deployed_by, deployment_notes, created_at)
       VALUES ($1, $2, $3, 'PENDING', $4, $5, NOW())
       RETURNING id, version, environment, status, created_at as "createdAt"`,
      [projectId || null, version, environment, deployedBy, deploymentNotes || null]
    );
    
    return res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error: any) {
    logger.error('Failed to create deployment', { error });
    return res.status(400).json({
      success: false,
      error: error.message || 'Failed to create deployment',
    });
  }
});

/**
 * Update deployment status
 * PATCH /api/v1/deployments/:id/status
 */
router.patch('/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, deploymentNotes } = req.body;
    
    if (!status) {
      return res.status(400).json({
        success: false,
        error: 'status is required',
      });
    }
    
    const result = await db.query(
      `UPDATE deployments
       SET status = $1,
           deployment_notes = COALESCE($2, deployment_notes),
           started_at = CASE WHEN $1 = 'IN_PROGRESS' AND started_at IS NULL THEN NOW() ELSE started_at END,
           completed_at = CASE WHEN $1 IN ('SUCCESS', 'FAILED') THEN NOW() ELSE completed_at END
       WHERE id = $3
       RETURNING id, status, started_at as "startedAt", completed_at as "completedAt"`,
      [status, deploymentNotes, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Deployment not found',
      });
    }
    
    return res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error: any) {
    logger.error('Failed to update deployment', { error });
    return res.status(400).json({
      success: false,
      error: error.message || 'Failed to update deployment',
    });
  }
});

export default router;
