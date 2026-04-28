/**
 * Dedicated public webhook router for Daraja (Safaricom M-Pesa) callbacks.
 * Only the /webhook endpoint is exposed here — no other payment routes.
 * Mounted at /api/payments (no JWT required — Safaricom cannot send auth headers).
 */
import { Router, Request, Response } from 'express';
import { paymentService } from './paymentService';
import logger from '../utils/logger';

export const webhookRouter = Router();

/**
 * POST /api/payments/webhook
 * Handle Daraja API webhook callbacks (STK Push & B2C results).
 * Signature verification is always attempted; unsigned callbacks are rejected
 * unless the webhook secret is not configured (sandbox fallback).
 */
webhookRouter.post('/webhook', async (req: Request, res: Response) => {
  try {
    const payload = req.body;

    if (!payload || (!payload.Body && !payload.transactionId)) {
      logger.warn('Webhook rejected: invalid payload structure', { ip: req.ip });
      return res.status(400).json({ error: 'Invalid webhook payload' });
    }

    const signature = (req.headers['x-daraja-signature'] || '') as string;

    // Always call handleWebhook — it internally verifies the signature.
    // When no secret is configured (sandbox), verification is skipped inside the service.
    try {
      await paymentService.handleWebhook(signature, payload);
    } catch (error: any) {
      if (error.message === 'Invalid webhook signature') {
        logger.error('SECURITY ALERT: Invalid webhook signature', {
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        });
        return res.status(401).json({ error: 'Invalid webhook signature' });
      }
      throw error;
    }

    logger.info('Webhook processed successfully');
    return res.status(200).json({ success: true });
  } catch (error: any) {
    logger.error('Webhook processing error', { error: error.message });
    return res.status(500).json({ error: 'Failed to process webhook' });
  }
});
