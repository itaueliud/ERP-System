import { Router, Request, Response } from 'express';
import { db } from '../database/connection';
import { requireRole } from '../auth/authorizationMiddleware';
import { Role } from '../auth/authorizationService';
import logger from '../utils/logger';

const router = Router();

// ── Developer Team Management ─────────────────────────────────────────────────
// Teams of exactly 3 developers, each with a shared payout account.
// EA or CTO approves the team's payout account.

/**
 * POST /api/developer-teams
 * Create a new developer team (CTO only).
 */
router.post('/', requireRole(Role.CTO), async (req: Request, res: Response) => {
  try {
    const { name, memberIds, payoutMethod, payoutPhone, payoutBankName, payoutBankAccount } = req.body;
    const createdBy = (req as any).user?.id;

    if (!name) return res.status(400).json({ error: 'Team name is required' });
    if (!Array.isArray(memberIds) || memberIds.length !== 3) {
      return res.status(400).json({ error: 'A developer team must have exactly 3 members' });
    }
    if (!payoutMethod) return res.status(400).json({ error: 'payoutMethod is required' });
    if (payoutMethod === 'MPESA' && !payoutPhone?.trim()) {
      return res.status(400).json({ error: 'M-Pesa phone number is required' });
    }
    if (payoutMethod === 'BANK' && (!payoutBankName?.trim() || !payoutBankAccount?.trim())) {
      return res.status(400).json({ error: 'Bank name and account number are required' });
    }

    // Verify all members are DEVELOPER role
    const memberCheck = await db.query(
      `SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id
       WHERE u.id = ANY($1) AND r.name = 'DEVELOPER'`,
      [memberIds]
    );
    if (memberCheck.rows.length !== 3) {
      return res.status(400).json({ error: 'All team members must have the DEVELOPER role' });
    }

    // Verify no member is already in a team
    const alreadyInTeam = await db.query(
      `SELECT id, full_name FROM users WHERE id = ANY($1) AND team_id IS NOT NULL`,
      [memberIds]
    );
    if (alreadyInTeam.rows.length > 0) {
      return res.status(400).json({
        error: `Some members are already in a team: ${alreadyInTeam.rows.map((r: any) => r.full_name).join(', ')}`,
      });
    }

    // Create team
    const teamResult = await db.query(
      `INSERT INTO developer_teams
         (name, payout_method, payout_phone, payout_bank_name, payout_bank_account, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        name,
        payoutMethod,
        payoutMethod === 'MPESA' ? payoutPhone.trim() : null,
        payoutMethod === 'BANK' ? payoutBankName.trim() : null,
        payoutMethod === 'BANK' ? payoutBankAccount.trim() : null,
        createdBy,
      ]
    );
    const team = teamResult.rows[0];

    // Assign members to team
    await db.query(
      `UPDATE users SET team_id = $1 WHERE id = ANY($2)`,
      [team.id, memberIds]
    );

    logger.info('Developer team created', { teamId: team.id, memberIds, createdBy });
    return res.status(201).json({ success: true, data: team });
  } catch (error: any) {
    logger.error('Failed to create developer team', { error });
    return res.status(500).json({ error: error.message || 'Failed to create developer team' });
  }
});

/**
 * GET /api/developer-teams
 * List all developer teams (CTO, EA, CFO, CEO, CoS).
 */
router.get('/', requireRole(Role.CTO, Role.EA, Role.CFO, Role.CEO, Role.CoS), async (_req: Request, res: Response) => {
  try {
    const result = await db.query(
      `SELECT dt.*,
              json_agg(json_build_object(
                'id', u.id, 'fullName', u.full_name, 'email', u.email,
                'payoutMethod', u.payout_method, 'payoutPhone', u.payout_phone,
                'payoutBankName', u.payout_bank_name, 'payoutBankAccount', u.payout_bank_account
              )) AS members,
              ub.full_name AS approved_by_name
       FROM developer_teams dt
       LEFT JOIN users u ON u.team_id = dt.id
       LEFT JOIN users ub ON ub.id = dt.payout_approved_by
       GROUP BY dt.id, ub.full_name
       ORDER BY dt.created_at DESC`
    );
    return res.json({ success: true, data: result.rows });
  } catch (error: any) {
    logger.error('Failed to list developer teams', { error });
    return res.status(500).json({ error: 'Failed to list developer teams' });
  }
});

/**
 * POST /api/developer-teams/:id/approve-payout
 * EA or CTO approves the team's payout account.
 */
router.post('/:id/approve-payout', requireRole(Role.EA, Role.CTO), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const approverId = (req as any).user?.id;

    const result = await db.query(
      `UPDATE developer_teams
       SET payout_approved_by = $1, payout_approved_at = NOW(), updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [approverId, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Team not found' });

    logger.info('Developer team payout approved', { teamId: id, approverId });
    return res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    logger.error('Failed to approve developer team payout', { error });
    return res.status(500).json({ error: 'Failed to approve payout' });
  }
});

/**
 * PATCH /api/developer-teams/:id/payout
 * Update team payout account (CTO only, requires re-approval).
 */
router.patch('/:id/payout', requireRole(Role.CTO), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { payoutMethod, payoutPhone, payoutBankName, payoutBankAccount } = req.body;

    if (!payoutMethod) return res.status(400).json({ error: 'payoutMethod is required' });
    if (payoutMethod === 'MPESA' && !payoutPhone?.trim()) {
      return res.status(400).json({ error: 'M-Pesa phone number is required' });
    }
    if (payoutMethod === 'BANK' && (!payoutBankName?.trim() || !payoutBankAccount?.trim())) {
      return res.status(400).json({ error: 'Bank name and account number are required' });
    }

    const result = await db.query(
      `UPDATE developer_teams
       SET payout_method = $1, payout_phone = $2, payout_bank_name = $3,
           payout_bank_account = $4,
           -- Reset approval — needs re-approval after account change
           payout_approved_by = NULL, payout_approved_at = NULL,
           updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [
        payoutMethod,
        payoutMethod === 'MPESA' ? payoutPhone.trim() : null,
        payoutMethod === 'BANK' ? payoutBankName.trim() : null,
        payoutMethod === 'BANK' ? payoutBankAccount.trim() : null,
        id,
      ]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Team not found' });

    return res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    logger.error('Failed to update developer team payout', { error });
    return res.status(500).json({ error: 'Failed to update payout' });
  }
});

export default router;
