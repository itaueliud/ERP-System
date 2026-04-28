import { Router, Request, Response } from 'express';
import { paymentService } from './paymentService';
import { requireRole } from '../auth/authorizationMiddleware';
import { Role } from '../auth/authorizationService';
import { paymentScheduleService, inferPaymentType, assertPaymentWindowOpen } from './paymentScheduleService';
import { db } from '../database/connection';
import { darajaClient } from '../services/daraja';
import { config } from '../config';
import logger from '../utils/logger';
const router = Router();

// ── Sandbox Endpoints ─────────────────────────────────────────────────────────

/**
 * GET /api/payments/sandbox/status
 * Returns current sandbox mode status and test credentials.
 * Safe to expose — only contains public sandbox test values, never production secrets.
 */
router.get('/sandbox/status', (_req: Request, res: Response) => {
  const isSandbox = darajaClient.sandboxMode;
  const key = config.daraja.consumerKey;
  const secret = config.daraja.consumerSecret;
  const isPlaceholder = (v: string) => !v || v.startsWith('your_') || v === 'undefined' || v === 'null';
  const credentialsConfigured = !isPlaceholder(key) && !isPlaceholder(secret);
  return res.json({
    sandbox: isSandbox,
    apiUrl: config.daraja.apiUrl,
    shortCode: isSandbox ? (config.daraja.shortCode || '174379') : '[PRODUCTION]',
    testPhone: isSandbox ? '254708374149' : null,
    credentialsConfigured,
    message: isSandbox
      ? 'SANDBOX MODE — no real money is processed. Transactions are simulated.'
      : 'PRODUCTION MODE — real transactions are processed.',
    docsUrl: isSandbox ? 'https://developer.safaricom.co.ke' : null,
  });
});

/**
 * POST /api/payments/sandbox/simulate-webhook
 * Simulate a Daraja webhook callback for a given transaction (sandbox only).
 * Allows end-to-end testing of the payment completion flow without real M-Pesa.
 * Body: { transactionId, status: 'COMPLETED' | 'FAILED' }
 */
