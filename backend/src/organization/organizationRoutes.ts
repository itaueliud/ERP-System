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
/**
 * GET /api/v1/organization/teams
 */
router.get('/teams', async (_req: Request, res: Response) => {
  try {
    const { db } = await import('../database/connection');
    const result = await db.query(
      `SELECT dt.id, dt.name, dt.github_org as "githubOrg",
              u.full_name as "leaderName", dt.team_leader_id as "leaderId",
              (SELECT COUNT(*) FROM users m WHERE m.team_id = dt.id) as "memberCount"
       FROM developer_teams dt
       LEFT JOIN users u ON u.id = dt.team_leader_id
       ORDER BY dt.created_at DESC`
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
    const { name, leaderId, githubOrg, members } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'name is required' });

    const { db } = await import('../database/connection');
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    // Create the team first
    const teamResult = await db.query(
      `INSERT INTO developer_teams (name, github_org, created_at, updated_at)
       VALUES ($1, $2, NOW(), NOW())
       RETURNING id, name, team_leader_id as "leaderId", github_org as "githubOrg", created_at`,
      [name, githubOrg || null]
    );
    const team = teamResult.rows[0];

    // Handle members array (name + email — create/invite new users)
    if (Array.isArray(members) && members.length > 0) {
      const devRole = await db.query(`SELECT id FROM roles WHERE name = 'DEVELOPER' LIMIT 1`);
      const roleId = devRole.rows[0]?.id;
      let leadUserIdSet = false;
      for (const m of members) {
        if (!m.name && !m.email) continue;
        const payoutMethod: string | null = m.payoutMethod || m.paymentType || null;
        const payoutPhone: string | null = payoutMethod === 'MPESA' ? (m.payoutPhone || m.paymentAccount || null) : null;
        const payoutBankAccount: string | null = payoutMethod === 'BANK' ? (m.payoutBankAccount || m.paymentAccount || null) : null;
        try {
          let userId: string | null = null;
          if (m.email) {
            const existing = await db.query(`SELECT id FROM users WHERE email = $1`, [m.email]);
            if (existing.rows.length > 0) userId = existing.rows[0].id;
          }
          if (!userId && roleId) {
            const bcrypt = await import('bcrypt');
            const tempPassword = await bcrypt.hash(`TST@${Date.now()}`, 10);
            const newUser = await db.query(
              `INSERT INTO users (email, password_hash, full_name, phone, country, role_id, team_id, is_team_leader, payout_method, payout_phone, payout_bank_account, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW()) RETURNING id`,
              [m.email || `${(m.name || 'dev').toLowerCase().replace(/\s+/g, '.')}@tst.local`, tempPassword, m.name || 'Developer', '+254000000000', 'Kenya', roleId, team.id, m.isLeader || false, payoutMethod, payoutPhone, payoutBankAccount]
            );
            userId = newUser.rows[0].id;
          } else if (userId) {
            await db.query(
              `UPDATE users SET team_id = $1, is_team_leader = $2, payout_method = COALESCE($3, payout_method), payout_phone = COALESCE($4, payout_phone), payout_bank_account = COALESCE($5, payout_bank_account), updated_at = NOW() WHERE id = $6`,
              [team.id, m.isLeader || false, payoutMethod, payoutPhone, payoutBankAccount, userId]
            );
          }
          if (m.isLeader && userId && !leadUserIdSet) {
            await db.query(`UPDATE developer_teams SET team_leader_id = $1 WHERE id = $2`, [userId, team.id]);
            leadUserIdSet = true;
          }
        } catch (memberErr) {
          logger.warn('Failed to create/assign team member', { memberErr, member: m });
        }
      }
    } else {
      const safeLeaderId = leaderId && uuidRe.test(leaderId) ? leaderId : null;
      if (safeLeaderId) {
        await db.query(`UPDATE developer_teams SET team_leader_id = $1 WHERE id = $2`, [safeLeaderId, team.id]);
        await db.query(`UPDATE users SET team_id = $1, is_team_leader = TRUE, updated_at = NOW() WHERE id = $2`, [team.id, safeLeaderId]).catch(() => {});
      }
    }

    // Refresh team with leader name
    const refreshed = await db.query(
      `SELECT dt.id, dt.name, dt.github_org as "githubOrg", dt.team_leader_id as "leaderId",
              u.full_name as "leaderName",
              (SELECT COUNT(*) FROM users m WHERE m.team_id = dt.id) as "memberCount"
       FROM developer_teams dt LEFT JOIN users u ON u.id = dt.team_leader_id WHERE dt.id = $1`,
      [team.id]
    );
    return res.status(201).json({ success: true, data: refreshed.rows[0] || team });
  } catch (error: any) {
    logger.error('Failed to create team', { error });
    return res.status(400).json({ success: false, error: error.message || 'Failed to create team' });
  }
});

/**
 * GET /api/v1/organization/teams/:teamId/members
 */
