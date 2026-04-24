import { Router, Request, Response } from 'express';
import { organizationService } from './organizationService';
import { requireRole } from '../auth/authorizationMiddleware';
import { Role } from '../auth/authorizationService';
import logger from '../utils/logger';

const router = Router();

/**
 * Get organizational chart
 * GET /api/v1/organization/chart
 * Requirement 18.8: Allow viewing organizational chart as a tree visualization
 */
router.get('/chart', async (_req: Request, res: Response) => {
  try {
    const chart = await organizationService.getOrganizationalChart();

    res.json({
      success: true,
      data: chart,
    });
  } catch (error: any) {
    logger.error('Failed to get organizational chart', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get organizational chart',
    });
  }
});

/**
 * Get direct reports for a user
 * GET /api/v1/organization/users/:userId/reports
 * Requirement 18.9: Display direct reports for each manager role
 */
router.get('/users/:userId/reports', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const reports = await organizationService.getDirectReports(userId);

    res.json({
      success: true,
      data: reports,
    });
  } catch (error: any) {
    logger.error('Failed to get direct reports', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get direct reports',
    });
  }
});

/**
 * Get span of control for a user
 * GET /api/v1/organization/users/:userId/span
 * Requirement 18.12: Calculate span of control for each manager
 */
router.get('/users/:userId/span', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const spanOfControl = await organizationService.getSpanOfControl(userId);

    res.json({
      success: true,
      data: {
        userId,
        spanOfControl,
      },
    });
  } catch (error: any) {
    logger.error('Failed to get span of control', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get span of control',
    });
  }
});

/**
 * Get reporting chain for a user
 * GET /api/v1/organization/users/:userId/chain
 */
router.get('/users/:userId/chain', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const chain = await organizationService.getReportingChain(userId);

    res.json({
      success: true,
      data: chain,
    });
  } catch (error: any) {
    logger.error('Failed to get reporting chain', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get reporting chain',
    });
  }
});

/**
 * Set or update a user's manager
 * PUT /api/v1/organization/users/:userId/manager
 * Requirement 18.7: Link users to appropriate managers
 * Requirement 18.10: Prevent circular reporting relationships
 */
router.put('/users/:userId/manager', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { managerId } = req.body;

    // Validate managerId is provided (can be null to remove manager)
    if (managerId === undefined) {
      return res.status(400).json({
        success: false,
        error: 'managerId is required (use null to remove manager)',
      });
    }

    await organizationService.setManager(userId, managerId);

    return res.json({
      success: true,
      message: 'Manager updated successfully',
    });
  } catch (error: any) {
    logger.error('Failed to set manager', { error });
    
    // Check for circular relationship error
    if (error.message && error.message.includes('circular')) {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }

    return res.status(400).json({
      success: false,
      error: error.message || 'Failed to set manager',
    });
  }
});

/**
 * Create a department
 * POST /api/v1/organization/departments
 * Doc §15: CEO assigns countries to COO/CTO; CoS/COO/CTO manage departments
 * Requirement 18.3: Organize COO departments
 * Requirement 18.4: Organize CTO departments
 */
router.post('/departments', requireRole(Role.CEO, Role.CoS, Role.COO, Role.CTO), async (req: Request, res: Response) => {
  try {
    const { name, type, parentId, headId } = req.body;

    // Validate required fields
    if (!name || !type) {
      return res.status(400).json({
        success: false,
        error: 'name and type are required',
      });
    }

    // Validate type
    if (!['COO', 'CTO', 'SALES'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'type must be one of: COO, CTO, SALES',
      });
    }

    const department = await organizationService.createDepartment(name, type, parentId, headId);

    return res.status(201).json({
      success: true,
      data: department,
    });
  } catch (error: any) {
    logger.error('Failed to create department', { error });
    return res.status(400).json({
      success: false,
      error: error.message || 'Failed to create department',
    });
  }
});

/**
 * Get all departments
 * GET /api/v1/organization/departments
 */
router.get('/departments', async (req: Request, res: Response) => {
  try {
    const { type } = req.query;

    const departments = await organizationService.getDepartments(
      type as 'COO' | 'CTO' | 'SALES' | undefined
    );

    res.json({
      success: true,
      data: departments,
    });
  } catch (error: any) {
    logger.error('Failed to get departments', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get departments',
    });
  }
});

/**
 * Get department by ID
 * GET /api/v1/organization/departments/:id
 */
router.get('/departments/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const department = await organizationService.getDepartmentById(id);

    if (!department) {
      return res.status(404).json({
        success: false,
        error: 'Department not found',
      });
    }

    return res.json({
      success: true,
      data: department,
    });
  } catch (error: any) {
    logger.error('Failed to get department', { error });
    return res.status(500).json({
      success: false,
      error: 'Failed to get department',
    });
  }
});

/**
 * Update department
 * PUT /api/v1/organization/departments/:id
 */
router.put('/departments/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, headId } = req.body;

    const department = await organizationService.updateDepartment(id, { name, headId });

    res.json({
      success: true,
      data: department,
    });
  } catch (error: any) {
    logger.error('Failed to update department', { error });
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to update department',
    });
  }
});

/**
 * Get users in a department
 * GET /api/v1/organization/departments/:id/users
 */
router.get('/departments/:id/users', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const users = await organizationService.getDepartmentUsers(id);

    res.json({
      success: true,
      data: users,
    });
  } catch (error: any) {
    logger.error('Failed to get department users', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get department users',
    });
  }
});

/**
 * GET /api/v1/organization/teams
 */
router.get('/teams', async (_req: Request, res: Response) => {
  try {
    const { db } = await import('../database/connection');
    const result = await db.query(
      `SELECT t.id, t.name, t.github_org as "githubOrg",
              u.full_name as "leaderName", t.leader_id as "leaderId",
              (SELECT COUNT(*) FROM team_members tm WHERE tm.team_id = t.id) as "memberCount"
       FROM teams t
       LEFT JOIN users u ON u.id = t.leader_id
       ORDER BY t.created_at DESC`
    );
    return res.json({ success: true, data: result.rows });
  } catch {
    return res.json({ success: true, data: [] });
  }
});

/**
 * POST /api/v1/organization/teams
 */
router.post('/teams', async (req: Request, res: Response) => {
  try {
    const { name, leaderId, memberIds, githubOrg } = req.body;
    if (!name || !leaderId) {
      return res.status(400).json({ success: false, error: 'name and leaderId are required' });
    }
    const { db } = await import('../database/connection');
    const teamResult = await db.query(
      `INSERT INTO teams (name, leader_id, github_org, created_at)
       VALUES ($1, $2, $3, NOW()) RETURNING id, name, leader_id as "leaderId", github_org as "githubOrg"`,
      [name, leaderId, githubOrg || null]
    );
    const team = teamResult.rows[0];
    if (Array.isArray(memberIds) && memberIds.length > 0) {
      for (const memberId of memberIds) {
        await db.query(
          `INSERT INTO team_members (team_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [team.id, memberId]
        ).catch(() => {/* ignore if table doesn't exist yet */});
      }
    }
    return res.status(201).json({ success: true, data: team });
  } catch (error: any) {
    logger.error('Failed to create team', { error });
    return res.status(400).json({ success: false, error: error.message || 'Failed to create team' });
  }
});

export default router;