router.post('/sandbox/simulate-webhook', async (req: Request, res: Response) => {
  if (!darajaClient.sandboxMode) {
    return res.status(403).json({ error: 'Sandbox simulation is only available in sandbox mode' });
  }

  const { transactionId, status = 'COMPLETED' } = req.body;
  if (!transactionId) {
    return res.status(400).json({ error: 'transactionId is required' });
  }
  if (!['COMPLETED', 'FAILED'].includes(status)) {
    return res.status(400).json({ error: 'status must be COMPLETED or FAILED' });
  }

  try {
    // Build a simulated Daraja-style webhook payload
    const simulatedPayload = {
      transactionId,
      status,
      resultCode: status === 'COMPLETED' ? 0 : 1,
      resultDesc: status === 'COMPLETED' ? 'The service request is processed successfully.' : 'Sandbox simulated failure',
      sandbox: true,
    };

    // Generate a valid HMAC signature using the configured webhook secret (or bypass in sandbox)
    const crypto = await import('crypto');
    const secret = config.daraja.webhookSecret || 'sandbox_test_secret';
    const payloadStr = JSON.stringify(simulatedPayload);
    const signature = crypto.createHmac('sha256', secret).update(payloadStr).digest('hex');

    await paymentService.handleWebhook(signature, simulatedPayload);

    logger.info('[SANDBOX] Simulated webhook processed', { transactionId, status });
    return res.json({
      success: true,
      message: `[SANDBOX] Payment ${transactionId} simulated as ${status}`,
      sandbox: true,
    });
  } catch (err: any) {
    logger.error('[SANDBOX] Simulate webhook failed', { err, transactionId });
    return res.status(500).json({ error: err.message || 'Simulation failed' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/payments/webhook
 * @deprecated — webhook is now handled exclusively by webhookRouter.ts
 * mounted at /api/payments (public). This stub is kept to avoid 404s
 * if any old reference calls /api/v1/payments/webhook.
 */
router.post('/webhook', async (req: Request, res: Response) => {
  // Delegate to the shared handler via paymentService
  try {
    const payload = req.body;
    if (!payload || (!payload.Body && !payload.transactionId)) {
      return res.status(400).json({ error: 'Invalid webhook payload' });
    }
    const signature = (req.headers['x-daraja-signature'] || '') as string;
    await paymentService.handleWebhook(signature, payload);
    return res.status(200).json({ success: true });
  } catch (error: any) {
    if (error.message === 'Invalid webhook signature') {
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }
    logger.error('Webhook error (v1 route)', { error: error.message });
    return res.status(500).json({ error: 'Failed to process webhook' });
  }
});

/**
 * GET /api/payments/:transactionId
 * Get payment status by transaction ID
 * Requirements: 5.7, 5.9
 */
router.get('/:transactionId', async (req: Request, res: Response) => {
  try {
    const { transactionId } = req.params;

    if (!transactionId) {
      return res.status(400).json({
        error: 'Transaction ID is required',
      });
    }

    const payment = await paymentService.getPaymentStatus(transactionId);

    if (!payment) {
      return res.status(404).json({
        error: 'Payment not found',
      });
    }

    return res.json(payment);
  } catch (error: any) {
    logger.error('Error getting payment status', {
      error,
      transactionId: req.params.transactionId,
    });

    return res.status(500).json({
      error: 'Failed to get payment status',
    });
  }
});

/**
 * POST /api/payments/mpesa
 * Initiate M-Pesa STK Push payment
 * Requirements: 5.2, 5.6
 *
 * In sandbox auto-complete mode (DARAJA_SANDBOX_AUTO_COMPLETE=true), skips the
 * real STK push and immediately records the payment as COMPLETED — useful for
 * testing the full payment flow without a real phone or real money.
 */
router.post('/mpesa', async (req: Request, res: Response) => {
  try {
    const { phoneNumber, amount, currency, reference, description, clientId, projectId, propertyId } = req.body;

    if (!phoneNumber || !amount || !currency || !reference) {
      return res.status(400).json({
        error: 'Missing required fields: phoneNumber, amount, currency, reference',
      });
    }

    const parsedAmount = parseFloat(amount);
    if (!isFinite(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: 'amount must be a positive finite number' });
    }

    // ── Sandbox auto-complete ─────────────────────────────────────────────────
    // When DARAJA_SANDBOX_AUTO_COMPLETE=true, skip the real STK push and
    // immediately mark the payment as COMPLETED so the full flow can be tested.
    if (config.daraja.sandboxMode && process.env.DARAJA_SANDBOX_AUTO_COMPLETE === 'true') {
      const fakeCheckoutId = `SANDBOX-AUTO-${Date.now()}`;
      logger.info('[SANDBOX AUTO-COMPLETE] Skipping real STK push, marking payment COMPLETED', {
        phoneNumber, amount: parsedAmount, reference, propertyId,
      });

      // Record the payment as already completed
      const result = await db.query(
        `INSERT INTO payments
           (transaction_id, checkout_request_id, amount, currency, payment_method,
            status, client_id, project_id, property_id)
         VALUES ($1, $1, $2, $3, 'MPESA', 'COMPLETED', $4, $5, $6)
         RETURNING id, transaction_id, amount, currency, payment_method, status, created_at`,
        [fakeCheckoutId, parsedAmount, currency,
         clientId || null, projectId || null, propertyId || null]
      );

      // Immediately update marketer_properties if linked
      if (propertyId) {
        await db.query(
          `UPDATE marketer_properties
           SET payment_status = 'PAID',
               payment_confirmed_at = NOW(),
               checkout_request_id = $2,
               updated_at = NOW()
           WHERE id = $1`,
          [propertyId, fakeCheckoutId]
        ).catch(() => {});
        await db.query(
          `UPDATE marketer_properties SET status = 'PUBLISHED', updated_at = NOW()
           WHERE id = $1 AND status = 'APPROVED'`,
          [propertyId]
        ).catch(() => {});
      }

      // Activate/qualify the client lead if linked
      if (clientId) {
        try {
          const { clientService } = await import('../clients/clientService');
          // Determine payment plan from the payments record or default to FULL
          const planRow = await db.query(
            `SELECT payment_plan FROM clients WHERE id = $1`, [clientId]
          ).catch(() => ({ rows: [] }));
          const paymentPlan = planRow.rows[0]?.payment_plan || 'FULL';
          // Walk the status chain: NEW_LEAD → CONVERTED → LEAD_ACTIVATED/LEAD_QUALIFIED
          await clientService.markConverted(clientId).catch(() => {});
          if (paymentPlan === 'FULL') {
            await clientService.activateLead(clientId, fakeCheckoutId);
          } else {
            await clientService.qualifyLead(clientId, fakeCheckoutId);
          }
          logger.info('[SANDBOX AUTO-COMPLETE] Client lead status updated', { clientId, paymentPlan });
        } catch (err: any) {
          logger.warn('[SANDBOX AUTO-COMPLETE] Could not update client lead status', { clientId, err: err.message });
        }
      }

      const row = result.rows[0];
      return res.status(201).json({
        id: row.id,
        transactionId: row.transaction_id,
        status: 'COMPLETED',
        amount: parseFloat(row.amount),
        currency: row.currency,
        sandbox: true,
        autoCompleted: true,
        message: '[SANDBOX] Payment auto-completed — no real money charged.',
      });
    }
    // ─────────────────────────────────────────────────────────────────────────

    const payment = await paymentService.initiateMpesaPayment({
      phoneNumber,
      amount: parsedAmount,
      currency,
      reference,
      description,
      clientId,
      projectId,
      propertyId,
    } as any);

    return res.status(201).json(payment);
  } catch (error: any) {
    logger.error('Error initiating M-Pesa payment', { error, body: req.body });
    return res.status(400).json({
      error: error.message || 'Failed to initiate M-Pesa payment',
    });
  }
});

/**
 * POST /api/payments/airtel
 * Initiate Airtel Money payment
 * Requirements: 5.3, 5.6
 */
router.post('/airtel', async (req: Request, res: Response) => {
  try {
    const { phoneNumber, amount, currency, reference, description, clientId, projectId } = req.body;

    // Validate required fields
    if (!phoneNumber || !amount || !currency || !reference) {
      return res.status(400).json({
        error: 'Missing required fields: phoneNumber, amount, currency, reference',
      });
    }

    const payment = await paymentService.initiateAirtelPayment({
      phoneNumber,
      amount: parseFloat(amount),
      currency,
      reference,
      description,
      clientId,
      projectId,
    });

    return res.status(201).json(payment);
  } catch (error: any) {
    logger.error('Error initiating Airtel Money payment', { error, body: req.body });
    return res.status(400).json({
      error: error.message || 'Failed to initiate Airtel Money payment',
    });
  }
});

/**
 * POST /api/payments/bank-transfer
 * Initiate bank transfer payment
 * Requirements: 5.4, 5.6
 */
router.post('/bank-transfer', async (req: Request, res: Response) => {
  try {
    const { accountNumber, bankCode, amount, currency, reference, clientId, projectId } = req.body;

    // Validate required fields
    if (!accountNumber || !bankCode || !amount || !currency || !reference) {
      return res.status(400).json({
        error: 'Missing required fields: accountNumber, bankCode, amount, currency, reference',
      });
    }

    const payment = await paymentService.initiateBankTransfer({
      accountNumber,
      bankCode,
      amount: parseFloat(amount),
      currency,
      reference,
      clientId,
      projectId,
    });

    return res.status(201).json(payment);
  } catch (error: any) {
    logger.error('Error initiating bank transfer', { error, body: req.body });
    return res.status(400).json({
      error: error.message || 'Failed to initiate bank transfer',
    });
  }
});

/**
 * POST /api/payments/card
 * Initiate card payment (Visa/Mastercard)
 * Requirements: 5.5, 5.6
 */
router.post('/card', async (req: Request, res: Response) => {
  try {
    const {
      cardNumber,
      expiryMonth,
      expiryYear,
      cvv,
      cardholderName,
      amount,
      currency,
      reference,
      clientId,
      projectId,
    } = req.body;

    // Validate required fields
    if (!cardNumber || !expiryMonth || !expiryYear || !cvv || !cardholderName || !amount || !currency || !reference) {
      return res.status(400).json({
        error: 'Missing required fields: cardNumber, expiryMonth, expiryYear, cvv, cardholderName, amount, currency, reference',
      });
    }

    const payment = await paymentService.initiateCardPayment({
      cardNumber,
      expiryMonth,
      expiryYear,
      cvv,
      cardholderName,
      amount: parseFloat(amount),
      currency,
      reference,
      clientId,
      projectId,
    });

    return res.status(201).json(payment);
  } catch (error: any) {
    // Never log req.body here — it contains card details (PCI-DSS)
    logger.error('Error initiating card payment', { error: error.message });
    return res.status(400).json({
      error: error.message || 'Failed to initiate card payment',
    });
  }
});

/**
 * POST /api/payments/:transactionId/retry
 * Retry a failed payment
 * Requirements: 4.9
 */
router.post('/:transactionId/retry', async (req: Request, res: Response) => {
  try {
    const { transactionId } = req.params;

    if (!transactionId) {
      return res.status(400).json({
        error: 'Transaction ID is required',
      });
    }

    const payment = await paymentService.retryPayment(transactionId);

    return res.json(payment);
  } catch (error: any) {
    logger.error('Error retrying payment', {
      error,
      transactionId: req.params.transactionId,
    });

    return res.status(400).json({
      error: error.message || 'Failed to retry payment',
    });
  }
});

/**
 * POST /api/payments/approvals
 * Create payment approval request.
 * Only COO, CTO, HEAD_OF_TRAINERS, OPERATIONS_USER, TECH_STAFF, CFO_ASSISTANT can submit.
 * CEO, CoS, CFO, EA, TRAINER, AGENT, DEVELOPER cannot submit.
 * Requirements: 7.1
 */
router.post('/approvals', requireRole(
  Role.COO, Role.CTO,
  Role.HEAD_OF_TRAINERS,
  Role.OPERATIONS_USER, Role.TECH_STAFF,
  Role.CFO_ASSISTANT
), async (req: Request, res: Response) => {
  try {
    const { projectId, amount, purpose } = req.body;
    const requesterId = (req as any).user?.id;
    const requesterRole = (req as any).user?.role || '';

    if (!amount || !purpose) {
      return res.status(400).json({
        error: 'Missing required fields: amount, purpose',
      });
    }

    const paymentType = inferPaymentType(requesterRole, purpose);

    const approval = await paymentService.createApprovalRequest(
      projectId || null,
      parseFloat(amount),
      purpose,
      requesterId,
      paymentType
    );

    return res.status(201).json(approval);
  } catch (error: any) {
    logger.error('Error creating payment approval request', { error, body: req.body });
    return res.status(400).json({
      error: error.message || 'Failed to create payment approval request',
    });
  }
});

/**
 * GET /api/payments/approvals/pending
 * Get pending approvals (for CFO dashboard)
 * Requirements: 7.2, 7.10
 */
router.get('/approvals/pending', requireRole(Role.CFO, Role.CoS, Role.CEO, Role.EA), async (_req: Request, res: Response) => {
  try {
    const approvals = await paymentService.getPendingApprovals();
    return res.json(approvals);
  } catch (error: any) {
    logger.error('Error getting pending approvals', { error });
    return res.status(500).json({
      error: 'Failed to get pending approvals',
    });
  }
});

/**
 * GET /api/payments/approvals/approved-pending-execution
 * Get approved pending execution (for EA dashboard)
 * Requirements: 7.5, 7.10
 */
router.get('/approvals/approved-pending-execution', requireRole(Role.CFO, Role.CoS, Role.CEO, Role.EA), async (_req: Request, res: Response) => {
  try {
    const approvals = await paymentService.getApprovedPendingExecution();
    return res.json(approvals);
  } catch (error: any) {
    logger.error('Error getting approved pending execution', { error });
    return res.status(500).json({
      error: 'Failed to get approved pending execution',
    });
  }
});

/**
 * GET /api/payments/approvals/overdue
 * Get overdue approvals (pending for more than 48 hours)
 * Requirements: 7.8
 */
router.get('/approvals/overdue', requireRole(Role.CFO, Role.CoS, Role.CEO, Role.EA), async (_req: Request, res: Response) => {
  try {
    const approvals = await paymentService.getOverdueApprovals();
    return res.json(approvals);
  } catch (error: any) {
    logger.error('Error getting overdue approvals', { error });
    return res.status(500).json({
      error: 'Failed to get overdue approvals',
    });
  }
});

/**
 * GET /api/payments/approvals/:approvalId
 * Get payment approval by ID
 */
router.get('/approvals/:approvalId', requireRole(Role.CFO, Role.CoS, Role.CEO, Role.EA, Role.COO, Role.CTO, Role.HEAD_OF_TRAINERS, Role.OPERATIONS_USER, Role.TECH_STAFF, Role.CFO_ASSISTANT), async (req: Request, res: Response) => {
  try {
    const { approvalId } = req.params;

    if (!approvalId) {
      return res.status(400).json({
        error: 'Approval ID is required',
      });
    }

    const approval = await paymentService.getApproval(approvalId);

    if (!approval) {
      return res.status(404).json({
        error: 'Payment approval not found',
      });
    }

    return res.json(approval);
  } catch (error: any) {
    logger.error('Error getting payment approval', {
      error,
      approvalId: req.params.approvalId,
    });

    return res.status(500).json({
      error: 'Failed to get payment approval',
    });
  }
});

/**
 * POST /api/payments/approvals/:approvalId/approve
 * Approve payment — CFO, CoS, CEO only.
 * CFO can also execute (dual role). CoS and CEO can approve but not execute directly.
 * Requirements: 7.2, 7.3
 */
router.post('/approvals/:approvalId/approve', requireRole(Role.CFO, Role.CoS, Role.CEO), async (req: Request, res: Response) => {
  try {
    const { approvalId } = req.params;
    const approverId = (req as any).user?.id || req.body.approverId;

    if (!approvalId) {
      return res.status(400).json({
        error: 'Approval ID is required',
      });
    }

    if (!approverId) {
      return res.status(400).json({
        error: 'Approver ID is required',
      });
    }

    const approval = await paymentService.approvePayment(approvalId, approverId);

    return res.json(approval);
  } catch (error: any) {
    logger.error('Error approving payment', {
      error,
      approvalId: req.params.approvalId,
      body: req.body,
    });

    return res.status(400).json({
      error: error.message || 'Failed to approve payment',
    });
  }
});

/**
 * POST /api/payments/approvals/:approvalId/reject
 * Reject payment — CFO, CoS, CEO only.
 * Requirements: 7.4
 */
router.post('/approvals/:approvalId/reject', requireRole(Role.CFO, Role.CoS, Role.CEO), async (req: Request, res: Response) => {
  try {
    const { approvalId } = req.params;
    const approverId = (req as any).user?.id || req.body.approverId;
    const { reason } = req.body;

    if (!approvalId) {
      return res.status(400).json({ error: 'Approval ID is required' });
    }
    if (!reason) {
      return res.status(400).json({ error: 'Rejection reason is required' });
    }

    const approval = await paymentService.rejectPayment(approvalId, approverId, reason);

    return res.json(approval);
  } catch (error: any) {
    logger.error('Error rejecting payment', {
      error,
      approvalId: req.params.approvalId,
      body: req.body,
    });

    return res.status(400).json({
      error: error.message || 'Failed to reject payment',
    });
  }
});

/**
 * POST /api/payments/approvals/:approvalId/execute
 * Execute payment — CFO, CoS, CEO only.
 * CFO can both approve AND execute (no separation of duties restriction for CFO).
 * Requirements: 7.5, 7.6, 7.7
 */
router.post('/approvals/:approvalId/execute', requireRole(Role.CFO, Role.CoS, Role.CEO), async (req: Request, res: Response) => {
  try {
    const { approvalId } = req.params;
    const executorId = (req as any).user?.id;
    const executorRole = (req as any).user?.role;
    const { paymentDetails } = req.body;

    if (!approvalId) {
      return res.status(400).json({ error: 'Approval ID is required' });
    }

    // Normalise paymentMethod — frontend may send 'method' or 'paymentMethod'
    const details = paymentDetails || {};
    const normalised = {
      ...details,
      paymentMethod: details.paymentMethod || details.method || 'BANK_TRANSFER',
    };

    // Enforce payment schedule window if this approval has a scheduled type
    const approvalCheck = await db.query(
      `SELECT payment_type FROM payment_approvals WHERE id = $1`,
      [approvalId]
    );
    if (approvalCheck.rows.length > 0) {
      const paymentType = approvalCheck.rows[0].payment_type || 'GENERAL';
      try {
        assertPaymentWindowOpen(paymentType);
      } catch (windowErr: any) {
        return res.status(400).json({ error: windowErr.message });
      }
    }

    const result = await paymentService.executePayment(approvalId, executorId, normalised, executorRole);

    return res.json(result);
  } catch (error: any) {
    logger.error('Error executing payment', {
      error,
      approvalId: req.params.approvalId,
      body: req.body,
    });

    return res.status(400).json({
      error: error.message || 'Failed to execute payment',
    });
  }
});

/**
 * GET /api/payments/schedule
 * Get upcoming payment schedule windows (CFO, CoS, CEO).
 */
router.get('/schedule', requireRole(Role.CFO, Role.CoS, Role.CEO), (_req: Request, res: Response) => {
  return res.json({
    success: true,
    data: paymentScheduleService.getUpcomingPaymentSchedule(),
  });
});

/**
 * GET /api/payments/agents
 * CFO-only: all agents with commission data for Friday payout processing.
 */
router.get('/agents', requireRole(Role.CFO, Role.CoS, Role.CEO), async (_req: Request, res: Response) => {
  try {
    const agents = await paymentScheduleService.getAgentsForCFO();
    return res.json({ success: true, data: agents });
  } catch (error: any) {
    logger.error('Failed to get agents for CFO', { error });
    return res.status(500).json({ error: 'Failed to get agent data' });
  }
});

/**
 * POST /api/payments/approvals/:approvalId/approve-developer
 * EA or CTO approves a developer team payment.
 */
router.post('/approvals/:approvalId/approve-developer',
  requireRole(Role.EA, Role.CTO),
  async (req: Request, res: Response) => {
    try {
      const { approvalId } = req.params;
      const approverId = (req as any).user?.id;

      // Verify this is a DEVELOPER_PAYMENT type
      const check = await db.query(
        `SELECT id, payment_type FROM payment_approvals WHERE id = $1`,
        [approvalId]
      );
      if (check.rows.length === 0) {
        return res.status(404).json({ error: 'Payment approval not found' });
      }
      if (check.rows[0].payment_type !== 'DEVELOPER_PAYMENT') {
        return res.status(400).json({ error: 'This endpoint is only for DEVELOPER_PAYMENT type approvals' });
      }

      const approval = await paymentService.approvePayment(approvalId, approverId);
      logger.info('Developer payment approved', { approvalId, approverId });
      return res.json(approval);
    } catch (error: any) {
      logger.error('Error approving developer payment', { error });
      return res.status(400).json({ error: error.message || 'Failed to approve developer payment' });
    }
  }
);

export default router;
