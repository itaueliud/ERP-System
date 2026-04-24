/**
 * Webhook Delivery Service
 * Handles webhook delivery with retry logic, logging, and auto-disable on repeated failures.
 * Requirements: 45.7-45.10
 */

import axios from 'axios';
import { db } from '../database/connection';
import logger from '../utils/logger';
import { withRetry } from '../utils/retryHandler';
import { webhookService } from './webhookService';
import type { WebhookEvent } from './webhookService';

// ============================================================================
// Types
// ============================================================================

export interface DeliveryResult {
  success: boolean;
  statusCode?: number;
  responseBody?: string;
  error?: string;
  attemptCount: number;
  deliveredAt: Date;
}

export interface WebhookDeliveryLog {
  id: string;
  webhookId: string;
  eventType: string;
  statusCode?: number;
  success: boolean;
  error?: string;
  attemptCount: number;
  createdAt: Date;
}

const MAX_CONSECUTIVE_FAILURES = 10;
const MAX_RETRY_ATTEMPTS = 3;
const TEST_EVENT_TYPE = 'test';

// ============================================================================
// Service
// ============================================================================

export class WebhookDeliveryService {
  /**
   * Deliver a webhook event with retry logic (up to 3 attempts, exponential backoff).
   * Logs each attempt and disables the webhook after 10 consecutive failures.
   * Requirements: 45.7, 45.8, 45.9
   */
  async deliver(
    webhookId: string,
    eventType: WebhookEvent,
    payload: Record<string, any>
  ): Promise<DeliveryResult> {
    const webhooks = await db.query<any>(
      `SELECT id, url, secret, active FROM webhooks WHERE id = $1`,
      [webhookId]
    );

    if (webhooks.rows.length === 0) {
      return {
        success: false,
        error: 'Webhook not found',
        attemptCount: 0,
        deliveredAt: new Date(),
      };
    }

    const webhook = webhooks.rows[0];

    if (!webhook.active) {
      return {
        success: false,
        error: 'Webhook is disabled',
        attemptCount: 0,
        deliveredAt: new Date(),
      };
    }

    const webhookPayload = {
      event: eventType,
      timestamp: new Date().toISOString(),
      data: payload,
    };
    const payloadString = JSON.stringify(webhookPayload);
    const signature = webhookService.signPayload(payloadString, webhook.secret);

    let attemptCount = 0;
    let result: DeliveryResult;

    try {
      let statusCode: number | undefined;
      let responseBody: string | undefined;

      await withRetry(
        async () => {
          attemptCount++;
          const response = await axios.post(webhook.url, payloadString, {
            headers: {
              'Content-Type': 'application/json',
              'X-Webhook-Signature': `sha256=${signature}`,
              'X-Webhook-Event': eventType,
            },
            timeout: 10000,
          });
          statusCode = response.status;
          responseBody = typeof response.data === 'string'
            ? response.data
            : JSON.stringify(response.data);
        },
        { maxAttempts: MAX_RETRY_ATTEMPTS }
      );

      result = {
        success: true,
        statusCode,
        responseBody,
        attemptCount,
        deliveredAt: new Date(),
      };

      logger.info('Webhook delivered successfully', { webhookId, eventType, attemptCount });
    } catch (error: any) {
      const statusCode = error?.response?.status;
      const errMessage = error instanceof Error ? error.message : String(error);

      result = {
        success: false,
        statusCode,
        error: errMessage,
        attemptCount,
        deliveredAt: new Date(),
      };

      logger.error('Webhook delivery failed after retries', {
        webhookId,
        eventType,
        attemptCount,
        error: errMessage,
      });
    }

    await this.logDelivery(webhookId, eventType, result);

    if (!result.success) {
      const consecutiveFailures = await this.getConsecutiveFailureCount(webhookId);
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        await this.disableWebhook(
          webhookId,
          `Auto-disabled after ${MAX_CONSECUTIVE_FAILURES} consecutive failures`
        );
      }
    }

