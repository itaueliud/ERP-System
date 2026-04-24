import { Router, Request, Response } from 'express';
import { paymentService } from './paymentService';
import { requireRole } from '../auth/authorizationMiddleware';
import { Role } from '../auth/authorizationService';
import logger from '../utils/logger';

const router = Router();

/**
 * POST /api/payments/webhook
 * Handle Jenga API webhook callbacks
 * Requirements: 5.11, 5.12
 * 
 * This endpoint receives payment status updates from Jenga API.
 * It verifies the webhook signature using HMAC-SHA256 and processes
 * payment status updates (PENDING, COMPLETED, FAILED, REFUNDED).
 */
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    // Extract signature from header
    const signature = req.headers['x-jenga-signature'] as string;

    if (!signature) {
      logger.error('Webhook signature missing', { headers: req.headers });
      return res.status(400).json({
        error: 'Missing webhook signature',
      });
    }

    // Get raw body as string for signature verification
    const payload = req.body;

    // Validate payload structure
    if (!payload.transactionId || !payload.status) {
      logger.error('Invalid webhook payload structure', { payload });
      return res.status(400).json({
        error: 'Invalid webhook payload',
      });
    }

    // Handle webhook and verify signature
    try {
      await paymentService.handleWebhook(signature, payload);

      logger.info('Webhook processed successfully', {
        transactionId: payload.transactionId,
        status: payload.status,
      });

      // Return 200 OK to acknowledge receipt
      return res.status(200).json({
        success: true,
        message: 'Webhook processed successfully',
      });
    } catch (error: any) {
      // If signature verification fails, log security alert
      if (error.message === 'Invalid webhook signature') {
        logger.error('SECURITY ALERT: Invalid webhook signature detected', {
          signature,
          payload,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        });

        return res.status(401).json({
          error: 'Invalid webhook signature',
        });
      }

      throw error;
    }
  } catch (error: any) {
    logger.error('Webhook processing error', {
      error,
      body: req.body,
      headers: req.headers,
    });

    return res.status(500).json({
      error: 'Failed to process webhook',
    });
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
 */
router.post('/mpesa', async (req: Request, res: Response) => {
  try {
    const { phoneNumber, amount, currency, reference, description, clientId, projectId } = req.body;

    // Validate required fields
    if (!phoneNumber || !amount || !currency || !reference) {
      return res.status(400).json({
        error: 'Missing required fields: phoneNumber, amount, currency, reference',
      });
    }

    const payment = await paymentService.initiateMpesaPayment({
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
    logger.error('Error initiating card payment', { error, body: req.body });
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
 * Create payment approval request
 * Requirements: 7.1
 */
router.post('/approvals', async (req: Request, res: Response) => {
  try {
    const { projectId, amount, purpose, requesterId } = req.body;

    if (!projectId || !amount || !purpose || !requesterId) {
      return res.status(400).json({
        error: 'Missing required fields: projectId, amount, purpose, requesterId',
      });
    }

    const approval = await paymentService.createApprovalRequest(
      projectId,
      parseFloat(amount),
      purpose,
      requesterId
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
router.get('/approvals/pending', async (_req: Request, res: Response) => {
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
router.get('/approvals/approved-pending-execution', async (_req: Request, res: Response) => {
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
router.get('/approvals/overdue', async (_req: Request, res: Response) => {
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
router.get('/approvals/:approvalId', async (req: Request, res: Response) => {
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
 * Approve payment — CFO ONLY (doc §9: CFO cannot execute. EA cannot approve. Hard-coded at API level.)
 * Requirements: 7.2, 7.3
 */
router.post('/approvals/:approvalId/approve', requireRole(Role.CFO), async (req: Request, res: Response) => {
  try {
    const { approvalId } = req.params;
    const { approverId } = req.body;

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
 * Reject payment — CFO ONLY (doc §9: hard-coded role restriction at API level)
 * Requirements: 7.4
 */
router.post('/approvals/:approvalId/reject', requireRole(Role.CFO), async (req: Request, res: Response) => {
  try {
    const { approvalId } = req.params;
    const { approverId, reason } = req.body;

    if (!approvalId) {
      return res.status(400).json({
        error: 'Approval ID is required',
      });
    }

    if (!approverId || !reason) {
      return res.status(400).json({
        error: 'Approver ID and rejection reason are required',
      });
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
 * Execute payment — EA only (doc §19: EA executes, CFO cannot execute — hard-coded)
 * Requirements: 7.5, 7.6, 7.7
 */
router.post('/approvals/:approvalId/execute', requireRole(Role.EA), async (req: Request, res: Response) => {
  try {
    const { approvalId } = req.params;
    const { executorId, paymentDetails } = req.body;

    if (!approvalId) {
      return res.status(400).json({
        error: 'Approval ID is required',
      });
    }

    if (!executorId || !paymentDetails) {
      return res.status(400).json({
        error: 'Executor ID and payment details are required',
      });
    }

    const result = await paymentService.executePayment(approvalId, executorId, paymentDetails);

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

export default router;
