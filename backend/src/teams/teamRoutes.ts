/**
 * Developer Team Management Routes
 * Doc §17: 10+ teams, each with exactly 3 developers, one Team Leader
 * Managed by CTO
 */
import { Router, Request, Response } from 'express';
import { requireRole } from '../auth/authorizationMiddleware';
import { Role } from '../auth/authorizationService';
import { db } from '../database/connection';
import logger from '../utils/logger';

const router = Router();

// ── Create team (CTO only) ────────────────────────────────────────────────────
router.post('/', requireRole(Role.CTO), async (req: Request, res: Response) => {
  try {
    const { name, departmentId } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'name is required' });

    const result = await db.query(
      `INSERT INTO developer_teams (name, department_id) VALUES ($1, $2) RETURNING *`,
      [name, departmentId || null]
    );
    return res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    logger.error('Create team error', { error });
    return res.status(400).json({ success: false, error: error.message });
  }
});

// ── List all teams ────────────────────────────────────────────────────────────
router.get('/', requireRole(Role.CTO, Role.CEO, Role.CoS), async (_req: Request, res: Response) => {
  try {
    const result = await db.query(
      `SELECT dt.*, u.full_name AS team_leader_name,
              COUNT(m.id) AS member_count
       FROM developer_teams dt
       LEFT JOIN users u ON u.id = dt.team_leader_id
       LEFT JOIN users m ON m.team_id = dt.id
       GROUP BY dt.id, u.full_name
       ORDER BY dt.name`
    );
    return res.json({ success: true, data: result.rows });
  } catch (error: any) {
    logger.error('List teams error', { error });
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ── Get team members ──────────────────────────────────────────────────────────
router.get('/:teamId/members', async (req: Request, res: Response) => {
  try {
    const result = await db.query(
      `SELECT u.id, u.full_name, u.email, u.github_username, u.is_team_leader,
              u.country, u.created_at
       FROM users u
       WHERE u.team_id = $1
       ORDER BY u.is_team_leader DESC, u.full_name`,
      [req.params.teamId]
    );
    return res.json({ success: true, data: result.rows });
  } catch (error: any) {
    logger.error('Get team members error', { error });
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ── Assign user to team (CTO only) ───────────────────────────────────────────
router.post('/:teamId/members', requireRole(Role.CTO), async (req: Request, res: Response) => {
  try {
    const { teamId } = req.params;
    const { userId, isTeamLeader } = req.body;
    if (!userId) return res.status(400).json({ success: false, error: 'userId is required' });

    // Enforce max 3 members per team (doc §17)
    const countResult = await db.query(
      `SELECT COUNT(*) FROM users WHERE team_id = $1`, [teamId]
    );
    if (parseInt(countResult.rows[0].count) >= 3) {
      return res.status(400).json({ success: false, error: 'Teams can have a maximum of 3 members (doc §17)' });
    }

    // If setting as team leader, unset previous leader
    if (isTeamLeader) {
      await db.query(
        `UPDATE users SET is_team_leader = FALSE WHERE team_id = $1 AND is_team_leader = TRUE`,
        [teamId]
      );
      await db.query(
        `UPDATE developer_teams SET team_leader_id = $1 WHERE id = $2`,
        [userId, teamId]
      );
    }

    await db.query(
      `UPDATE users SET team_id = $1, is_team_leader = $2, updated_at = NOW() WHERE id = $3`,
      [teamId, isTeamLeader || false, userId]
    );

    return res.json({ success: true, message: 'User assigned to team' });
  } catch (error: any) {
    logger.error('Assign team member error', { error });
    return res.status(400).json({ success: false, error: error.message });
  }
});

// ── Set team leader (CTO only) ────────────────────────────────────────────────
router.post('/:teamId/leader', requireRole(Role.CTO), async (req: Request, res: Response) => {
  try {
    const { teamId } = req.params;
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ success: false, error: 'userId is required' });

    // Verify user is in this team
    const check = await db.query(`SELECT id FROM users WHERE id = $1 AND team_id = $2`, [userId, teamId]);
    if (!check.rows.length) return res.status(400).json({ success: false, error: 'User is not in this team' });

    // Unset previous leader
    await db.query(`UPDATE users SET is_team_leader = FALSE WHERE team_id = $1`, [teamId]);
    await db.query(`UPDATE users SET is_team_leader = TRUE WHERE id = $1`, [userId]);
    await db.query(`UPDATE developer_teams SET team_leader_id = $1 WHERE id = $2`, [userId, teamId]);

    return res.json({ success: true, message: 'Team leader assigned' });
  } catch (error: any) {
    logger.error('Set team leader error', { error });
    return res.status(400).json({ success: false, error: error.message });
  }
});

export default router;
