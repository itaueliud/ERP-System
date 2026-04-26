import { Router, Request, Response } from 'express';
import { requireRole } from '../auth/authorizationMiddleware';
import { Role } from '../auth/authorizationService';
import { db } from '../database/connection';
import { darajaClient } from '../services/daraja';
import logger from '../utils/logger';

const router = Router();

/**
 * GET /api/v1/staff-payments/eligible
 * List all payable staff with their payout details for the CFO to select.
 */
router.get(
  '/eligible',
  requireRole(Role.CFO, Role.CEO, Role.CoS),
  async (_req: Request, res: Response) => {
    try {
      const result = await db.query(`
        SELECT u.id, u.full_name, u.email, u.phone,
               r.name AS role,
               u.payout_method, u.payout_phone, u.payout_bank_name, u.payout_bank_account
        FROM users u
        JOIN roles r ON r.id = u.role_id
        WHERE r.name IN (
          'CFO','COO','CTO','EA','HEAD_OF_TRAINERS','TRAINER',
          'AGENT','DEVELOPER','OPERATIONS_USER','TECH_STAFF','CFO_ASSISTANT'
        )
        AND u.is_active = TRUE
        ORDER BY r.name, u.full_name
      `);
      return res.json({ success: true, data: result.rows });
    } catch (err: any) {
      logger.error('Failed to list eligible staff', { err });
      return res.status(500).json({ success: false, error: 'Failed to fetch staff' });
    }
  }
);

/**
 * GET /api/v1/staff-payments/runs
 * List past payment runs.
 */
router.get(
  '/runs',
  requireRole(Role.CFO, Role.CEO, Role.CoS),
  async (_req: Request, res: Response) => {
    try {
      const result = await db.query(`
        SELECT r.id, r.label, r.payment_type, r.total_amount, r.status,
               r.executed_at, r.created_at,
               u.full_name AS initiated_by_name,
               COUNT(i.id) AS item_count,
               COUNT(i.id) FILTER (WHERE i.status = 'PAID') AS paid_count,
               COUNT(i.id) FILTER (WHERE i.status = 'FAILED') AS failed_count
        FROM staff_payment_runs r
        JOIN users u ON u.id = r.initiated_by
        LEFT JOIN staff_payment_items i ON i.run_id = r.id
        GROUP BY r.id, u.full_name
        ORDER BY r.created_at DESC
        LIMIT 50
      `);
      return res.json({ success: true, data: result.rows });
    } catch (err: any) {
      logger.error('Failed to list payment runs', { err });
      return res.status(500).json({ success: false, error: 'Failed to fetch runs' });
    }
  }
);

/**
 * GET /api/v1/staff-payments/runs/:runId
 * Get items for a specific run.
 */
router.get(
  '/runs/:runId',
  requireRole(Role.CFO, Role.CEO, Role.CoS),
  async (req: Request, res: Response) => {
    try {
      const { runId } = req.params;
      const runRes = await db.query(
        `SELECT r.*, u.full_name AS initiated_by_name
         FROM staff_payment_runs r JOIN users u ON u.id = r.initiated_by
         WHERE r.id = $1`, [runId]
      );
      if (!runRes.rows.length) return res.status(404).json({ success: false, error: 'Run not found' });

      const itemsRes = await db.query(`
        SELECT i.*, u.full_name, u.email, r.name AS role
        FROM staff_payment_items i
        JOIN users u ON u.id = i.user_id
        JOIN roles r ON r.id = u.role_id
        WHERE i.run_id = $1
        ORDER BY u.full_name
      `, [runId]);

      return res.json({ success: true, data: { run: runRes.rows[0], items: itemsRes.rows } });
    } catch (err: any) {
      logger.error('Failed to get run details', { err });
      return res.status(500).json({ success: false, error: 'Failed to fetch run' });
    }
  }
);

/**
 * POST /api/v1/staff-payments/runs
 * Create and immediately execute a payment run.
 * Body: { label, paymentType, items: [{ userId, amount }] }
 */