    return result;
  }

  /**
   * Send a test payload to the webhook endpoint to verify it's reachable.
   * Requirements: 45.10
   */
  async testWebhook(webhookId: string): Promise<DeliveryResult> {
    const webhooks = await db.query<any>(
      `SELECT id, url, secret FROM webhooks WHERE id = $1`,
      [webhookId]
    );

    if (webhooks.rows.length === 0) {
      return {
        success: false,
        error: 'Webhook not found',
        attemptCount: 0,
        deliveredAt: new Date(),
      };
    }

    const webhook = webhooks.rows[0];
    const testPayload = {
      event: TEST_EVENT_TYPE,
      timestamp: new Date().toISOString(),
      data: { message: 'This is a test webhook delivery' },
    };
    const payloadString = JSON.stringify(testPayload);
    const signature = webhookService.signPayload(payloadString, webhook.secret);

    let statusCode: number | undefined;
    let responseBody: string | undefined;
    let error: string | undefined;
    let success = false;

    try {
      const response = await axios.post(webhook.url, payloadString, {
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': `sha256=${signature}`,
          'X-Webhook-Event': TEST_EVENT_TYPE,
        },
        timeout: 10000,
      });
      statusCode = response.status;
      responseBody = typeof response.data === 'string'
        ? response.data
        : JSON.stringify(response.data);
      success = true;
      logger.info('Webhook test delivery succeeded', { webhookId });
    } catch (err: any) {
      statusCode = err?.response?.status;
      error = err instanceof Error ? err.message : String(err);
      logger.warn('Webhook test delivery failed', { webhookId, error });
    }

    const result: DeliveryResult = {
      success,
      statusCode,
      responseBody,
      error,
      attemptCount: 1,
      deliveredAt: new Date(),
    };

    await this.logDelivery(webhookId, TEST_EVENT_TYPE, result);

    return result;
  }

  /**
   * Retrieve delivery logs for a webhook, most recent first.
   * Requirements: 45.8
   */
  async getDeliveryLogs(webhookId: string, limit = 50): Promise<WebhookDeliveryLog[]> {
    const result = await db.query<any>(
      `SELECT id, webhook_id, event_type, status_code, success, error, attempt_count, created_at
       FROM webhook_delivery_logs
       WHERE webhook_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [webhookId, limit]
    );

    return result.rows.map((row) => this.mapLogFromDb(row));
  }

  /**
   * Count consecutive failures for a webhook (from most recent logs).
   * Requirements: 45.9
   */
  async getConsecutiveFailureCount(webhookId: string): Promise<number> {
    const result = await db.query<any>(
      `SELECT success
       FROM webhook_delivery_logs
       WHERE webhook_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [webhookId, MAX_CONSECUTIVE_FAILURES + 1]
    );

    let count = 0;
    for (const row of result.rows) {
      if (!row.success) {
        count++;
      } else {
        break;
      }
    }
    return count;
  }

  /**
   * Disable a webhook with a reason.
   * Requirements: 45.9
   */
  async disableWebhook(webhookId: string, reason: string): Promise<void> {
    await db.query(
      `UPDATE webhooks SET active = FALSE WHERE id = $1`,
      [webhookId]
    );
    logger.warn('Webhook disabled', { webhookId, reason });
  }

  // ============================================================================
  // Private helpers
  // ============================================================================

  private async logDelivery(
    webhookId: string,
    eventType: string,
    result: DeliveryResult
  ): Promise<void> {
    try {
      await db.query(
        `INSERT INTO webhook_delivery_logs
           (webhook_id, event_type, status_code, success, error, attempt_count)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          webhookId,
          eventType,
          result.statusCode ?? null,
          result.success,
          result.error ?? null,
          result.attemptCount,
        ]
      );
    } catch (err) {
      logger.error('Failed to log webhook delivery', {
        webhookId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private mapLogFromDb(row: any): WebhookDeliveryLog {
    return {
      id: row.id,
      webhookId: row.webhook_id,
      eventType: row.event_type,
      statusCode: row.status_code ?? undefined,
      success: row.success,
      error: row.error ?? undefined,
      attemptCount: row.attempt_count,
      createdAt: row.created_at,
    };
  }
}

export const webhookDeliveryService = new WebhookDeliveryService();
export default webhookDeliveryService;