router.get('/teams/:teamId/members', async (req: Request, res: Response) => {
  try {
    const { db } = await import('../database/connection');
    const result = await db.query(
      `SELECT u.id, u.full_name as "fullName", u.email, u.github_username as "githubUsername",
              u.is_team_leader as "isTeamLeader", u.country
       FROM users u WHERE u.team_id = $1 ORDER BY u.is_team_leader DESC, u.full_name`,
      [req.params.teamId]
    );
    return res.json({ success: true, data: result.rows });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/v1/organization/teams/:teamId — update team name / leader / github
 */
router.put('/teams/:teamId', async (req: Request, res: Response) => {
  try {
    const { name, leaderId, githubOrg, members } = req.body;
    const { db } = await import('../database/connection');
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    // Update team metadata
    await db.query(
      `UPDATE developer_teams SET
         name = COALESCE($1, name),
         github_org = COALESCE($2, github_org),
         updated_at = NOW()
       WHERE id = $3`,
      [name || null, githubOrg !== undefined ? (githubOrg || null) : undefined, req.params.teamId]
    );

    // Handle members array (name + email)
    if (Array.isArray(members) && members.length > 0) {
      const devRole = await db.query(`SELECT id FROM roles WHERE name = 'DEVELOPER' LIMIT 1`);
      const roleId = devRole.rows[0]?.id;

      // Clear old team assignments
      await db.query(`UPDATE users SET team_id = NULL, is_team_leader = FALSE WHERE team_id = $1`, [req.params.teamId]);
      await db.query(`UPDATE developer_teams SET team_leader_id = NULL WHERE id = $1`, [req.params.teamId]);

      for (const m of members) {
        if (!m.name && !m.email) continue;
        const payoutMethod: string | null = m.payoutMethod || m.paymentType || null;
        const payoutPhone: string | null = payoutMethod === 'MPESA' ? (m.payoutPhone || m.paymentAccount || null) : null;
        const payoutBankAccount: string | null = payoutMethod === 'BANK' ? (m.payoutBankAccount || m.paymentAccount || null) : null;
        try {
          let userId: string | null = null;
          if (m.email) {
            const existing = await db.query(`SELECT id FROM users WHERE email = $1`, [m.email]);
            if (existing.rows.length > 0) userId = existing.rows[0].id;
          }
          if (!userId && roleId) {
            const bcrypt = await import('bcrypt');
            const tempPassword = await bcrypt.hash(`TST@${Date.now()}`, 10);
            const newUser = await db.query(
              `INSERT INTO users (email, password_hash, full_name, phone, country, role_id, team_id, is_team_leader,
                                  payout_method, payout_phone, payout_bank_account, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW()) RETURNING id`,
              [
                m.email || `${(m.name || 'dev').toLowerCase().replace(/\s+/g, '.')}@tst.local`,
                tempPassword, m.name || 'Developer', '+254000000000', 'Kenya',
                roleId, req.params.teamId, m.isLeader || false,
                payoutMethod, payoutPhone, payoutBankAccount,
              ]
            );
            userId = newUser.rows[0].id;
          } else if (userId) {
            await db.query(
              `UPDATE users SET team_id = $1, is_team_leader = $2,
                payout_method = COALESCE($3, payout_method),
                payout_phone = COALESCE($4, payout_phone),
                payout_bank_account = COALESCE($5, payout_bank_account),
                updated_at = NOW()
               WHERE id = $6`,
              [req.params.teamId, m.isLeader || false, payoutMethod, payoutPhone, payoutBankAccount, userId]
            );
          }
          if (m.isLeader && userId) {
            await db.query(`UPDATE developer_teams SET team_leader_id = $1 WHERE id = $2`, [userId, req.params.teamId]);
          }
        } catch (memberErr) {
          logger.warn('Failed to update team member', { memberErr, member: m });
        }
      }
    } else if (leaderId && uuidRe.test(leaderId)) {
      await db.query(`UPDATE developer_teams SET team_leader_id = $1 WHERE id = $2`, [leaderId, req.params.teamId]);
      await db.query(`UPDATE users SET is_team_leader = FALSE WHERE team_id = $1`, [req.params.teamId]);
      await db.query(`UPDATE users SET is_team_leader = TRUE WHERE id = $1`, [leaderId]).catch(() => {});
    }

    const result = await db.query(
      `SELECT dt.id, dt.name, dt.github_org as "githubOrg", dt.team_leader_id as "leaderId",
              u.full_name as "leaderName",
              (SELECT COUNT(*) FROM users m WHERE m.team_id = dt.id) as "memberCount"
       FROM developer_teams dt LEFT JOIN users u ON u.id = dt.team_leader_id WHERE dt.id = $1`,
      [req.params.teamId]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, error: 'Team not found' });
    return res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    logger.error('Failed to update team', { error });
    return res.status(400).json({ success: false, error: error.message || 'Failed to update team' });
  }
});

/**
 * DELETE /api/v1/organization/teams/:teamId
 */
router.delete('/teams/:teamId', async (req: Request, res: Response) => {
  try {
    const { db } = await import('../database/connection');
    // Unassign all members first
    await db.query(`UPDATE users SET team_id = NULL, is_team_leader = FALSE WHERE team_id = $1`, [req.params.teamId]);
    const result = await db.query(`DELETE FROM developer_teams WHERE id = $1 RETURNING id`, [req.params.teamId]);
    if (!result.rows.length) return res.status(404).json({ success: false, error: 'Team not found' });
    return res.json({ success: true, message: 'Team deleted' });
  } catch (error: any) {
    logger.error('Failed to delete team', { error });
    return res.status(400).json({ success: false, error: error.message || 'Failed to delete team' });
  }
});

export default router;