router.post(
  '/runs',
  requireRole(Role.CFO, Role.CEO, Role.CoS),
  async (req: Request, res: Response) => {
    const initiator = (req as any).user;
    const { label, paymentType = 'SALARY', items } = req.body;

    if (!label?.trim()) return res.status(400).json({ success: false, error: 'Label is required' });
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'At least one staff member must be selected' });
    }
    for (const item of items) {
      if (!item.userId) return res.status(400).json({ success: false, error: 'Each item needs a userId' });
      if (!item.amount || Number(item.amount) <= 0) {
        return res.status(400).json({ success: false, error: `Amount must be > 0 for user ${item.userId}` });
      }
    }

    try {
      // Fetch payout details for all selected users in one query
      const userIds = items.map((i: any) => i.userId);
      const usersRes = await db.query(
        `SELECT u.id, u.full_name, u.payout_method, u.payout_phone, u.payout_bank_account
         FROM users u WHERE u.id = ANY($1)`,
        [userIds]
      );
      const userMap: Record<string, any> = {};
      for (const u of usersRes.rows) userMap[u.id] = u;

      // Validate all have payout details
      for (const item of items) {
        const u = userMap[item.userId];
        if (!u) return res.status(400).json({ success: false, error: `User ${item.userId} not found` });
        if (!u.payout_method) {
          return res.status(400).json({
            success: false,
            error: `${u.full_name} has no payout details set. Update in Staff Payout Details first.`,
          });
        }
        const account = u.payout_method === 'MPESA' ? u.payout_phone : u.payout_bank_account;
        if (!account) {
          return res.status(400).json({
            success: false,
            error: `${u.full_name} is missing payout account number.`,
          });
        }
      }

      const totalAmount = items.reduce((sum: number, i: any) => sum + Number(i.amount), 0);

      // Create the run record
      const runRes = await db.query(
        `INSERT INTO staff_payment_runs (label, payment_type, total_amount, status, initiated_by)
         VALUES ($1, $2, $3, 'PROCESSING', $4) RETURNING id`,
        [label.trim(), paymentType, totalAmount, initiator.id]
      );
      const runId = runRes.rows[0].id;

      // Insert items and process payments
      let paidCount = 0;
      let failedCount = 0;

      for (const item of items) {
        const u = userMap[item.userId];
        const amount = Number(item.amount);
        const payoutMethod = u.payout_method;
        const payoutAccount = payoutMethod === 'MPESA' ? u.payout_phone : u.payout_bank_account;

        // Insert item as PROCESSING
        const itemRes = await db.query(
          `INSERT INTO staff_payment_items
             (run_id, user_id, amount, payout_method, payout_account, status)
           VALUES ($1, $2, $3, $4, $5, 'PROCESSING') RETURNING id`,
          [runId, item.userId, amount, payoutMethod, payoutAccount]
        );
        const itemId = itemRes.rows[0].id;

        try {
          const reference = `STAFF-${runId.slice(0, 8)}-${itemId.slice(0, 8)}`;
          let txnId: string;

          if (payoutMethod === 'MPESA') {
            // B2C via Daraja — send money to staff M-Pesa
            const resp = await darajaClient.initiateBankTransfer(
              payoutAccount, 'MPESA', amount, 'KES', reference
            );
            txnId = resp.transactionId || resp.requestId;
          } else {
            // Bank transfer
            const resp = await darajaClient.initiateBankTransfer(
              payoutAccount, 'BANK', amount, 'KES', reference
            );
            txnId = resp.transactionId || resp.requestId;
          }

          await db.query(
            `UPDATE staff_payment_items
             SET status = 'PAID', transaction_id = $1, paid_at = NOW()
             WHERE id = $2`,
            [txnId, itemId]
          );
          paidCount++;
        } catch (payErr: any) {
          logger.error('Staff payment item failed', { payErr, itemId, userId: item.userId });
          await db.query(
            `UPDATE staff_payment_items SET status = 'FAILED', failure_reason = $1 WHERE id = $2`,
            [payErr.message || 'Payment failed', itemId]
          );
          failedCount++;
        }
      }

      // Update run status
      const finalStatus = failedCount === 0 ? 'COMPLETED' : paidCount === 0 ? 'FAILED' : 'PARTIAL';
      await db.query(
        `UPDATE staff_payment_runs SET status = $1, executed_at = NOW(), updated_at = NOW() WHERE id = $2`,
        [finalStatus, runId]
      );

      logger.info('Staff payment run completed', { runId, paidCount, failedCount, finalStatus });

      return res.status(201).json({
        success: true,
        data: { runId, status: finalStatus, paidCount, failedCount, totalAmount },
      });
    } catch (err: any) {
      logger.error('Staff payment run failed', { err });
      return res.status(500).json({ success: false, error: err.message || 'Payment run failed' });
    }
  }
);

export default router;
